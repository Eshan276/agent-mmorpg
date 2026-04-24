import { Item } from './Item.js';

export class ToolItem extends Item {
  /**
   * @param {object} cfg
   * @param {string} cfg.toolType  - 'axe' | 'pickaxe' | 'sword' | 'hammer' | 'hoe'
   * @param {number} cfg.damage    - Damage dealt per swing (to harvestables and future enemies)
   * @param {number} cfg.durability - Max uses before breaking (Infinity = unbreakable)
   */
  constructor({ id, name, sprite, desc, toolType, damage = 10, durability = Infinity }) {
    super({ id, name, type: 'tool', sprite, desc, stackable: false });
    this.toolType   = toolType;
    this.damage     = damage;
    this.durability = durability;
    this.uses       = 0;
  }

  // Returns true if this tool can harvest the given requiredTool type.
  // An axe can harvest 'axe' nodes; a pickaxe harvests 'pickaxe' nodes, etc.
  // Any tool (or bare hands) can harvest 'none' nodes.
  canHarvest(requiredTool) {
    if (!requiredTool || requiredTool === 'none') return true;
    return this.toolType === requiredTool;
  }

  // Record a use; returns false if the tool broke.
  swing() {
    if (this.durability === Infinity) return true;
    this.uses += 1;
    return this.uses < this.durability;
  }

  get broken() {
    return this.durability !== Infinity && this.uses >= this.durability;
  }

  // Tools are not consumed on click-use
  use(_player) { return false; }
}
