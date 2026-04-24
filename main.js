// =============================================================================
// TILESET CONSTANTS
// All tilesets use 16x16 pixel tiles.
// Frame index = row * numCols + col  (0-indexed, left-to-right, top-to-bottom)
// =============================================================================
const TILE = 16;

// TilesetFloor.png — 352x417px = 22 cols x 26 rows
const FLOOR = {
  COLS: 22,
  // Visual analysis of TilesetFloor.png:
  // Rows 0-1:  Peach/sandy stone variants (village path)
  // Rows 2-3:  Green grass + dirt edge transitions
  // Rows 4-6:  Brown dirt path tiles
  // Rows 7-10: Dirt/grass mix transitions
  // Rows 11-13: Light white/grey stone floor
  // Rows 14-16: Dark grey stone

  // Grass: row 2, col 0  (bright green grass tile)
  GRASS:       2 * 22 + 0,   // 44
  GRASS2:      2 * 22 + 1,   // 45  (grass variant)
  GRASS3:      2 * 22 + 11,  // 55  (right-half grass)
  // Forest floor: row 3, col 0 (darker/shadowed grass)
  FOREST:      3 * 22 + 0,   // 66
  FOREST2:     3 * 22 + 1,   // 67
  // Dirt path: row 4, col 0
  PATH:        4 * 22 + 0,   // 88
  PATH2:       4 * 22 + 1,   // 89
  // Stone floor (village plaza): row 11, col 0
  STONE:       11 * 22 + 0,  // 242
  STONE2:      11 * 22 + 1,  // 243
  // Sandy/desert ground: row 0, col 0 (peach stone tile)
  SAND:        0 * 22 + 0,   // 0
  SAND2:       0 * 22 + 1,   // 1
  SAND3:       0 * 22 + 11,  // 11  (right-half sandy)
};

// TilesetNature.png — 384x336px = 24 cols x 21 rows
const NATURE = {
  COLS: 24,
  // Row 0-1: Large green tree (2x2 sprite each, many variants across the row)
  // Col 0-1: classic round green tree
  TREE_TL:  0 * 24 + 0,   // top-left of 2x2 tree
  TREE_TR:  0 * 24 + 1,
  TREE_BL:  1 * 24 + 0,
  TREE_BR:  1 * 24 + 1,
  // Col 2-3: second tree variant
  TREE2_TL: 0 * 24 + 2,
  TREE2_TR: 0 * 24 + 3,
  TREE2_BL: 1 * 24 + 2,
  TREE2_BR: 1 * 24 + 3,
  // Col 4-5: pink blossom tree
  TREEP_TL: 0 * 24 + 4,
  TREEP_TR: 0 * 24 + 5,
  TREEP_BL: 1 * 24 + 4,
  TREEP_BR: 1 * 24 + 5,
  // Col 8-9: big round green tree
  TREEB_TL: 0 * 24 + 8,
  TREEB_TR: 0 * 24 + 9,
  TREEB_BL: 1 * 24 + 8,
  TREEB_BR: 1 * 24 + 9,
  // Dead tree row 2-3
  TREED_TL: 2 * 24 + 0,
  TREED_TR: 2 * 24 + 1,
  TREED_BL: 3 * 24 + 0,
  TREED_BR: 3 * 24 + 1,
  // Rocks row 4, cols 12+
  ROCK_SM:  4 * 24 + 12,
  ROCK_MD:  4 * 24 + 14,
  ROCK_LG:  4 * 24 + 16,
  // Small bushes row 4
  BUSH:     4 * 24 + 0,
  BUSH2:    4 * 24 + 2,
};

// TilesetWater.png — 448x272px = 28 cols x 17 rows
const WATER = {
  COLS: 28,
  // Row 0-2: blue/cyan water tiles with border variants
  CENTER:   1 * 28 + 1,   // solid water center
  CENTER2:  1 * 28 + 3,
  EDGE_N:   0 * 28 + 1,
  EDGE_S:   2 * 28 + 1,
  EDGE_W:   1 * 28 + 0,
  EDGE_E:   1 * 28 + 2,
  // Row 3-4: water with green-grass border
  SHORE_N:  3 * 28 + 1,
  SHORE_W:  4 * 28 + 0,
  // Row 9-10: wooden dock/bridge
  DOCK:     9 * 28 + 0,
  DOCK2:    9 * 28 + 1,
};

