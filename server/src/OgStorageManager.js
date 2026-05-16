// 0G Storage integration for persistent agent memory.
//
// Each agent's persona, swap history, and periodic state snapshots are written
// to 0G Storage (Galileo testnet, which is what the SDK is documented against).
// When an agent restarts on a different machine, it can reload its memory from
// 0G by its rootHash.
//
// Disabled gracefully when env vars are missing — game still runs without it.

import { ethers }            from 'ethers';
import { Indexer, MemData }  from '@0gfoundation/0g-ts-sdk';

// Per-agent debounce: don't push state snapshots more than once every 30s.
const SNAPSHOT_DEBOUNCE_MS = 30_000;

class OgStorageManager {
  constructor() {
    this._ready    = false;
    this._provider = null;
    this._signer   = null;
    this._indexer  = null;
    this._rpcUrl   = null;
    this._roots    = new Map();   // agentId → latest rootHash
    this._lastSnap = new Map();   // agentId → ms timestamp
  }

  init() {
    const rpcUrl     = process.env.OG_RPC_URL      || 'https://evmrpc-testnet.0g.ai';
    const indexerUrl = process.env.OG_INDEXER_URL  || 'https://indexer-storage-testnet-turbo.0g.ai';
    const privKey    = process.env.OG_PRIVATE_KEY  || process.env.SERVER_PRIVATE_KEY;

    if (!privKey) {
      console.warn('[0G] OG_PRIVATE_KEY (or SERVER_PRIVATE_KEY) not set — 0G Storage disabled');
      return;
    }

    try {
      this._provider = new ethers.JsonRpcProvider(rpcUrl);
      this._signer   = new ethers.Wallet(privKey, this._provider);
      this._indexer  = new Indexer(indexerUrl);
      this._rpcUrl   = rpcUrl;
      this._ready    = true;
      console.log(`[0G] storage connected — signer ${this._signer.address} indexer ${indexerUrl}`);
    } catch (e) {
      console.warn(`[0G] storage init failed: ${e.message}`);
    }
  }

  get ready()        { return this._ready; }
  rootFor(agentId)   { return this._roots.get(agentId) ?? null; }

  // ── upload helpers ─────────────────────────────────────────────────────────

  async _uploadJson(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.length === 0) throw new Error('empty payload');
    const data = new MemData(bytes);

    // Build the merkle tree first (required by the SDK before upload).
    const [, treeErr] = await data.merkleTree();
    if (treeErr) throw new Error(`merkle tree failed: ${treeErr.message || treeErr}`);

    const [tx, err] = await this._indexer.upload(data, this._rpcUrl, this._signer);
    if (err) throw new Error(err.message || String(err));

    // Single-segment uploads return {rootHash, txHash}; fragmented return arrays.
    const rootHash = tx.rootHash ?? tx.rootHashes?.[0];
    const txHash   = tx.txHash   ?? tx.txHashes?.[0]   ?? null;
    return { rootHash, txHash };
  }

  // ── public API ─────────────────────────────────────────────────────────────

  // Called on agent register: write the agent's identity blob to 0G.
  async registerAgent(agentId, profile) {
    if (!this._ready) return null;
    try {
      const blob = {
        kind:      'agentx.identity.v1',
        agentId,
        createdAt: new Date().toISOString(),
        ...profile,
      };
      const { rootHash, txHash } = await this._uploadJson(blob);
      this._roots.set(agentId, rootHash);
      console.log(`[0G] stored identity for ${agentId} root=${rootHash} tx=${txHash}`);
      return rootHash;
    } catch (e) {
      console.warn(`[0G] registerAgent(${agentId}) failed: ${e.message}`);
      return null;
    }
  }

  // Periodic state snapshot — debounced. Returns the new rootHash (or null).
  async snapshotAgent(agentId, snapshot) {
    if (!this._ready) return null;
    const last = this._lastSnap.get(agentId) ?? 0;
    if (Date.now() - last < SNAPSHOT_DEBOUNCE_MS) return null;
    this._lastSnap.set(agentId, Date.now());

    try {
      const blob = {
        kind:      'agentx.snapshot.v1',
        agentId,
        capturedAt: new Date().toISOString(),
        ...snapshot,
      };
      const { rootHash, txHash } = await this._uploadJson(blob);
      this._roots.set(agentId, rootHash);
      console.log(`[0G] snapshot ${agentId} root=${rootHash} tx=${txHash}`);
      return rootHash;
    } catch (e) {
      console.warn(`[0G] snapshotAgent(${agentId}) failed: ${e.message}`);
      return null;
    }
  }
}

export const og = new OgStorageManager();
