import { ItemRegistry } from '../items/ItemRegistry.js';

// A listing in a shop. Not itself an Item — it wraps item metadata with pricing.
// Inherits nothing from Item (it's a catalogue entry, not a thing you carry).
export class ShopListing {
  /**
   * @param {string} itemId    - ItemRegistry id
   * @param {number} buyPrice  - Cost in currency units to purchase 1
   * @param {number} sellPrice - What the shop pays per unit when player sells (0 = not accepted)
   * @param {number} stock     - How many the shop has (-1 = infinite)
   */
  constructor({ itemId, buyPrice, sellPrice = 0, stock = -1 }) {
    this.itemId    = itemId;
    this.buyPrice  = buyPrice;
    this.sellPrice = sellPrice;
    this.stock     = stock;

    // Cache display info from registry
    const sample   = ItemRegistry.create(itemId);
    this.name      = sample?.name   ?? itemId;
    this.desc      = sample?.desc   ?? '';
    this.sprite    = sample?.sprite ?? '';
    this.itemType  = sample?.type   ?? 'resource';
  }
}
