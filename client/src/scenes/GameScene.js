import { TILE, HOUSE } from '../constants/Tilesets.js';
import { StateManager } from '../state/StateManager.js';
import { ActionSystem, getFacingObject } from '../systems/ActionSystem.js';
import { InputHandler } from '../systems/InputHandler.js';
import { TilemapBuilder } from '../world/TilemapBuilder.js';
import { Player } from '../entities/Player.js';
import { ItemRegistry } from '../entities/items/ItemRegistry.js';
import { HarvestSystem } from '../systems/HarvestSystem.js';

// Zones considered hostile (health drains while inside)
const HOSTILE_ZONES = new Set(['Forest of Whispers', 'Sunken Sands Desert', 'Mountain Pass']);

export class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // --------------------------------------------------------------------------
  preload() {
    const TS = 'assets/tilesets/';
    this.load.spritesheet('ts_floor',   TS+'TilesetFloor.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_nature',  TS+'TilesetNature.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_water',   TS+'TilesetWater.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_house',   TS+'TilesetHouse.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_desert',  TS+'TilesetDesert.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_relief',  TS+'TilesetRelief.png',  { frameWidth:16, frameHeight:16 });

    const CH = 'assets/characters/';
    this.load.spritesheet('player',       CH+'NinjaBlue.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_villager', CH+'Villager.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_guard',    CH+'Inspector.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_elder',    CH+'Master.png',     { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hunter',   CH+'Hunter.png',     { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hermit',   CH+'Caveman.png',    { frameWidth:16, frameHeight:16 });

    this.load.json('tilemap', 'tilemap.json');

    // Item sprites — load each unique sprite used by the registry
    const IT = 'assets/items/';
    this.load.image('item_life_potion',  IT+'Potion/LifePot.png');
    this.load.image('item_heart',        IT+'Potion/Heart.png');
    this.load.image('item_milk_pot',     IT+'Potion/MilkPot.png');
    this.load.image('item_water_pot',    IT+'Potion/WaterPot.png');
    this.load.image('item_sword',        IT+'Weapons/Sword/Sprite.png');
    this.load.image('item_katana',       IT+'Weapons/Katana/Sprite.png');
    this.load.image('item_kunai',        IT+'Weapons/Sai/Sprite.png');
    this.load.image('item_gem_red',      IT+'Resource/GemRed.png');
    this.load.image('item_gem_green',    IT+'Resource/GemGreen.png');
    this.load.image('item_bar_gold',     IT+'Resource/BarGold.png');
    this.load.image('item_bar_iron',     IT+'Resource/BarIron.png');
    this.load.image('item_rock',         IT+'Resource/Rock.png');
    this.load.image('item_grass',        IT+'Resource/Grass.png');
    this.load.image('item_gold_coin',    IT+'Treasure/GoldCoin.png');
    this.load.image('item_silver_coin',  IT+'Treasure/SilverCoin.png');
    this.load.image('item_gold_key',     IT+'Treasure/GoldKey.png');
    this.load.image('item_gold_cup',     IT+'Treasure/GoldCup.png');
    this.load.image('item_meat',         IT+'Food/Meat.png');
    this.load.image('item_fish',         IT+'Food/Fish.png');
    this.load.image('item_honey',        IT+'Food/Honey.png');
    this.load.image('item_plank',        IT+'Resource/Branch.png');
    this.load.image('item_branch',       IT+'Resource/Branch.png');
    this.load.image('item_axe',          IT+'Weapons/AxeTool/Sprite.png');
    this.load.image('item_pickaxe',      IT+'Weapons/Pickaxe/Sprite.png');
    this.load.image('item_hammer',       IT+'Weapons/Hammer/Sprite.png');
    this.load.image('item_big_sword',    IT+'Weapons/BigSword/Sprite.png');

    // Loading bar
    this.load.on('progress', v => {
      if (!this._bar) {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this._barBg  = this.add.rectangle(W/2, H/2+16, W*0.6, 12, 0x333333).setOrigin(0.5);
        this._bar    = this.add.rectangle(W/2 - W*0.3, H/2+16, 0, 12, 0xffcc44).setOrigin(0, 0.5);
        this._barTxt = this.add.text(W/2, H/2-8, 'Loading…',
          { fontSize:'14px', fontFamily:'monospace', color:'#fff' }).setOrigin(0.5);
      }
      this._bar.width = this._barBg.width * v;
    });
  }

  // --------------------------------------------------------------------------
  create() {
    [this._bar, this._barBg, this._barTxt].forEach(o => o?.destroy());

    const mapData = this.cache.json.get('tilemap');
    const { width, height, zones, spawn } = mapData;
    // Split objects: harvest nodes go to HarvestSystem, everything else to ActionSystem
    const harvestNodes = mapData.objects.filter(o => o.type === 'harvestNode')
      .map(o => ({ ...o, type: o.nodeType })); // rename nodeType→type for HarvestableResource
    const objects      = mapData.objects.filter(o => o.type !== 'harvestNode');

    StateManager.initMap(mapData);

    // Player entity (stats, events) — all display goes via game event bus to UIScene
    this.playerEntity = new Player();
    this.playerEntity.on('statsChanged',      snap  => this.game.events.emit('ui:statsChanged', snap));
    this.playerEntity.on('notEnoughEnergy',   ()    => this.game.events.emit('ui:flashEnergy'));
    this.playerEntity.on('died',              ()    => { this._dead = true; this._onPlayerDied(); });
    this.playerEntity.on('respawn',           ()    => this.game.events.emit('ui:respawn'));
    this.playerEntity.on('inventoryChanged',  slots => this.game.events.emit('ui:inventoryChanged', slots));

    // Use item from inventory panel click
    this.game.events.on('ui:useItem', idx => {
      this.playerEntity.inventory.useAt(idx);
    });

    ActionSystem.init(this, objects, zones, this.playerEntity);

    // World layers
    new TilemapBuilder(this).build(mapData);

    // Chests, signs, NPCs, world items
    this._chestMap = {};
    this._spawnObjects(objects);

    // Harvest nodes (trees, rocks, bushes)
    this._harvestSprites = {}; // key → Phaser.GameObjects.Image
    HarvestSystem.init(this, this.playerEntity);
    HarvestSystem.registerNodes(harvestNodes);
    this._spawnHarvestNodes(harvestNodes);

    // Player sprite
    this._createPlayerAnims();
    this.player = this.add.sprite(
      spawn.tileX * TILE + TILE/2,
      spawn.tileY * TILE + TILE/2,
      'player', 1
    ).setDepth(50);
    this.player.play('idle_down');

    // Interact prompt — world-space bubble that hovers above the target
    this._promptBg = this.add.graphics().setDepth(80);
    this._promptTxt = this.add.text(0, 0, 'E', {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(81).setVisible(false);

    // Camera
    this.cameras.main.setBounds(0, 0, width*TILE, height*TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(3);

    // Launch UIScene on top (parallel scene, not replacing this one)
    this.scene.launch('UIScene');

    // Fire initial stats after a tick so UIScene is fully created
    this.time.delayedCall(50, () => {
      this.game.events.emit('ui:statsChanged', this.playerEntity._snapshot());
      this.game.events.emit('ui:zoneLabel', 'Shinobi Village');
    });
    this._dead = false;

    // Stat tick — every 20 seconds (-1 hp/energy in hostile, +1 in safe)
    this.time.addEvent({
      delay: 20000, loop: true,
      callback: () => {
        const zone = StateManager.getState().currentZone;
        const zoneType = HOSTILE_ZONES.has(zone) ? 'hostile' : 'safe';
        this.playerEntity.tick(zoneType);
      },
    });

    // Passive hunger drain — 1 HP every 2 minutes regardless of zone
    this.time.addEvent({
      delay: 120000, loop: true,
      callback: () => this.playerEntity.takeDamage(1),
    });

    // Store zone defs for the spawner
    this._mapZones  = zones;
    this._mapWidth  = width;
    this._mapHeight = height;

    // Continuous item spawner — tries every 6s, keeps world items between 6–12
    this._MAX_WORLD_ITEMS = 20;
    this._MIN_WORLD_ITEMS = 6;
    this.time.addEvent({
      delay: 6000, loop: true,
      callback: () => this._trySpawnRandomItem(),
    });

    InputHandler.init(this);
    this.time.delayedCall(300, () => this.showZoneBanner('Shinobi Village'));
  }

  // --------------------------------------------------------------------------
  update(time) {
    if (!this._dead) InputHandler.update(time);
    this._updateInteractPrompt();
  }

  _updateInteractPrompt() {
    const target = getFacingObject();

    if (!target) {
      this._promptBg.setVisible(false);
      this._promptTxt.setVisible(false);
      return;
    }

    // Position bubble above the target tile center
    const px = target.tileX * TILE + TILE / 2;
    const py = target.tileY * TILE - 2;

    // Draw speech-bubble background (pill shape)
    this._promptBg.clear().setVisible(true);
    this._promptBg.fillStyle(0x000000, 0.75);
    this._promptBg.fillRoundedRect(px - 7, py - 11, 14, 10, 3);
    // Small triangle pointer
    this._promptBg.fillTriangle(px - 3, py - 1, px + 3, py - 1, px, py + 3);

    const label = target.type === 'item'    ? '↑'
      : target.type === 'harvest'           ? (target.resourceType === 'rock_node' ? '⛏' : '🪓')
      : (target.type === 'chest' && target.opened) ? '✓' : 'E';
    this._promptTxt
      .setPosition(px, py - 2)
      .setText(label)
      .setVisible(true);
  }

  // ==========================================================================
  // Objects: Chests, Signs, NPCs, World Items
  // ==========================================================================
  _spawnObjects(objects) {
    const npcKeys = {
      merchant:'npc_villager', guard:'npc_guard', elder:'npc_elder',
      hunter:'npc_hunter',     hermit:'npc_hermit',
    };

    // _worldItems: key → { sprite, bobTween } — removed on pickup
    this._worldItems = {};

    for (const obj of objects) {
      const px = obj.tileX * TILE + TILE/2;
      const py = obj.tileY * TILE + TILE/2;

      if (obj.type === 'chest') {
        const g = this.add.graphics().setDepth(15);
        this._drawChest(g, px, py, false);
        this._chestMap[`${obj.tileX}_${obj.tileY}`] = g;

      } else if (obj.type === 'sign') {
        this.add.image(px, py, 'ts_house', 8*HOUSE.COLS+12).setDepth(10).setOrigin(0.5);

      } else if (obj.type === 'npc') {
        const key = npcKeys[obj.id] || 'npc_villager';
        this.add.sprite(px, py, key, 4).setDepth(20);
        this.add.text(px, py-12, '!', {
          fontSize:'8px', fontFamily:'monospace',
          color:'#ffff00', stroke:'#000', strokeThickness:2,
        }).setOrigin(0.5).setDepth(25);

      } else if (obj.type === 'item') {
        this._spawnWorldItem(obj);
      }
    }
  }

  _spawnWorldItem(obj) {
    const px = obj.tileX * TILE + TILE/2;
    const py = obj.tileY * TILE + TILE/2;
    const key = `item_${obj.itemId}`;
    const sprite = this.add.image(px, py, key).setDepth(12).setOrigin(0.5).setScale(0.8);

    // Gentle bob tween
    const bobTween = this.tweens.add({
      targets: sprite, y: py - 3, yoyo: true, repeat: -1,
      duration: 800, ease: 'Sine.InOut',
    });

    // Glow circle underneath
    const glow = this.add.graphics().setDepth(11);
    glow.fillStyle(0xffffff, 0.15);
    glow.fillEllipse(px, py + 4, 10, 4);

    this._worldItems[`${obj.tileX}_${obj.tileY}`] = { sprite, bobTween, glow, obj };
  }

  _trySpawnRandomItem() {
    const count = Object.keys(this._worldItems).length;
    if (count >= this._MAX_WORLD_ITEMS) return;

    // Pick a random zone and matching item pool
    const ZONE_POOLS = {
      'Shinobi Village':    ['life_potion', 'heart', 'gold_coin', 'meat', 'milk_pot'],
      'Forest of Whispers': ['gem_green', 'rock', 'grass', 'fish', 'bar_iron'],
      'Sunken Sands Desert':['gold_coin', 'silver_coin', 'honey', 'gem_red', 'water_pot'],
      'Crystal Lake':       ['gem_red', 'gem_green', 'bar_gold', 'water_pot', 'life_potion'],
      'Mountain Pass':      ['rock', 'bar_iron', 'gem_red', 'meat', 'heart'],
    };

    const zoneNames = Object.keys(ZONE_POOLS);
    const zone = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    const pool = ZONE_POOLS[zone];
    const itemId = pool[Math.floor(Math.random() * pool.length)];

    // Find the zone bounds
    const zoneDef = this._mapZones.find(z => z.name === zone);
    if (!zoneDef) return;

    // Try up to 20 random tiles in that zone to find a walkable empty one
    const { collisionData, width } = StateManager.getState().map;
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = zoneDef.x + Math.floor(Math.random() * zoneDef.w);
      const ty = zoneDef.y + Math.floor(Math.random() * zoneDef.h);
      const key = `${tx}_${ty}`;

      if (collisionData[ty * width + tx] === 1) continue;  // blocked tile
      if (this._worldItems[key]) continue;                  // already has item
      // Don't spawn on a chest/npc/sign tile (ActionSystem checks mapObjects but we check here too)
      const { objects } = this.cache.json.get('tilemap');
      if (objects.some(o => o.tileX === tx && o.tileY === ty)) continue;

      const obj = { type: 'item', itemId, tileX: tx, tileY: ty };
      this._spawnWorldItem(obj);
      // Also register in ActionSystem's mapObjects via a scene event
      this.game.events.emit('world:itemSpawned', obj);

      // Fade the sprite in
      const entry = this._worldItems[key];
      if (entry) {
        entry.sprite.setAlpha(0);
        this.tweens.add({ targets: entry.sprite, alpha: 1, duration: 400, ease: 'Quad.Out' });
      }
      break;
    }
  }

  _drawChest(g, cx, cy, opened) {
    g.clear();
    const h = TILE;
    if (opened) {
      g.fillStyle(0x6a3a10,1).fillRect(cx-h/2+2, cy-h/2+4, h-4, h-6);
      g.fillStyle(0x3366aa,0.8).fillRect(cx-h/2+3, cy-h/2+5, h-6, h-8);
    } else {
      g.fillStyle(0x8b4513,1).fillRect(cx-h/2+2, cy-h/2+2, h-4, h-4);
      g.fillStyle(0xffd700,1).fillRect(cx-h/2+2, cy-h/2+2, h-4, 4);
      g.fillStyle(0x222,1).fillRect(cx-2, cy, 4, 4);
      g.lineStyle(1,0x5a2a00,1).strokeRect(cx-h/2+2, cy-h/2+2, h-4, h-4);
    }
  }

  openChest(obj) {
    const g = this._chestMap[`${obj.tileX}_${obj.tileY}`];
    if (!g) return;
    this._drawChest(g, obj.tileX*TILE+TILE/2, obj.tileY*TILE+TILE/2, true);

    // Particle burst
    for (let i = 0; i < 5; i++) {
      const angle = (i/5)*Math.PI*2;
      const sx = obj.tileX*TILE+TILE/2 + Math.cos(angle)*14;
      const sy = obj.tileY*TILE+TILE/2 + Math.sin(angle)*14;
      const star = this.add.graphics().setDepth(60);
      star.fillStyle(0xffdd00,1).fillRect(sx-2, sy-2, 4, 4);
      this.tweens.add({ targets:star, alpha:0, y:sy-12, duration:500,
        ease:'Quad.Out', onComplete:()=>star.destroy() });
    }

    // Give loot items to inventory
    const lootItems = obj.lootItems || [];
    const gained = [];
    for (const id of lootItems) {
      const item = ItemRegistry.create(id);
      if (item) {
        const ok = this.playerEntity.inventory.add(item);
        if (ok) gained.push(item.name);
      }
    }
    const msg = gained.length > 0
      ? `Found: ${gained.join(', ')}!`
      : 'The chest is empty.';
    this.showDialog(msg);
    this.game.events.emit('ui:inventoryChanged', this.playerEntity.inventory.slots);
  }

  // ==========================================================================
  // Harvest nodes — spawn, flash, deplete, respawn
  // ==========================================================================
  _spawnHarvestNodes(nodeDefs) {
    const TEXTURES = { tree: 'ts_nature', rock_node: 'ts_nature', bush: 'ts_nature' };
    // Use proper frame constants: TREE_TL=0, ROCK_MD=4*24+14=110, BUSH=4*24+0=96
    const FRAMES   = { tree: 0, rock_node: 110, bush: 96 };
    const DEPTHS   = { tree: 18, rock_node: 14, bush: 13 };

    for (const def of nodeDefs) {
      const px  = def.tileX * TILE + TILE/2;
      const py  = def.tileY * TILE + TILE/2;
      const tex = TEXTURES[def.type] || 'ts_nature';
      const frm = FRAMES[def.type]   ?? 0;
      const spr = this.add.image(px, py, tex, frm)
        .setDepth(DEPTHS[def.type] ?? 14).setOrigin(0.5);
      this._harvestSprites[`${def.tileX}_${def.tileY}`] = spr;
    }
  }

  // Called by HarvestSystem each hit — shake + tint to show damage
  flashHarvestNode(tx, ty, hp, maxHp) {
    const spr = this._harvestSprites[`${tx}_${ty}`];
    if (!spr) return;
    const tint = hp / maxHp > 0.5 ? 0xffaa44 : 0xff4444;
    spr.setTint(tint);
    this.tweens.add({
      targets: spr, x: spr.x + 2, yoyo: true, repeat: 2,
      duration: 40, ease: 'Linear',
      onComplete: () => { spr.x = tx * TILE + TILE/2; spr.clearTint(); },
    });
  }

  // Called when node hp hits 0 — fade out the sprite
  depleteHarvestNode(tx, ty) {
    const spr = this._harvestSprites[`${tx}_${ty}`];
    if (!spr) return;
    this.tweens.add({
      targets: spr, alpha: 0, duration: 300, ease: 'Quad.Out',
    });
  }

  // Called after respawn timer — fade node back in
  respawnHarvestNode(tx, ty) {
    const spr = this._harvestSprites[`${tx}_${ty}`];
    if (!spr) return;
    spr.clearTint();
    this.tweens.add({
      targets: spr, alpha: 1, duration: 500, ease: 'Quad.In',
    });
  }

  // ==========================================================================
  // Player animations
  // NinjaBlue spritesheet: 4 cols × 7 rows at 16×16
  // Row 0: walk down (0-3), Row 1: walk left (4-7)
  // Row 2: walk right (8-11), Row 3: walk up (12-15)
  // ==========================================================================
  _createPlayerAnims() {
    const defs = [
      { key:'walk_down',  frames:[0,1,2,3],    rate:8 },
      { key:'walk_left',  frames:[4,5,6,7],    rate:8 },
      { key:'walk_right', frames:[8,9,10,11],  rate:8 },
      { key:'walk_up',    frames:[12,13,14,15],rate:8 },
      { key:'idle_down',  frames:[1],  rate:1 },
      { key:'idle_left',  frames:[5],  rate:1 },
      { key:'idle_right', frames:[9],  rate:1 },
      { key:'idle_up',    frames:[13], rate:1 },
    ];
    for (const d of defs) {
      if (!this.anims.exists(d.key)) {
        this.anims.create({
          key: d.key,
          frames: d.frames.map(f => ({ key:'player', frame:f })),
          frameRate: d.rate, repeat: -1,
        });
      }
    }
  }

  updatePlayerDir(dir) {
    this.player.play(`walk_${dir}`, true);
    this._idleAnim = `idle_${dir}`;
  }

  tweenPlayerTo(tx, ty, onComplete) {
    this.tweens.add({
      targets: this.player,
      x: tx*TILE + TILE/2, y: ty*TILE + TILE/2,
      duration: 130, ease: 'Linear',
      onComplete: () => {
        if (this._idleAnim) this.player.play(this._idleAnim, true);
        if (onComplete) onComplete();
      },
    });
  }

  // ==========================================================================
  // Death / Respawn — sprite side only; overlay is handled by UIScene
  // ==========================================================================
  _onPlayerDied() {
    // Fade player sprite out
    this.tweens.add({
      targets: this.player, alpha: 0.25,
      yoyo: true, repeat: 5, duration: 100, ease: 'Linear',
      onComplete: () => this.player.setAlpha(0.25),
    });
    // Tell UIScene
    this.game.events.emit('ui:died');
    // Listen for respawn key
    const doRespawn = () => this._respawn();
    this.input.keyboard.once('keydown-SPACE', doRespawn);
    this.input.keyboard.once('keydown-E',     doRespawn);
  }

  _respawn() {
    if (!this._dead) return;
    this._dead = false;

    this.playerEntity.respawn(); // emits 'respawn' → ui:respawn

    const spawn = this.cache.json.get('tilemap').spawn;
    StateManager.setPlayerPos(spawn.tileX, spawn.tileY);
    this.player.setPosition(spawn.tileX*TILE + TILE/2, spawn.tileY*TILE + TILE/2);
    this.player.setAlpha(1).play('idle_down');
    this._idleAnim = 'idle_down';

    StateManager.setZone('Shinobi Village');
    this.showZoneBanner('Shinobi Village');
  }

  // Called by ActionSystem when player steps onto / interacts with a world item
  pickupWorldItem(obj) {
    const key = `${obj.tileX}_${obj.tileY}`;
    const entry = this._worldItems[key];
    if (!entry) return;

    const item = ItemRegistry.create(obj.itemId);
    if (!item) return;

    const ok = this.playerEntity.inventory.add(item);
    if (!ok) {
      this.showDialog('Inventory full!');
      return;
    }

    // Fly-up then destroy
    entry.bobTween.stop();
    this.tweens.add({
      targets: entry.sprite, y: entry.sprite.y - 16, alpha: 0,
      duration: 350, ease: 'Quad.Out',
      onComplete: () => { entry.sprite.destroy(); entry.glow.destroy(); },
    });
    entry.glow.destroy();
    delete this._worldItems[key];

    this.showDialog(`Picked up: ${item.name}`);
    this.game.events.emit('ui:inventoryChanged', this.playerEntity.inventory.slots);
  }

  // ==========================================================================
  // UI event emitters — UIScene does all the actual rendering
  // ==========================================================================
  showDialog(msg, speaker) {
    this.game.events.emit('ui:dialog', { msg, speaker });
  }

  showZoneBanner(name) {
    this.game.events.emit('ui:zoneBanner', name);
    this.game.events.emit('ui:zoneLabel',  name);
  }
}
