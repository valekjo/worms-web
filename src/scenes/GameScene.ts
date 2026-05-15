import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Terrain } from '../game/Terrain';
import { Worm } from '../game/Worm';
import { Team } from '../game/Team';
import { TurnManager } from '../game/TurnManager';
import { AI } from '../game/AI';
import { Projectile } from '../game/weapons/Projectile';
import { WeaponType, getWeaponConfig } from '../game/weapons/Weapon';
import { create as createBazooka } from '../game/weapons/Bazooka';
import { create as createRifle } from '../game/weapons/Rifle';
import { create as createGrenade } from '../game/weapons/Grenade';
import { HUD } from '../ui/HUD';
import { WeaponSelector } from '../ui/WeaponSelector';

interface GameData {
  mode: 'hotseat' | 'vsai';
  wormsPerTeam: number;
}

interface WormVisual {
  graphic: Phaser.GameObjects.Graphics;
  worm: Worm;
  teamColor: number;
}

export class GameScene extends Phaser.Scene {
  // Core game state
  private terrain!: Terrain;
  private teams: Team[] = [];
  private turnManager!: TurnManager;
  private wind: number = 0;

  // Rendering
  private renderTexture!: Phaser.GameObjects.RenderTexture;
  private wormVisuals: WormVisual[] = [];

  // Projectiles
  private activeProjectiles: Projectile[] = [];
  private projectileGraphics: Map<Projectile, Phaser.GameObjects.Graphics> = new Map();

  // Aiming
  private aimElevation: number = 0; // angle relative to facing dir, negative = up
  private aimPower: number = 0;
  private isCharging: boolean = false;
  private chargeStartTime: number = 0;
  private aimGraphic!: Phaser.GameObjects.Graphics;

  // AI
  private aiDelayTimer: number = 0;
  private aiPendingFire: { angle: number; power: number; weapon: WeaponType } | null = null;
  private gameMode: 'hotseat' | 'vsai' = 'hotseat';

