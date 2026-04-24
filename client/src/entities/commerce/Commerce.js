// Base class for all commerce entities (shops, traders, auction houses).
// Subclasses implement getStock(), buy(), sell().
export class Commerce {
  constructor({ id, name, currency = 'gold_coin' }) {
    this.id       = id;
    this.name     = name;
    this.currency = currency; // item id used as money
  }

  // Returns array of ShopListing objects available for purchase
  getStock() { return []; }

  // Attempt to buy listingId qty times. Returns { ok, reason }
  buy(_player, _listingId, _qty) { return { ok: false, reason: 'Not implemented' }; }

  // Attempt to sell itemId qty times. Returns { ok, reason, earned }
  sell(_player, _itemId, _qty) { return { ok: false, reason: 'Not implemented' }; }
}
