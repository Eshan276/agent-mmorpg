import { Item } from './Item.js';

export class PotionItem extends Item {
  /**
   * @param {object} cfg
   * @param {number} cfg.hpRestore    - HP restored on use (0 = none)
   * @param {number} cfg.enRestore    - Energy restored on use (0 = none)
   */
  constructor({ id, name, sprite, desc, hpRestore = 0, enRestore = 0 }) {
    super({ id, name, type: 'potion', sprite, desc, stackable: true, maxStack: 10 });
    this.hpRestore = hpRestore;
    this.enRestore = enRestore;
  }

  use(player) {
    if (!player.alive) return false;
    if (this.hpRestore > 0) player.heal(this.hpRestore);
    if (this.enRestore > 0) player.regenEnergy(this.enRestore);
    return true; // consumed
  }
}
