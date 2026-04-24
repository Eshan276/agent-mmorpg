import { Shop }        from './Shop.js';
import { ShopListing } from './ShopListing.js';

// All shops keyed by their npc id
const SHOPS = {
  merchant: new Shop({
    id: 'merchant', name: "Merchant's Shop",
    listings: [
      // ── Buy from shop ─────────────────────────────────────────
      new ShopListing({ itemId: 'life_potion', buyPrice:  8, sellPrice: 3 }),
      new ShopListing({ itemId: 'heart',       buyPrice:  5, sellPrice: 2 }),
      new ShopListing({ itemId: 'milk_pot',    buyPrice:  6, sellPrice: 2 }),
      new ShopListing({ itemId: 'water_pot',   buyPrice:  4, sellPrice: 1 }),
      new ShopListing({ itemId: 'meat',        buyPrice:  4, sellPrice: 1 }),
      new ShopListing({ itemId: 'fish',        buyPrice:  3, sellPrice: 1 }),
      new ShopListing({ itemId: 'honey',       buyPrice:  5, sellPrice: 2 }),
      new ShopListing({ itemId: 'axe',         buyPrice: 15, sellPrice: 5 }),
      new ShopListing({ itemId: 'pickaxe',     buyPrice: 15, sellPrice: 5 }),
      new ShopListing({ itemId: 'sword',       buyPrice: 20, sellPrice: 8 }),
      // ── Sell only (shop buys these but doesn't stock them) ────
      new ShopListing({ itemId: 'gold_coin',   buyPrice:  0, sellPrice: 0 }), // currency itself
      new ShopListing({ itemId: 'plank',       buyPrice:  0, sellPrice: 2 }),
      new ShopListing({ itemId: 'branch',      buyPrice:  0, sellPrice: 1 }),
      new ShopListing({ itemId: 'rock',        buyPrice:  0, sellPrice: 1 }),
      new ShopListing({ itemId: 'bar_iron',    buyPrice:  0, sellPrice: 6 }),
      new ShopListing({ itemId: 'gem_red',     buyPrice:  0, sellPrice:12 }),
      new ShopListing({ itemId: 'gem_green',   buyPrice:  0, sellPrice:10 }),
      new ShopListing({ itemId: 'bar_gold',    buyPrice:  0, sellPrice:18 }),
    ],
  }),
};

export const ShopRegistry = {
  get(npcId) { return SHOPS[npcId] ?? null; },
};
