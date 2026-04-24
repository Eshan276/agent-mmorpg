import { Server } from 'socket.io';

export class GameServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
    });

    this.players = new Map(); // socketId → { id, tileX, tileY, direction }

    this.io.on('connection', socket => this._onConnect(socket));
    console.log('[GameServer] Socket.io ready');
  }

  _onConnect(socket) {
    console.log(`[GameServer] player connected: ${socket.id}`);

    // Register new player
    this.players.set(socket.id, {
      id: socket.id,
      tileX: 40,
      tileY: 35,
      direction: 'down',
    });

    // Placeholder event handlers — filled in when multiplayer is implemented
    socket.on('player:action', (_data) => {
      // TODO: validate and broadcast player actions
    });

    socket.on('disconnect', () => {
      console.log(`[GameServer] player disconnected: ${socket.id}`);
      this.players.delete(socket.id);
    });
  }
}
