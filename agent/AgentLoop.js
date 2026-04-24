import { io }              from 'socket.io-client';
import { SYSTEM_PROMPT, buildUserPrompt, parseAction } from './prompt.js';

export class AgentLoop {
  /**
   * @param {object} opts
   * @param {string} opts.serverUrl  - Socket.io server URL
   * @param {object} opts.provider   - AnthropicProvider | OllamaProvider instance
   * @param {string} opts.agentId    - Unique name for this agent
   * @param {number} opts.tickMs     - Milliseconds between LLM calls
   */
  constructor({ serverUrl, provider, agentId, tickMs = 800 }) {
    this._serverUrl = serverUrl;
    this._provider  = provider;
    this._agentId   = agentId;
    this._tickMs    = tickMs;
    this._socket    = null;
    this._snapshot  = null;
    this._running   = false;
    this._loopTimer = null;
  }

  start() {
    this._socket = io(this._serverUrl, { reconnectionAttempts: Infinity });

    this._socket.on('connect', () => {
      console.log(`[Agent:${this._agentId}] connected to server`);
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
      if (this._snapshot) {
        const userPrompt = buildUserPrompt(this._snapshot);
        const raw        = await this._provider.complete(SYSTEM_PROMPT, userPrompt);
        const action     = parseAction(raw);
        console.log(`[Agent:${this._agentId}] tick=${this._snapshot.tick} → ${action}`);
        this._socket.emit('agent:action', { action });
      } else {
        console.log(`[Agent:${this._agentId}] waiting for first observation...`);
      }
    } catch (err) {
      console.error(`[Agent:${this._agentId}] LLM error:`, err.message);
    }

    this._scheduleNext();
  }
}
