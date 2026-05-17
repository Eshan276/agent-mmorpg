import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const GOLD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function mint(address to, uint256 amount)',
];

const AMM_ABI = [
  'function sell(bytes32 resourceId, uint256 resourceUnits, uint256 minGoldOut) returns (uint256)',
  'function buy(bytes32 resourceId, uint256 resourceUnits, uint256 maxGoldIn) returns (uint256)',
  'function previewSell(bytes32 resourceId, uint256 resourceUnits) view returns (uint256)',
  'function previewBuy(bytes32 resourceId, uint256 resourceUnits) view returns (uint256)',
  'function getPrice(bytes32 resourceId) view returns (uint256)',
  'function getAllPoolIds() view returns (bytes32[])',
  'function pools(bytes32) view returns (uint256 reserveResource, uint256 reserveGold, bool exists)',
];

const KNOWN_RESOURCES = [
  'plank','branch','rock','bar_iron','gem_red','gem_green','grass','honey','meat','fish',
];

const UNIT = 10n ** 18n;

class Web3Manager {
  constructor() {
    this._ready      = false;
    this._provider   = null;
    this._wallet     = null;
    this._gold       = null;
    this._amm        = null;
    this._priceCache   = {}; // resourceId → float, refreshed every 30s
    this._priceHistory = {}; // resourceId → [{ t: ms, p: float }], capped at HISTORY_MAX
  }

  static HISTORY_MAX = 240; // 240 samples × 30s = 2 hours of history

  async init() {
    const privKey = process.env.SERVER_PRIVATE_KEY;
    if (!privKey) {
      console.warn('[Web3] SERVER_PRIVATE_KEY not set — Web3 disabled');
      return;
    }

    // Pick which chain the economy runs on. WEB3_CHAIN=og-mainnet|og-testnet|base-sepolia
    // Default is base-sepolia for backwards compat with the original deploy.
    const chain = (process.env.WEB3_CHAIN || 'base-sepolia').toLowerCase();
    const CHAINS = {
      'base-sepolia': { chainId: 84532, defaultRpc: 'https://sepolia.base.org',         envRpc: 'BASE_SEPOLIA_RPC_URL' },
      'og-mainnet':   { chainId: 16661, defaultRpc: 'https://evmrpc.0g.ai',             envRpc: 'OG_MAINNET_RPC_URL'   },
      'og-testnet':   { chainId: 16602, defaultRpc: 'https://evmrpc-testnet.0g.ai',     envRpc: 'OG_TESTNET_RPC_URL'   },
    };
    const spec = CHAINS[chain];
    if (!spec) {
      console.warn(`[Web3] unknown WEB3_CHAIN=${chain} — Web3 disabled (use base-sepolia | og-mainnet | og-testnet)`);
      return;
    }
    const rpcUrl = process.env[spec.envRpc] || spec.defaultRpc;

    const deployedPath = join(__dir, '../../contracts/deployed.json');
    if (!existsSync(deployedPath)) {
      console.warn('[Web3] contracts/deployed.json not found — run deploy script first. Web3 disabled.');
      return;
    }
    const deployed = JSON.parse(readFileSync(deployedPath, 'utf-8'));

    // Prefer the per-chainId block; fall back to the flat keys for backwards compat.
    const block = deployed[`chain_${spec.chainId}`] || deployed;
    if (!block?.gameAMM || !block?.goldToken) {
      console.warn(`[Web3] no GameAMM/GoldToken in deployed.json for chainId ${spec.chainId} — disabled`);
      return;
    }

    this._provider = new ethers.JsonRpcProvider(rpcUrl);
    this._wallet   = new ethers.Wallet(privKey, this._provider);
    this._gold     = new ethers.Contract(block.goldToken, GOLD_ABI, this._wallet);
    this._amm      = new ethers.Contract(block.gameAMM,   AMM_ABI,  this._wallet);
    this._rpcUrl   = rpcUrl;
    this._chainId  = spec.chainId;

    const network = await this._provider.getNetwork();
    console.log(`[Web3] connected — chain ${network.chainId} (${chain}), gold=${block.goldToken} amm=${block.gameAMM}, server wallet ${this._wallet.address}`);
    this._ready = true;

    this._refreshPrices();
    setInterval(() => this._refreshPrices(), 30_000);
  }