// TilesetHouse.png — 528x368px = 33 cols x 23 rows
// This tileset has FULL pre-drawn building sprites at top (rows 0-3 area)
// Each "building" is roughly 5-6 tiles wide and 4 tiles tall
const HOUSE = {
  COLS: 33,
  // Row 0: building tops/roofs of complete buildings
  // Row 0 col 0: small house (peach/orange roof) — approx 5 tiles wide
  BLDG1_TL: 0 * 33 + 0,
  // Fence row ~8
  FENCE_H:  8 * 33 + 9,
  FENCE_V:  8 * 33 + 10,
  // Well-like barrel row 10
  BARREL:   10 * 33 + 10,
};

// TilesetDesert.png — 320x192px = 20 cols x 12 rows
const DESERT = {
  COLS: 20,
  // Row 0: desert trees (palm/cactus style)
  PALM_TL:  0 * 20 + 0,
  PALM_TR:  0 * 20 + 1,
  // Row 1: sand-colored buildings
  BLDG_TL:  1 * 20 + 0,
  // Row 4-6: open sand floor
  SAND:     4 * 20 + 0,
  SAND2:    4 * 20 + 1,
  // Row 6-8: darker sand / sand with rocks
  SAND_D:   6 * 20 + 0,
};

// TilesetRelief.png — 320x192px = 20 cols x 12 rows
const RELIEF = {
  COLS: 20,
  // Row 0-1: green-top cliff (mountain with grass cap)
  CLIFF_TL: 0 * 20 + 0,
  CLIFF_T:  0 * 20 + 1,
  CLIFF_TR: 0 * 20 + 2,
  CLIFF_L:  1 * 20 + 0,
  CLIFF_C:  1 * 20 + 1,
  CLIFF_R:  1 * 20 + 2,
  // Row 2-3: brown rock face
  ROCK_TL:  2 * 20 + 0,
  ROCK_T:   2 * 20 + 1,
  ROCK_C:   3 * 20 + 1,
};


// =============================================================================
// SECTION 1: StateManager
// =============================================================================
const StateManager = (() => {
  const state = {
    player: { tileX: 40, tileY: 35, direction: 'down', isMoving: false },
    map: { width: 0, height: 0, tileSize: TILE, groundData: [], collisionData: [] },
    currentZone: ''
  };
  return {
    getState() { return state; },
    setPlayerPos(tx, ty) { state.player.tileX = tx; state.player.tileY = ty; },
    setPlayerDir(dir)    { state.player.direction = dir; },
    setPlayerMoving(b)   { state.player.isMoving = b; },
    setZone(name)        { state.currentZone = name; },
    initMap(mapData) {
      state.map.width        = mapData.width;
      state.map.height       = mapData.height;
      state.map.tileSize     = mapData.tileSize;
      state.map.groundData   = mapData.layers.find(l => l.name === 'ground').data;
      state.map.collisionData= mapData.layers.find(l => l.name === 'collision').data;
      state.player.tileX     = mapData.spawn.tileX;
      state.player.tileY     = mapData.spawn.tileY;
    }
  };
})();
window.getGameState = () => StateManager.getState();


// =============================================================================
// SECTION 2: ActionSystem
// =============================================================================
const ActionSystem = (() => {
  let sceneRef = null, mapObjects = [], mapZones = [];

  function isWalkable(tx, ty) {
    const { width, height, collisionData } = StateManager.getState().map;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
    if (collisionData[ty * width + tx] === 1) return false;
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
    sceneRef.tweenPlayerTo(nx, ny, () => StateManager.setPlayerMoving(false));
  }

  function tryInteract() {
    const { tileX, tileY, direction } = StateManager.getState().player;
    const off = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
    const [dx, dy] = off[direction];
    const obj = getObjectAt(tileX + dx, tileY + dy);
    if (!obj) return;
    if (obj.type === 'chest') {
      if (obj.opened) { sceneRef.showDialog('The chest is empty.'); }
      else { obj.opened = true; sceneRef.showDialog(`You found: ${obj.loot}!`); sceneRef.openChest(obj); }
    } else if (obj.type === 'npc')  { sceneRef.showDialog(obj.dialog, obj.id); }
    else if  (obj.type === 'sign')  { sceneRef.showDialog(obj.text); }
  }

  function performAction(type) {
    if (!sceneRef || StateManager.getState().player.isMoving) return;
    switch (type) {
      case 'move_up':    tryMove( 0,-1,'up');    break;
      case 'move_down':  tryMove( 0, 1,'down');  break;
      case 'move_left':  tryMove(-1, 0,'left');  break;
      case 'move_right': tryMove( 1, 0,'right'); break;
      case 'interact':   tryInteract();          break;
    }
  }

  return {
    init(scene, objects, zones) { sceneRef = scene; mapObjects = objects||[]; mapZones = zones||[]; },
    performAction
  };
})();
window.performAction = t => ActionSystem.performAction(t);


