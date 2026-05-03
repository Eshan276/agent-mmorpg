// Manages a Gensyn AXL spoke node lifecycle for one agent process.
//
// Spawns `./node` as a subprocess on agent run, registers with the public hub
// advertised at <serverUrl>/api/axl-hub, exposes send()/recv() via the spoke's
// HTTP bridge on 127.0.0.1, and tears down on stop().
//
// Binary distribution: we don't bundle the AXL binary in npm (it's ~30 MB per
// platform). Instead, we fetch it lazily on first run from a public release URL
// and cache it under ~/.agentx/axl/bin/. If fetch fails or the platform isn't
// supported, AXL is gracefully disabled and whisper() returns a clear error —
// the rest of the agent keeps working.

import { spawn }         from 'child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, statSync } from 'fs';
import { join }          from 'path';
import { homedir, tmpdir, platform, arch } from 'os';

const AXL_HOME    = join(process.env.AGENTX_HOME || join(homedir(), '.agentx'), 'axl');
const BIN_DIR     = join(AXL_HOME, 'bin');
const KEYS_DIR    = join(AXL_HOME, 'keys');
const POLL_MS     = 1000;
const STARTUP_MS  = 8000;
const DEFAULT_API = 9002;     // local HTTP bridge
const DEFAULT_PEER = 9001;    // peer-link port

// AXL binary release URLs — replace with a real release once we publish one.
// The CLI logs a clear message and disables AXL when fetch fails.
const RELEASE_BASE = process.env.AGENTX_AXL_RELEASE
  || 'https://github.com/gensyn-ai/axl/releases/latest/download';
const PLATFORM_BIN = {
  'linux-x64':    'axl-linux-x64',
  'linux-arm64':  'axl-linux-arm64',
  'darwin-arm64': 'axl-darwin-arm64',
  'darwin-x64':   'axl-darwin-x64',
};

function platformKey() {
  const p = platform();
  const a = arch();
  if (p === 'linux'  && a === 'x64')   return 'linux-x64';
  if (p === 'linux'  && a === 'arm64') return 'linux-arm64';
  if (p === 'darwin' && a === 'arm64') return 'darwin-arm64';
  if (p === 'darwin' && a === 'x64')   return 'darwin-x64';
  return null;
}

class AxlSpoke {
  constructor(agentId) {
    this._agentId    = agentId;
    this._proc       = null;
    this._apiPort    = DEFAULT_API;
    this._peerId     = null;
    this._enabled    = false;
    this._inboxLoop  = null;
    this._inbox      = []; // [{from, payload, t}]
    this._onMessage  = null;
  }

