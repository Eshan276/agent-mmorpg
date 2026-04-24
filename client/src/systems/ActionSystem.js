import { StateManager }  from '../state/StateManager.js';
import { HarvestSystem }  from './HarvestSystem.js';
import { ShopRegistry }   from '../entities/commerce/ShopRegistry.js';

let sceneRef   = null;
let mapObjects = [];
let mapZones   = [];
let playerRef  = null; // Player entity — set via ActionSystem.init()

function isWalkable(tx, ty) {
  const { width, height, collisionData } = StateManager.getState().map;
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
  if (collisionData[ty * width + tx] === 1) return false;
  // Items are walkable (auto-pickup on step); chests/npcs/signs block
  if (mapObjects.some(o => o.tileX === tx && o.tileY === ty &&
      (o.type === 'chest' || o.type === 'npc' || o.type === 'sign'))) return false;
  return true;
}

function getZoneAt(tx, ty) {
  for (const z of mapZones) {
    if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) return z.name;
  }
  return null;
}

function getObjectAt(tx, ty) {
  return mapObjects.find(o => o.tileX === tx && o.tileY === ty);
}

function tryMove(dx, dy, dir) {
  StateManager.setPlayerDir(dir);
  if (sceneRef) sceneRef.updatePlayerDir(dir);

  const { tileX, tileY } = StateManager.getState().player;
  const nx = tileX + dx, ny = tileY + dy;
  if (!isWalkable(nx, ny)) return;

  StateManager.setPlayerMoving(true);
  StateManager.setPlayerPos(nx, ny);

  const zone = getZoneAt(nx, ny);
  if (zone && zone !== StateManager.getState().currentZone) {
    StateManager.setZone(zone);
    sceneRef.showZoneBanner(zone);
  }

  sceneRef.tweenPlayerTo(nx, ny, () => {
    StateManager.setPlayerMoving(false);
    // Auto-pickup item on stepped tile
    const stepped = getObjectAt(nx, ny);
    if (stepped?.type === 'item') {
      sceneRef.pickupWorldItem(stepped);
      mapObjects = mapObjects.filter(o => o !== stepped);
    }
  });
}

function tryInteract() {
  const { tileX, tileY, direction } = StateManager.getState().player;
  const off = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  const [dx, dy] = off[direction];
  const fx = tileX + dx, fy = tileY + dy;

  // Check harvest nodes first (trees, rocks, bushes)
  const node = HarvestSystem.getAt(fx, fy);
  if (node) {
    HarvestSystem.tryHarvest(fx, fy);
    return;
  }

  const obj = getObjectAt(fx, fy);
  if (!obj) return;

  // World items are picked up directly (no energy cost)
  if (obj.type === 'item') {
    sceneRef.pickupWorldItem(obj);
    // Remove from mapObjects so it no longer blocks or shows prompt
    mapObjects = mapObjects.filter(o => o !== obj);
    return;
  }

  // Energy gate — all interactions cost energy
  if (playerRef && !playerRef.spendEnergy(playerRef.energyCostInteract)) {
    sceneRef.showDialog('Not enough energy to interact!');
    return;
  }

  if (obj.type === 'chest') {
    if (obj.opened) { sceneRef.showDialog('The chest is empty.'); }
    else { obj.opened = true; sceneRef.openChest(obj); }
  } else if (obj.type === 'npc') {
    const shop = ShopRegistry.get(obj.id);
    if (shop) {
      sceneRef.game.events.emit('ui:openShop', { shop, player: playerRef });
    } else {
      sceneRef.showDialog(obj.dialog, obj.id);
    }
  } else if (obj.type === 'sign') { sceneRef.showDialog(obj.text); }
}

// Returns the object/node the player is currently facing, or null.
export function getFacingObject() {
  if (!sceneRef) return null;
  const { tileX, tileY, direction } = StateManager.getState().player;
  const off = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  const [dx, dy] = off[direction];
  const fx = tileX + dx, fy = tileY + dy;
  const node = HarvestSystem.getAt(fx, fy);
  if (node && !node.depleted) return { type: 'harvest', resourceType: node.resourceType, tileX: fx, tileY: fy };
  return getObjectAt(fx, fy) ?? null;
}

export const ActionSystem = {
  init(scene, objects, zones, player = null) {
    sceneRef   = scene;
    mapObjects = objects || [];
    mapZones   = zones   || [];
    playerRef  = player;
    // Register dynamically spawned items so they're interactable
    scene.game.events.on('world:itemSpawned', obj => { mapObjects.push(obj); });
  },
  performAction(type) {
    if (!sceneRef || StateManager.getState().player.isMoving) return;
    switch (type) {
      case 'move_up':    tryMove( 0,-1,'up');    break;
      case 'move_down':  tryMove( 0, 1,'down');  break;
      case 'move_left':  tryMove(-1, 0,'left');  break;
      case 'move_right': tryMove( 1, 0,'right'); break;
      case 'interact':   tryInteract();          break;
    }
  },
  getMapObjects() { return mapObjects; },
};

// Global access for bots/devtools/future network layer
window.performAction = t => ActionSystem.performAction(t);
