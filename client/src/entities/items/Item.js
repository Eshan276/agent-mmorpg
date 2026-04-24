// Base class for all items. Subclasses override use() and provide their own fields.
export class Item {
  /**
   * @param {object} cfg
   * @param {string} cfg.id       - Unique string id, e.g. 'life_potion'
   * @param {string} cfg.name     - Display name
   * @param {string} cfg.type     - 'potion' | 'weapon' | 'resource' | 'treasure' | 'food' | 'scroll' | 'tool'
   * @param {string} cfg.sprite   - Path relative to assets/, e.g. 'items/Potion/LifePot.png'
   * @param {string} cfg.desc     - Short description shown in inventory tooltip
   * @param {boolean} cfg.stackable
   * @param {number}  cfg.maxStack
   */
  constructor({ id, name, type, sprite, desc = '', stackable = true, maxStack = 99 }) {
    this.id        = id;
    this.name      = name;
    this.type      = type;
    this.sprite    = sprite;
    this.desc      = desc;
    this.stackable = stackable;
    this.maxStack  = stackable ? maxStack : 1;
    this.quantity  = 1;
  }

  // Called when the player uses/equips this item. Override in subclasses.
  // Returns true if the item was consumed (should be removed/decremented).
  use(_player) { return false; }

  // Serialise to plain object (for future save/network)
  toJSON() {
    return { id: this.id, quantity: this.quantity };
  }
}