// =============================================================================
// SECTION 3: InputHandler
// =============================================================================
const InputHandler = (() => {
  const INTERVAL = 130;
  let cursors, wasd, lastMove = 0;
  function init(scene) {
    cursors = scene.input.keyboard.createCursorKeys();
    wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W, down:  Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
    });
    scene.input.keyboard.on('keydown-SPACE', () => ActionSystem.performAction('interact'));
    scene.input.keyboard.on('keydown-E',     () => ActionSystem.performAction('interact'));
    scene.input.keyboard.on('keydown-ENTER', () => ActionSystem.performAction('interact'));
  }
  function update(time) {
    if (time - lastMove < INTERVAL) return;
    if      (cursors.up.isDown    || wasd.up.isDown)    { ActionSystem.performAction('move_up');    lastMove=time; }
    else if (cursors.down.isDown  || wasd.down.isDown)  { ActionSystem.performAction('move_down');  lastMove=time; }
    else if (cursors.left.isDown  || wasd.left.isDown)  { ActionSystem.performAction('move_left');  lastMove=time; }
    else if (cursors.right.isDown || wasd.right.isDown) { ActionSystem.performAction('move_right'); lastMove=time; }
  }
  return { init, update };
})();


// =============================================================================
// SECTION 4: GameScene
// =============================================================================
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // --------------------------------------------------------------------------
  preload() {
    this.load.json('tilemap', 'tilemap.json');

    const TS = 'Ninja Adventure - Asset Pack/Backgrounds/Tilesets/';
    this.load.spritesheet('ts_floor',   TS+'TilesetFloor.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_nature',  TS+'TilesetNature.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_water',   TS+'TilesetWater.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_house',   TS+'TilesetHouse.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_desert',  TS+'TilesetDesert.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('ts_relief',  TS+'TilesetRelief.png',  { frameWidth:16, frameHeight:16 });

    const CH = 'Ninja Adventure - Asset Pack/Actor/Character/';
    this.load.spritesheet('player',      CH+'NinjaBlue/SpriteSheet.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_villager',CH+'Villager/SpriteSheet.png',   { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_guard',   CH+'Inspector/SpriteSheet.png',  { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_elder',   CH+'Master/SpriteSheet.png',     { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hunter',  CH+'Hunter/SpriteSheet.png',     { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('npc_hermit',  CH+'Caveman/SpriteSheet.png',    { frameWidth:16, frameHeight:16 });

    // Loading screen
    this.load.on('progress', v => {
      if (!this._loadBar) {
        this._loadBar = this.add.graphics();
        this._loadText = this.add.text(
          (window.innerWidth||800)/2, (window.innerHeight||600)/2 - 20,
          'Loading...', { fontSize:'16px', color:'#fff', fontFamily:'monospace' }
        ).setOrigin(0.5);
      }
      this._loadBar.clear();
      this._loadBar.fillStyle(0x333333,1).fillRect(100,(window.innerHeight||600)/2,
        (window.innerWidth||800)-200, 16);
      this._loadBar.fillStyle(0xffcc44,1).fillRect(100,(window.innerHeight||600)/2,
        ((window.innerWidth||800)-200)*v, 16);
    });
  }

  // --------------------------------------------------------------------------
  create() {
    if (this._loadBar)  this._loadBar.destroy();
    if (this._loadText) this._loadText.destroy();

    const mapData = this.cache.json.get('tilemap');
    const { width, height, tileSize, objects, zones, spawn } = mapData;

    StateManager.initMap(mapData);
    ActionSystem.init(this, objects, zones);

    // ---- LAYER 1: Ground tiles (using real tileset frames) ----
    this._drawGroundLayer(mapData);

    // ---- LAYER 2: Water (lake area) ----
    this._drawWaterLayer(mapData);

    // ---- LAYER 3: Cliffs / mountains ----
    this._drawCliffLayer(mapData);

    // ---- LAYER 4: Nature decorations (trees, rocks, bushes) ----
    this._drawNatureLayer(mapData);

    // ---- LAYER 5: Buildings ----
    this._drawBuildingLayer(mapData);

    // ---- LAYER 6: Chests, Signs, NPC sprites ----
    this._chestMap = {};
    this._drawObjects(objects);

    // ---- Player ----
    this._createPlayerAnims();
    this.player = this.add.sprite(
      spawn.tileX * TILE + TILE/2,
      spawn.tileY * TILE + TILE/2,
      'player', 1
    ).setDepth(50).setScale(1);
    this.player.play('idle_down');

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, width*TILE, height*TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(3);

    // ---- UI ----
    this._buildUI();

    // ---- Input ----
    InputHandler.init(this);

    // First zone banner
    this.time.delayedCall(300, () => this.showZoneBanner('Shinobi Village'));
  }

  update(time) { InputHandler.update(time); }

  // ==========================================================================
  // GROUND LAYER
  // Ground tile IDs in tilemap: 0=grass, 1=dirt_path, 2=stone, 3=sand, 4=forest_floor
  // We tile the floor using real frames from TilesetFloor / TilesetDesert
  // ==========================================================================
  _drawGroundLayer(mapData) {
    const { width, height } = mapData;
    const gData = mapData.layers.find(l => l.name==='ground').data;

    // Frame picks per ground type — varied using (col+row)%2 for natural look
    const FRAMES = {
      0: [FLOOR.GRASS, FLOOR.GRASS2, FLOOR.GRASS,  FLOOR.GRASS2],  // grass
      1: [FLOOR.PATH,  FLOOR.PATH2,  FLOOR.PATH,   FLOOR.PATH2],   // dirt path
      2: [FLOOR.STONE, FLOOR.STONE2, FLOOR.STONE,  FLOOR.STONE2],  // stone
      3: [DESERT.SAND, DESERT.SAND2, DESERT.SAND,  DESERT.SAND2],  // sand
      4: [FLOOR.FOREST,FLOOR.FOREST2,FLOOR.FOREST, FLOOR.FOREST2], // forest
    };
    const TILESET = { 0:'ts_floor', 1:'ts_floor', 2:'ts_floor', 3:'ts_desert', 4:'ts_floor' };

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const id   = gData[row * width + col];
        const key  = TILESET[id] ?? 'ts_floor';
        const pool = FRAMES[id] ?? FRAMES[0];
        // Checkerboard variation
        const f    = pool[(col + row) % pool.length];
        this.add.image(col*TILE + TILE/2, row*TILE + TILE/2, key, f)
          .setDepth(0).setOrigin(0.5);
      }
    }
  }

  // ==========================================================================
  // WATER LAYER — draws over the ground in the lake zone
  // Lake region: cols 55-75, rows 5-25
  // ==========================================================================
  _drawWaterLayer(mapData) {
    const { width, height } = mapData;
    const cData = mapData.layers.find(l => l.name==='collision').data;

    for (let row = 4; row <= 27; row++) {
      for (let col = 54; col <= 76; col++) {
        if (col >= width || row >= height) continue;
        if (cData[row * width + col] !== 1) continue;
        // Skip mountain collision zone
        if (row > 55) continue;

        const cx = col*TILE + TILE/2;
        const cy = row*TILE + TILE/2;

        // Pick water frame based on position (edge vs center)
        let frame;
        const isN = (row === 5  || cData[(row-1)*width+col] !== 1);
        const isS = (row === 25 || cData[(row+1)*width+col] !== 1);
        const isW = (col === 55 || cData[row*width+(col-1)] !== 1);
        const isE = (col === 75 || cData[row*width+(col+1)] !== 1);

        if      (isN && isW) frame = WATER.COLS * 0 + 0;   // NW corner
        else if (isN && isE) frame = WATER.COLS * 0 + 2;   // NE corner
        else if (isS && isW) frame = WATER.COLS * 2 + 0;   // SW corner
        else if (isS && isE) frame = WATER.COLS * 2 + 2;   // SE corner
        else if (isN)        frame = WATER.COLS * 0 + 1;   // N edge
        else if (isS)        frame = WATER.COLS * 2 + 1;   // S edge
        else if (isW)        frame = WATER.COLS * 1 + 0;   // W edge
        else if (isE)        frame = WATER.COLS * 1 + 2;   // E edge
        else                 frame = WATER.CENTER;          // center

        this.add.image(cx, cy, 'ts_water', frame).setDepth(2).setOrigin(0.5);
      }
    }
  }

  // ==========================================================================
  // CLIFF / MOUNTAIN LAYER — SW corner, rows 62-79, cols 0-15
  // Uses TilesetRelief cliff tiles
  // ==========================================================================
  _drawCliffLayer(mapData) {
    const { width, height } = mapData;
    const cData = mapData.layers.find(l => l.name==='collision').data;

    for (let row = 60; row < height; row++) {
      for (let col = 0; col <= 17; col++) {
        if (cData[row * width + col] !== 1) continue;
        const cx = col*TILE + TILE/2;
        const cy = row*TILE + TILE/2;

        const isTop = (row === 60 || cData[(row-1)*width+col] !== 1);
        let frame;
        if (isTop) {
          const isW = (col === 0  || cData[row*width+(col-1)] !== 1);
          const isE = (col === 17 || cData[row*width+(col+1)] !== 1);
          if (isW)      frame = RELIEF.CLIFF_TL;
          else if (isE) frame = RELIEF.CLIFF_TR;
          else          frame = RELIEF.CLIFF_T;
        } else {
          frame = RELIEF.CLIFF_C;
        }
        this.add.image(cx, cy, 'ts_relief', frame).setDepth(2).setOrigin(0.5);
      }
    }
  }

  // ==========================================================================
  // NATURE LAYER — trees on forest floor, rocks in desert/forest
  // Trees are 2×2 tile sprites placed at every 3rd tile in forest zones
  // ==========================================================================
  _drawNatureLayer(mapData) {
    const { width, height } = mapData;
    const gData = mapData.layers.find(l => l.name==='ground').data;
    const cData = mapData.layers.find(l => l.name==='collision').data;

    // Tree variants: each is a [TL,TR,BL,BR] frame set from ts_nature
    const TREE_VARIANTS = [
      [NATURE.TREE_TL,  NATURE.TREE_TR,  NATURE.TREE_BL,  NATURE.TREE_BR ],  // classic green
      [NATURE.TREE2_TL, NATURE.TREE2_TR, NATURE.TREE2_BL, NATURE.TREE2_BR],  // green v2
      [NATURE.TREEB_TL, NATURE.TREEB_TR, NATURE.TREEB_BL, NATURE.TREEB_BR],  // big round
      [NATURE.TREEP_TL, NATURE.TREEP_TR, NATURE.TREEP_BL, NATURE.TREEP_BR],  // pink blossom
    ];

    // Place trees: scan collision=1 cells in forest zone, place 2x2 tree every ~3 cols
    // Forest: col 0-32, row 0-55
    const placed = new Set();
    for (let row = 1; row < 55; row += 3) {
      for (let col = 1; col < 32; col += 3) {
        if (col+1 >= width || row+1 >= height) continue;
        if (cData[row*width+col] !== 1) continue;

        // Don't place on roads
        const gid = gData[row*width+col];
        if (gid === 1 || gid === 2) continue;

        const variant = TREE_VARIANTS[(col * 7 + row * 3) % TREE_VARIANTS.length];
        const px = col*TILE + TILE/2;
        const py = row*TILE + TILE/2;
        // 2x2 tree: four 16x16 tiles placed at grid positions
        this.add.image(px,        py,        'ts_nature', variant[0]).setDepth(8).setOrigin(0.5);
        this.add.image(px+TILE,   py,        'ts_nature', variant[1]).setDepth(8).setOrigin(0.5);
        this.add.image(px,        py+TILE,   'ts_nature', variant[2]).setDepth(8).setOrigin(0.5);
        this.add.image(px+TILE,   py+TILE,   'ts_nature', variant[3]).setDepth(8).setOrigin(0.5);
        placed.add(`${col},${row}`);
      }
    }

    // Dead trees in mountain/south-west border of forest
    for (let row = 50; row < 60; row += 4) {
      for (let col = 2; col < 28; col += 4) {
        if (cData[row*width+col] !== 1) continue;
        const px = col*TILE + TILE/2;
        const py = row*TILE + TILE/2;
        this.add.image(px,      py,      'ts_nature', NATURE.TREED_TL).setDepth(8).setOrigin(0.5);
        this.add.image(px+TILE, py,      'ts_nature', NATURE.TREED_TR).setDepth(8).setOrigin(0.5);
        this.add.image(px,      py+TILE, 'ts_nature', NATURE.TREED_BL).setDepth(8).setOrigin(0.5);
        this.add.image(px+TILE, py+TILE, 'ts_nature', NATURE.TREED_BR).setDepth(8).setOrigin(0.5);
      }
    }

    // Desert rocks
    const desertRocks = [[55,55,58,58],[65,53,68,56],[62,62,66,65],[72,58,76,62]];
    for (const [x1,y1,x2,y2] of desertRocks) {
      for (let r = y1; r <= y2; r++) {
        for (let c = x1; c <= x2; c++) {
          const f = ((c+r)%2===0) ? NATURE.ROCK_LG : NATURE.ROCK_MD;
          this.add.image(c*TILE+TILE/2, r*TILE+TILE/2, 'ts_nature', f).setDepth(6).setOrigin(0.5);
        }
      }
    }

    // Scatter some small bushes/rocks around the world edges
    for (let i = 0; i < 40; i++) {
      const col = Math.floor((i * 17 + 5) % width);
      const row = Math.floor((i * 13 + 7) % (height * 0.8));
      const gid = gData[row*width+col];
      if (gid !== 0 && gid !== 4) continue;
      if (cData[row*width+col] === 1) continue;
      if (col > 24 && col < 55 && row > 18 && row < 50) continue; // skip village
      this.add.image(col*TILE+TILE/2, row*TILE+TILE/2, 'ts_nature', NATURE.BUSH)
        .setDepth(4).setOrigin(0.5);
    }
  }

  // ==========================================================================
  // BUILDINGS — use TilesetHouse frames for authentic look
  // Each building is placed tile by tile using house tileset frames.
  // Building structure per tile:
  //   Roof row: ts_house row 2 (orange roof tiles)
  //   Wall row: ts_house row 4 (brown wall tiles with windows)
  //   Base row: ts_house row 5 (wall base / door)
  //
  // TilesetHouse 33 cols:
  //   Roof tiles row 2: col 0=roof-TL, col 1=roof-top, col 2=roof-TR
  //   Roof tiles row 3: col 0=roof-BL (overhang), col 1=roof-bottom, col 2=roof-BR
  //   Wall row 4:       col 0=wall-L, col 1=wall-mid, col 2=wall-R
  //   Base/door row 5:  col 0=base-L, col 1=door,     col 2=base-R
  // ==========================================================================
  _drawBuildingLayer(mapData) {
    // Building definitions: x, y, w, h (in tiles), style (0=inn, 1=shop, 2=blacksmith)
    const buildings = [
      { x:29, y:23, w:6, h:5, style:0 },
      { x:37, y:23, w:5, h:5, style:1 },
      { x:45, y:23, w:5, h:5, style:2 },
      { x:29, y:38, w:5, h:5, style:1 },
      { x:37, y:38, w:5, h:5, style:0 },
      { x:45, y:38, w:5, h:5, style:2 },
    ];

    // House tileset row offsets for each style:
    // style 0 (inn):        roof row 2, wall row 4,  base row 5
    // style 1 (shop):       roof row 7, wall row 9,  base row 10
    // style 2 (blacksmith): roof row 2, wall row 14, base row 15
    const STYLES = [
      { roofRow:2, wallRow:4, baseRow:5,  roofColor:0 },
      { roofRow:7, wallRow:9, baseRow:10, roofColor:0 },
      { roofRow:2, wallRow:4, baseRow:5,  roofColor:0 },
    ];

    for (const b of buildings) {
      const s = STYLES[b.style];
      const HC = HOUSE.COLS; // 33

      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          const wx = (b.x + dx) * TILE + TILE/2;
          const wy = (b.y + dy) * TILE + TILE/2;
          let tsRow, tsCol;

          if (dy === 0) {
            // Roof top row
            tsRow = s.roofRow;
            tsCol = dx === 0 ? 0 : (dx === b.w-1 ? 2 : 1);
          } else if (dy === 1) {
            // Roof bottom / overhang
            tsRow = s.roofRow + 1;
            tsCol = dx === 0 ? 0 : (dx === b.w-1 ? 2 : 1);
          } else if (dy === b.h - 1) {
            // Base / door row
            tsRow = s.baseRow;
            const mid = Math.floor(b.w / 2);
            tsCol = dx === 0 ? 0 : (dx === b.w-1 ? 2 : (dx === mid ? 1 : 3));
          } else {
            // Wall rows
            tsRow = s.wallRow;
            tsCol = dx === 0 ? 0 : (dx === b.w-1 ? 2 : 1);
          }

          const frame = tsRow * HC + tsCol;
          this.add.image(wx, wy, 'ts_house', frame).setDepth(10).setOrigin(0.5);
        }
      }
    }

    // Village well — use house tileset barrel/well sprite (row 10, col ~5)
    const wellX = 40*TILE + TILE/2;
    const wellY = 28*TILE + TILE/2;
    // Well is a 2x2 sprite in the house tileset — rows 10-11, cols 4-5
    this.add.image(wellX,      wellY,      'ts_house', 10*HOUSE.COLS+4).setDepth(12).setOrigin(0.5);
    this.add.image(wellX+TILE, wellY,      'ts_house', 10*HOUSE.COLS+5).setDepth(12).setOrigin(0.5);
    this.add.image(wellX,      wellY+TILE, 'ts_house', 11*HOUSE.COLS+4).setDepth(12).setOrigin(0.5);
    this.add.image(wellX+TILE, wellY+TILE, 'ts_house', 11*HOUSE.COLS+5).setDepth(12).setOrigin(0.5);

    // Fences along village perimeter paths
    for (let c = 28; c <= 53; c++) {
      if (c === 39 || c === 40 || c === 41) continue; // gap for road
      this.add.image(c*TILE+TILE/2, 21*TILE+TILE/2, 'ts_house', 8*HOUSE.COLS+9)
        .setDepth(9).setOrigin(0.5);
    }
  }

  // ==========================================================================
  // OBJECTS: Chests, Signs, NPCs
  // ==========================================================================
  _drawObjects(objects) {
    const npcKeys = {
      merchant: 'npc_villager', guard: 'npc_guard', elder: 'npc_elder',
      hunter: 'npc_hunter',    hermit: 'npc_hermit'
    };

    for (const obj of objects) {
      const px = obj.tileX * TILE + TILE/2;
      const py = obj.tileY * TILE + TILE/2;

      if (obj.type === 'chest') {
        // Chest from house tileset: rows 10-11, cols 0-1 area
        // Use a graphics-drawn chest as fallback since exact chest frame varies
        const g = this.add.graphics().setDepth(15);
        this._drawChestGraphic(g, px, py, false);
        this._chestMap[`${obj.tileX}_${obj.tileY}`] = { gfx: g, obj };

      } else if (obj.type === 'sign') {
        // Sign post using house tileset row 8, col 12 area (signpost tile)
        this.add.image(px, py, 'ts_house', 8*HOUSE.COLS+12).setDepth(10).setOrigin(0.5);

      } else if (obj.type === 'npc') {
        const key = npcKeys[obj.id] || 'npc_villager';
        // NPC sprites: frame 4 = idle down (row 1, col 0)
        const spr = this.add.sprite(px, py, key, 4).setDepth(20);
        // Exclamation mark above head
        this.add.text(px, py - 12, '!', {
          fontSize:'8px', fontFamily:'monospace', color:'#ffff00',
          stroke:'#000', strokeThickness:2
        }).setOrigin(0.5).setDepth(25);
      }
    }
  }

  _drawChestGraphic(g, cx, cy, opened) {
    g.clear();
    const h = TILE;
    if (opened) {
      g.fillStyle(0x6a3a10,1).fillRect(cx-h/2+2, cy-h/2+4, h-4, h-6);
      g.fillStyle(0x3366aa,0.8).fillRect(cx-h/2+3, cy-h/2+5, h-6, h-8);
    } else {
      g.fillStyle(0x8b4513,1).fillRect(cx-h/2+2, cy-h/2+2, h-4, h-4);
      g.fillStyle(0xffd700,1).fillRect(cx-h/2+2, cy-h/2+2, h-4, 4);
      g.fillStyle(0x222,1).fillRect(cx-2, cy,   4, 4);
      g.lineStyle(1,0x5a2a00,1).strokeRect(cx-h/2+2, cy-h/2+2, h-4, h-4);
    }
  }

  openChest(obj) {
    const entry = this._chestMap[`${obj.tileX}_${obj.tileY}`];
    if (!entry) return;
    const { gfx } = entry;
    const px = obj.tileX * TILE + TILE/2;
    const py = obj.tileY * TILE + TILE/2;
    this._drawChestGraphic(gfx, px, py, true);
    // Sparkle
    for (let i = 0; i < 5; i++) {
      const angle = (i/5)*Math.PI*2;
      const sx = px + Math.cos(angle)*14, sy = py + Math.sin(angle)*14;
      const star = this.add.graphics().setDepth(60);
      star.fillStyle(0xffdd00,1).fillRect(sx-2, sy-2, 4, 4);
      this.tweens.add({ targets:star, alpha:0, y:sy-12, duration:500,
        ease:'Quad.Out', onComplete:()=>star.destroy() });
    }
  }

  // ==========================================================================
  // PLAYER ANIMATIONS
  // NinjaBlue: 64x112 = 4 cols x 7 rows, 16x16 per frame
  // Row 0 frames 0-3:   walk down
  // Row 1 frames 4-7:   walk left
  // Row 2 frames 8-11:  walk right
  // Row 3 frames 12-15: walk up
  // ==========================================================================
  _createPlayerAnims() {
    const defs = [
      { key:'walk_down',  frames:[0,1,2,3],    rate:8 },
      { key:'walk_left',  frames:[4,5,6,7],    rate:8 },
      { key:'walk_right', frames:[8,9,10,11],  rate:8 },
      { key:'walk_up',    frames:[12,13,14,15],rate:8 },
      { key:'idle_down',  frames:[1],           rate:1 },
      { key:'idle_left',  frames:[5],           rate:1 },
      { key:'idle_right', frames:[9],           rate:1 },
      { key:'idle_up',    frames:[13],          rate:1 },
    ];
    for (const d of defs) {
      if (!this.anims.exists(d.key)) {
        this.anims.create({
          key: d.key,
          frames: d.frames.map(f => ({ key:'player', frame:f })),
          frameRate: d.rate, repeat: -1
        });
      }
    }
  }

  updatePlayerDir(dir) {
    this.player.play(`walk_${dir}`, true);
    this._idleAnim = `idle_${dir}`;
  }

  tweenPlayerTo(tx, ty, onComplete) {
    const px = tx*TILE + TILE/2, py = ty*TILE + TILE/2;
    this.tweens.add({
      targets: this.player, x:px, y:py, duration:130, ease:'Linear',
      onComplete: () => {
        if (this._idleAnim) this.player.play(this._idleAnim, true);
        if (onComplete) onComplete();
      }
    });
  }

  // ==========================================================================
  // UI
  // ==========================================================================
  _buildUI() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.zoneBanner = this.add.text(W/2, 20, '', {
      fontSize:'14px', fontFamily:'monospace', color:'#fff',
      stroke:'#000', strokeThickness:3,
      backgroundColor:'#00000099', padding:{x:10,y:4}
    }).setOrigin(0.5,0).setScrollFactor(0).setDepth(200).setAlpha(0);

    this.add.text(6, H-16, 'WASD/Arrows: Move   Space/E: Interact', {
      fontSize:'7px', fontFamily:'monospace', color:'#ffffffbb',
      backgroundColor:'#00000066', padding:{x:4,y:2}
    }).setScrollFactor(0).setDepth(200);

    this.dialogBg = this.add.rectangle(W/2, H-28, W-16, 44, 0x000000, 0.88)
      .setScrollFactor(0).setDepth(200).setVisible(false)
      .setStrokeStyle(1, 0xffcc44);
    this.dialogTxt = this.add.text(W/2, H-28, '', {
      fontSize:'8px', fontFamily:'monospace', color:'#fff',
      wordWrap:{width:W-32}, align:'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);
    this._dlgTimer = null;

    this.zoneLabel = this.add.text(W-6, H-16, '', {
      fontSize:'7px', fontFamily:'monospace', color:'#ffcc88',
      backgroundColor:'#00000066', padding:{x:4,y:2}
    }).setOrigin(1,1).setScrollFactor(0).setDepth(200);
  }

  showDialog(msg, speaker) {
    const txt = speaker ? `[${speaker.toUpperCase()}]  ${msg}` : msg;
    this.dialogBg.setVisible(true);
    this.dialogTxt.setText(txt).setVisible(true);
    if (this._dlgTimer) this._dlgTimer.remove();
    this._dlgTimer = this.time.delayedCall(3500, () => {
      this.dialogBg.setVisible(false);
      this.dialogTxt.setVisible(false);
    });
  }

  showZoneBanner(name) {
    this.zoneBanner.setText(name).setAlpha(1);
    this.tweens.add({
      targets:this.zoneBanner, alpha:0,
      delay:2000, duration:800, ease:'Quad.In'
    });
    this.zoneLabel.setText(name);
  }
}


// =============================================================================
// Bootstrap
// =============================================================================
new Phaser.Game({
  type: Phaser.AUTO,
  width:  window.innerWidth  || 800,
  height: window.innerHeight || 600,
  backgroundColor: '#1a2a1a',
  scene: [GameScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  pixelArt: true
});
