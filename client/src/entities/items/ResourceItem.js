import { Item } from './Item.js';

export class ResourceItem extends Item {
  constructor({ id, name, sprite, desc }) {
    super({ id, name, type: 'resource', sprite, desc, stackable: true, maxStack: 99 });
  }
}

// Plank is a resource derived from chopping trees — inherits ResourceItem
export class PlankItem extends ResourceItem {
  constructor() {
    super({
      id:     'plank',
      name:   'Wood Plank',
      sprite: 'assets/items/Resource/Branch.png',
      desc:   'Rough-cut plank. Used for crafting.',
    });
  }
}
