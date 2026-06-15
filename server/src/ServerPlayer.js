// ── Item definitions — server-side only, no Phaser paths ────────────────────
export const ITEM_DEFS = {
  life_potion:  { name: 'Life Potion',  type: 'potion',   stackable: true,  hpRestore: 40 },
  heart:        { name: 'Heart',        type: 'potion',   stackable: true,  hpRestore: 20 },
  milk_pot:     { name: 'Milk Pot',     type: 'potion',   stackable: true,  enRestore: 30 },
  water_pot:    { name: 'Water Pot',    type: 'potion',   stackable: true,  enRestore: 15 },
  meat:         { name: 'Meat',         type: 'food',     stackable: true,  hpRestore: 15 },
  fish:         { name: 'Fish',         type: 'food',     stackable: true,  hpRestore: 10 },
  honey:        { name: 'Honey',        type: 'food',     stackable: true,  enRestore: 20 },
  axe:          { name: 'Axe',          type: 'tool',     stackable: false, toolType: 'axe' },
  pickaxe:      { name: 'Pickaxe',      type: 'tool',     stackable: false, toolType: 'pickaxe' },
  hammer:       { name: 'Hammer',       type: 'tool',     stackable: false, toolType: 'hammer' },
  sword:        { name: 'Sword',        type: 'weapon',   stackable: false },
  katana:       { name: 'Katana',       type: 'weapon',   stackable: false },
  kunai:        { name: 'Kunai',        type: 'weapon',   stackable: false },
  big_sword:    { name: 'Big Sword',    type: 'weapon',   stackable: false },
  plank:        { name: 'Wood Plank',   type: 'resource', stackable: true  },
  branch:       { name: 'Branch',       type: 'resource', stackable: true  },
  rock:         { name: 'Rock',         type: 'resource', stackable: true  },
  grass:        { name: 'Grass Clump',  type: 'resource', stackable: true  },
  bar_iron:     { name: 'Iron Bar',     type: 'resource', stackable: true  },
  bar_gold:     { name: 'Gold Bar',     type: 'resource', stackable: true  },
  gem_red:      { name: 'Red Gem',      type: 'resource', stackable: true  },
  gem_green:    { name: 'Green Gem',    type: 'resource', stackable: true  },
  gold_coin:    { name: 'Gold Coin',    type: 'treasure', stackable: true  },
  silver_coin:  { name: 'Silver Coin',  type: 'treasure', stackable: true  },
  gold_key:     { name: 'Gold Key',     type: 'treasure', stackable: false },
  gold_cup:     { name: 'Gold Cup',     type: 'treasure', stackable: false },
};

// Prices are now dynamic from AMM pools — these are kept for reference only.
// Do not use for server-side gold arithmetic.
export const SHOP_SELL_PRICES = {};
export const SHOP_BUY_PRICES  = {};

// ── ServerPlayer ─────────────────────────────────────────────────────────────
export class ServerPlayer {
  constructor({ agentId, spawnX, spawnY }) {
    this.agentId      = agentId;
    this.tileX        = spawnX;
    this.tileY        = spawnY;
    this.direction    = 'down';
    this.hp           = 100;
    this.maxHp        = 100;
    this.energy       = 100;
    this.maxEnergy    = 100;
    // goldBalance is a cached on-chain balance (BigInt wei); refreshed each observation build.
    // Falls back to 0 when Web3 is disabled.
    this.goldBalance  = 0n;
    this.walletAddress = null; // set by GameServer on agent:register
    this.axlPeerId     = null; // 64-char hex of the agent's AXL spoke public key (whisper())
    this.persona       = '';   // free-form personality text from CLI init
    this.totalSwaps    = 0;    // incremented in GameServer after each verified swap
    this.alive          = true;
    this.zone           = 'Shinobi Village';
    this.totalHarvests  = 0;
    this.lastActionAt = 0;
    this.spawnX       = spawnX;
    this.spawnY       = spawnY;
    // [{id, name, qty, type, toolType|null}]
    this.inventory    = [];
    this.addItem('axe');
    this.addItem('pickaxe');
    // ring buffer — cleared after each observation build
    this.recentEvents = [];
  }

  // Human-readable GGLD amount (divide by 1e18, 2 decimal places)
  get goldDisplay() {
    return (Number(this.goldBalance) / 1e18).toFixed(2);
  }

  pushEvent(msg) {
    this.recentEvents.push(msg);
    if (this.recentEvents.length > 8) this.recentEvents.shift();
  }

  countItem(itemId) {
    return this.inventory.reduce((n, s) => s.id === itemId ? n + s.qty : n, 0);
  }

  addItem(itemId, qty = 1) {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    if (def.stackable) {
      const slot = this.inventory.find(s => s.id === itemId);
      if (slot) { slot.qty += qty; return true; }
    }
    if (this.inventory.length >= 24) return false;
    this.inventory.push({
      id: itemId, name: def.name, qty,
      type: def.type, toolType: def.toolType ?? null,
    });
    return true;
  }

  removeItem(itemId, qty = 1) {
    let remaining = qty;
    for (let i = this.inventory.length - 1; i >= 0 && remaining > 0; i--) {
      if (this.inventory[i].id !== itemId) continue;
      const take = Math.min(this.inventory[i].qty, remaining);
      this.inventory[i].qty -= take;
      remaining -= take;
      if (this.inventory[i].qty <= 0) this.inventory.splice(i, 1);
    }
    return remaining === 0;
  }

  getEquippedTool() {
    return this.inventory.find(s => s.type === 'tool') ?? null;
  }

  toObservationPlayer() {
    return {
      tileX: this.tileX, tileY: this.tileY,
      direction: this.direction,
      hp: this.hp, maxHp: this.maxHp,
      energy: this.energy, maxEnergy: this.maxEnergy,
      zone: this.zone, alive: this.alive,
    };
  }
}
