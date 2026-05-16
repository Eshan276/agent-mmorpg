const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Deploys AgentRegistry to 0G Chain. Run with:
//   npx hardhat run scripts/deploy-og.js --network ogMainnet
// or for testing first:
//   npx hardhat run scripts/deploy-og.js --network ogTestnet

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network:        chainId=${network.chainId}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:        ${ethers.formatEther(balance)} OG`);
  if (balance === 0n) {
    console.error('✗ Deployer wallet has 0 OG — fund it before deploying.');
    process.exit(1);
  }

  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const registry      = await AgentRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`AgentRegistry deployed: ${address}`);

  // Write 0G-specific deployed.json (keeps separate from Base contracts)
  const outPath = path.join(__dirname, '../deployed-og.json');
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : {};
  const updated  = {
    ...existing,
    [`chain_${network.chainId}`]: {
      network:        network.name,
      chainId:        Number(network.chainId),
      agentRegistry:  address,
      deployer:       deployer.address,
      deployedAt:     new Date().toISOString(),
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(updated, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`\nView on explorer: ${network.chainId === 16661n
    ? `https://chainscan.0g.ai/address/${address}`
    : `https://chainscan-galileo.0g.ai/address/${address}`}`);
}

main().catch(err => { console.error(err); process.exit(1); });
