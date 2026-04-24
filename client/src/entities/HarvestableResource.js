import { ItemRegistry } from './items/ItemRegistry.js';

/**
 * Base class for anything in the world you can chop/mine/gather.
 * Subclasses define requiredTool, drops, maxHp, and visual appearance.
 *
 * Drop format: [{ itemId, qty, chance }]
 *   chance: 0–1 probability each drop entry is included (1 = always)
 */
export class HarvestableResource {
  constructor({ tileX, tileY, requiredTool = 'none', drops = [], maxHp = 3, respawnMs = 30000 }) {
    this.tileX        = tileX;
    this.tileY        = tileY;
    this.requiredTool = requiredTool; // 'axe' | 'pickaxe' | 'none'
    this.drops        = drops;
    this.maxHp        = maxHp;
    this.hp           = maxHp;
    this.respawnMs    = respawnMs;    // ms until it regrows (0 = never)
    this.depleted     = false;
  }

  // Called by HarvestSystem when a tool swing lands.
  // Returns array of Item instances that dropped, or [] if not depleted yet / wrong tool.
  hit(toolItem) {
    if (this.depleted) return [];
    if (toolItem && !toolItem.canHarvest(this.requiredTool)) return [];

    this.hp -= 1;
    if (this.hp > 0) return []; // still alive, no drops yet

    this.depleted = true;
    return this._rollDrops();
  }

  _rollDrops() {
    const results = [];
    for (const drop of this.drops) {
      if (Math.random() > drop.chance) continue;
      const qty = typeof drop.qty === 'function' ? drop.qty() : drop.qty;
      for (let i = 0; i < qty; i++) {
        const item = ItemRegistry.create(drop.itemId);
        if (item) results.push(item);
      }
    }
    return results;
  }

  // Restore this resource to full hp (called after respawnMs by HarvestSystem)
  respawn() {
    this.hp       = this.maxHp;
    this.depleted = false;
  }
}

// ── Concrete subclasses ──────────────────────────────────────────────────────

export class TreeResource extends HarvestableResource {
  constructor(tileX, tileY) {
    super({
      tileX, tileY,
      requiredTool: 'axe',
      maxHp: 3,
      respawnMs: 30000, // 30 s
      drops: [
        { itemId: 'plank',  qty: () => 2 + Math.floor(Math.random() * 3), chance: 1.0 }, // 2–4 planks
        { itemId: 'branch', qty: 1,  chance: 0.6 },
      ],
    });
    this.resourceType = 'tree';
  }
}

export class RockResource extends HarvestableResource {
  constructor(tileX, tileY) {
    super({
      tileX, tileY,
      requiredTool: 'pickaxe',
      maxHp: 4,
      respawnMs: 60000, // 60 s
      drops: [
        { itemId: 'rock',    qty: () => 1 + Math.floor(Math.random() * 3), chance: 1.0 },
        { itemId: 'bar_iron',qty: 1, chance: 0.25 },
        { itemId: 'gem_red', qty: 1, chance: 0.10 },
      ],
    });
    this.resourceType = 'rock';
  }
}

export class BushResource extends HarvestableResource {
  constructor(tileX, tileY) {
    super({
      tileX, tileY,
      requiredTool: 'none', // bare hands ok
      maxHp: 1,
      respawnMs: 15000,
      drops: [
        { itemId: 'grass', qty: 1, chance: 1.0 },
        { itemId: 'honey', qty: 1, chance: 0.2 },
      ],
    });
    this.resourceType = 'bush';
  }
}
