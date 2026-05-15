import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // No external assets needed – everything is drawn with Phaser primitives.
    // Proceed to menu immediately.
    this.scene.start('MenuScene');
  }
}
