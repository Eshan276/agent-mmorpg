import Phaser from 'phaser';
import { io }  from 'socket.io-client';
import { TilemapBuilder } from './world/TilemapBuilder.js';

const TILE     = 16;
const HOUSE_COLS = 33;
const countEl   = document.getElementById('count');
const wsAgents  = document.getElementById('ws-agents');
const wsNodes   = document.getElementById('ws-nodes');
const wsItems   = document.getElementById('ws-items');
const panelBody = document.getElementById('panel-body');
const noAgentsMsg = document.getElementById('no-agents-msg');

// Harvest node frame / depth config (mirrors GameScene)
const NODE_TEXTURES = { tree: 'ts_nature', rock_node: 'ts_nature', bush: 'ts_nature' };
const NODE_FRAMES   = { tree: 0, rock_node: 110, bush: 96 };
const NODE_DEPTHS   = { tree: 18, rock_node: 14, bush: 13 };

// NPC sprite keys
const NPC_KEYS = {
  merchant: 'npc_villager', guard: 'npc_guard', elder: 'npc_elder',
  hunter: 'npc_hunter',     hermit: 'npc_hermit',
};

// Player animation definitions
const ANIM_DEFS = [
  { key: 'walk_down',  frames: [0,1,2,3],    repeat: -1, rate: 8 },
  { key: 'walk_left',  frames: [4,5,6,7],    repeat: -1, rate: 8 },
  { key: 'walk_right', frames: [8,9,10,11],  repeat: -1, rate: 8 },
  { key: 'walk_up',    frames: [12,13,14,15],repeat: -1, rate: 8 },
  { key: 'idle_down',  frames: [1],  repeat: 0, rate: 1 },
  { key: 'idle_left',  frames: [5],  repeat: 0, rate: 1 },
  { key: 'idle_right', frames: [9],  repeat: 0, rate: 1 },
  { key: 'idle_up',    frames: [13], repeat: 0, rate: 1 },
];

const TINTS = [0xff6666, 0x66aaff, 0xffdd55, 0xaaffaa, 0xff99ff, 0xff9944];
let _tintIdx = 0;

class WorldScene extends Phaser.Scene {
  constructor() { super({ key: 'WorldScene' }); }

