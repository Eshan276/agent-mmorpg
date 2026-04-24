import { createServer } from 'http';
import { GameServer } from './GameServer.js';

const PORT = process.env.PORT || 3000;
const httpServer = createServer();
const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
