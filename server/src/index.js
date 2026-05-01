import { createServer } from 'http';
import { GameServer }   from './GameServer.js';
import { logsHandler }  from './logsHandler.js';
import { web3 }         from './Web3Manager.js';

const PORT = process.env.PORT || 3000;

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/api/logs') return logsHandler(req, res, url);
  res.writeHead(404).end();
});

// Init Web3 (non-blocking — server runs without it if env vars absent)
web3.init().catch(e => console.error('[Web3] init error:', e.message));

const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
