import Phaser from 'phaser';
import { Worm } from '../game/Worm';
import { Team } from '../game/Team';
import { TurnPhase } from '../game/TurnManager';
import { WeaponType } from '../game/weapons/Weapon';

export class HUD {
  private scene: Phaser.Scene;

  // Top bar
  private turnText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private windArrow!: Phaser.GameObjects.Graphics;

  // Weapon info
  private weaponText!: Phaser.GameObjects.Text;

  // Worm health bars: keyed by worm id
  private healthBars: Map<number, {
    bg: Phaser.GameObjects.Rectangle;
    fill: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const { width } = this.scene.scale;

    // Top-left: turn + team info
    this.turnText = this.scene.add
      .text(10, 10, '', { fontSize: '18px', color: '#fff', stroke: '#000', strokeThickness: 3 })
      .setDepth(20);

    // Top-right: timer
    this.timerText = this.scene.add
      .text(width - 10, 10, '', {
        fontSize: '28px',
        color: '#ffff00',
        stroke: '#000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(20);

    // Wind indicator (top center)
    this.windArrow = this.scene.add.graphics().setDepth(20);
    this.windText = this.scene.add
      .text(width / 2, 10, '', {
        fontSize: '16px',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    // Bottom weapon text
    this.weaponText = this.scene.add
      .text(10, this.scene.scale.height - 80, '', {
        fontSize: '16px',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setDepth(20);

  }

  /** Register a worm and create its floating health bar. */
  registerWorm(worm: Worm, color: number): void {
    const bg = this.scene.add.rectangle(worm.x, worm.y - 20, 40, 6, 0x000000, 0.7).setDepth(15);
    const fill = this.scene.add.rectangle(worm.x - 20, worm.y - 20, 40, 6, color).setOrigin(0, 0.5).setDepth(16);
    const label = this.scene.add
      .text(worm.x, worm.y - 30, worm.name, { fontSize: '11px', color: '#fff', stroke: '#000', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(16);
    this.healthBars.set(worm.id, { bg, fill, label });
  }

  /** Update all health bars positions and fill amounts. */
  updateHealthBars(teams: Team[]): void {
    for (const team of teams) {
      for (const worm of team.worms) {
        const bar = this.healthBars.get(worm.id);
        if (!bar) continue;
        const visible = worm.alive;
        bar.bg.setVisible(visible);
        bar.fill.setVisible(visible);
        bar.label.setVisible(visible);
        if (!visible) continue;

        bar.bg.setPosition(worm.x, worm.y - 22);
        bar.fill.setPosition(worm.x - 20, worm.y - 22);
        bar.label.setPosition(worm.x, worm.y - 30);

        const pct = Math.max(0, worm.health / worm.maxHealth);
        bar.fill.setSize(40 * pct, 6);

        // Color based on health
        const hp = worm.health;
        const color = hp > 60 ? 0x44dd44 : hp > 30 ? 0xffaa00 : 0xff2222;
        bar.fill.setFillStyle(color);
        bar.label.setText(`${worm.name} ${worm.health}`);
      }
    }
  }

  /** Update the top bar. */
  updateTurnInfo(turnNumber: number, team: Team, phase: TurnPhase, timeLeft: number): void {
    const phaseLabel = phase === 'RETREAT' ? ' [Retreat]' : phase === 'FIRED' ? ' [Fired]' : '';
    this.turnText.setText(`Turn ${turnNumber + 1} — ${team.name}${phaseLabel}`);
    this.turnText.setColor(phase === 'RETREAT' ? '#ff8800' : '#ffffff');

    const t = Math.ceil(timeLeft);
    this.timerText.setText(`${t}s`);
    this.timerText.setColor(timeLeft < 10 ? '#ff4444' : '#ffff00');
  }

  /** Update the wind display. */
  updateWind(wind: number): void {
    const cx = this.scene.scale.width / 2;
    const cy = 32;
    const strength = Math.abs(wind);
    const dir = wind >= 0 ? 1 : -1;
    const bars = Math.round((strength / 80) * 5);

    this.windArrow.clear();
    this.windArrow.lineStyle(2, 0xffffff, 1);
    // Draw arrow shaft
    this.windArrow.beginPath();
    this.windArrow.moveTo(cx - dir * 40, cy);
    this.windArrow.lineTo(cx + dir * 40, cy);
    this.windArrow.strokePath();
    // Arrow head
    this.windArrow.fillStyle(0xffffff, 1);
    this.windArrow.fillTriangle(
      cx + dir * 40, cy,
      cx + dir * 28, cy - 6,
      cx + dir * 28, cy + 6,
    );

    this.windText.setText(`Wind: ${strength.toFixed(0)} (${bars}/5)`);
  }

  /** Update weapon label. */
  updateWeapon(type: WeaponType): void {
    const names: Record<WeaponType, string> = {
      BAZOOKA: '🚀 Bazooka  [1]',
      RIFLE: '🔫 Rifle    [2]',
      GRENADE: '💣 Grenade  [3]',
    };
    this.weaponText.setText(names[type]);
  }

  /** Show game-over overlay. */
  showGameOver(winnerName: string): void {
    const { width, height } = this.scene.scale;
    this.scene.add.rectangle(width / 2, height / 2, 500, 200, 0x000000, 0.8).setDepth(50);
    this.scene.add
      .text(width / 2, height / 2 - 30, 'GAME OVER', {
        fontSize: '48px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(51);
    this.scene.add
      .text(width / 2, height / 2 + 30, `${winnerName} wins!`, {
        fontSize: '28px',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(51);

    // Restart button
    const btn = this.scene.add
      .rectangle(width / 2, height / 2 + 90, 180, 44, 0x226622)
      .setInteractive({ useHandCursor: true })
      .setDepth(51);
    this.scene.add
      .text(width / 2, height / 2 + 90, 'Play Again', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(52);
    btn.on('pointerdown', () => this.scene.scene.start('MenuScene'));
  }
}
