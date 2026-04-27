import { io }              from 'socket.io-client';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

// Simple Manhattan-distance greedy step toward target (one step per tick).
// Returns the single action string to emit, or null if already there.
function stepToward(fromX, fromY, toX, toY, blocked) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return null;

  // Prefer the axis with larger distance first; try both axes then diagonals
  const candidates = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) candidates.push('move_right', 'move_down', 'move_up',  'move_left');
    else        candidates.push('move_left',  'move_down', 'move_up',  'move_right');
    if (dy > 0) { candidates[1] = 'move_down'; candidates[2] = 'move_up'; }
    else        { candidates[1] = 'move_up';   candidates[2] = 'move_down'; }
  } else {
    if (dy > 0) candidates.push('move_down', 'move_right', 'move_left', 'move_up');
    else        candidates.push('move_up',   'move_right', 'move_left', 'move_down');
    if (dx > 0) { candidates[1] = 'move_right'; candidates[2] = 'move_left'; }
    else        { candidates[1] = 'move_left';  candidates[2] = 'move_right'; }
  }

  const blockedSet = new Set(blocked ?? []);
  for (const action of candidates) {
    const dir = action.replace('move_', '');
    if (!blockedSet.has(dir)) return action;
  }
  return 'wait'; // fully stuck
}

// Convert tool+input from provider → game action string
function toolToAction(tool, input, snapshot) {
  switch (tool) {
    case 'move':
      return `move_${input.direction}`;

    case 'interact':
      return 'interact';

    case 'eat':
      return 'eat';

    case 'buy':
      return `buy:${input.itemId}`;

    case 'wait':
      return 'wait';

    case 'go_to': {
      const { tileX: tx, tileY: ty } = snapshot.player;
      const step = stepToward(tx, ty, input.tileX, input.tileY, snapshot.blockedDirections);
      // If adjacent (1 tile away) and facing the target, interact instead
      const dist = Math.abs(input.tileX - tx) + Math.abs(input.tileY - ty);
      if (dist <= 1 && step === null) return 'interact';
      return step ?? 'wait';
    }

    default:
      return 'wait';
  }
}

export class AgentLoop {
  /**
   * @param {object} opts
   * @param {string} opts.serverUrl  - Socket.io server URL
   * @param {object} opts.provider   - AnthropicProvider | OllamaProvider instance
   * @param {string} opts.agentId    - Unique name for this agent
   * @param {number} opts.tickMs     - Milliseconds between LLM calls
   */
  constructor({ serverUrl, provider, agentId, tickMs = 1200 }) {
    this._serverUrl  = serverUrl;
    this._provider   = provider;
    this._agentId    = agentId;
    this._tickMs     = tickMs;
    this._socket     = null;
    this._snapshot   = null;
    this._running    = false;
    this._loopTimer  = null;
    this._gotoTarget = null; // { tileX, tileY, reason, faceDir?, finalStep? } | null
    // finalStep: after arriving at gotoTarget, emit this action then query LLM
    // Ring buffer of last 8 LLM decisions + outcomes
    this._history    = []; // [{ tick, goal, action, outcome }]
  }

  _pushHistory(tick, goal, action, outcome) {
    this._history.push({ tick, goal, action, outcome });
    if (this._history.length > 8) this._history.shift();
  }

  start() {
    this._socket = io(this._serverUrl, { reconnectionAttempts: Infinity });

    this._socket.on('connect', () => {
      console.log(`[Agent:${this._agentId}] connected`);
      this._socket.emit('agent:register', { agentId: this._agentId });
      this._running = true;
      this._scheduleNext();
    });

    this._socket.on('server:observation', snapshot => {
      this._snapshot = snapshot;
    });

    this._socket.on('disconnect', () => {
      console.log(`[Agent:${this._agentId}] disconnected`);
      this._running = false;
      clearTimeout(this._loopTimer);
    });

    this._socket.on('connect_error', err => {
      console.error(`[Agent:${this._agentId}] connection error:`, err.message);
    });
  }

  stop() {
    this._running = false;
    clearTimeout(this._loopTimer);
    this._socket?.disconnect();
  }

  _scheduleNext() {
    if (!this._running) return;
    this._loopTimer = setTimeout(() => this._tick(), this._tickMs);
  }

