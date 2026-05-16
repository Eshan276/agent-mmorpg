// On-chain AgentRegistry calls on 0G Chain.
//
// Each agent is registered on 0G Chain with their wallet, ENS name, and the
// latest 0G Storage root hash for their identity blob. Other 0G dApps can
// discover all AGENTX agents by reading this contract.
//
// Disabled gracefully when env vars are missing — game still runs without it.

import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const REGISTRY_ABI = [
  'function register(address wallet, string ensName, bytes32 storageRoot)',
  'function update(address wallet, bytes32 storageRoot, uint32 totalSwaps)',
  'function getAgent(address wallet) view returns (tuple(address wallet, string ensName, bytes32 storageRoot, uint64 updatedAt, uint32 totalSwaps, bool exists))',
  'function totalAgents() view returns (uint256)',
];

// Per-agent cache of "has this wallet been registered on-chain yet?"
const _registered = new Set();

class OgChainManager {
  constructor() {
    this._ready    = false;
    this._provider = null;
    this._signer   = null;
    this._registry = null;
    this._chainId  = null;
    this._lastSent = new Map();   // agentId → ms, throttle update() calls
  }

  init() {
    const rpcUrl  = process.env.OG_CHAIN_RPC_URL || process.env.OG_RPC_URL;
    const privKey = process.env.OG_PRIVATE_KEY   || process.env.SERVER_PRIVATE_KEY;

    if (!rpcUrl || !privKey) {
      console.warn('[0G-Chain] OG_CHAIN_RPC_URL or OG_PRIVATE_KEY missing — 0G Chain disabled');
      return;
    }

    // Load AgentRegistry address from deployed-og.json
    const deployedPath = join(__dir, '../../contracts/deployed-og.json');
    if (!existsSync(deployedPath)) {
      console.warn('[0G-Chain] contracts/deployed-og.json not found — run deploy-og.js first. Disabled.');
      return;
    }
    const deployed = JSON.parse(readFileSync(deployedPath, 'utf-8'));

    try {
      // Galileo testnet can be slow — give RPC calls a generous timeout
      this._provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { polling: true, pollingInterval: 4000, batchMaxCount: 1 });
      this._signer   = new ethers.Wallet(privKey, this._provider);

      // Resolve chainId → pick matching deployed block
      // (We init the contract lazily on the first call once chainId is known.)
      this._provider.getNetwork().then(net => {
        this._chainId = Number(net.chainId);
        const block = deployed[`chain_${this._chainId}`];
        if (!block?.agentRegistry) {
          console.warn(`[0G-Chain] no AgentRegistry deployed on chainId ${this._chainId}. Disabled.`);
          return;
        }
        this._registry = new ethers.Contract(block.agentRegistry, REGISTRY_ABI, this._signer);
        this._ready    = true;
        console.log(`[0G-Chain] connected — chain ${this._chainId}, registry ${block.agentRegistry}, signer ${this._signer.address}`);
      }).catch(e => console.warn(`[0G-Chain] network probe failed: ${e.message}`));
    } catch (e) {
      console.warn(`[0G-Chain] init failed: ${e.message}`);
    }
  }

  get ready()  { return this._ready; }
  get chainId() { return this._chainId; }
  get registryAddress() { return this._registry?.target ?? null; }

  // ── public API ─────────────────────────────────────────────────────────────

  // Register an agent on-chain. Called after 0G Storage has produced a root.
  async registerAgent(walletAddress, ensName, storageRoot) {
    if (!this._ready || !walletAddress || !storageRoot) return null;
    try {
      const tx = await this._registry.register(walletAddress, ensName || '', storageRoot);
      const rc = await tx.wait();
      _registered.add(walletAddress.toLowerCase());
      console.log(`[0G-Chain] registered ${walletAddress} → ${ensName} root=${storageRoot} tx=${rc.hash}`);
      return rc.hash;
    } catch (e) {
      console.warn(`[0G-Chain] register failed for ${walletAddress}: ${e.message}`);
      return null;
    }
  }

  // Push new storage root + bumped swap counter. Throttled per agent (~60s).
  // If the agent was never registered on-chain (or the earlier register tx
  // timed out), retry register first so the contract's `exists` check passes.
  async updateAgent(walletAddress, storageRoot, totalSwaps, agentId = walletAddress) {
    if (!this._ready || !walletAddress || !storageRoot) return null;
    const last = this._lastSent.get(agentId) ?? 0;
    if (Date.now() - last < 60_000) return null;
    this._lastSent.set(agentId, Date.now());

    // If we never confirmed registration, do that first.
    if (!_registered.has(walletAddress.toLowerCase())) {
      try {
        const rec = await this._registry.getAgent(walletAddress);
        if (rec?.exists) _registered.add(walletAddress.toLowerCase());
      } catch { /* ignore */ }
    }
    if (!_registered.has(walletAddress.toLowerCase())) {
      return this.registerAgent(walletAddress, '', storageRoot);
    }

    try {
      const tx = await this._registry.update(walletAddress, storageRoot, totalSwaps);
      const rc = await tx.wait();
      console.log(`[0G-Chain] updated ${walletAddress} swaps=${totalSwaps} tx=${rc.hash}`);
      return rc.hash;
    } catch (e) {
      console.warn(`[0G-Chain] update failed for ${walletAddress}: ${e.message}`);
      return null;
    }
  }

  explorerUrl(addressOrTx) {
    if (this._chainId === 16661) return `https://chainscan.0g.ai/address/${addressOrTx}`;
    if (this._chainId === 16602) return `https://chainscan-galileo.0g.ai/address/${addressOrTx}`;
    return null;
  }
}

export const ogChain = new OgChainManager();