  // UI
  private hud!: HUD;
  private weaponSelector!: WeaponSelector;
  private selectedWeapon: WeaponType = 'BAZOOKA';

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameData): void {
    this.gameMode = data?.mode ?? 'hotseat';
    const wormsPerTeam = data?.wormsPerTeam ?? 3;

    // Reset state
    this.teams = [];
    this.activeProjectiles = [];
    this.projectileGraphics = new Map();
    this.wormVisuals = [];
    this.wind = (Math.random() * 2 - 1) * CONFIG.WIND_MAX;
    this.selectedWeapon = 'BAZOOKA';
    this.isCharging = false;
    this.aimElevation = 0;
    this.aimPower = 0;
    this.aiDelayTimer = 0;
    this.aiPendingFire = null;

    // Build terrain
    this.terrain = new Terrain(CONFIG.WIDTH, CONFIG.HEIGHT);
    this.terrain.generate(Math.floor(Math.random() * 1000));

    // Create teams
    for (let ti = 0; ti < CONFIG.TEAMS.length; ti++) {
      const cfg = CONFIG.TEAMS[ti];
      const isAI = this.gameMode === 'vsai' && ti === 1;
      const team = new Team(ti, cfg.name, cfg.color, isAI);
      this.teams.push(team);

      // Spread worms across the map
      const sectionWidth = CONFIG.WIDTH / (CONFIG.TEAMS.length * wormsPerTeam);
      for (let wi = 0; wi < wormsPerTeam; wi++) {
        const globalIdx = ti * wormsPerTeam + wi;
        const baseX = sectionWidth * globalIdx + sectionWidth / 2;
        const x = Math.max(20, Math.min(CONFIG.WIDTH - 20, baseX + (Math.random() - 0.5) * 60));
        const y = this.terrain.surfaceY(x) - 16;
        const worm = new Worm(globalIdx, ti, x, y);
        worm.name = `${cfg.name.split(' ')[1]} ${wi + 1}`;
        team.worms.push(worm);
      }
    }

    this.turnManager = new TurnManager(this.teams, CONFIG.TURN_TIME, CONFIG.RETREAT_TIME);
  }

  create(): void {
    // Build terrain render texture
    this.renderTexture = this.add.renderTexture(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT).setOrigin(0, 0).setDepth(0);
    this.drawTerrainToTexture();

    // Create worm visuals
    for (const team of this.teams) {
      for (const worm of team.worms) {
        const graphic = this.add.graphics().setDepth(5);
        this.wormVisuals.push({ graphic, worm, teamColor: team.color });
      }
    }

    // Aim graphic
    this.aimGraphic = this.add.graphics().setDepth(6);

    // HUD
    this.hud = new HUD(this);
    this.weaponSelector = new WeaponSelector(this);

    // Register worms with HUD
    for (const team of this.teams) {
      for (const worm of team.worms) {
        this.hud.registerWorm(worm, team.color);
      }
    }

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      key1: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      key2: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      key3: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      enter: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };

    // Update wind display
    this.hud.updateWind(this.wind);
    this.hud.updateWeapon(this.selectedWeapon);
  }

  private drawTerrainToTexture(): void {
    const bitmap = this.terrain.getBitmap();
    const { width, height } = this.terrain;

    // Use an offscreen canvas to build the image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const groundR = (CONFIG.TERRAIN.GROUND_COLOR >> 16) & 0xff;
    const groundG = (CONFIG.TERRAIN.GROUND_COLOR >> 8) & 0xff;
    const groundB = CONFIG.TERRAIN.GROUND_COLOR & 0xff;

    for (let i = 0; i < bitmap.length; i++) {
      const idx = i * 4;
      if (bitmap[i] === 1) {
        data[idx] = groundR;
        data[idx + 1] = groundG;
        data[idx + 2] = groundB;
        data[idx + 3] = 255;
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw sky background first
    const skyGfx = this.add.graphics();
    skyGfx.fillStyle(CONFIG.TERRAIN.SKY_COLOR, 1);
    skyGfx.fillRect(0, 0, width, height);
    this.renderTexture.draw(skyGfx, 0, 0);
    skyGfx.destroy();

    // Draw terrain via texture
    const texKey = '__terrain__';
    if (this.textures.exists(texKey)) {
      this.textures.remove(texKey);
    }
    this.textures.addCanvas(texKey, canvas);
    const terrainImg = this.add.image(0, 0, texKey).setOrigin(0, 0);
    this.renderTexture.draw(terrainImg, 0, 0);
    terrainImg.destroy();
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    const phase = this.turnManager.phase;

    if (phase === 'GAME_OVER') return;

    // Tick turn manager
    const phaseChanged = this.turnManager.tick(dt);

    // Handle wind change on new turn
    if (phaseChanged && this.turnManager.phase === 'AIMING') {
      this.wind = (Math.random() * 2 - 1) * CONFIG.WIND_MAX;
      this.hud.updateWind(this.wind);
    }

    // Physics: gravity + terrain collision for all worms
    for (const team of this.teams) {
      for (const worm of team.worms) {
        if (!worm.alive) continue;
        this.updateWormPhysics(worm, dt);
      }
    }

    // Active worm controls (only in AIMING or RETREAT phase, and only for non-AI teams)
    const activeWorm = this.turnManager.activeWorm;
    const activeTeam = this.turnManager.activeTeam;
    const canControl = (phase === 'AIMING' || phase === 'RETREAT') && !activeTeam.isAI;

    if (canControl) {
      this.handleWormMovement(activeWorm, dt);
      this.handleWeaponKeys(dt);
    }

    // Update aim line (only when aiming)
    this.aimGraphic.clear();
    if (phase === 'AIMING' && !activeTeam.isAI) {
      let power = 0;
      if (this.isCharging) {
        const elapsed = (time - this.chargeStartTime) / 1000;
        power = Math.min(1, elapsed / 2);
      }
      this.drawAimLine(activeWorm);
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // AI logic
    if (phase === 'AIMING' && activeTeam.isAI) {
      this.handleAI(dt, activeWorm, activeTeam);
    }

    // Draw worms
    this.drawWorms();

    // Update HUD
    this.hud.updateTurnInfo(
      this.turnManager.turnNumber,
      activeTeam,
      phase,
      this.turnManager.timeLeft,
    );
    this.hud.updateHealthBars(this.teams);
  }

  private updateWormPhysics(worm: Worm, dt: number): void {
    // Apply gravity
    worm.velY += CONFIG.GRAVITY * dt;

    // Move
    worm.x += worm.velX * dt;
    worm.y += worm.velY * dt;

    // Clamp x to map bounds
    worm.x = Math.max(8, Math.min(CONFIG.WIDTH - 8, worm.x));

    // Terrain collision — check bottom of worm circle
    const WORM_RADIUS = 10;
    const wx = Math.round(worm.x);
    const footY = Math.round(worm.y + WORM_RADIUS);

    if (this.terrain.isSolid(wx, footY)) {
      // Scan upward to find surface
      let surfY = footY;
      while (surfY > 0 && this.terrain.isSolid(wx, surfY)) {
        surfY--;
      }
      worm.y = surfY - WORM_RADIUS;
      worm.velY = 0;
      worm.onGround = true;
    } else {
      worm.onGround = false;
    }

    // Friction when on ground
    if (worm.onGround) {
      worm.velX *= 0.85;
      if (Math.abs(worm.velX) < 1) worm.velX = 0;
    }
  }

  private handleWormMovement(worm: Worm, dt: number): void {
    if (this.isCharging) return;

    if (worm.onGround) {
      if (this.cursors.left?.isDown) {
        worm.velX = -CONFIG.MOVE_SPEED;
        worm.facingLeft = true;
      } else if (this.cursors.right?.isDown) {
        worm.velX = CONFIG.MOVE_SPEED;
        worm.facingLeft = false;
      } else {
        worm.velX = 0;
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
        worm.velY = -320;
        worm.onGround = false;
      }
    }
  }

  private handleWeaponKeys(dt: number): void {
    const phase = this.turnManager.phase;
    if (phase !== 'AIMING') return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.key1)) {
      this.selectedWeapon = 'BAZOOKA';
      this.weaponSelector.select('BAZOOKA');
      this.hud.updateWeapon('BAZOOKA');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.key2)) {
      this.selectedWeapon = 'RIFLE';
      this.weaponSelector.select('RIFLE');
      this.hud.updateWeapon('RIFLE');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.key3)) {
      this.selectedWeapon = 'GRENADE';
      this.weaponSelector.select('GRENADE');
      this.hud.updateWeapon('GRENADE');
    }

    // UP always lifts the barrel, DOWN always lowers it, clamped to straight up/down
    const AIM_SPEED = 2.0; // radians per second
    if (this.cursors.up?.isDown) {
      this.aimElevation = Math.max(-Math.PI / 2, this.aimElevation - AIM_SPEED * dt);
    } else if (this.cursors.down?.isDown) {
      this.aimElevation = Math.min(Math.PI / 2, this.aimElevation + AIM_SPEED * dt);
    }

    // SPACE: rifle fires instantly at full power; other weapons hold to charge
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      if (this.selectedWeapon === 'RIFLE') {
        const worm = this.turnManager.activeWorm;
        const angle = worm.facingLeft ? Math.PI - this.aimElevation : this.aimElevation;
        this.fireWeapon(worm, angle, 1);
      } else {
        this.isCharging = true;
        this.chargeStartTime = this.time.now;
      }
    } else if (this.isCharging && Phaser.Input.Keyboard.JustUp(this.keys.space)) {
      const elapsed = (this.time.now - this.chargeStartTime) / 1000;
      this.aimPower = Math.min(1, elapsed / 2);
      this.isCharging = false;
      const worm = this.turnManager.activeWorm;
      const angle = worm.facingLeft ? Math.PI - this.aimElevation : this.aimElevation;
      this.fireWeapon(worm, angle, this.aimPower);
    }
  }

  private drawAimLine(worm: Worm): void {
    const angle = worm.facingLeft ? Math.PI - this.aimElevation : this.aimElevation;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const BAR_LEN = 80;

    // Direction dots
    for (let i = 0; i < 5; i++) {
      const t = 16 + i * 12;
      this.aimGraphic.fillStyle(0xffffff, 0.7 - i * 0.1);
      this.aimGraphic.fillCircle(worm.x + cos * t, worm.y + sin * t, 2);
    }

    // Power bar (shown while charging)
    if (this.isCharging) {
      const elapsed = (this.time.now - this.chargeStartTime) / 1000;
      const power = Math.min(1, elapsed / 2);

      this.aimGraphic.lineStyle(5, 0x555555, 0.7);
      this.aimGraphic.beginPath();
      this.aimGraphic.moveTo(worm.x, worm.y);
      this.aimGraphic.lineTo(worm.x + cos * BAR_LEN, worm.y + sin * BAR_LEN);
      this.aimGraphic.strokePath();

      this.aimGraphic.lineStyle(5, 0xff4400, 1);
      this.aimGraphic.beginPath();
      this.aimGraphic.moveTo(worm.x, worm.y);
      this.aimGraphic.lineTo(worm.x + cos * BAR_LEN * power, worm.y + sin * BAR_LEN * power);
      this.aimGraphic.strokePath();
    }
  }

  private fireWeapon(worm: Worm, angle: number, power: number): void {
    const weapon = this.selectedWeapon;
    let projectile: Projectile;

    switch (weapon) {
      case 'BAZOOKA':
        projectile = createBazooka(worm.x, worm.y - 8, angle, power, this.wind);
        break;
      case 'RIFLE':
        projectile = createRifle(worm.x, worm.y - 8, angle, power, this.wind);
        break;
      case 'GRENADE':
        projectile = createGrenade(worm.x, worm.y - 8, angle, power, this.wind);
        break;
    }

    this.activeProjectiles.push(projectile);
    const gfx = this.add.graphics().setDepth(8);
    this.projectileGraphics.set(projectile, gfx);

    this.turnManager.onFired();
  }

  private updateProjectiles(dt: number): void {
    const toRemove: Projectile[] = [];

    for (const proj of this.activeProjectiles) {
      const gfx = this.projectileGraphics.get(proj);
      const explode = proj.update(dt, this.terrain, this.wind);

      if (explode || (!proj.state.alive)) {
        if (explode && proj.state.exploded) {
          this.doExplosion(proj.state.x, proj.state.y, proj.config);
        }
        gfx?.destroy();
        this.projectileGraphics.delete(proj);
        toRemove.push(proj);
      } else if (gfx) {
        gfx.clear();
        gfx.fillStyle(0xffff00, 1);
        gfx.fillCircle(proj.state.x, proj.state.y, 4);
        // Grenade draws bigger dot
        if (proj.config.fuseTime !== undefined) {
          gfx.fillStyle(0xff8800, 1);
          gfx.fillCircle(proj.state.x, proj.state.y, 5);
        }
      }
    }

    for (const p of toRemove) {
      this.activeProjectiles.splice(this.activeProjectiles.indexOf(p), 1);
    }

    // Check if all projectiles settled
    if (this.activeProjectiles.length === 0 && this.turnManager.phase === 'FIRED') {
      this.turnManager.onProjectilesSettled();
    }
    if (this.activeProjectiles.length === 0 && this.turnManager.phase === 'GAME_OVER') {
      const aliveTeams = this.teams.filter((t) => t.alive);
      const winnerName = aliveTeams.length > 0 ? aliveTeams[0].name : 'Nobody';
      this.hud.showGameOver(winnerName);
    }
  }

  private doExplosion(cx: number, cy: number, config: { damage: number; blastRadius: number }): void {
    // Carve terrain
    this.terrain.destroy(cx, cy, config.blastRadius);

    // Visual erase from render texture
    const eraseGfx = this.make.graphics({ x: 0, y: 0 });
    eraseGfx.fillStyle(0xffffff, 1);
    eraseGfx.fillCircle(cx, cy, config.blastRadius);
    this.renderTexture.erase(eraseGfx, 0, 0);
    eraseGfx.destroy();

    // Flash / shockwave effect
    const flash = this.add.graphics().setDepth(10);
    flash.fillStyle(0xffaa00, 0.8);
    flash.fillCircle(cx, cy, config.blastRadius * 1.2);
    this.time.delayedCall(120, () => flash.destroy());

    // Apply damage to worms
    for (const team of this.teams) {
      for (const worm of team.worms) {
        if (!worm.alive) continue;
        const dx = worm.x - cx;
        const dy = worm.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < config.blastRadius) {
          const dmg = Math.max(5, Math.round(config.damage * (1 - dist / config.blastRadius)));
          worm.takeDamage(dmg);
          // Knock back
          const force = (1 - dist / config.blastRadius) * 200;
          if (dist > 0) {
            worm.velX += (dx / dist) * force;
            worm.velY += (dy / dist) * force - 100;
          }
        }
      }
    }
  }

  private handleAI(dt: number, worm: Worm, _team: Team): void {
    if (this.aiPendingFire === null) {
      // Choose action
      const enemyTeams = this.teams.filter((t) => !t.isAI);
      this.aiPendingFire = AI.chooseFiring(worm, enemyTeams, this.wind);
      this.selectedWeapon = this.aiPendingFire.weapon;
      this.weaponSelector.select(this.aiPendingFire.weapon);
      this.hud.updateWeapon(this.aiPendingFire.weapon);
      this.aiDelayTimer = 1.0; // 1s delay before firing
    } else {
      this.aiDelayTimer -= dt;
      if (this.aiDelayTimer <= 0 && this.aiPendingFire !== null) {
        const { angle, power } = this.aiPendingFire;
        this.aiPendingFire = null;
        this.fireWeapon(worm, angle, power);
      }
    }
  }

  private drawWorms(): void {
    for (const { graphic, worm, teamColor } of this.wormVisuals) {
      graphic.clear();
      if (!worm.alive) continue;

      const isActive = this.turnManager.activeWorm === worm;

      // Body
      graphic.fillStyle(teamColor, 1);
      graphic.fillCircle(worm.x, worm.y, 10);

      // Eyes
      graphic.fillStyle(0xffffff, 1);
      const eyeOffX = worm.facingLeft ? -4 : 4;
      graphic.fillCircle(worm.x + eyeOffX, worm.y - 2, 3);
      graphic.fillStyle(0x000000, 1);
      graphic.fillCircle(worm.x + eyeOffX, worm.y - 2, 1.5);

      // Active indicator (ring)
      if (isActive) {
        graphic.lineStyle(2, 0xffffff, 1);
        graphic.strokeCircle(worm.x, worm.y, 13);
      }
    }
  }
}
