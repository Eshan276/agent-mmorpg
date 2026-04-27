import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { ServerPlayer, ITEM_DEFS, SHOP_SELL_PRICES, SHOP_BUY_PRICES } from './ServerPlayer.js';

const __dir = dirname(fileURLToPath(import.meta.url));

const HOSTILE_ZONES = new Set(['Forest of Whispers', 'Sunken Sands Desert', 'Mountain Pass']);

const NODE_CONFIG = {
  tree: {
    requiredTool: 'axe', maxHp: 3, respawnMs: 30000,
    drops: [
      { itemId: 'plank',  qty: [2, 4], chance: 1.0 },
      { itemId: 'branch', qty: [1, 1], chance: 0.6 },
    ],
  },
  rock_node: {
    requiredTool: 'pickaxe', maxHp: 4, respawnMs: 60000,
    drops: [
      { itemId: 'rock',     qty: [1, 3], chance: 1.0 },
      { itemId: 'bar_iron', qty: [1, 1], chance: 0.25 },
      { itemId: 'gem_red',  qty: [1, 1], chance: 0.10 },
    ],
  },
  bush: {
    requiredTool: 'none', maxHp: 1, respawnMs: 15000,
    drops: [
      { itemId: 'grass', qty: [1, 1], chance: 1.0 },
      { itemId: 'honey', qty: [1, 1], chance: 0.2  },
    ],
  },
};

const DIR_OFFSETS = {
  up:    [  0, -1 ],
  down:  [  0,  1 ],
  left:  [ -1,  0 ],
  right: [  1,  0 ],
};

const ZONE_ITEM_POOLS = {
  'Shinobi Village':     ['life_potion', 'heart', 'gold_coin', 'meat', 'milk_pot'],
  'Forest of Whispers':  ['gem_green', 'rock', 'grass', 'fish', 'bar_iron'],
  'Sunken Sands Desert': ['gold_coin', 'silver_coin', 'honey', 'gem_red', 'water_pot'],
  'Crystal Lake':        ['gem_red', 'gem_green', 'bar_gold', 'water_pot', 'life_potion'],
  'Mountain Pass':       ['rock', 'bar_iron', 'gem_red', 'meat', 'heart'],
};

function rollRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class WorldSimulation {
  constructor() {
    const raw = readFileSync(join(__dir, '../../client/public/tilemap.json'), 'utf-8');
    const mapData = JSON.parse(raw);

    this._width          = mapData.width;
    this._height         = mapData.height;
    this._spawn          = mapData.spawn;
    this._zones          = mapData.zones ?? [];
    this._collisionData  = mapData.layers.find(l => l.name === 'collision').data;

    // Static objects that block tiles or are interactable
    const objects = mapData.objects ?? [];
    this._staticObjects  = objects.filter(o => ['npc', 'chest', 'sign'].includes(o.type));

    // Harvest nodes
    this._harvestNodes   = new Map();
    for (const o of objects.filter(o => o.type === 'harvestNode')) {
      const cfg = NODE_CONFIG[o.nodeType];
      if (!cfg) continue;
      const key = `${o.tileX}_${o.tileY}`;
      this._harvestNodes.set(key, {
        key, nodeType: o.nodeType,
        tileX: o.tileX, tileY: o.tileY,
        hp: cfg.maxHp, maxHp: cfg.maxHp,
        depleted: false, respawnAt: null,
        respawnMs: cfg.respawnMs,
      });
    }

    // World items (static spawns from tilemap)
    this._worldItems  = new Map();
    for (const o of objects.filter(o => o.type === 'item')) {
      const key = `${o.tileX}_${o.tileY}`;
      this._worldItems.set(key, { itemId: o.itemId, tileX: o.tileX, tileY: o.tileY });
    }

    // Chest state
    this._chestState  = new Map();
    for (const o of objects.filter(o => o.type === 'chest')) {
      const key = `${o.tileX}_${o.tileY}`;
      this._chestState.set(key, { opened: false, lootItems: o.lootItems ?? [] });
    }

    this._players = new Map();  // agentId → ServerPlayer
    this._tick    = 0;

    this._startTicks();
    console.log(`[WorldSim] loaded map ${this._width}×${this._height}, ` +
      `${this._harvestNodes.size} nodes, ${this._staticObjects.length} objects`);
  }

  // ── Player management ──────────────────────────────────────────────────────

  registerPlayer(agentId) {
    const player = new ServerPlayer({
      agentId,
      spawnX: this._spawn.tileX,
      spawnY: this._spawn.tileY,
    });
    this._players.set(agentId, player);
    console.log(`[WorldSim] ${agentId} joined at (${player.tileX},${player.tileY})`);
    return player;
  }

  removePlayer(agentId) {
    this._players.delete(agentId);
    console.log(`[WorldSim] ${agentId} left`);
  }

  // ── Action processing ──────────────────────────────────────────────────────

  processAction(agentId, action) {
    const player = this._players.get(agentId);
    if (!player || !player.alive) return { ok: false };

    const now = Date.now();
    if (now - player.lastActionAt < 150) return { ok: false };
    player.lastActionAt = now;

    const move = {
      move_up:    { dx:  0, dy: -1, dir: 'up'    },
      move_down:  { dx:  0, dy:  1, dir: 'down'  },
      move_left:  { dx: -1, dy:  0, dir: 'left'  },
      move_right: { dx:  1, dy:  0, dir: 'right' },
    }[action];

    if (move) {
      player.direction = move.dir;
      const nx = player.tileX + move.dx;
      const ny = player.tileY + move.dy;
      if (this._isWalkable(nx, ny, agentId)) {
        player.tileX = nx;
        player.tileY = ny;
        const zone = this._getZoneAt(nx, ny);
        if (zone !== player.zone) {
          player.zone = zone;
          player.pushEvent(`Entered ${zone}`);
        }
        // Auto-pickup world item on stepped tile
        const itemKey = `${nx}_${ny}`;
        const wi = this._worldItems.get(itemKey);
        if (wi) {
          if (player.addItem(wi.itemId)) {
            this._worldItems.delete(itemKey);
            player.pushEvent(`Picked up ${ITEM_DEFS[wi.itemId]?.name ?? wi.itemId}`);
          }
        }
      }
      return { ok: true };
    }

    if (action === 'interact') return this._processInteract(player);

    if (action === 'eat') return this._processEat(player);

    if (action.startsWith('buy:')) {
      const itemId = action.slice(4);
      return this._processBuy(player, itemId);
    }

    // 'wait' — valid no-op
    return { ok: true };
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  _processInteract(player) {
    const [fdx, fdy] = DIR_OFFSETS[player.direction];
    const fx = player.tileX + fdx;
    const fy = player.tileY + fdy;

    // 1. Harvest node?
    const nodeKey = `${fx}_${fy}`;
    const node = this._harvestNodes.get(nodeKey);
    if (node && !node.depleted) return this._processHarvest(player, node);

    // 2. World item on facing tile?
    const wiKey = `${fx}_${fy}`;
    const wi = this._worldItems.get(wiKey);
    if (wi) {
      if (player.addItem(wi.itemId)) {
        this._worldItems.delete(wiKey);
        player.pushEvent(`Picked up ${ITEM_DEFS[wi.itemId]?.name ?? wi.itemId}`);
      }
      return { ok: true };
    }

    // 3. Static object?
    const obj = this._staticObjects.find(o => o.tileX === fx && o.tileY === fy);
    if (!obj) return { ok: false };

    // Energy gate for non-item interactions
    if (player.energy < 10) {
      player.pushEvent('Not enough energy to interact!');
      return { ok: false };
    }
    player.energy = Math.max(0, player.energy - 10);

    if (obj.type === 'chest') {
      const chest = this._chestState.get(`${fx}_${fy}`);
      if (!chest || chest.opened) {
        player.pushEvent('The chest is empty.');
        return { ok: true };
      }
      chest.opened = true;
      const gained = [];
      for (const id of chest.lootItems) {
        if (player.addItem(id)) gained.push(ITEM_DEFS[id]?.name ?? id);
      }
      player.pushEvent(gained.length ? `Opened chest: ${gained.join(', ')}` : 'Chest was empty.');
      return { ok: true };
    }

    if (obj.type === 'npc') {
      if (obj.id === 'merchant') return this._processMerchant(player);
      player.pushEvent(`[${obj.id.toUpperCase()}] ${obj.dialog ?? '...'}`);
      return { ok: true };
    }

    if (obj.type === 'sign') {
      player.pushEvent(`[Sign] ${obj.text ?? ''}`);
      return { ok: true };
    }

    return { ok: true };
  }

  _processHarvest(player, node) {
    const cfg = NODE_CONFIG[node.nodeType];
    if (cfg.requiredTool !== 'none') {
      const tool = player.getEquippedTool();
      if (!tool || tool.toolType !== cfg.requiredTool) {
        player.pushEvent(`Need a ${cfg.requiredTool} to harvest this!`);
        return { ok: false };
      }
    }

    node.hp -= 1;
    if (node.hp > 0) {
      player.pushEvent(`Hit ${node.nodeType} (${node.hp}/${node.maxHp} HP left)`);
      return { ok: true };
    }

    // Depleted — roll drops
    node.depleted  = true;
    node.respawnAt = Date.now() + node.respawnMs;
    node.hp        = 0;

    const dropped = [];
    for (const drop of cfg.drops) {
      if (Math.random() > drop.chance) continue;
      const qty = Array.isArray(drop.qty) ? rollRange(drop.qty) : drop.qty;
      if (player.addItem(drop.itemId, qty)) {
        dropped.push(`${qty}x ${ITEM_DEFS[drop.itemId]?.name ?? drop.itemId}`);
      }
    }
    player.pushEvent(dropped.length
      ? `Harvested ${node.nodeType}: ${dropped.join(', ')}`
      : `Harvested ${node.nodeType} (inventory full?)`);
    return { ok: true };
  }

  _processMerchant(player) {
    // Sell all sellable items for gold
    const soldParts = [];
    let earned = 0;
    for (const slot of [...player.inventory]) {
      const price = SHOP_SELL_PRICES[slot.id];
      if (!price) continue;
      earned += price * slot.qty;
      soldParts.push(`${slot.qty}x ${slot.name}`);
      player.removeItem(slot.id, slot.qty);
    }
    if (earned > 0) {
      player.gold += earned;
      player.pushEvent(`Sold ${soldParts.join(', ')} → +${earned} gold (total: ${player.gold})`);
    } else {
      player.pushEvent('[MERCHANT] Nothing to sell right now.');
    }
    return { ok: true };
  }

  _processEat(player) {
    const FOOD_TYPES = new Set(['food', 'potion']);
    const slot = player.inventory.find(s => FOOD_TYPES.has(ITEM_DEFS[s.id]?.type));
    if (!slot) {
      player.pushEvent('Nothing to eat!');
      return { ok: false };
    }
    const def = ITEM_DEFS[slot.id];
    player.removeItem(slot.id, 1);
    if (def.hpRestore) player.hp = Math.min(player.maxHp, player.hp + def.hpRestore);
    if (def.enRestore) player.energy = Math.min(player.maxEnergy, player.energy + def.enRestore);
    player.pushEvent(`Ate ${def.name} → +${def.hpRestore ?? 0} HP, +${def.enRestore ?? 0} EN`);
    return { ok: true };
  }

  _processBuy(player, itemId) {
    const price = SHOP_BUY_PRICES[itemId];
    if (!price) {
      player.pushEvent(`[MERCHANT] Cannot buy: ${itemId}`);
      return { ok: false };
    }
    // Must be adjacent to (facing) the merchant
    const [fdx, fdy] = DIR_OFFSETS[player.direction];
    const fx = player.tileX + fdx, fy = player.tileY + fdy;
    const obj = this._staticObjects.find(o => o.tileX === fx && o.tileY === fy && o.id === 'merchant');
    if (!obj) {
      player.pushEvent(`[MERCHANT] Not facing merchant`);
      return { ok: false };
    }
    if (player.gold < price) {
      player.pushEvent(`[MERCHANT] Need ${price}g for ${itemId}, have ${player.gold}g`);
      return { ok: false };
    }
    if (!player.addItem(itemId)) {
      player.pushEvent(`[MERCHANT] Inventory full`);
      return { ok: false };
    }
    player.gold -= price;
    player.pushEvent(`Bought ${ITEM_DEFS[itemId]?.name ?? itemId} for ${price}g (gold: ${player.gold})`);
    return { ok: true };
  }

  // ── Observation & renderer state ───────────────────────────────────────────

  buildObservation(agentId) {
    const player = this._players.get(agentId);
    if (!player) return null;

    const { tileX, tileY, direction } = player;
    const [fdx, fdy] = DIR_OFFSETS[direction];
    const fx = tileX + fdx, fy = tileY + fdy;

    const NEARBY = 5;

    const nearbyNodes = [];
    for (const node of this._harvestNodes.values()) {
      if (Math.abs(node.tileX - tileX) <= NEARBY && Math.abs(node.tileY - tileY) <= NEARBY) {
        nearbyNodes.push({
          resourceType: node.nodeType,
          tileX: node.tileX, tileY: node.tileY,
          depleted: node.depleted,
        });
      }
    }

    const nearbyItems = [];
    for (const wi of this._worldItems.values()) {
      if (Math.abs(wi.tileX - tileX) <= NEARBY && Math.abs(wi.tileY - tileY) <= NEARBY) {
        nearbyItems.push({ id: wi.itemId, tileX: wi.tileX, tileY: wi.tileY });
      }
    }

    const blockedDirections = ['up', 'down', 'left', 'right'].filter(d => {
      const [dx, dy] = DIR_OFFSETS[d];
      return !this._isWalkable(tileX + dx, tileY + dy, agentId);
    });

    const otherAgents = [];
    for (const [id, p] of this._players) {
      if (id !== agentId) {
        otherAgents.push({
          agentId: id, tileX: p.tileX, tileY: p.tileY,
          hp: p.hp, zone: p.zone,
        });
      }
    }

    const events = [...player.recentEvents];
    player.recentEvents = [];

    return {
      tick: ++this._tick,
      player: player.toObservationPlayer(),
      inventory: player.inventory.map(s => ({ id: s.id, name: s.name, qty: s.qty })),
      gold: player.gold,
      facing: this._buildFacingInfo(fx, fy),
      nearbyNodes,
      nearbyItems,
      blockedDirections,
      recentEvents: events,
      otherAgents,
    };
  }

  _buildFacingInfo(fx, fy) {
    const node = this._harvestNodes.get(`${fx}_${fy}`);
    if (node && !node.depleted) {
      return { type: 'harvest', resourceType: node.nodeType, tileX: fx, tileY: fy,
               requiredTool: NODE_CONFIG[node.nodeType].requiredTool };
    }
    const wi = this._worldItems.get(`${fx}_${fy}`);
    if (wi) return { type: 'item', itemId: wi.itemId, tileX: fx, tileY: fy };
    const obj = this._staticObjects.find(o => o.tileX === fx && o.tileY === fy);
    if (!obj) return null;
    if (obj.type === 'chest') {
      const c = this._chestState.get(`${fx}_${fy}`);
      return { type: 'chest', tileX: fx, tileY: fy, opened: c?.opened ?? false };
    }
    if (obj.type === 'npc') return { type: 'npc', id: obj.id, tileX: fx, tileY: fy };
    if (obj.type === 'sign') return { type: 'sign', text: obj.text, tileX: fx, tileY: fy };
    return null;
  }

  buildRendererState() {
    return {
      players: [...this._players.values()].map(p => ({
        agentId:   p.agentId,
        tileX:     p.tileX,
        tileY:     p.tileY,
        direction: p.direction,
        hp:        p.hp,
        maxHp:     p.maxHp,
        energy:    p.energy,
        maxEnergy: p.maxEnergy,
        gold:      p.gold,
        zone:      p.zone,
        alive:     p.alive,
        inventory: p.inventory.map(s => ({ id: s.id, name: s.name, qty: s.qty })),
      })),
      worldItems: [...this._worldItems.values()].map(wi => ({
        id: wi.itemId, tileX: wi.tileX, tileY: wi.tileY,
      })),
      harvestNodes: [...this._harvestNodes.values()].map(n => ({
        key: n.key, tileX: n.tileX, tileY: n.tileY,
        nodeType: n.nodeType, depleted: n.depleted,
      })),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _isWalkable(tx, ty, excludeAgentId = null) {
    if (tx < 0 || ty < 0 || tx >= this._width || ty >= this._height) return false;
    if (this._collisionData[ty * this._width + tx] === 1) return false;
    if (this._staticObjects.some(o => o.tileX === tx && o.tileY === ty)) return false;
    for (const [id, p] of this._players) {
      if (id !== excludeAgentId && p.tileX === tx && p.tileY === ty && p.alive) return false;
    }
    return true;
  }

  _getZoneAt(tx, ty) {
    for (const z of this._zones) {
      if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) return z.name;
    }
    return 'Unknown';
  }

  // ── Ticks ──────────────────────────────────────────────────────────────────

  _startTicks() {
    // Zone-based stat tick every 20 seconds: hostile drains HP+energy, safe only restores energy
    setInterval(() => {
      for (const player of this._players.values()) {
        if (!player.alive) continue;
        if (HOSTILE_ZONES.has(player.zone)) {
          player.hp     = Math.max(0, player.hp - 2);
          player.energy = Math.max(0, player.energy - 2);
          if (player.hp === 0) this._killPlayer(player);
        } else {
          // Safe zone: energy recovers, but HP does NOT regen — must eat to heal
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
        }
      }
    }, 20000);

    // Hunger drain every 30 seconds regardless of zone
    setInterval(() => {
      for (const player of this._players.values()) {
        if (!player.alive) continue;
        player.hp = Math.max(0, player.hp - 3);
        if (player.hp === 0) this._killPlayer(player);
      }
    }, 30000);

    // Harvest node respawn check every 5 seconds
    setInterval(() => {
      const now = Date.now();
      for (const node of this._harvestNodes.values()) {
        if (node.depleted && node.respawnAt && now >= node.respawnAt) {
          node.hp        = node.maxHp;
          node.depleted  = false;
          node.respawnAt = null;
        }
      }
    }, 5000);

    // World item spawner every 6 seconds
    setInterval(() => this._trySpawnWorldItem(), 6000);
  }

  _killPlayer(player) {
    player.alive = false;
    player.pushEvent('You died! Respawning in 3 seconds...');
    setTimeout(() => this._respawnPlayer(player), 3000);
  }

  _respawnPlayer(player) {
    player.hp     = player.maxHp;
    player.energy = player.maxEnergy;
    player.tileX  = player.spawnX;
    player.tileY  = player.spawnY;
    player.zone   = this._getZoneAt(player.spawnX, player.spawnY) || 'Shinobi Village';
    player.alive  = true;
    player.pushEvent('Respawned at Shinobi Village');
  }

  _trySpawnWorldItem() {
    const MAX = 20, MIN = 6;
    if (this._worldItems.size >= MAX) return;
    if (this._worldItems.size >= MIN && Math.random() > 0.4) return;

    const zoneNames = this._zones.map(z => z.name).filter(n => ZONE_ITEM_POOLS[n]);
    if (!zoneNames.length) return;
    const zoneName = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    const zoneDef  = this._zones.find(z => z.name === zoneName);
    const pool     = ZONE_ITEM_POOLS[zoneName];
    const itemId   = pool[Math.floor(Math.random() * pool.length)];

    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = zoneDef.x + Math.floor(Math.random() * zoneDef.w);
      const ty = zoneDef.y + Math.floor(Math.random() * zoneDef.h);
      if (this._collisionData[ty * this._width + tx] === 1) continue;
      const key = `${tx}_${ty}`;
      if (this._worldItems.has(key)) continue;
      if (this._staticObjects.some(o => o.tileX === tx && o.tileY === ty)) continue;
      this._worldItems.set(key, { itemId, tileX: tx, tileY: ty });
      break;
    }
  }
}
