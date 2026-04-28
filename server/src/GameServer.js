import { Server }          from 'socket.io';
import { WorldSimulation } from './WorldSimulation.js';
import { logAction, flush } from './AxiomLogger.js';

const RENDER_INTERVAL_MS = 200;

export class GameServer {
  constructor(httpServer) {
    this.io   = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    this._sim = new WorldSimulation();

    this._agents     = new Map();  // agentId → { socketId }
    this._spectators = new Set();  // socketId[]

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

    socket.on('agent:register', ({ agentId: id }) => {
      role    = 'agent';
      agentId = id;
      this._agents.set(agentId, { socketId: socket.id });
      this._sim.registerPlayer(agentId);
      const obs = this._sim.buildObservation(agentId);
      socket.emit('server:observation', obs);
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
        socket.emit('server:observation', obs);
        logAction(agentId, action, {
          tileX:    obs.player.tileX,
          tileY:    obs.player.tileY,
          hp:       obs.player.hp,
          energy:   obs.player.energy,
          gold:     obs.gold,
          zone:     obs.player.zone,
          events:   obs.recentEvents?.join(' | ') ?? '',
        });
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
    // Attach agent targets for debug overlay
    state.agentTargets = [...this._agents.entries()]
      .filter(([, a]) => a.target)
      .map(([id, a]) => ({ agentId: id, ...a.target }));
    for (const sid of this._spectators) {
      this.io.to(sid).emit('server:worldState', state);
    }
  }
}
