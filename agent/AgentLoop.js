import { io }             from 'socket.io-client';
import { TOOLS, SYSTEM_PROMPT } from './tools.js';
import { buildObsPrompt } from './prompt.js';
import { executeSwap }    from './wallet.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Step one tile toward (toX,toY), respecting blocked directions.
function stepToward(fromX, fromY, toX, toY, blocked) {
  const dx = toX - fromX, dy = toY - fromY;
  if (dx === 0 && dy === 0) return null;
  const blockedSet = new Set(blocked ?? []);
  const candidates = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    candidates.push(dx > 0 ? 'right' : 'left');
    candidates.push(dy > 0 ? 'down'  : 'up');
    candidates.push(dy > 0 ? 'up'    : 'down');
    candidates.push(dx > 0 ? 'left'  : 'right');
  } else {
    candidates.push(dy > 0 ? 'down'  : 'up');
    candidates.push(dx > 0 ? 'right' : 'left');
    candidates.push(dx > 0 ? 'left'  : 'right');
    candidates.push(dy > 0 ? 'up'    : 'down');
  }
  for (const dir of candidates) {
    if (!blockedSet.has(dir)) return `move_${dir}`;
  }
  return 'wait';
}

function dirFromDelta(dx, dy) {
  if (dx === 1  && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0  && dy === 1) return 'down';
  if (dx === 0  && dy === -1) return 'up';
  return null;
}

export class AgentLoop {
  constructor({ serverUrl, provider, agentId, wallet }) {
    this._serverUrl = serverUrl;
    this._provider  = provider;
    this._agentId   = agentId;
    this._wallet    = wallet ?? null;
    this._socket    = null;
    this._snapshot  = null;
    this._running   = false;
    // Resolves the pending _act() promise when a new observation arrives
    this._obsResolve = null;
  }

  start() {
    this._socket = io(this._serverUrl, { reconnectionAttempts: Infinity });

    this._socket.on('connect', () => {
      console.log(`[Agent:${this._agentId}] connected`);
      this._socket.emit('agent:register', {
        agentId:       this._agentId,
        walletAddress: this._wallet?.address ?? null,
      });
      this._running = true;
      this._loop();
    });

    this._socket.on('server:observation', snap => {
      this._snapshot = snap;
      if (this._obsResolve) {
        const resolve = this._obsResolve;
        this._obsResolve = null;
        resolve(snap);
      }
    });

    this._socket.on('disconnect', () => {
      console.log(`[Agent:${this._agentId}] disconnected`);
      this._running = false;
    });

    this._socket.on('connect_error', err => {
      console.error(`[Agent:${this._agentId}] connect error:`, err.message);
    });
  }

  stop() {
    this._running = false;
    this._socket?.disconnect();
  }

  // ── Main loop ────────────────────────────────────────────────────────────────

  async _loop() {
    while (this._running) {
      // Wait for first observation
      if (!this._snapshot) { await sleep(200); continue; }
      try {
        await this._runSession();
      } catch (err) {
        console.error(`[Agent:${this._agentId}] session error:`, err.message);
      }
      await sleep(500); // brief pause between sessions
    }
  }

  // ── Session: LLM calls tools until done() ───────────────────────────────────

