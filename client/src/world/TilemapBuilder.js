import { TILE, FLOOR, NATURE, WATER, HOUSE, DESERT, RELIEF } from '../constants/Tilesets.js';

export class TilemapBuilder {
  constructor(scene) {
    this.scene = scene;
  }

  build(mapData) {
    this._drawGroundLayer(mapData);
    this._drawWaterLayer(mapData);
    this._drawCliffLayer(mapData);
    this._drawNatureLayer(mapData);
    this._drawBuildingLayer(mapData);
  }

  // --------------------------------------------------------------------------
  // Ground — one real tileset frame per tile
  // --------------------------------------------------------------------------
  _drawGroundLayer({ width, height, layers }) {
    const gData = layers.find(l => l.name === 'ground').data;
    const FRAMES = {
      0: [FLOOR.GRASS,   FLOOR.GRASS2,  FLOOR.GRASS,  FLOOR.GRASS2 ],
      1: [FLOOR.PATH,    FLOOR.PATH2,   FLOOR.PATH,   FLOOR.PATH2  ],
      2: [FLOOR.STONE,   FLOOR.STONE2,  FLOOR.STONE,  FLOOR.STONE2 ],
      3: [DESERT.SAND,   DESERT.SAND2,  DESERT.SAND,  DESERT.SAND2 ],
      4: [FLOOR.FOREST,  FLOOR.FOREST2, FLOOR.FOREST, FLOOR.FOREST2],
    };
    const KEYS = { 0:'ts_floor', 1:'ts_floor', 2:'ts_floor', 3:'ts_desert', 4:'ts_floor' };

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const id    = gData[row * width + col];
        const pool  = FRAMES[id] ?? FRAMES[0];
        const frame = pool[(col + row) % pool.length];
        const key   = KEYS[id] ?? 'ts_floor';
        this.scene.add.image(col*TILE + TILE/2, row*TILE + TILE/2, key, frame)
          .setDepth(0).setOrigin(0.5);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Water — edge-aware tile selection (NW/N/NE corners etc.)
  // --------------------------------------------------------------------------
  _drawWaterLayer({ width, height, layers }) {
    const cData = layers.find(l => l.name === 'collision').data;

    for (let row = 4; row <= 27; row++) {
      for (let col = 54; col <= 76; col++) {
        if (col >= width || row >= height) continue;
        if (cData[row * width + col] !== 1) continue;

        const isN = row <= 5  || cData[(row-1)*width+col] !== 1;
        const isS = row >= 25 || cData[(row+1)*width+col] !== 1;
        const isW = col <= 55 || cData[row*width+(col-1)] !== 1;
        const isE = col >= 75 || cData[row*width+(col+1)] !== 1;

        let frame;
        if      (isN && isW) frame = WATER.COR_NW;
        else if (isN && isE) frame = WATER.COR_NE;
        else if (isS && isW) frame = WATER.COR_SW;
        else if (isS && isE) frame = WATER.COR_SE;
        else if (isN)        frame = WATER.EDGE_N;
        else if (isS)        frame = WATER.EDGE_S;
        else if (isW)        frame = WATER.EDGE_W;
        else if (isE)        frame = WATER.EDGE_E;
        else                 frame = WATER.CENTER;

        this.scene.add.image(col*TILE + TILE/2, row*TILE + TILE/2, 'ts_water', frame)
          .setDepth(2).setOrigin(0.5);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Cliffs — SW mountain area
  // --------------------------------------------------------------------------
  _drawCliffLayer({ width, height, layers }) {
    const cData = layers.find(l => l.name === 'collision').data;

    for (let row = 60; row < height; row++) {
      for (let col = 0; col <= 17; col++) {
        if (cData[row * width + col] !== 1) continue;
        const isTop = row === 60 || cData[(row-1)*width+col] !== 1;
        const isW   = col === 0  || cData[row*width+(col-1)] !== 1;
        const isE   = col === 17 || cData[row*width+(col+1)] !== 1;
        let frame;
        if (isTop) frame = isW ? RELIEF.CLIFF_TL : isE ? RELIEF.CLIFF_TR : RELIEF.CLIFF_T;
        else       frame = RELIEF.CLIFF_C;
        this.scene.add.image(col*TILE + TILE/2, row*TILE + TILE/2, 'ts_relief', frame)
          .setDepth(2).setOrigin(0.5);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Nature — 2×2 trees in forest, rocks in desert, scattered bushes
  // --------------------------------------------------------------------------
  _drawNatureLayer({ width, height, layers }) {
    const gData = layers.find(l => l.name === 'ground').data;
    const cData = layers.find(l => l.name === 'collision').data;

    const TREE_VARIANTS = [
      [NATURE.TREE_TL,  NATURE.TREE_TR,  NATURE.TREE_BL,  NATURE.TREE_BR ],
      [NATURE.TREE2_TL, NATURE.TREE2_TR, NATURE.TREE2_BL, NATURE.TREE2_BR],
      [NATURE.TREEB_TL, NATURE.TREEB_TR, NATURE.TREEB_BL, NATURE.TREEB_BR],
      [NATURE.TREEP_TL, NATURE.TREEP_TR, NATURE.TREEP_BL, NATURE.TREEP_BR],
    ];

    // Forest trees
    for (let row = 1; row < 55; row += 3) {
      for (let col = 1; col < 32; col += 3) {
        if (col+1 >= width || row+1 >= height) continue;
        if (cData[row*width+col] !== 1) continue;
        const gid = gData[row*width+col];
        if (gid === 1 || gid === 2) continue;
        const v  = TREE_VARIANTS[(col*7 + row*3) % TREE_VARIANTS.length];
        const px = col*TILE + TILE/2, py = row*TILE + TILE/2;
        this.scene.add.image(px,      py,      'ts_nature', v[0]).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px+TILE, py,      'ts_nature', v[1]).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px,      py+TILE, 'ts_nature', v[2]).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px+TILE, py+TILE, 'ts_nature', v[3]).setDepth(8).setOrigin(0.5);
      }
    }

    // Dead trees near mountain transition
    for (let row = 50; row < 60; row += 4) {
      for (let col = 2; col < 28; col += 4) {
        if (cData[row*width+col] !== 1) continue;
        const px = col*TILE + TILE/2, py = row*TILE + TILE/2;
        this.scene.add.image(px,      py,      'ts_nature', NATURE.TREED_TL).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px+TILE, py,      'ts_nature', NATURE.TREED_TR).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px,      py+TILE, 'ts_nature', NATURE.TREED_BL).setDepth(8).setOrigin(0.5);
        this.scene.add.image(px+TILE, py+TILE, 'ts_nature', NATURE.TREED_BR).setDepth(8).setOrigin(0.5);
      }
    }

    // Desert rocks
    for (const [x1,y1,x2,y2] of [[55,55,58,58],[65,53,68,56],[62,62,66,65],[72,58,76,62]]) {
      for (let r = y1; r <= y2; r++) {
        for (let c = x1; c <= x2; c++) {
          const f = ((c+r) % 2 === 0) ? NATURE.ROCK_LG : NATURE.ROCK_MD;
          this.scene.add.image(c*TILE+TILE/2, r*TILE+TILE/2, 'ts_nature', f).setDepth(6).setOrigin(0.5);
        }
      }
    }

    // Scattered bushes (avoid village area)
    for (let i = 0; i < 40; i++) {
      const col = Math.floor((i*17+5) % width);
      const row = Math.floor((i*13+7) % (height*0.8));
      if (gData[row*width+col] !== 0 && gData[row*width+col] !== 4) continue;
      if (cData[row*width+col] === 1) continue;
      if (col > 24 && col < 55 && row > 18 && row < 50) continue;
      this.scene.add.image(col*TILE+TILE/2, row*TILE+TILE/2, 'ts_nature', NATURE.BUSH)
        .setDepth(4).setOrigin(0.5);
    }
  }

  // --------------------------------------------------------------------------
  // Buildings — assembled tile by tile from TilesetHouse frames
  // --------------------------------------------------------------------------
  _drawBuildingLayer(_mapData) {
    const buildings = [
      { x:29, y:23, w:6, h:5, roofRow:2, wallRow:4, baseRow:5  },
      { x:37, y:23, w:5, h:5, roofRow:7, wallRow:9, baseRow:10 },
      { x:45, y:23, w:5, h:5, roofRow:2, wallRow:4, baseRow:5  },
      { x:29, y:38, w:5, h:5, roofRow:7, wallRow:9, baseRow:10 },
      { x:37, y:38, w:5, h:5, roofRow:2, wallRow:4, baseRow:5  },
      { x:45, y:38, w:5, h:5, roofRow:7, wallRow:9, baseRow:10 },
    ];
    const HC = HOUSE.COLS;

    for (const b of buildings) {
      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          const wx = (b.x + dx)*TILE + TILE/2;
          const wy = (b.y + dy)*TILE + TILE/2;
          let tsRow, tsCol;
          if (dy === 0)        { tsRow = b.roofRow;     tsCol = dx===0?0:dx===b.w-1?2:1; }
          else if (dy === 1)   { tsRow = b.roofRow+1;   tsCol = dx===0?0:dx===b.w-1?2:1; }
          else if (dy===b.h-1) { tsRow = b.baseRow;     tsCol = dx===0?0:dx===b.w-1?2:(dx===Math.floor(b.w/2)?1:3); }
          else                 { tsRow = b.wallRow;     tsCol = dx===0?0:dx===b.w-1?2:1; }
          this.scene.add.image(wx, wy, 'ts_house', tsRow*HC + tsCol).setDepth(10).setOrigin(0.5);
        }
      }
    }

    // Village well (2×2 from house tileset rows 10-11, cols 4-5)
    const wx = 40*TILE + TILE/2, wy = 28*TILE + TILE/2;
    this.scene.add.image(wx,      wy,      'ts_house', 10*HC+4).setDepth(12).setOrigin(0.5);
    this.scene.add.image(wx+TILE, wy,      'ts_house', 10*HC+5).setDepth(12).setOrigin(0.5);
    this.scene.add.image(wx,      wy+TILE, 'ts_house', 11*HC+4).setDepth(12).setOrigin(0.5);
    this.scene.add.image(wx+TILE, wy+TILE, 'ts_house', 11*HC+5).setDepth(12).setOrigin(0.5);

    // Fence line above village
    for (let c = 28; c <= 53; c++) {
      if (c === 39 || c === 40 || c === 41) continue;
      this.scene.add.image(c*TILE+TILE/2, 21*TILE+TILE/2, 'ts_house', 8*HC+9)
        .setDepth(9).setOrigin(0.5);
    }
  }
}
