import { Item } from './Item.js';

export class WeaponItem extends Item {
  /**
   * @param {object} cfg
   * @param {number} cfg.damage - Base damage value
   */
  constructor({ id, name, sprite, desc, damage = 10 }) {
    super({ id, name, type: 'weapon', sprite, desc, stackable: false });
    this.damage = damage;
  }

  // Weapons are equipped, not consumed. Returns false.
  use(_player) { return false; }
}
