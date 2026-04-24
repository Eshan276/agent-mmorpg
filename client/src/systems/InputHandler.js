import { ActionSystem } from './ActionSystem.js';

const MOVE_INTERVAL = 130; // ms — matches tween duration
let cursors, wasd, lastMove = 0;

export const InputHandler = {
  init(scene) {
    cursors = scene.input.keyboard.createCursorKeys();
    wasd = scene.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    scene.input.keyboard.on('keydown-SPACE', () => ActionSystem.performAction('interact'));
    scene.input.keyboard.on('keydown-E',     () => ActionSystem.performAction('interact'));
    scene.input.keyboard.on('keydown-ENTER', () => ActionSystem.performAction('interact'));
  },

  update(time) {
    if (time - lastMove < MOVE_INTERVAL) return;
    if      (cursors.up.isDown    || wasd.up.isDown)    { ActionSystem.performAction('move_up');    lastMove = time; }
    else if (cursors.down.isDown  || wasd.down.isDown)  { ActionSystem.performAction('move_down');  lastMove = time; }
    else if (cursors.left.isDown  || wasd.left.isDown)  { ActionSystem.performAction('move_left');  lastMove = time; }
    else if (cursors.right.isDown || wasd.right.isDown) { ActionSystem.performAction('move_right'); lastMove = time; }
  },
};
