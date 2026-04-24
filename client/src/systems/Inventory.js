// Inventory manages a fixed-size slot grid on the player.
// Emits 'inventoryChanged' on the player entity whenever it mutates.

export class Inventory {
  constructor(player, { slots = 24 } = {}) {
    this._player = player;
    this._slots  = new Array(slots).fill(null); // each slot: Item instance | null
    this._size   = slots;
  }

  // Returns array copy of slots (nulls included)
  get slots() { return [...this._slots]; }

  // Add an item. Stacks if possible, otherwise fills first empty slot.
  // Returns true if added, false if inventory full.
  add(item) {
    if (!item) return false;

    if (item.stackable) {
      // Try to stack into an existing slot of the same id
      for (let i = 0; i < this._size; i++) {
        const slot = this._slots[i];
        if (slot && slot.id === item.id && slot.quantity < slot.maxStack) {
          const space = slot.maxStack - slot.quantity;
          const take  = Math.min(space, item.quantity);
          slot.quantity += take;
          item.quantity -= take;
          if (item.quantity <= 0) {
            this._notify();
            return true;
          }
        }
      }
    }

    // Find first empty slot
    const idx = this._slots.findIndex(s => s === null);
    if (idx === -1) return false; // full
    this._slots[idx] = item;
    this._notify();
    return true;
  }

  // Remove one item (or a quantity) from slot index. Returns removed item or null.
  removeAt(index, qty = 1) {
    const slot = this._slots[index];
    if (!slot) return null;
    const removed = qty >= slot.quantity ? slot : null;
    if (removed) {
      this._slots[index] = null;
    } else {
      slot.quantity -= qty;
    }
    this._notify();
    return removed ?? slot; // caller gets reference
  }

  // Use item at slot index (calls item.use(player)), removes if consumed.
  useAt(index) {
    const slot = this._slots[index];
    if (!slot) return;
    const consumed = slot.use(this._player);
    if (consumed) {
      slot.quantity -= 1;
      if (slot.quantity <= 0) this._slots[index] = null;
      this._notify();
    }
  }

  // Returns slot index of first item matching id, or -1
  findById(id) {
    return this._slots.findIndex(s => s?.id === id);
  }

  _notify() {
    this._player._emit('inventoryChanged', this.slots);
  }
}
