const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Initial virtual reserves per pool — determines starting price (gold/resource).
// price = goldUnits / resourceUnits  (GGLD per 1 unit)
const POOLS = [
  { id: 'plank',     resource: 1000n, gold: 200n  },  // 0.2 GGLD/plank
  { id: 'branch',    resource: 1000n, gold: 100n  },  // 0.1 GGLD/branch
  { id: 'rock',      resource: 1000n, gold: 100n  },  // 0.1 GGLD/rock
  { id: 'bar_iron',  resource: 500n,  gold: 300n  },  // 0.6 GGLD/iron
  { id: 'gem_red',   resource: 200n,  gold: 2400n },  // 12 GGLD/gem_red
  { id: 'gem_green', resource: 200n,  gold: 2000n },  // 10 GGLD/gem_green
  { id: 'grass',     resource: 1000n, gold: 100n  },  // 0.1 GGLD/grass
  { id: 'honey',     resource: 500n,  gold: 1000n },  // 2 GGLD/honey
  { id: 'meat',      resource: 500n,  gold: 2000n },  // 4 GGLD/meat
  { id: 'fish',      resource: 500n,  gold: 1500n },  // 3 GGLD/fish
];

async function main() {
  const deployed = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployed.json'), 'utf-8'));
  const [seeder] = await ethers.getSigners();
  console.log(`Seeding from: ${seeder.address}`);
  console.log(`GameAMM: ${deployed.gameAMM}`);

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
