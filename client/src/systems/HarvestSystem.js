import { TreeResource, RockResource, BushResource } from '../entities/HarvestableResource.js';

// Keyed by "tileX_tileY" for O(1) lookup
const _nodes   = new Map();
let   _scene   = null;
let   _player  = null;

function key(tx, ty) { return `${tx}_${ty}`; }

export const HarvestSystem = {
  init(scene, player) {
    _scene  = scene;
    _player = player;
  },

  // Called from GameScene after the map loads
  registerNodes(nodeDefs) {
    for (const def of nodeDefs) {
      const node = _makeNode(def);
      if (node) _nodes.set(key(def.tileX, def.tileY), node);
    }
  },

  // Returns the node at tile coords, or null
  getAt(tx, ty) {
    return _nodes.get(key(tx, ty)) ?? null;
  },

  // Player swings their equipped tool at tileX,tileY.
  // Returns true if something was hit (for animation trigger).
  tryHarvest(tx, ty) {
    const node = _nodes.get(key(tx, ty));
    if (!node || node.depleted) return false;

    // Get equipped tool from inventory (first tool/weapon slot found)
    const equippedTool = _getEquippedTool();

    // Check if tool is right for this node
    if (equippedTool && !equippedTool.canHarvest(node.requiredTool)) {
      _scene.showDialog(`Need a ${node.requiredTool} to harvest this!`);
      return false;
    }

    if (equippedTool) equippedTool.swing();

    const drops = node.hit(equippedTool);

    // Visual feedback on the node sprite
    _scene.flashHarvestNode(tx, ty, node.hp, node.maxHp);

    if (drops.length > 0) {
      // Give items to inventory, show drop names
      const names = [];
      for (const item of drops) {
        const ok = _player.inventory.add(item);
        if (ok) names.push(item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name);
      }
      if (names.length) _scene.showDialog(`Got: ${names.join(', ')}`);
      _scene.depleteHarvestNode(tx, ty, node.resourceType);
    }

    // Schedule respawn
    if (node.depleted && node.respawnMs > 0) {
      _scene.time.delayedCall(node.respawnMs, () => {
        node.respawn();
        _scene.respawnHarvestNode(tx, ty, node.resourceType);
      });
    }

    return true;
  },

  // Expose nodes for ActionSystem facing check
  allNodes() { return _nodes; },
};

function _makeNode({ type, tileX, tileY }) {
  switch (type) {
    case 'tree': return new TreeResource(tileX, tileY);
    case 'rock_node': return new RockResource(tileX, tileY);
    case 'bush': return new BushResource(tileX, tileY);
    default: return null;
  }
}

function _getEquippedTool() {
  if (!_player) return null;
  const slots = _player.inventory.slots;
  for (const item of slots) {
    if (item && item.type === 'tool' && !item.broken) return item;
  }
  return null;
}
