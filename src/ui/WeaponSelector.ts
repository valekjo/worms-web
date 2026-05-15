import Phaser from 'phaser';
import { WeaponType } from '../game/weapons/Weapon';

const WEAPONS: WeaponType[] = ['BAZOOKA', 'RIFLE', 'GRENADE'];
const LABELS: Record<WeaponType, string> = {
  BAZOOKA: '1:Bazooka',
  RIFLE:   '2:Rifle',
  GRENADE: '3:Grenade',
};

export class WeaponSelector {
  private scene: Phaser.Scene;
  private containers: Phaser.GameObjects.Rectangle[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private selected: WeaponType = 'BAZOOKA';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.scale;
    const startX = width / 2 - 160;
    const y = height - 30;

    for (let i = 0; i < WEAPONS.length; i++) {
      const wx = startX + i * 160;
      const rect = this.scene.add.rectangle(wx, y, 140, 44, 0x222222, 0.85).setDepth(10).setScrollFactor(0);
      const txt = this.scene.add
        .text(wx, y, LABELS[WEAPONS[i]], { fontSize: '16px', color: '#fff' })
        .setOrigin(0.5)
        .setDepth(11).setScrollFactor(0);
      this.containers.push(rect);
      this.texts.push(txt);
    }
    this.updateHighlight();
  }

  select(type: WeaponType): void {
    this.selected = type;
    this.updateHighlight();
  }

  getSelected(): WeaponType {
    return this.selected;
  }

  private updateHighlight(): void {
    for (let i = 0; i < WEAPONS.length; i++) {
      const active = WEAPONS[i] === this.selected;
      this.containers[i].setFillStyle(active ? 0x005500 : 0x222222);
      this.texts[i].setColor(active ? '#ffff00' : '#ffffff');
    }
  }

  setVisible(visible: boolean): void {
    this.containers.forEach((c) => c.setVisible(visible));
    this.texts.forEach((t) => t.setVisible(visible));
  }
}