  async _tick() {
    if (!this._running) return;

    try {
      if (!this._snapshot) {
        console.log(`[Agent:${this._agentId}] waiting for first observation...`);
        this._scheduleNext();
        return;
      }

      const snap = this._snapshot;

      // ── go_to carry-over: keep stepping toward target without re-querying LLM ──
      if (this._gotoTarget) {
        const { tileX: tx, tileY: ty } = snap.player;
        const { tileX: gtx, tileY: gty, reason, faceDir } = this._gotoTarget;
        const dx = gtx - tx, dy = gty - ty;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist === 0) {
          const finalStep = this._gotoTarget.finalStep;
          if (finalStep) {
            // Arrived at approach tile — take final step to land on target with correct facing direction
            console.log(`[Agent:${this._agentId}] at approach (${gtx},${gty}), final step → ${finalStep}`);
            this._gotoTarget = null; // next tick: LLM query (agent now on final target tile)
            this._socket.emit('agent:action', { action: finalStep });
            this._scheduleNext();
            return;
          }
          // Arrived at actual target — let LLM decide (it sees facing field)
          console.log(`[Agent:${this._agentId}] arrived at (${gtx},${gty}) [${reason}] — querying LLM`);
          this._pushHistory(snap.tick, `arrived at (${gtx},${gty}): ${reason}`, 'arrived', snap.recentEvents?.join('; ') || '');
          this._gotoTarget = null;
          // fall through to LLM

        } else if (dist === 1) {
          const blocked = new Set(snap.blockedDirections ?? []);
          let dirToTarget = null, moveAction = null;
          if      (dx === 1  && dy === 0) { dirToTarget = 'right'; moveAction = 'move_right'; }
          else if (dx === -1 && dy === 0) { dirToTarget = 'left';  moveAction = 'move_left';  }
          else if (dy === 1  && dx === 0) { dirToTarget = 'down';  moveAction = 'move_down';  }
          else if (dy === -1 && dx === 0) { dirToTarget = 'up';    moveAction = 'move_up';    }

          if (dirToTarget && !blocked.has(dirToTarget)) {
            // Walkable — step onto it
            console.log(`[Agent:${this._agentId}] stepping onto (${gtx},${gty}) → ${moveAction}`);
            this._socket.emit('agent:action', { action: moveAction });
          } else {
            // Blocked — face and interact
            const alreadyFacing = snap.player.direction === dirToTarget;
            if (alreadyFacing || moveAction === null) {
              console.log(`[Agent:${this._agentId}] adjacent & facing blocked (${gtx},${gty}) — interacting [${reason}]`);
              const outcome = snap.recentEvents?.join('; ') || 'arrived';
              this._pushHistory(snap.tick, `go_to (${gtx},${gty}): ${reason}`, 'interact', outcome);
              this._gotoTarget = null;
              this._socket.emit('agent:action', { action: 'interact' });
            } else {
              console.log(`[Agent:${this._agentId}] adjacent to blocked (${gtx},${gty}), turning → ${moveAction}`);
              this._socket.emit('agent:action', { action: moveAction });
            }
          }
          this._scheduleNext();
          return;

        } else {
          // dist > 1 — navigate directly
          const action = stepToward(tx, ty, gtx, gty, snap.blockedDirections) ?? 'wait';
          console.log(`[Agent:${this._agentId}] go_to (${gtx},${gty}) [${reason}] → ${action} (dist ${dist}) pos=(${tx},${ty})`);
          this._socket.emit('agent:action', { action });
          this._scheduleNext();
          return;
        }
      }

      // ── Auto-eat when HP is low and food is in inventory (highest priority) ──
      const { tileX, tileY, hp, energy, zone } = snap.player;
      console.log(`[Agent:${this._agentId}] state: pos=(${tileX},${tileY}) hp=${hp} en=${energy} gold=${snap.gold} zone=${zone} blocked=[${snap.blockedDirections}] inv=[${snap.inventory.map(i=>i.id+(i.qty>1?'×'+i.qty:'')).join(',')||'empty'}]`);

      if (hp < 80) {
        const FOOD_IDS = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
        const foodSlot = snap.inventory?.find(i => FOOD_IDS.has(i.id));
        if (foodSlot) {
          console.log(`[Agent:${this._agentId}] auto-eat: hp=${hp} < 80, consuming ${foodSlot.id}`);
          this._pushHistory(snap.tick, `auto-eat hp=${hp}`, 'eat', '');
          this._socket.emit('agent:action', { action: 'eat' });
          this._scheduleNext();
          return;
        }
      }

      // ── Auto-interact if facing something interactable ──────────────────────
      if (snap.facing && ['harvest', 'npc', 'chest'].includes(snap.facing.type)) {
        const SELLABLE = new Set(['grass','plank','branch','rock','bar_iron','bar_gold','gem_red','gem_green','meat','fish','honey']);
        const FOOD_IDS = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
        const hasSellable = snap.inventory?.some(i => SELLABLE.has(i.id));
        const hasFood = snap.inventory?.some(i => FOOD_IDS.has(i.id));
        const canAffordFood = (snap.gold ?? 0) >= 3;

        // At NPC with nothing useful to do: leave and go harvest
        if (snap.facing.type === 'npc' && !hasSellable && !canAffordFood) {
          console.log(`[Agent:${this._agentId}] leaving merchant — nothing to sell, can't afford food`);
          this._gotoTarget = { tileX: 38, tileY: 34, reason: 'harvest grass for food money', finalStep: 'move_down' };
          this._socket.emit('agent:action', { action: 'move_right' });
          this._scheduleNext();
          return;
        }

        // At NPC with food to buy: auto-buy if HP low and can afford
        if (snap.facing.type === 'npc' && canAffordFood && !hasSellable && hp < 80) {
          const itemId = (snap.gold ?? 0) >= 8 ? 'life_potion' : (snap.gold ?? 0) >= 5 ? 'heart' : (snap.gold ?? 0) >= 4 ? 'meat' : 'fish';
          console.log(`[Agent:${this._agentId}] auto-buy: hp=${hp}, buying ${itemId}`);
          this._pushHistory(snap.tick, `auto-buy ${itemId}: hp=${hp}`, 'buy', '');
          this._socket.emit('agent:action', { action: `buy:${itemId}` });
          this._scheduleNext();
          return;
        }

        const skip =
          (snap.facing.type === 'chest' && snap.facing.opened) ||
          (snap.facing.type === 'harvest' && snap.facing.depleted) ||
          (snap.facing.type === 'npc' && !hasSellable);
        if (!skip) {
          console.log(`[Agent:${this._agentId}] auto-interact: facing ${snap.facing.type} (${snap.facing.id ?? snap.facing.resourceType ?? ''})`);
          const outcome = snap.recentEvents?.join('; ') || '';
          this._pushHistory(snap.tick, `auto-interact: ${snap.facing.type}`, 'interact', outcome);
          this._socket.emit('agent:action', { action: 'interact' });
          this._scheduleNext();
          return;
        }
      }

      // ── Query LLM ────────────────────────────────────────────────────────────
      const userPrompt = buildUserPrompt(snap, this._history);
      const { tool, input } = await this._provider.complete(SYSTEM_PROMPT, userPrompt);

      if (tool === 'go_to') {
        const { tileX: fx, tileY: fy } = snap.player;
        const faceDir = input.faceDir ?? null;
        let navX = input.tileX, navY = input.tileY, finalStep = null;
        // If faceDir is set, navigate to approach tile; final step lands on target with correct dir
        if (faceDir) {
          const stepAction = { down:'move_down', up:'move_up', right:'move_right', left:'move_left' }[faceDir];
          if (faceDir === 'down')        { navX = input.tileX; navY = input.tileY - 1; }
          else if (faceDir === 'up')     { navX = input.tileX; navY = input.tileY + 1; }
          else if (faceDir === 'right')  { navX = input.tileX - 1; navY = input.tileY; }
          else if (faceDir === 'left')   { navX = input.tileX + 1; navY = input.tileY; }
          finalStep = stepAction;
        }
        this._gotoTarget = { tileX: navX, tileY: navY, reason: input.reason ?? '?', finalStep };
        const action = stepToward(fx, fy, navX, navY, snap.blockedDirections) ?? 'wait';
        console.log(`[Agent:${this._agentId}] tick=${snap.tick} | goal: go_to (${input.tileX},${input.tileY}) via (${navX},${navY}) — ${input.reason} | step → ${action}`);
        this._socket.emit('agent:action', { action });
      } else {
        const action = toolToAction(tool, input, snap);
        const reason = input.reason ?? '';
        const outcome = snap.recentEvents?.join('; ') || '';
        this._pushHistory(snap.tick, reason, tool, outcome);
        console.log(`[Agent:${this._agentId}] tick=${snap.tick} | goal: ${reason} | ${tool} → ${action}`);
        this._socket.emit('agent:action', { action });
      }

    } catch (err) {
      console.error(`[Agent:${this._agentId}] LLM error:`, err.message);
    }

    this._scheduleNext();
  }
}
