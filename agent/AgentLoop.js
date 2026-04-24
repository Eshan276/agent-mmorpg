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
    // go_to carry-over: if LLM picks go_to we execute one step per tick
    // until we reach the target, re-querying LLM only once we arrive
    this._gotoTarget = null; // { tileX, tileY, reason } | null
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
        const { tileX: gtx, tileY: gty, reason } = this._gotoTarget;
        const dist = Math.abs(gtx - tx) + Math.abs(gty - ty);

        if (dist <= 1) {
          // Arrived — interact if facing, then clear target
          console.log(`[Agent:${this._agentId}] arrived at (${gtx},${gty}) for: ${reason}`);
          this._gotoTarget = null;
          this._socket.emit('agent:action', { action: 'interact' });
          this._scheduleNext();
          return;
        }

        const action = stepToward(tx, ty, gtx, gty, snap.blockedDirections);
        console.log(`[Agent:${this._agentId}] go_to (${gtx},${gty}) [${reason}] step → ${action} (dist ${dist})`);
        this._socket.emit('agent:action', { action });
        this._scheduleNext();
        return;
      }

      // ── Query LLM ────────────────────────────────────────────────────────────
      const userPrompt = buildUserPrompt(snap);
      const { tool, input } = await this._provider.complete(SYSTEM_PROMPT, userPrompt);

      if (tool === 'go_to') {
        this._gotoTarget = { tileX: input.tileX, tileY: input.tileY, reason: input.reason ?? '?' };
        const { tileX: tx, tileY: ty } = snap.player;
        const action = stepToward(tx, ty, input.tileX, input.tileY, snap.blockedDirections);
        console.log(`[Agent:${this._agentId}] tick=${snap.tick} | goal: go_to (${input.tileX},${input.tileY}) — ${input.reason} | step → ${action}`);
        this._socket.emit('agent:action', { action });
      } else {
        const action = toolToAction(tool, input, snap);
        const reason = input.reason ?? '';
        console.log(`[Agent:${this._agentId}] tick=${snap.tick} | goal: ${reason} | ${tool} → ${action}`);
        this._socket.emit('agent:action', { action });
      }

    } catch (err) {
      console.error(`[Agent:${this._agentId}] LLM error:`, err.message);
    }

    this._scheduleNext();
  }
}
