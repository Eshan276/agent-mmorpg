const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Deploys GoldToken + GameAMM to whichever EVM network is active.
// Writes to deployed.json keyed by chainId, so multiple chains coexist
// (e.g. Base Sepolia and 0G Chain can both be live).
//
// Usage:
//   npx hardhat run scripts/deploy.js --network baseSepolia
//   npx hardhat run scripts/deploy.js --network ogMainnet
//   npx hardhat run scripts/deploy.js --network ogTestnet

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network:        chainId=${chainId}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:        ${ethers.formatEther(balance)} (native)`);
  if (balance === 0n) {
    console.error('✗ Deployer wallet has 0 native balance — fund it before deploying.');
    process.exit(1);
  }

  // 1. Deploy GoldToken
  const GoldToken = await ethers.getContractFactory('GoldToken');
  const goldToken = await GoldToken.deploy(deployer.address);
  await goldToken.waitForDeployment();
  const goldAddress = await goldToken.getAddress();
  console.log(`GoldToken deployed: ${goldAddress}`);

  // 2. Deploy GameAMM
  const GameAMM = await ethers.getContractFactory('GameAMM');
  const gameAMM = await GameAMM.deploy(goldAddress, deployer.address);
  await gameAMM.waitForDeployment();
  const ammAddress = await gameAMM.getAddress();
  console.log(`GameAMM deployed: ${ammAddress}`);

  // 3. Grant AMM the MINTER_ROLE so it can mint/burn GGLD
  await (await goldToken.grantMinter(ammAddress)).wait();
  console.log(`GameAMM granted MINTER_ROLE on GoldToken`);

  // 4. Write/merge deployed.json (keyed per chain so multiple chains coexist)
  const outPath = path.join(__dirname, '../deployed.json');
  const existing = fs.existsSync(outPath) ? safeParse(outPath) : {};
  const block = {
    network:    network.name,
    chainId,
    deployer:   deployer.address,
    goldToken:  goldAddress,
    gameAMM:    ammAddress,
    deployedAt: new Date().toISOString(),
  };
  const merged = {
    ...existing,
    [`chain_${chainId}`]: block,
    // For backwards compatibility: keep the flat keys mirroring the *most-recent* deploy.
    ...block,
  };
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`\ndeployed.json written to ${outPath}`);
  console.log(`Next: npx hardhat run scripts/seed.js --network <same-network>`);
}

function safeParse(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

main().catch(err => { console.error(err); process.exit(1); });
