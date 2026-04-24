import { Item } from './Item.js';

export class FoodItem extends Item {
  constructor({ id, name, sprite, desc, hpRestore = 0, enRestore = 0 }) {
    super({ id, name, type: 'food', sprite, desc, stackable: true, maxStack: 20 });
    this.hpRestore = hpRestore;
    this.enRestore = enRestore;
  }

  use(player) {
    if (!player.alive) return false;
    if (this.hpRestore > 0) player.heal(this.hpRestore);
    if (this.enRestore > 0) player.regenEnergy(this.enRestore);
    return true;
  }
}
