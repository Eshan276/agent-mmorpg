import { Item } from './Item.js';

export class TreasureItem extends Item {
  constructor({ id, name, sprite, desc, value = 1 }) {
    super({ id, name, type: 'treasure', sprite, desc, stackable: true, maxStack: 999 });
    this.value = value;
  }
}
