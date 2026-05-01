import { ethers }    from 'ethers';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath }  from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const WALLETS_DIR = join(__dir, 'wallets');

const RPC_URL    = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const PASSPHRASE = process.env.WALLET_PASSPHRASE    || 'agent-mmorpg-default';

export const AMM_ABI = [
  'function sell(bytes32 resourceId, uint256 resourceUnits, uint256 minGoldOut) returns (uint256)',
  'function buy(bytes32 resourceId, uint256 resourceUnits, uint256 maxGoldIn) returns (uint256)',
  'function previewSell(bytes32 resourceId, uint256 resourceUnits) view returns (uint256)',
  'function previewBuy(bytes32 resourceId, uint256 resourceUnits) view returns (uint256)',
  'function getPrice(bytes32 resourceId) view returns (uint256)',
];

export const GOLD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export async function loadOrCreateWallet(agentId) {
  mkdirSync(WALLETS_DIR, { recursive: true });
  const keyfile = join(WALLETS_DIR, `${agentId}.json`);

  let wallet;
  if (existsSync(keyfile)) {
    const json = readFileSync(keyfile, 'utf-8');
    wallet = await ethers.Wallet.fromEncryptedJson(json, PASSPHRASE);
    console.log(`[Wallet] loaded wallet for ${agentId}: ${wallet.address}`);
  } else {
    wallet = ethers.Wallet.createRandom();
    const encrypted = await wallet.encrypt(PASSPHRASE);
    writeFileSync(keyfile, encrypted, 'utf-8');
    console.log(`[Wallet] created wallet for ${agentId}: ${wallet.address}`);
  }

  const provider  = new ethers.JsonRpcProvider(RPC_URL);
  const connected = wallet.connect(provider);
  return { wallet: connected, address: wallet.address, provider };
}

// Execute a swap on the GameAMM contract.
// direction='sell': agent gives up resourceUnits, receives GGLD (minted to them)
// direction='buy':  agent burns GGLD, server delivers item to inventory
export async function executeSwap({ wallet, ammAddress, goldAddress, resourceId, direction, amountUnits, slippagePct = 2 }) {
  const rid  = ethers.encodeBytes32String(resourceId);
  const amm  = new ethers.Contract(ammAddress, AMM_ABI, wallet);
  const gold = new ethers.Contract(goldAddress, GOLD_ABI, wallet);
  const units = BigInt(Math.floor(amountUnits));

  let tx, receipt;

  if (direction === 'sell') {
    // Preview to compute minGoldOut with slippage
    const expected = await amm.previewSell(rid, units);
    const minOut   = expected * BigInt(100 - slippagePct) / 100n;

    tx      = await amm.sell(rid, units, minOut);
    receipt = await tx.wait();

    return {
      txHash:    receipt.hash,
      amountIn:  Number(units),
      amountOut: Number(ethers.formatEther(expected)),
      ok:        receipt.status === 1,
    };
  } else {
    // Preview to compute maxGoldIn with slippage
    const expected = await amm.previewBuy(rid, units);
    const maxIn    = expected * BigInt(100 + slippagePct) / 100n;

    // Approve AMM to burn GGLD (approve allowance trick — AMM calls burn via GoldToken)
    // Actually GameAMM calls goldToken.burn(msg.sender, goldIn) — no approval needed.
    // But we need enough balance.
    const balance = await gold.balanceOf(wallet.address);
    if (balance < maxIn) {
      return { ok: false, error: `Insufficient GGLD: have ${ethers.formatEther(balance)}, need ~${ethers.formatEther(expected)}` };
    }

    tx      = await amm.buy(rid, units, maxIn);
    receipt = await tx.wait();

    return {
      txHash:    receipt.hash,
      amountIn:  Number(ethers.formatEther(expected)),
      amountOut: Number(units),
      ok:        receipt.status === 1,
    };
  }
}
