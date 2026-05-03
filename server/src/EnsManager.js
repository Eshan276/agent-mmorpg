// On-chain ENS subname minter for Sepolia.
//
// We own a parent name (e.g. agentx.eth) on Sepolia, so the parent owner can
// freely mint subnames via the ENS Registry's setSubnodeRecord(). We then call
// setAddr + setText on the public resolver to attach the agent's wallet and
// metadata. Two txs per agent (subnode + multicall of records), only Sepolia
// gas required.
//
// Disabled gracefully when ENS_PARENT or SERVER_PRIVATE_KEY are missing.

import { ethers } from 'ethers';

// ── ENS contract addresses on Sepolia ────────────────────────────────────────
// Registry is at the same canonical address across all ENS-enabled networks.
const ENS_REGISTRY    = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
// Public Resolver (the standard one returned by ENS Manager UI on Sepolia).
const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5';

const REGISTRY_ABI = [
  'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)',
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
];

// PublicResolver supports a multicall so we can set addr+text in one tx.
const RESOLVER_ABI = [
  'function setAddr(bytes32 node, address a)',
  'function setText(bytes32 node, string key, string value)',
  'function multicall(bytes[] calldata data) returns (bytes[] memory results)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
];

// Per-agent debounce: don't push text_record updates more than once every 30s.
const UPDATE_DEBOUNCE_MS = 30_000;

class EnsManager {
  constructor() {
    this._ready    = false;
    this._provider = null;
    this._wallet   = null;
    this._registry = null;
    this._resolver = null;
    this._parent   = null;            // 'agentx.eth'
    this._parentNode = null;          // namehash(parent)
    this._cache    = new Map();       // walletAddress.toLowerCase() → ensName
    this._lastPush = new Map();       // agentId → ms
    this._minted   = new Set();       // agentIds we've already setSubnodeRecord for
  }

  init() {
    const rpcUrl  = process.env.SEPOLIA_ENS_RPC_URL || process.env.SEPOLIA_RPC_URL;
    const privKey = process.env.SERVER_PRIVATE_KEY;
    const parent  = process.env.ENS_PARENT;          // e.g. "agentx.eth"

    if (!rpcUrl) {
      console.warn('[ENS] SEPOLIA_ENS_RPC_URL (or SEPOLIA_RPC_URL) not set — ENS disabled');
      return;
    }
    if (!privKey) {
      console.warn('[ENS] SERVER_PRIVATE_KEY not set — ENS disabled');
      return;
    }
    if (!parent) {
      console.warn('[ENS] ENS_PARENT not set — ENS disabled');
      return;
    }

    this._provider   = new ethers.JsonRpcProvider(rpcUrl);
    this._wallet     = new ethers.Wallet(privKey, this._provider);
    this._registry   = new ethers.Contract(ENS_REGISTRY,    REGISTRY_ABI, this._wallet);
    this._resolver   = new ethers.Contract(PUBLIC_RESOLVER, RESOLVER_ABI, this._wallet);
    this._parent     = parent;
    this._parentNode = ethers.namehash(parent);
    this._ready      = true;

    console.log(`[ENS] connected — parent=${parent} signer=${this._wallet.address}`);
    // Best-effort sanity check: are we actually the parent owner? Don't block on it.
    this._registry.owner(this._parentNode).then(o => {
      if (o.toLowerCase() !== this._wallet.address.toLowerCase()) {
        console.warn(`[ENS] WARNING: signer ${this._wallet.address} is NOT the owner of ${parent} (owner=${o}). Subname mints will fail until ownership is transferred.`);
      }
    }).catch(() => {});
  }

  get ready() { return this._ready; }

  // ── helpers ───────────────────────────────────────────────────────────────

  _label(agentId) {
    return String(agentId).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'agent';
  }

  fullName(agentId) {
    return `${this._label(agentId)}.${this._parent}`;
  }

  _subnodeOf(label) {
    // namehash(child) = keccak256(parentNode || keccak256(label))
    return ethers.keccak256(
      ethers.concat([this._parentNode, ethers.keccak256(ethers.toUtf8Bytes(label))]),
    );
  }

  _labelHash(label) {
    return ethers.keccak256(ethers.toUtf8Bytes(label));
  }

  // ── public API ────────────────────────────────────────────────────────────