  preload() {
    const TS = 'assets/tilesets/';
    const CH = 'assets/characters/';
    const IT = 'assets/items/';

    // Tilesets
    this.load.spritesheet('ts_floor',   TS+'TilesetFloor.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_nature',  TS+'TilesetNature.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_water',   TS+'TilesetWater.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_house',   TS+'TilesetHouse.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_desert',  TS+'TilesetDesert.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_relief',  TS+'TilesetRelief.png',  { frameWidth:16, frameHeight:16 });

    // Characters
    this.load.spritesheet('player',       CH+'NinjaBlue.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_villager', CH+'Villager.png',    { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_guard',    CH+'Inspector.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_elder',    CH+'Master.png',      { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hunter',   CH+'Hunter.png',      { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hermit',   CH+'Caveman.png',     { frameWidth:16, frameHeight:16 });

    // Items
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

    this.load.json('tilemap', 'tilemap.json');
  }

  create() {
    const mapData    = this.cache.json.get('tilemap');
    const objects    = mapData.objects ?? [];
    const harvestNodes = objects.filter(o => o.type === 'harvestNode');
    const staticObjs   = objects.filter(o => o.type !== 'harvestNode');

    // Init all Maps before any spawn calls
    this._chestGraphics    = new Map();
    this._harvestSprites   = new Map();
    this._worldItemSprites = new Map();
    this._remotes          = new Map();
    this._prevAlive        = new Map(); // agentId → bool, for death/respawn effects
    this._targetGraphics   = this.add.graphics().setDepth(100);

    // Build tilemap layers
    new TilemapBuilder(this).build(mapData);

    // Static objects (chests, signs, NPCs)
    this._spawnStaticObjects(staticObjs);

    // Harvest nodes
    this._spawnHarvestNodes(harvestNodes);

    // Player animations
    for (const def of ANIM_DEFS) {
      if (!this.anims.exists(def.key)) {
        this.anims.create({
          key: def.key,
          frames: this.anims.generateFrameNumbers('player', { frames: def.frames }),
          frameRate: def.rate, repeat: def.repeat,
        });
      }
    }

    console.log('[WorldScene] create() done — static objects:', staticObjs.length, 'nodes:', harvestNodes.length);

    // Tooltip (HTML overlay — lives outside Phaser canvas)
    this._tooltip = document.getElementById('tooltip');

    // Camera
    const { width, height } = mapData;
    this.cameras.main.setBounds(0, 0, width*TILE, height*TILE);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn((width*TILE)/2, (height*TILE)/2);

    // Drag to pan
    this.input.on('pointermove', ptr => {
      if (ptr.isDown) {
        this.cameras.main.scrollX -= ptr.velocity.x / this.cameras.main.zoom / 10;
        this.cameras.main.scrollY -= ptr.velocity.y / this.cameras.main.zoom / 10;
      }
    });

    // Hover tooltip via native DOM (fires everywhere on canvas, not just game objects)
    this.game.canvas.addEventListener('mousemove', e => {
      const rect = this.game.canvas.getBoundingClientRect();
      const scaleX = this.game.canvas.width  / rect.width;
      const scaleY = this.game.canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top)  * scaleY;
      const world = this.cameras.main.getWorldPoint(cx, cy);
      this._checkHoverWorld(world.x, world.y, e.clientX, e.clientY);
    });
    this.game.canvas.addEventListener('mouseleave', () => this._hideTooltip());
    this.input.on('wheel', (_ptr, _objs, _dx, dy) => {
      const z = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.5, 8);
      this.cameras.main.setZoom(z);
    });

    this._connectSocket();
  }

  // ── Static objects ──────────────────────────────────────────────────────

  _spawnStaticObjects(objects) {
    for (const obj of objects) {
      const px = obj.tileX * TILE + TILE/2;
      const py = obj.tileY * TILE + TILE/2;

      if (obj.type === 'chest') {
        const g = this.add.graphics().setDepth(15);
        this._drawChest(g, px, py, false);
        this._chestGraphics.set(`${obj.tileX}_${obj.tileY}`, g);

      } else if (obj.type === 'sign') {
        this.add.image(px, py, 'ts_house', 8*HOUSE_COLS+12).setDepth(10).setOrigin(0.5);

      } else if (obj.type === 'npc') {
        const key = NPC_KEYS[obj.id] || 'npc_villager';
        this.add.sprite(px, py, key, 4).setDepth(20);
        this.add.text(px, py-12, '!', {
          fontSize: '8px', fontFamily: 'monospace',
          color: '#ffff00', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(25);

      } else if (obj.type === 'item') {
        this._addWorldItemSprite(obj.itemId, obj.tileX, obj.tileY);
      }
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
      g.fillStyle(0x222222,1).fillRect(cx-2, cy, 4, 4);
      g.lineStyle(1, 0x5a2a00,1).strokeRect(cx-h/2+2, cy-h/2+2, h-4, h-4);
    }
  }

  // ── Harvest nodes ───────────────────────────────────────────────────────

  _spawnHarvestNodes(nodeDefs) {
    for (const def of nodeDefs) {
      const px  = def.tileX * TILE + TILE/2;
      const py  = def.tileY * TILE + TILE/2;
      const tex = NODE_TEXTURES[def.nodeType] || 'ts_nature';
      const frm = NODE_FRAMES[def.nodeType]   ?? 0;
      const spr = this.add.image(px, py, tex, frm)
        .setDepth(NODE_DEPTHS[def.nodeType] ?? 14)
        .setOrigin(0.5);
      this._harvestSprites.set(`${def.tileX}_${def.tileY}`, spr);
    }
  }

  // ── World items (dynamic) ───────────────────────────────────────────────

  _addWorldItemSprite(itemId, tileX, tileY) {
    const key = `item_${itemId}`;
    if (!this.textures.exists(key)) return; // unknown item texture
    const px   = tileX * TILE + TILE/2;
    const py   = tileY * TILE + TILE/2;

    const glow = this.add.graphics().setDepth(11);
    glow.fillStyle(0xffffff, 0.15);
    glow.fillEllipse(px, py+4, 10, 4);

    const sprite   = this.add.image(px, py, key).setDepth(12).setOrigin(0.5).setScale(0.8);
    const bobTween = this.tweens.add({
      targets: sprite, y: py - 3, yoyo: true, repeat: -1,
      duration: 800, ease: 'Sine.InOut',
    });
    this._worldItemSprites.set(`${tileX}_${tileY}`, { sprite, glow, bobTween });
  }

  _syncWorldItems(serverItems) {
    const incoming = new Set(serverItems.map(i => `${i.tileX}_${i.tileY}`));

    // Remove items no longer on server
    for (const [k, entry] of this._worldItemSprites) {
      if (!incoming.has(k)) {
        entry.sprite.destroy();
        entry.glow.destroy();
        entry.bobTween.stop();
        this._worldItemSprites.delete(k);
      }
    }

    // Add new items
    for (const item of serverItems) {
      const k = `${item.tileX}_${item.tileY}`;
      if (!this._worldItemSprites.has(k)) {
        this._addWorldItemSprite(item.id, item.tileX, item.tileY);
      }
    }
  }

  _syncHarvestNodes(serverNodes) {
    const serverKeys = new Set(serverNodes.map(n => n.key));

    // Remove sprites for nodes no longer on server
    for (const [key, spr] of this._harvestSprites) {
      if (!serverKeys.has(key)) {
        spr.destroy();
        this._harvestSprites.delete(key);
      }
    }

    for (const node of serverNodes) {
      let spr = this._harvestSprites.get(node.key);
      if (!spr) {
        // Dynamically spawned node — create sprite now
        const texture = NODE_TEXTURES[node.nodeType] ?? 'ts_nature';
        const frame   = NODE_FRAMES[node.nodeType]   ?? 96;
        const depth   = NODE_DEPTHS[node.nodeType]   ?? 13;
        const px = node.tileX * TILE;
        const py = node.tileY * TILE;
        spr = this.add.image(px, py, texture, frame)
          .setOrigin(0, 0).setDepth(depth);
        this._harvestSprites.set(node.key, spr);
      }
      spr.setAlpha(node.depleted ? 0.15 : 1);
    }
  }

  _syncChests(serverPlayers) {
    // Chests are opened when a player interacts — server tracks this in worldState
    // For now chests stay as initially rendered; opened state would need server to send it
  }

  // ── Socket ──────────────────────────────────────────────────────────────

  _connectSocket() {
    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      console.log('[WorldView] socket connected, id:', socket.id);
      socket.emit('spectator:register');
      console.log('[WorldView] emitted spectator:register');
    });

    socket.on('connect_error', err => console.error('[WorldView] connect_error:', err.message));

    socket.on('server:worldState', state => {
      console.log('[WorldView] worldState received — players:', state.players?.length, 'items:', state.worldItems?.length);
      this._onWorldState(state);
    });

    socket.on('disconnect', reason => console.log('[WorldView] disconnected:', reason));
  }

  _onWorldState({ players = [], worldItems = [], harvestNodes = [], agentTargets = [] }) {
    // Sync dynamic layers
    this._syncWorldItems(worldItems);
    this._syncHarvestNodes(harvestNodes);

    const hadNone = this._remotes.size === 0;

    // Reconcile agent sprites
    const seen = new Set();
    for (const p of players) {
      seen.add(p.agentId);
      this._upsertAgent(p);
    }
    for (const [id] of this._remotes) {
      if (!seen.has(id)) this._removeAgent(id);
    }
    if (countEl) countEl.textContent = players.length;
    this._updatePanel(players, worldItems, harvestNodes);
    this._drawTargetLines(players, agentTargets);

    // Pan camera to first agent when it first appears
    if (hadNone && players.length > 0) {
      const p  = players[0];
      const px = p.tileX * TILE + TILE / 2;
      const py = p.tileY * TILE + TILE / 2;
      this.cameras.main.pan(px, py, 600, 'Power2');
    }
  }

  // ── Side panel ──────────────────────────────────────────────────────────

  _updatePanel(players, worldItems, harvestNodes) {
    if (wsAgents) wsAgents.textContent = players.length;
    if (wsNodes)  wsNodes.textContent  = harvestNodes ? `${harvestNodes.filter(n => !n.depleted).length}/${harvestNodes.length}` : '—';
    if (wsItems)  wsItems.textContent  = worldItems?.length ?? '—';

    if (!panelBody) return;
    if (noAgentsMsg) noAgentsMsg.style.display = players.length ? 'none' : 'block';

    for (const p of players) {
      const { agentId, hp, maxHp, energy, maxEnergy, gold, zone, alive, inventory = [] } = p;
      const hpPct = Math.round(hp / maxHp * 100);
      const enPct = Math.round(energy / maxEnergy * 100);
      const tint  = this._remotes.get(agentId)?.tint ?? '#aaa';

      const invHtml = inventory.length
        ? inventory.map(i => `<span class="ac-inv-item">${i.name ?? i.id}${i.qty > 1 ? ` ×${i.qty}` : ''}</span>`).join('')
        : '<span class="ac-inv-empty">empty</span>';

      const html = `
        <div class="ac-header">
          <div class="ac-name">
            <div class="ac-dot" style="background:${tint}"></div>
            ${agentId}
          </div>
          <div class="ac-zone">${zone ?? ''}</div>
        </div>
        <div class="ac-bars">
          <div class="ac-bar-row">
            <span class="ac-bar-label">HP</span>
            <div class="ac-bar-track"><div class="ac-bar-fill hp" style="width:${hpPct}%"></div></div>
            <span class="ac-bar-val">${hp}/${maxHp}</span>
          </div>
          <div class="ac-bar-row">
            <span class="ac-bar-label">EN</span>
            <div class="ac-bar-track"><div class="ac-bar-fill en" style="width:${enPct}%"></div></div>
            <span class="ac-bar-val">${energy}/${maxEnergy}</span>
          </div>
        </div>
        <div class="ac-row">
          <div class="ac-stat"><span class="label">Gold </span><span class="val gold">⬡ ${gold}</span></div>
          <div class="ac-stat"><span class="label">Status </span><span class="val ${alive ? 'alive' : 'dead'}">${alive ? 'alive' : 'dead'}</span></div>
        </div>
        <div class="ac-inv-label">Inventory</div>
        <div class="ac-inv">${invHtml}</div>
      `;

      let card = panelBody.querySelector(`[data-agent="${agentId}"]`);
      if (!card) {
        card = document.createElement('div');
        card.className = 'agent-card';
        card.dataset.agent = agentId;
        panelBody.appendChild(card);
      }
      card.className = `agent-card${alive ? '' : ' dead'}`;
      card.innerHTML = html;
    }

    // Remove cards for agents that left
    const activeIds = new Set(players.map(p => p.agentId));
    for (const card of panelBody.querySelectorAll('.agent-card')) {
      if (!activeIds.has(card.dataset.agent)) card.remove();
    }

    // ── Scores tab ──────────────────────────────────────────────────────────
    const scoresList = document.getElementById('scores-list');
    if (scoresList) {
      if (!players.length) {
        scoresList.innerHTML = '<div class="scores-empty">No agents online</div>';
      } else {
        const sorted = [...players].sort((a, b) => (b.gold ?? 0) - (a.gold ?? 0));
        const rankLabels = ['🥇', '🥈', '🥉'];
        const rankClasses = ['gold', 'silver', 'bronze'];
        scoresList.innerHTML = sorted.map((p, i) => {
          const tint = this._remotes.get(p.agentId)?.tint ?? '#aaa';
          const rank = i < 3 ? `<span class="score-rank ${rankClasses[i]}">${rankLabels[i]}</span>` : `<span class="score-rank">${i+1}</span>`;
          const shortId = p.agentId.slice(-8);
          return `<div class="score-row">
            ${rank}
            <div class="score-dot" style="background:${tint}"></div>
            <div class="score-name">${shortId}</div>
            <div class="score-zone">${p.zone ?? ''}</div>
            <div class="score-gold">⬡${p.gold ?? 0}</div>
            <div class="score-harvests">🌿${p.totalHarvests ?? 0}</div>
          </div>`;
        }).join('');
      }
    }
  }

  // ── Agent sprites ───────────────────────────────────────────────────────

  _upsertAgent(p) {
    const { agentId, tileX, tileY, direction = 'down', hp, maxHp, energy, maxEnergy, gold, alive, inventory = [] } = p;
    const px    = tileX * TILE + TILE/2;
    const py    = tileY * TILE + TILE/2;
    const alpha = alive ? 1 : 0.3;

    // Detect alive transitions for visual effects
    const wasAlive = this._prevAlive.get(agentId);
    this._prevAlive.set(agentId, alive);

    if (this._remotes.has(agentId)) {
      const rp = this._remotes.get(agentId);

      // Death flash
      if (wasAlive === true && !alive) {
        rp.sprite.setTintFill(0xff2222);
        this.time.delayedCall(500, () => {
          if (rp.sprite?.active) rp.sprite.clearTint();
          const rp2 = this._remotes.get(agentId);
          if (rp2) rp2.sprite.setTint(rp2._tintVal ?? 0xffffff);
        });
        this._floatText(px, py, '💀 DEAD', '#ff4444', 2000);
      }
      // Respawn flash
      if (wasAlive === false && alive) {
        rp.sprite.setTintFill(0xffffff);
        this.time.delayedCall(400, () => {
          if (rp.sprite?.active) rp.sprite.clearTint();
          const rp2 = this._remotes.get(agentId);
          if (rp2) rp2.sprite.setTint(rp2._tintVal ?? 0xffffff);
        });
        this._floatText(px, py, '✨ RESPAWNED', '#aaffaa', 2000);
      }

      this.tweens.add({
        targets: rp.sprite, x: px, y: py, duration: 130, ease: 'Linear',
        onComplete: () => rp.sprite.play(`idle_${direction}`, true),
      });
      rp.sprite.play(`walk_${direction}`, true).setAlpha(alpha);
      rp.nameTag.setPosition(px, py - TILE - 2);
      rp.hpTag.setText(`${hp}/${maxHp}`).setPosition(px, py - TILE - 10);
      // Store latest data for tooltip
      rp.data = p;
    } else {
      const tintVal = TINTS[_tintIdx++ % TINTS.length];
      const tintCss = '#' + tintVal.toString(16).padStart(6, '0');
      const sprite = this.add.sprite(px, py, 'player', 1)
        .setDepth(50).setTint(tintVal).setAlpha(alpha);
      sprite.play('idle_down');
      this._prevAlive.set(agentId, alive);

      const nameTag = this.add.text(px, py - TILE - 2, agentId.slice(-6), {
        fontSize: '5px', fontFamily: 'monospace',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(55);

      const hpTag = this.add.text(px, py - TILE - 10, `${hp}/${maxHp}`, {
        fontSize: '4px', fontFamily: 'monospace',
        color: '#ff8888', stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5, 1).setDepth(55);

      this._remotes.set(agentId, { sprite, nameTag, hpTag, tint: tintCss, _tintVal: tintVal, data: p });
    }
  }

  // ── Hover tooltip ────────────────────────────────────────────────────────

  _checkHoverWorld(wx, wy, screenX, screenY) {
    const hoverRadius = TILE * 1.5;

    let closest = null, closestDist = Infinity;
    for (const [, rp] of this._remotes) {
      const d = Math.hypot(wx - rp.sprite.x, wy - rp.sprite.y);
      if (d < hoverRadius && d < closestDist) { closest = rp; closestDist = d; }
    }

    if (closest) {
      this._showTooltip(closest.data, screenX, screenY);
    } else {
      this._hideTooltip();
    }
  }

  _showTooltip(p, screenX, screenY) {
    if (!this._tooltip) return;
    const { agentId, hp, maxHp, energy, maxEnergy, gold, zone, alive, inventory = [] } = p;

    const hpPct  = Math.round(hp  / maxHp  * 100);
    const enPct  = Math.round(energy / maxEnergy * 100);
    const invHtml = inventory.length
      ? inventory.map(i => `<span class="inv-item">${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}</span>`).join('')
      : '<span class="inv-empty">empty</span>';

    this._tooltip.innerHTML = `
      <div class="tt-name">${agentId}${alive ? '' : ' 💀'}</div>
      <div class="tt-zone">${zone}</div>
      <div class="tt-row"><span class="tt-label">HP</span>
        <div class="tt-bar"><div class="tt-fill hp" style="width:${hpPct}%"></div></div>
        <span class="tt-val">${hp}/${maxHp}</span>
      </div>
      <div class="tt-row"><span class="tt-label">EN</span>
        <div class="tt-bar"><div class="tt-fill en" style="width:${enPct}%"></div></div>
        <span class="tt-val">${energy}/${maxEnergy}</span>
      </div>
      <div class="tt-gold">⬡ ${gold} gold</div>
      <div class="tt-inv">${invHtml}</div>
    `;

    const margin = 12;
    const tw = 200, th = 160;
    const lx = screenX + margin + tw > window.innerWidth  ? screenX - tw - margin : screenX + margin;
    const ly = screenY + margin + th > window.innerHeight ? screenY - th - margin : screenY + margin;
    this._tooltip.style.left    = lx + 'px';
    this._tooltip.style.top     = ly + 'px';
    this._tooltip.style.display = 'block';
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.display = 'none';
  }

  _drawTargetLines(players, agentTargets) {
    const g = this._targetGraphics;
    g.clear();
    for (const t of agentTargets) {
      const rp = this._remotes.get(t.agentId);
      if (!rp) continue;
      const ax = rp.sprite.x;
      const ay = rp.sprite.y;
      const tx = t.tileX * TILE + TILE / 2;
      const ty = t.tileY * TILE + TILE / 2;
      // Dashed yellow line from agent to target
      g.lineStyle(1, 0xffff00, 0.8);
      g.beginPath();
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const fx = ax + (tx - ax) * (i / steps);
        const fy = ay + (ty - ay) * (i / steps);
        if (i % 2 === 0) g.moveTo(fx, fy);
        else g.lineTo(fx, fy);
      }
      g.strokePath();
      // Red X at target tile
      g.lineStyle(2, 0xff3300, 1);
      g.beginPath();
      g.moveTo(tx - 4, ty - 4); g.lineTo(tx + 4, ty + 4);
      g.moveTo(tx + 4, ty - 4); g.lineTo(tx - 4, ty + 4);
      g.strokePath();
    }
  }

  _removeAgent(agentId) {
    const rp = this._remotes.get(agentId);
    if (!rp) return;
    rp.sprite.destroy();
    rp.nameTag.destroy();
    rp.hpTag.destroy();
    this._remotes.delete(agentId);
    this._prevAlive.delete(agentId);
  }

  _floatText(x, y, text, color, duration = 1500) {
    const t = this.add.text(x, y - TILE, text, {
      fontSize: '6px', fontFamily: 'monospace',
      color, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(200).setAlpha(1);
    this.tweens.add({
      targets: t, y: y - TILE * 3, alpha: 0, duration, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width:  window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a2a1a',
  scene: [WorldScene],
  scale: { mode: Phaser.Scale.RESIZE },
  pixelArt: true,
});