  async _runSession() {
    const snap = this._snapshot;
    const { tileX, tileY, hp, energy, zone } = snap.player;
    console.log(`\n[Agent:${this._agentId}] ── new session ── pos=(${tileX},${tileY}) hp=${hp} en=${energy} GGLD=${snap.goldBalance ?? '?'} zone=${zone}`);

    const messages = [{ role: 'user', content: buildObsPrompt(snap) }];
    let toolCallCount = 0;

    while (this._running) {
      if (toolCallCount >= 60) {
        console.log(`[Agent:${this._agentId}] session limit reached, ending`);
        break;
      }

      const response = await this._provider.completeWithTools(SYSTEM_PROMPT, messages, TOOLS);
      messages.push({ role: 'assistant', content: response.content });

      // Collect all tool calls from this response
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      if (toolUses.length === 0) {
        console.log(`[Agent:${this._agentId}] no tool calls — ending session`);
        break;
      }

      // Execute each tool call and collect results
      const toolResults = [];
      let shouldEnd = false;

      for (const toolUse of toolUses) {
        toolCallCount++;
        console.log(`[Agent:${this._agentId}] tool: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

        const result = await this._executeTool(toolUse.name, toolUse.input);
        console.log(`[Agent:${this._agentId}] result: ${JSON.stringify(result)}`);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          _toolName: toolUse.name,
          content: JSON.stringify(result),
        });

        if (toolUse.name === 'done') { shouldEnd = true; break; }
        if (!this._running) break;
      }

      messages.push({ role: 'user', content: toolResults });
      if (shouldEnd) break;
    }
  }

  // ── Tool execution ───────────────────────────────────────────────────────────

  async _executeTool(name, input) {
    switch (name) {
      case 'go_to':
        this._socket.emit('agent:target', {
          tileX:  input._nodeTileX ?? input.tileX,
          tileY:  input._nodeTileY ?? input.tileY,
          reason: input.reason ?? '',
        });
        return this._walkTo(input.tileX, input.tileY, input.facingDir);

      case 'interact': {
        const snap = await this._act('interact');
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Not enough energy') || e.includes('Nothing to') || e.includes('Cannot'));
        return {
          ok: !failed,
          events,
          facing: snap.facing ?? null,
          hp: snap.player.hp,
          energy: snap.player.energy,
          gold: snap.gold,
          inventory: snap.inventory,
        };
      }

      case 'eat': {
        const snap = await this._act('eat');
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Nothing to eat'));
        return {
          ok: !failed,
          events,
          hp: snap.player.hp,
          energy: snap.player.energy,
          inventory: snap.inventory,
        };
      }

      case 'buy': {
        const snap = await this._act(`buy:${input.itemId}`);
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Not facing') || e.includes('Need') || e.includes('Cannot buy') || e.includes('full'));
        return {
          ok: !failed,
          events,
          gold: snap.gold,
          inventory: snap.inventory,
        };
      }

      case 'swap': {
        const snap = this._snapshot;
        const contracts = snap.contractAddresses;
        if (!contracts?.gameAMM || !contracts?.goldToken || !this._wallet) {
          return { ok: false, error: 'Web3 not available — wallet or contract addresses missing' };
        }
        const { resourceId, direction, amount } = input;
        try {
          const result = await executeSwap({
            wallet:      this._wallet,
            ammAddress:  contracts.gameAMM,
            goldAddress: contracts.goldToken,
            resourceId,
            direction,
            amountUnits: amount,
          });
          if (result.ok) {
            this._socket.emit('agent:swap_complete', {
              txHash:    result.txHash,
              resourceId,
              direction,
              amountIn:  result.amountIn,
              amountOut: result.amountOut,
            });
          }
          return result;
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }

      case 'get_prices': {
        const snap = this._snapshot;
        return { prices: snap.ammPrices ?? {}, note: 'GGLD per 1 unit of resource' };
      }

      case 'check_status': {
        const snap = this._snapshot;
        return this._snapSummary(snap);
      }

      case 'say': {
        const msg = String(input.message ?? '').slice(0, 60);
        this._socket.emit('agent:chat', { agentId: this._agentId, message: msg });
        console.log(`[Agent:${this._agentId}] says: "${msg}"`);
        return { ok: true, said: msg };
      }

      case 'done':
        console.log(`[Agent:${this._agentId}] done: ${input.summary}`);
        return { ok: true };

      default:
        return { error: `unknown tool: ${name}` };
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  async _walkTo(tileX, tileY, facingDir) {
    const posHistory = [];

    while (this._running) {
      const snap = this._snapshot;
      const { tileX: cx, tileY: cy } = snap.player;
      const dx = tileX - cx, dy = tileY - cy;
      const dist = Math.abs(dx) + Math.abs(dy);

      // Arrived
      if (dist === 0) {
        if (facingDir && snap.player.direction !== facingDir) {
          await this._act(`move_${facingDir}`);
        }
        const finalSnap = this._snapshot;
        console.log(`[Agent:${this._agentId}] arrived at (${finalSnap.player.tileX},${finalSnap.player.tileY}) facing=${JSON.stringify(finalSnap.facing)}`);
        return {
          arrived: true,
          tileX: finalSnap.player.tileX,
          tileY: finalSnap.player.tileY,
          facing: finalSnap.facing ?? null,
          nearbyNodes: finalSnap.nearbyNodes?.filter(n => !n.depleted) ?? [],
          hp: finalSnap.player.hp,
          zone: finalSnap.player.zone,
        };
      }

      // One tile away and it's a harvest/chest tile — face it and return
      // (but NOT if an NPC/player is blocking — let pathfinder route around them)
      if (dist === 1) {
        const dir = dirFromDelta(dx, dy);
        if (dir && snap.blockedDirections?.includes(dir)) {
          // Peek at what's facing to decide if this is the intended target
          await this._act(`move_${dir}`);
          const finalSnap = this._snapshot;
          const facingType = finalSnap.facing?.type;
          console.log(`[Agent:${this._agentId}] dist1-blocked at (${finalSnap.player.tileX},${finalSnap.player.tileY}) facing=${JSON.stringify(finalSnap.facing)}`);
          if (facingType === 'harvest' || facingType === 'chest') {
            return {
              arrived: true,
              tileX: finalSnap.player.tileX,
              tileY: finalSnap.player.tileY,
              facing: finalSnap.facing ?? null,
              nearbyNodes: finalSnap.nearbyNodes?.filter(n => !n.depleted) ?? [],
              hp: finalSnap.player.hp,
              zone: finalSnap.player.zone,
            };
          }
          // NPC or player blocking — don't return, let loop continue routing around
        }
      }

      // Stuck detection — track last 10 positions, detect no-progress
      const posKey = `${cx},${cy}`;
      posHistory.push(posKey);
      if (posHistory.length > 10) posHistory.shift();
      if (posHistory.length === 10) {
        const unique = new Set(posHistory);
        // Oscillating between ≤3 tiles for 10 steps = stuck
        if (unique.size <= 3) {
          return { arrived: false, stuck: true, tileX: cx, tileY: cy, reason: 'navigation blocked' };
        }
      }

      const action = stepToward(cx, cy, tileX, tileY, snap.blockedDirections);
      await this._act(action ?? 'wait');
    }

    return { arrived: false, reason: 'agent stopped' };
  }

  // ── Primitives ───────────────────────────────────────────────────────────────

  // Emit one action and wait for the server's next observation response.
  // The server has a 150ms rate limit — we wait at least 200ms before each action.
  _act(action) {
    return new Promise(resolve => {
      this._obsResolve = resolve;
      setTimeout(() => {
        this._socket.emit('agent:action', { action });
      }, 200);
    });
  }

  _snapSummary(snap) {
    return {
      hp:           snap.player.hp,
      maxHp:        snap.player.maxHp,
      energy:       snap.player.energy,
      maxEnergy:    snap.player.maxEnergy,
      gold:         snap.gold,
      goldBalance:  snap.goldBalance ?? null,
      ammPrices:    snap.ammPrices ?? {},
      zone:         snap.player.zone,
      position:     { tileX: snap.player.tileX, tileY: snap.player.tileY },
      facing:       snap.facing ?? null,
      inventory:    snap.inventory,
      nearbyNodes:  snap.nearbyNodes?.filter(n => !n.depleted) ?? [],
    };
  }
}
