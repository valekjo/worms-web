import Phaser from 'phaser';
import { CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  backgroundColor: CONFIG.TERRAIN.SKY_COLOR,
  scene: [BootScene, MenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

export default game;
