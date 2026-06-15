const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Deploys GoldToken + GameAMM to Mantle Sepolia.
//   npx hardhat run scripts/deploy.js --network mantleSepolia

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network:        chainId=${Number(network.chainId)}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:        ${ethers.formatEther(balance)} MNT`);
  if (balance === 0n) {
    console.error('✗ Deployer wallet has 0 MNT — fund it from https://faucet.sepolia.mantle.xyz');
    process.exit(1);
  }

  const GoldToken = await ethers.getContractFactory('GoldToken');
  const goldToken = await GoldToken.deploy(deployer.address);
  await goldToken.waitForDeployment();
  const goldAddress = await goldToken.getAddress();
  console.log(`GoldToken deployed: ${goldAddress}`);

  const GameAMM = await ethers.getContractFactory('GameAMM');
  const gameAMM = await GameAMM.deploy(goldAddress, deployer.address);
  await gameAMM.waitForDeployment();
  const ammAddress = await gameAMM.getAddress();
  console.log(`GameAMM deployed: ${ammAddress}`);

  await (await goldToken.grantMinter(ammAddress)).wait();
  console.log(`GameAMM granted MINTER_ROLE on GoldToken`);

  const outPath = path.join(__dirname, '../deployed.json');
  fs.writeFileSync(outPath, JSON.stringify({
    network:    network.name,
    chainId:    Number(network.chainId),
    deployer:   deployer.address,
    goldToken:  goldAddress,
    gameAMM:    ammAddress,
    deployedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`\ndeployed.json written to ${outPath}`);
  console.log(`Next: npx hardhat run scripts/seed.js --network mantleSepolia`);
  console.log(`Explorer: https://explorer.sepolia.mantle.xyz/address/${ammAddress}`);
}

main().catch(err => { console.error(err); process.exit(1); });
