import Phaser from 'phaser';
import { io }  from 'socket.io-client';
import { TilemapBuilder } from './world/TilemapBuilder.js';

const TILE    = 16;
const countEl = document.getElementById('count');

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
    this.load.spritesheet('ts_floor',   TS+'TilesetFloor.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_nature',  TS+'TilesetNature.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_water',   TS+'TilesetWater.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_house',   TS+'TilesetHouse.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_desert',  TS+'TilesetDesert.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_relief',  TS+'TilesetRelief.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('player',     CH+'NinjaBlue.png',      { frameWidth:16, frameHeight:16 });
    this.load.json('tilemap', 'tilemap.json');
  }

  create() {
    const mapData = this.cache.json.get('tilemap');
    new TilemapBuilder(this).build(mapData);

    for (const def of ANIM_DEFS) {
      if (!this.anims.exists(def.key)) {
        this.anims.create({
          key: def.key,
          frames: this.anims.generateFrameNumbers('player', { frames: def.frames }),
          frameRate: def.rate, repeat: def.repeat,
        });
      }
    }

    // agentId → { sprite, nameTag, hpTag }
    this._remotes = new Map();

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
    // Scroll to zoom
    this.input.on('wheel', (_ptr, _objs, _dx, dy) => {
      const z = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.5, 6);
      this.cameras.main.setZoom(z);
    });

    this._connectSocket();
  }

  _connectSocket() {
    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      console.log('[WorldView] connected, registering as spectator');
      socket.emit('spectator:register');
    });

    socket.on('server:worldState', state => this._onWorldState(state));

    socket.on('disconnect', () => {
      console.log('[WorldView] disconnected from server');
    });
  }

  _onWorldState({ players }) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.agentId);
      this._upsert(p);
    }
    // Remove players no longer in the world
    for (const [id] of this._remotes) {
      if (!seen.has(id)) this._remove(id);
    }
    if (countEl) countEl.textContent = players.length;
  }

  _upsert({ agentId, tileX, tileY, direction, hp, maxHp, alive }) {
    const px    = tileX * TILE + TILE / 2;
    const py    = tileY * TILE + TILE / 2;
    const alpha = alive ? 1 : 0.3;

    if (this._remotes.has(agentId)) {
      const rp = this._remotes.get(agentId);
      this.tweens.add({
        targets: rp.sprite, x: px, y: py, duration: 130, ease: 'Linear',
        onComplete: () => rp.sprite.play(`idle_${direction}`, true),
      });
      rp.sprite.play(`walk_${direction}`, true).setAlpha(alpha);
      rp.nameTag.setPosition(px, py - TILE - 2);
      rp.hpTag.setText(`${hp}/${maxHp}`).setPosition(px, py - TILE - 10);
    } else {
      const tint   = TINTS[_tintIdx++ % TINTS.length];
      const sprite = this.add.sprite(px, py, 'player', 1)
        .setDepth(50).setTint(tint).setAlpha(alpha);
      sprite.play('idle_down');

      const label   = agentId.slice(-6);
      const nameTag = this.add.text(px, py - TILE - 2, label, {
        fontSize: '5px', fontFamily: 'monospace',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(55);

      const hpTag = this.add.text(px, py - TILE - 10, `${hp}/${maxHp}`, {
        fontSize: '4px', fontFamily: 'monospace',
        color: '#ff8888', stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5, 1).setDepth(55);

      this._remotes.set(agentId, { sprite, nameTag, hpTag });
    }
  }

  _remove(agentId) {
    const rp = this._remotes.get(agentId);
    if (!rp) return;
    rp.sprite.destroy();
    rp.nameTag.destroy();
    rp.hpTag.destroy();
    this._remotes.delete(agentId);
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
