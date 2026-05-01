const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);

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

  // 4. Write deployed.json
  const deployed = {
    network:    (await ethers.provider.getNetwork()).name,
    chainId:    Number((await ethers.provider.getNetwork()).chainId),
    deployer:   deployer.address,
    goldToken:  goldAddress,
    gameAMM:    ammAddress,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, '../deployed.json');
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`\ndeployed.json written to ${outPath}`);
  console.log('Next: run seed.js to initialise AMM pools');
}

main().catch(err => { console.error(err); process.exit(1); });