  get ready() { return this._ready; }

  // ── Minting ────────────────────────────────────────────────────────────────

  async mintGold(agentAddress, amountUnits = 100n) {
    if (!this._ready) return;
    try {
      const tx = await this._gold.mint(agentAddress, amountUnits * UNIT);
      await tx.wait();
      console.log(`[Web3] minted ${amountUnits} GGLD → ${agentAddress}`);

      // Top up native gas for the agent so it can actually call swap() on its own.
      // Only drips once — if the agent already has gas (e.g. self-funded), skip.
      const dripUnits = process.env.GAS_DRIP_ETH || '0.005';
      const currentGas = await this._provider.getBalance(agentAddress);
      const dripWei    = ethers.parseEther(dripUnits);
      if (currentGas < dripWei) {
        try {
          const gasTx = await this._wallet.sendTransaction({ to: agentAddress, value: dripWei });
          await gasTx.wait();
          console.log(`[Web3] sent ${dripUnits} native gas → ${agentAddress} tx=${gasTx.hash}`);
        } catch (e) {
          console.warn(`[Web3] gas drip failed: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`[Web3] mintGold failed: ${e.message}`);
    }
  }

  // No-op for non-tokenised resources — Web3Manager no longer mints resource tokens.
  // Harvest is server-inventory only; only GGLD lives on-chain.
  mintResource() {}

  // ── Balances ───────────────────────────────────────────────────────────────

  async getGoldBalance(agentAddress) {
    if (!this._ready) return 0n;
    try {
      return await this._gold.balanceOf(agentAddress);
    } catch { return 0n; }
  }

  // ── Prices ─────────────────────────────────────────────────────────────────

  // Returns { resourceId → price } — only includes successful fetches.
  // Failed fetches are omitted so callers can fall back to the previous cached value.
  async getAllPrices() {
    if (!this._ready) return {};
    const prices = {};
    await Promise.all(
      KNOWN_RESOURCES.map(async id => {
        try {
          const rid = ethers.encodeBytes32String(id);
          const p   = await this._amm.getPrice(rid);
          prices[id] = Number((Number(p) / 1e18).toFixed(4));
        } catch { /* skip — caller keeps previous cached value */ }
      })
    );
    return prices;
  }

  getCachedPrices() {
    return { ...this._priceCache };
  }

  _refreshPrices() {
    this.getAllPrices().then(prices => {
      const t = Date.now();
      for (const [id, p] of Object.entries(prices)) {
        // Merge into cache (preserves any previous values for resources that failed this tick)
        this._priceCache[id] = p;
        if (!this._priceHistory[id]) this._priceHistory[id] = [];
        const arr = this._priceHistory[id];
        arr.push({ t, p });
        if (arr.length > Web3Manager.HISTORY_MAX) arr.shift();
      }
    }).catch(() => {});
  }

  // Returns a sanitised copy: zero values (RPC failures from earlier versions) are stripped.
  getPriceHistory() {
    const out = {};
    for (const [id, arr] of Object.entries(this._priceHistory)) {
      out[id] = arr.filter(pt => pt.p > 0);
    }
    return out;
  }

  // ── Swap verification ──────────────────────────────────────────────────────

  async verifySwap(txHash) {
    if (!this._ready) return null;
    try {
      const receipt = await this._provider.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) return null;
      return { ok: true, blockNumber: receipt.blockNumber };
    } catch { return null; }
  }

  // ── Contract addresses for agent wallet ───────────────────────────────────

  getContractAddresses() {
    return {
      goldToken: this._gold?.target ?? null,
      gameAMM:   this._amm?.target  ?? null,
      chainId:   this._chainId      ?? null,
      rpcUrl:    this._rpcUrl       ?? null,
    };
  }
}

export const web3 = new Web3Manager();
