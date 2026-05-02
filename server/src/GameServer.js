import { Server }          from 'socket.io';
import { WorldSimulation } from './WorldSimulation.js';
import { logAction, flush } from './AxiomLogger.js';
import { web3 }             from './Web3Manager.js';

const RENDER_INTERVAL_MS = 200;
const CHAT_TTL_MS = 6000; // bubbles last 6 seconds

export class GameServer {
  constructor(httpServer) {
    this.io   = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    this._sim = new WorldSimulation();

    this._agents     = new Map();  // agentId → { socketId, target? }
    this._spectators = new Set();  // socketId[]
    this._chatMsgs   = new Map();  // agentId → { message, expiresAt }

    this.io.on('connection', socket => this._onConnect(socket));

    setInterval(() => this._broadcastWorldState(), RENDER_INTERVAL_MS);
    process.on('SIGTERM', () => flush().finally(() => process.exit(0)));
    process.on('SIGINT',  () => flush().finally(() => process.exit(0)));
    console.log('[GameServer] server-authoritative mode ready');
  }

  _onConnect(socket) {
    let role    = null;
    let agentId = null;

    socket.on('spectator:register', () => {
      role = 'spectator';
      this._spectators.add(socket.id);
      console.log(`[GameServer] spectator connected: ${socket.id}`);
      socket.emit('server:worldState', this._sim.buildRendererState());
    });

    socket.on('agent:register', ({ agentId: id, walletAddress }) => {
      role    = 'agent';
      agentId = id;
      this._agents.set(agentId, { socketId: socket.id });
      this._sim.registerPlayer(agentId, walletAddress ?? null);
      // Mint starting gold to agent wallet (fire-and-forget)
      if (walletAddress && web3.ready) {
        web3.mintGold(walletAddress, 100n).catch(() => {});
      }
      const obs = this._sim.buildObservation(agentId);
      const now = Date.now();
      obs.agentChat = [...this._chatMsgs.entries()]
        .filter(([cid, c]) => cid !== agentId && now < c.expiresAt)
        .map(([cid, c]) => ({ agentId: cid, message: c.message }));
      socket.emit('server:observation', obs);
    });

    // Agent reports a completed on-chain swap — server verifies and applies inventory effect
    socket.on('agent:swap_complete', async ({ txHash, resourceId, direction, amountIn, amountOut }) => {
      if (role !== 'agent' || !agentId) return;
      const verified = await web3.verifySwap(txHash);
      if (!verified?.ok) {
        console.warn(`[Web3] swap not verified for ${agentId}: ${txHash}`);
        return;
      }
      const player = this._sim.getPlayer(agentId);
      if (!player) return;

      if (direction === 'sell') {
        // Agent sold resource → remove from inventory, gold balance updated via chain
        player.removeItem(resourceId, Math.ceil(amountIn));
        player.pushEvent(`Sold ${amountIn} ${resourceId} → ${amountOut.toFixed(2)} GGLD (on-chain)`);
      } else {
        // Agent bought resource → add to inventory
        player.addItem(resourceId, Math.floor(amountOut));
        player.pushEvent(`Bought ${Math.floor(amountOut)} ${resourceId} for ${amountIn} GGLD (on-chain)`);
      }
      console.log(`[Web3] swap verified for ${agentId}: ${direction} ${amountIn} ${resourceId} tx=${txHash}`);

      // Push a fresh observation so the agent sees the updated inventory immediately
      const obs = this._sim.buildObservation(agentId);
      if (obs) {
        const now = Date.now();
        obs.agentChat = [...this._chatMsgs.entries()]
          .filter(([id, c]) => id !== agentId && now < c.expiresAt)
          .map(([id, c]) => ({ agentId: id, message: c.message }));
        socket.emit('server:observation', obs);
      }
    });

    socket.on('agent:chat', ({ message }) => {
      if (role !== 'agent' || !agentId) return;
      const text = String(message ?? '').slice(0, 60);
      this._chatMsgs.set(agentId, { message: text, expiresAt: Date.now() + CHAT_TTL_MS });
      console.log(`[Chat] ${agentId}: "${text}"`);
      const p = this._sim.getPlayer(agentId);
      logAction(agentId, 'say', {
        tileX: p?.tileX, tileY: p?.tileY, hp: p?.hp, energy: p?.energy,
        gold: p?.gold, zone: p?.zone, events: `💬 "${text}"`,
      });
    });

    socket.on('agent:target', ({ tileX, tileY, reason }) => {
      if (role !== 'agent' || !agentId) return;
      this._agents.get(agentId).target = { tileX, tileY, reason };
    });

    socket.on('agent:action', ({ action }) => {
      if (role !== 'agent' || !agentId) return;
      this._sim.processAction(agentId, action);
      const obs = this._sim.buildObservation(agentId);
      if (obs) {
        // Inject other agents' active chat so agents can hear each other
        const now = Date.now();
        obs.agentChat = [...this._chatMsgs.entries()]
          .filter(([id, c]) => id !== agentId && now < c.expiresAt)
          .map(([id, c]) => ({ agentId: id, message: c.message }));
        socket.emit('server:observation', obs);
        const events = obs.recentEvents?.join(' | ') ?? '';
        const isMeaningful = action === 'interact' || action === 'eat' ||
          action.startsWith('buy:') || events.length > 0;
        if (isMeaningful) {
          logAction(agentId, action, {
            tileX:  obs.player.tileX,
            tileY:  obs.player.tileY,
            hp:     obs.player.hp,
            energy: obs.player.energy,
            gold:   obs.gold,
            zone:   obs.player.zone,
            events,
          });
        }
      }
    });

    socket.on('disconnect', () => {
      if (role === 'spectator') {
        this._spectators.delete(socket.id);
        console.log(`[GameServer] spectator disconnected: ${socket.id}`);
      } else if (role === 'agent' && agentId) {
        this._sim.removePlayer(agentId);
        this._agents.delete(agentId);
        console.log(`[GameServer] agent disconnected: ${agentId}`);
      }
    });
  }

  _broadcastWorldState() {
    if (this._spectators.size === 0) return;
    const state = this._sim.buildRendererState();

    state.agentTargets = [...this._agents.entries()]
      .filter(([, a]) => a.target)
      .map(([id, a]) => ({ agentId: id, ...a.target }));

    // Attach active chat messages, prune expired ones
    const now = Date.now();
    for (const [id, chat] of this._chatMsgs) {
      if (now >= chat.expiresAt) this._chatMsgs.delete(id);
    }
    state.chatMessages = [...this._chatMsgs.entries()]
      .map(([agentId, { message }]) => ({ agentId, message }));

    for (const sid of this._spectators) {
      this.io.to(sid).emit('server:worldState', state);
    }
  }
}