  get ready()  { return this._enabled && !!this._peerId; }
  get peerId() { return this._peerId; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start({ hubAddress, hubPeerId } = {}) {
    // Allow users to point at a pre-installed AXL binary instead of downloading.
    // Set AGENTX_AXL_BINARY=/path/to/axl-node-binary
    const explicitBin = process.env.AGENTX_AXL_BINARY;

    const key = platformKey();
    if (!key && !explicitBin) {
      console.warn(`[AXL] unsupported platform ${platform()}/${arch()} — set AGENTX_AXL_BINARY to a system-installed binary, or AXL stays disabled`);
      return false;
    }

    let binPath;
    if (explicitBin) {
      if (!existsSync(explicitBin)) {
        console.warn(`[AXL] AGENTX_AXL_BINARY=${explicitBin} not found — AXL disabled`);
        return false;
      }
      binPath = explicitBin;
      console.log(`[AXL] using system binary ${binPath}`);
    } else {
      try {
        binPath = await this._ensureBinary(key);
      } catch (e) {
        console.warn(`[AXL] couldn't fetch AXL binary: ${e.message}`);
        console.warn('[AXL] disabled. To enable whisper():');
        console.warn('       1. Install AXL from https://github.com/gensyn-ai/axl');
        console.warn('       2. Point at it with AGENTX_AXL_BINARY=/path/to/node');
        return false;
      }
    }

    const { keyPath } = this._ensureKeypair();
    const cfgPath = this._writeConfig(keyPath, hubAddress);

    // Start the node. Capture its peer id from /topology after a short wait.
    this._proc = spawn(binPath, ['-config', cfgPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    this._proc.stdout.on('data', d => process.stdout.write(`[AXL:${this._agentId}] ${d}`));
    this._proc.stderr.on('data', d => process.stderr.write(`[AXL:${this._agentId}] ${d}`));
    this._proc.on('exit', code => {
      this._enabled = false;
      this._peerId  = null;
      console.warn(`[AXL] spoke exited code=${code}`);
    });

    const ok = await this._waitForReady();
    if (!ok) {
      this.stop();
      console.warn('[AXL] spoke did not come up — disabled');
      return false;
    }
    this._enabled = true;
    console.log(`[AXL] spoke ready peerId=${this._peerId.slice(0, 12)}… hub=${hubPeerId?.slice(0,12) ?? 'unknown'}`);
    this._startInboxLoop();
    return true;
  }

  stop() {
    if (this._inboxLoop) clearInterval(this._inboxLoop);
    this._inboxLoop = null;
    if (this._proc && !this._proc.killed) {
      try { this._proc.kill('SIGTERM'); } catch {}
    }
    this._enabled = false;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async _ensureBinary(key) {
    mkdirSync(BIN_DIR, { recursive: true });
    const dest = join(BIN_DIR, PLATFORM_BIN[key]);
    if (existsSync(dest) && statSync(dest).size > 1_000_000) return dest;

    const url = `${RELEASE_BASE}/${PLATFORM_BIN[key]}`;
    console.log(`[AXL] downloading binary from ${url} …`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000_000) throw new Error('downloaded file looks truncated');
    writeFileSync(dest, buf);
    chmodSync(dest, 0o755);
    return dest;
  }

  _ensureKeypair() {
    mkdirSync(KEYS_DIR, { recursive: true });
    const keyPath = join(KEYS_DIR, `${this._agentId}.pem`);
    if (!existsSync(keyPath)) {
      // Generate a fresh ed25519 key. Requires openssl in PATH.
      const out = spawn('openssl', ['genpkey', '-algorithm', 'ed25519', '-out', keyPath], { stdio: 'inherit' });
      // synchronous wait via spawnSync would be cleaner; keep it simple by checking after start
    }
    return { keyPath };
  }

  _writeConfig(keyPath, hubAddress) {
    const cfg = {
      PrivateKeyPath: keyPath,
      Listen:         [],            // spokes don't listen for peer traffic
      Peers:          hubAddress ? [hubAddress] : [],
      api_port:       this._apiPort,
    };
    const cfgPath = join(tmpdir(), `axl-${this._agentId}-${Date.now()}.json`);
    writeFileSync(cfgPath, JSON.stringify(cfg));
    return cfgPath;
  }

  async _waitForReady() {
    const deadline = Date.now() + STARTUP_MS;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://127.0.0.1:${this._apiPort}/topology`, { signal: AbortSignal.timeout(500) });
        if (r.ok) {
          const j = await r.json();
          if (j?.our_public_key) {
            this._peerId = j.our_public_key;
            return true;
          }
        }
      } catch { /* not up yet */ }
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  _startInboxLoop() {
    this._inboxLoop = setInterval(async () => {
      if (!this._enabled) return;
      try {
        const r = await fetch(`http://127.0.0.1:${this._apiPort}/recv`);
        if (r.status === 204) return;
        if (!r.ok) return;
        const from = r.headers.get('x-from-peer-id') || 'unknown';
        const buf  = Buffer.from(await r.arrayBuffer());
        let payload;
        try { payload = JSON.parse(buf.toString('utf-8')); } catch { payload = buf.toString('utf-8'); }
        const msg = { from, payload, t: Date.now() };
        this._inbox.push(msg);
        if (this._inbox.length > 32) this._inbox.shift();
        this._onMessage?.(msg);
      } catch { /* swallow */ }
    }, POLL_MS);
  }

  // ── Public API for AgentLoop ──────────────────────────────────────────────

  // Drain pending whispers since the last call.
  drainInbox() {
    const out = this._inbox.slice();
    this._inbox = [];
    return out;
  }

  setOnMessage(cb) { this._onMessage = cb; }

  async send(targetPeerId, payload) {
    if (!this._enabled) throw new Error('AXL spoke not running');
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const r = await fetch(`http://127.0.0.1:${this._apiPort}/send`, {
      method: 'POST',
      headers: { 'X-Destination-Peer-Id': targetPeerId, 'Content-Type': 'application/octet-stream' },
      body,
    });
    if (!r.ok) throw new Error(`send ${r.status}: ${await r.text().catch(() => '')}`);
    return { ok: true, bytes: Number(r.headers.get('x-sent-bytes') || 0) };
  }
}

// One spoke per CLI invocation
let _spoke = null;

export async function startAxl(agentId, serverUrl) {
  if (_spoke) return _spoke;
  _spoke = new AxlSpoke(agentId);

  // Best-effort: read hub address from the game server.
  let hubAddress, hubPeerId;
  try {
    const base = serverUrl.replace(/\/$/, '');
    const r = await fetch(`${base}/api/axl-hub`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json();
      hubAddress = j.hubAddress;
      hubPeerId  = j.hubPeerId;
    }
  } catch { /* no hub published */ }

  if (!hubAddress) {
    console.warn('[AXL] no hub published at /api/axl-hub — whispers will only reach peers we can directly route to');
  }

  await _spoke.start({ hubAddress, hubPeerId });
  return _spoke;
}

export function getAxl() { return _spoke; }

export function stopAxl() {
  if (_spoke) {
    _spoke.stop();
    _spoke = null;
  }
}
