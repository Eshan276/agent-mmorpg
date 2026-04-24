export const TILE = 16;

// TilesetFloor.png — 352x417px = 22 cols x 26 rows
export const FLOOR = {
  COLS:    22,
  GRASS:   2*22+0,   // 44 — bright green grass
  GRASS2:  2*22+1,   // 45
  FOREST:  3*22+0,   // 66 — darker forest floor
  FOREST2: 3*22+1,   // 67
  PATH:    4*22+0,   // 88 — dirt path
  PATH2:   4*22+1,   // 89
  STONE:   11*22+0,  // 242 — stone floor (village plaza)
  STONE2:  11*22+1,  // 243
  SAND:    0*22+0,   // 0   — peach/sandy stone
  SAND2:   0*22+1,   // 1
};

// TilesetNature.png — 384x336px = 24 cols x 21 rows
export const NATURE = {
  COLS:     24,
  TREE_TL:  0*24+0,  TREE_TR:  0*24+1,  TREE_BL:  1*24+0,  TREE_BR:  1*24+1,
  TREE2_TL: 0*24+2,  TREE2_TR: 0*24+3,  TREE2_BL: 1*24+2,  TREE2_BR: 1*24+3,
  TREEP_TL: 0*24+4,  TREEP_TR: 0*24+5,  TREEP_BL: 1*24+4,  TREEP_BR: 1*24+5,
  TREEB_TL: 0*24+8,  TREEB_TR: 0*24+9,  TREEB_BL: 1*24+8,  TREEB_BR: 1*24+9,
  TREED_TL: 2*24+0,  TREED_TR: 2*24+1,  TREED_BL: 3*24+0,  TREED_BR: 3*24+1,
  ROCK_SM:  4*24+12,
  ROCK_MD:  4*24+14,
  ROCK_LG:  4*24+16,
  BUSH:     4*24+0,
  BUSH2:    4*24+2,
};

// TilesetWater.png — 448x272px = 28 cols x 17 rows
export const WATER = {
  COLS:    28,
  CENTER:  1*28+1,
  EDGE_N:  0*28+1,
  EDGE_S:  2*28+1,
  EDGE_W:  1*28+0,
  EDGE_E:  1*28+2,
  COR_NW:  0*28+0,
  COR_NE:  0*28+2,
  COR_SW:  2*28+0,
  COR_SE:  2*28+2,
};

// TilesetHouse.png — 528x368px = 33 cols x 23 rows
export const HOUSE = {
  COLS: 33,
};

// TilesetDesert.png — 320x192px = 20 cols x 12 rows
export const DESERT = {
  COLS:  20,
  SAND:  4*20+0,  // 80
  SAND2: 4*20+1,  // 81
};

// TilesetRelief.png — 320x192px = 20 cols x 12 rows
export const RELIEF = {
  COLS:     20,
  CLIFF_TL: 0*20+0,
  CLIFF_T:  0*20+1,
  CLIFF_TR: 0*20+2,
  CLIFF_C:  2*20+1,
};