  // Idempotent: creates the subnode if it doesn't exist, then sets addr +
  // baseline text records. Safe to call repeatedly.
  async registerAgent(agentId, walletAddress, persona = '') {
    if (!this._ready || !walletAddress) return;
    const label = this._label(agentId);
    const node  = this._subnodeOf(label);
    const fullName = `${label}.${this._parent}`;

    try {
      // Check whether the subnode already has the right resolver. If not, mint.
      let needsMint = false;
      if (!this._minted.has(agentId)) {
        const currentResolver = await this._registry.resolver(node).catch(() => ethers.ZeroAddress);
        if (currentResolver === ethers.ZeroAddress || currentResolver.toLowerCase() !== PUBLIC_RESOLVER.toLowerCase()) {
          needsMint = true;
        }
      }

      if (needsMint) {
        const tx = await this._registry.setSubnodeRecord(
          this._parentNode,
          this._labelHash(label),
          this._wallet.address,    // owner = our server wallet (we control records)
          PUBLIC_RESOLVER,
          0,                        // ttl
        );
        await tx.wait();
        this._minted.add(agentId);
        console.log(`[ENS] minted subnode ${fullName} tx=${tx.hash}`);
      } else {
        this._minted.add(agentId);
      }

      // Set baseline records (addr + a few text fields) in one multicall.
      const calls = [
        this._resolver.interface.encodeFunctionData('setAddr',  [node, walletAddress]),
        this._resolver.interface.encodeFunctionData('setText',  [node, 'description',    persona || 'Autonomous agent in agent-mmorpg']),
        this._resolver.interface.encodeFunctionData('setText',  [node, 'agent.id',       agentId]),
        this._resolver.interface.encodeFunctionData('setText',  [node, 'agent.swaps',    '0']),
        this._resolver.interface.encodeFunctionData('setText',  [node, 'agent.ggld',     '0']),
        this._resolver.interface.encodeFunctionData('setText',  [node, 'url',            'https://agentx-gamma.vercel.app']),
      ];
      const tx2 = await this._resolver.multicall(calls);
      await tx2.wait();

      this._cache.set(walletAddress.toLowerCase(), fullName);
      console.log(`[ENS] records set for ${fullName} → ${walletAddress}`);
    } catch (e) {
      console.warn(`[ENS] registerAgent(${agentId}) failed: ${e.message}`);
    }
  }

  // Push live stats into text records. Debounced per agent.
  async updateStats(agentId, walletAddress, stats = {}) {
    if (!this._ready || !walletAddress) return;
    const last = this._lastPush.get(agentId) ?? 0;
    if (Date.now() - last < UPDATE_DEBOUNCE_MS) return;
    this._lastPush.set(agentId, Date.now());

    const label = this._label(agentId);
    const node  = this._subnodeOf(label);

    // Only set keys we actually have. Empty multicall = noop (skip).
    const calls = [];
    if (stats.persona !== undefined) calls.push(this._resolver.interface.encodeFunctionData('setText', [node, 'description',    String(stats.persona)]));
    if (stats.swaps   !== undefined) calls.push(this._resolver.interface.encodeFunctionData('setText', [node, 'agent.swaps',    String(stats.swaps)]));
    if (stats.ggld    !== undefined) calls.push(this._resolver.interface.encodeFunctionData('setText', [node, 'agent.ggld',     String(stats.ggld)]));
    if (stats.zone    !== undefined) calls.push(this._resolver.interface.encodeFunctionData('setText', [node, 'agent.zone',     String(stats.zone)]));
    if (stats.hp      !== undefined) calls.push(this._resolver.interface.encodeFunctionData('setText', [node, 'agent.hp',       String(stats.hp)]));
    if (calls.length === 0) return;

    try {
      const tx = await this._resolver.multicall(calls);
      await tx.wait();
    } catch (e) {
      console.warn(`[ENS] updateStats(${agentId}) failed: ${e.message}`);
    }
  }

  // Reverse: walletAddress → ENS name. Cached per session.
  // Note: this is the *forward* mapping we control (subname.addr() == walletAddress).
  // If an agent has been registered, its name is in our cache. Otherwise null.
  async resolveName(walletAddress) {
    if (!this._ready || !walletAddress) return null;
    const key = walletAddress.toLowerCase();
    if (this._cache.has(key)) return this._cache.get(key);
    return null;
  }
}

export const ens = new EnsManager();
