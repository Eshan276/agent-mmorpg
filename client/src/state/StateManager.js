import { TILE } from '../constants/Tilesets.js';

const state = {
  player: {
    tileX: 40,
    tileY: 35,
    direction: 'down',
    isMoving: false,
  },
  map: {
    width: 0,
    height: 0,
    tileSize: TILE,
    groundData: [],
    collisionData: [],
  },
  currentZone: '',
};

export const StateManager = {
  getState() { return state; },
  setPlayerPos(tx, ty)  { state.player.tileX = tx; state.player.tileY = ty; },
  setPlayerDir(dir)     { state.player.direction = dir; },
  setPlayerMoving(bool) { state.player.isMoving = bool; },
  setZone(name)         { state.currentZone = name; },
  initMap(mapData) {
    state.map.width         = mapData.width;
    state.map.height        = mapData.height;
    state.map.tileSize      = mapData.tileSize;
    state.map.groundData    = mapData.layers.find(l => l.name === 'ground').data;
    state.map.collisionData = mapData.layers.find(l => l.name === 'collision').data;
    state.player.tileX      = mapData.spawn.tileX;
    state.player.tileY      = mapData.spawn.tileY;
  },
};

// Global access for bots/devtools
window.getGameState = () => StateManager.getState();
