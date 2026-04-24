import { Commerce }     from './Commerce.js';
import { ShopListing }  from './ShopListing.js';
import { ItemRegistry } from '../items/ItemRegistry.js';

export class Shop extends Commerce {
  /**
   * @param {object}         cfg
   * @param {ShopListing[]}  cfg.listings  - Items this shop stocks
   */
  constructor({ id, name, currency = 'gold_coin', listings = [] }) {
    super({ id, name, currency });
    // Map listingId → ShopListing for O(1) lookup
    this._listings = new Map(listings.map(l => [l.itemId, l]));
  }

  getStock() {
    return [...this._listings.values()];
  }

  // Buy qty of listingId for player. Deducts currency from player inventory.
  buy(player, itemId, qty = 1) {
    const listing = this._listings.get(itemId);
    if (!listing) return { ok: false, reason: 'Not in stock.' };
    if (listing.stock !== -1 && listing.stock < qty)
      return { ok: false, reason: `Only ${listing.stock} left in stock.` };

    const totalCost = listing.buyPrice * qty;
    const currencyCount = _countItem(player, this.currency);
    if (currencyCount < totalCost)
      return { ok: false, reason: `Need ${totalCost} gold coins (have ${currencyCount}).` };

    // Check inventory space
    const sample = ItemRegistry.create(itemId);
    if (!sample) return { ok: false, reason: 'Unknown item.' };

    // Deduct currency
    _removeItem(player, this.currency, totalCost);

    // Give items
    for (let i = 0; i < qty; i++) {
      const item = ItemRegistry.create(itemId);
      player.inventory.add(item);
    }

    if (listing.stock !== -1) listing.stock -= qty;
    return { ok: true };
  }

  // Sell qty of itemId from player inventory to shop.
  // Uses listing sellPrice if defined, otherwise falls back to type-based default.
  sell(player, itemId, qty = 1) {
    // Don't buy currency itself
    if (itemId === this.currency)
      return { ok: false, reason: "Can't sell coins." };

    const listing  = this._listings.get(itemId);
    const price    = listing?.sellPrice ?? _defaultSellPrice(player, itemId);
    if (price === 0)
      return { ok: false, reason: "This shop doesn't buy that." };

    const have = _countItem(player, itemId);
    if (have < qty)
      return { ok: false, reason: `You only have ${have}.` };

    _removeItem(player, itemId, qty);
    const earned = price * qty;

    for (let i = 0; i < earned; i++) {
      const coin = ItemRegistry.create(this.currency);
      player.inventory.add(coin);
    }

    return { ok: true, earned };
  }

  // Returns the sell price for any item the player has (for UI display)
  getSellPrice(itemId) {
    if (itemId === this.currency) return 0;
    return this._listings.get(itemId)?.sellPrice ?? _defaultSellPriceById(itemId);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Default sell prices by item type when not explicitly listed
const TYPE_DEFAULTS = { resource: 1, food: 2, potion: 3, tool: 5, weapon: 8, treasure: 5 };

function _defaultSellPriceById(itemId) {
  const item = ItemRegistry.create(itemId);
  if (!item) return 0;
  return TYPE_DEFAULTS[item.type] ?? 1;
}

function _defaultSellPrice(player, itemId) {
  // Find in inventory to get type
  const slot = player.inventory.slots.find(s => s?.id === itemId);
  if (!slot) return 0;
  return TYPE_DEFAULTS[slot.type] ?? 1;
}

function _countItem(player, itemId) {
  return player.inventory.slots
    .filter(s => s?.id === itemId)
    .reduce((n, s) => n + s.quantity, 0);
}

function _removeItem(player, itemId, qty) {
  let remaining = qty;
  const slots = player.inventory.slots;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (!slot || slot.id !== itemId) continue;
    const take = Math.min(slot.quantity, remaining);
    player.inventory.removeAt(i, take);
    remaining -= take;
  }
}
