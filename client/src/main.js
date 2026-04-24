import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene }   from './scenes/UIScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width:  window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a2a1a',
  // GameScene runs first (world), UIScene runs on top (HUD)
  scene: [GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
});
