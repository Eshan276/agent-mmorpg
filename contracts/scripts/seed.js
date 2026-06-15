const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Seeds the 10 AMM pools.
//   npx hardhat run scripts/seed.js --network mantleSepolia

const POOLS = [
  { id: 'plank',     resource: 1000n, gold: 200n  },
  { id: 'branch',    resource: 1000n, gold: 100n  },
  { id: 'rock',      resource: 1000n, gold: 100n  },
  { id: 'bar_iron',  resource: 500n,  gold: 300n  },
  { id: 'gem_red',   resource: 200n,  gold: 2400n },
  { id: 'gem_green', resource: 200n,  gold: 2000n },
  { id: 'grass',     resource: 1000n, gold: 100n  },
  { id: 'honey',     resource: 500n,  gold: 1000n },
  { id: 'meat',      resource: 500n,  gold: 2000n },
  { id: 'fish',      resource: 500n,  gold: 1500n },
];

async function main() {
  const deployed = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployed.json'), 'utf-8'));
  const [seeder] = await ethers.getSigners();
  const network  = await ethers.provider.getNetwork();

  if (!deployed?.gameAMM) {
    console.error(`✗ no GameAMM address in deployed.json — run deploy.js first`);
    process.exit(1);
  }

  console.log(`Seeding from: ${seeder.address}`);
  console.log(`Network:      chainId=${Number(network.chainId)}`);
  console.log(`GameAMM:      ${deployed.gameAMM}`);

  const gameAMM = await ethers.getContractAt('GameAMM', deployed.gameAMM);

  for (const pool of POOLS) {
    const resourceId = ethers.encodeBytes32String(pool.id);
    const tx = await gameAMM.seedPool(resourceId, pool.resource, pool.gold);
    await tx.wait();
    const price = await gameAMM.getPrice(resourceId);
    console.log(`Pool[${pool.id}] seeded — price: ${ethers.formatEther(price)} GGLD/unit`);
  }

  console.log('\nAll pools seeded. AMM is ready.');
}

main().catch(err => { console.error(err); process.exit(1); });
