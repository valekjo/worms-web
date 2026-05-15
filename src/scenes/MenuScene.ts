import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private gameMode: 'hotseat' | 'vsai' = 'hotseat';
  private wormsPerTeam: number = 3;

  private modeText!: Phaser.GameObjects.Text;
  private wormsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Sky background
    this.add.rectangle(cx, height / 2, width, height, 0x87ceeb);

    // Title
    this.add
      .text(cx, 120, 'WORMS WEB', {
        fontSize: '64px',
        color: '#fff',
        fontStyle: 'bold',
        stroke: '#333',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 185, 'A Browser Clone', {
        fontSize: '22px',
        color: '#eee',
        stroke: '#333',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // --- Game Mode ---
    this.add
      .text(cx, 280, 'Game Mode', { fontSize: '28px', color: '#222' })
      .setOrigin(0.5);

    this.modeText = this.add
      .text(cx, 325, this.getModeLabel(), { fontSize: '24px', color: '#003399' })
      .setOrigin(0.5);

    this.createButton(cx - 100, 325, '◀', () => this.cycleMode(-1));
    this.createButton(cx + 100, 325, '▶', () => this.cycleMode(1));

    // --- Worms per team ---
    this.add
      .text(cx, 400, 'Worms per Team', { fontSize: '28px', color: '#222' })
      .setOrigin(0.5);

    this.wormsText = this.add
      .text(cx, 445, String(this.wormsPerTeam), { fontSize: '28px', color: '#003399' })
      .setOrigin(0.5);

    this.createButton(cx - 80, 445, '−', () => this.changeWorms(-1));
    this.createButton(cx + 80, 445, '+', () => this.changeWorms(1));

    // --- Start button ---
    const startBtn = this.add
      .rectangle(cx, 555, 220, 55, 0x228822)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cx, 555, 'START GAME', { fontSize: '26px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);

    startBtn.on('pointerover', () => startBtn.setFillStyle(0x33aa33));
    startBtn.on('pointerout',  () => startBtn.setFillStyle(0x228822));
    startBtn.on('pointerdown', () => this.startGame());
  }

  private getModeLabel(): string {
    return this.gameMode === 'hotseat' ? 'Local Hotseat' : 'vs AI';
  }

  private cycleMode(dir: number): void {
    const modes: Array<'hotseat' | 'vsai'> = ['hotseat', 'vsai'];
    const idx = modes.indexOf(this.gameMode);
    this.gameMode = modes[(idx + dir + modes.length) % modes.length];
    this.modeText.setText(this.getModeLabel());
  }

  private changeWorms(delta: number): void {
    this.wormsPerTeam = Math.max(2, Math.min(6, this.wormsPerTeam + delta));
    this.wormsText.setText(String(this.wormsPerTeam));
  }

  private createButton(x: number, y: number, label: string, cb: () => void): void {
    const btn = this.add
      .rectangle(x, y, 48, 36, 0x555555)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    btn.on('pointerover', () => btn.setFillStyle(0x888888));
    btn.on('pointerout',  () => btn.setFillStyle(0x555555));
    btn.on('pointerdown', cb);
  }

  private startGame(): void {
    this.scene.start('GameScene', {
      mode: this.gameMode,
      wormsPerTeam: this.wormsPerTeam,
    });
  }
}
