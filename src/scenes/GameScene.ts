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

  // Clouds (three parallax layers)
  private cloudLayers!: Array<{
    graphic: Phaser.GameObjects.Graphics;
    clouds: Array<{ x: number; y: number; scale: number; speed: number; puffs: Array<{ dx: number; dy: number; r: number }> }>;
    color: number;
    alpha: number;
  }>;

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
    this.terrain = new Terrain(CONFIG.WORLD_WIDTH, CONFIG.HEIGHT);
    this.terrain.generate(Math.floor(Math.random() * 1000));

    // Create teams
    for (let ti = 0; ti < CONFIG.TEAMS.length; ti++) {
      const cfg = CONFIG.TEAMS[ti];
      const isAI = this.gameMode === 'vsai' && ti === 1;
      const team = new Team(ti, cfg.name, cfg.color, isAI);
      this.teams.push(team);

      // Spread worms across the world
      const sectionWidth = CONFIG.WORLD_WIDTH / (CONFIG.TEAMS.length * wormsPerTeam);
      for (let wi = 0; wi < wormsPerTeam; wi++) {
        const globalIdx = ti * wormsPerTeam + wi;
        const baseX = sectionWidth * globalIdx + sectionWidth / 2;
        const x = Math.max(20, Math.min(CONFIG.WORLD_WIDTH - 20, baseX + (Math.random() - 0.5) * 60));
        const y = this.terrain.surfaceY(x) - 16;
        const worm = new Worm(globalIdx, ti, x, y);
        worm.name = `${cfg.name.split(' ')[1]} ${wi + 1}`;
        team.worms.push(worm);
      }
    }

    this.turnManager = new TurnManager(this.teams, CONFIG.TURN_TIME, CONFIG.RETREAT_TIME, CONFIG.TRANSITION_TIME);
  }

  create(): void {
    // Sky gradient fixed to camera (screen-space)
    const skyBg = this.add.graphics().setDepth(-4).setScrollFactor(0);
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x50 + t * (0xb8 - 0x50));
      const g = Math.round(0x90 + t * (0xe8 - 0x90));
      const b = Math.round(0xd0 + t * (0xff - 0xd0));
      skyBg.fillStyle((r << 16) | (g << 8) | b, 1);
      skyBg.fillRect(0, Math.floor((i / steps) * CONFIG.HEIGHT), CONFIG.WIDTH, Math.ceil(CONFIG.HEIGHT / steps) + 1);
    }

    // Three cloud layers: far → near, all screen-space (scrollFactor 0), parallax applied manually
    this.cloudLayers = [
      { graphic: this.add.graphics().setDepth(-3).setScrollFactor(0), clouds: [], color: 0xbbccdd, alpha: 0.45 }, // far
      { graphic: this.add.graphics().setDepth(-2).setScrollFactor(0), clouds: [], color: 0xddeeff, alpha: 0.65 }, // mid
      { graphic: this.add.graphics().setDepth(-1).setScrollFactor(0), clouds: [], color: 0xffffff, alpha: 0.88 }, // near
    ];
    this.initClouds();

    // Build terrain render texture (full world width)
    this.renderTexture = this.add.renderTexture(0, 0, CONFIG.WORLD_WIDTH, CONFIG.HEIGHT).setOrigin(0, 0).setDepth(0);
    this.drawTerrainToTexture();

    // Camera: follow active worm across the world
    this.cameras.main.setBounds(0, 0, CONFIG.WORLD_WIDTH, CONFIG.HEIGHT);

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

    const groundR  = (CONFIG.TERRAIN.GROUND_COLOR  >> 16) & 0xff;
    const groundG  = (CONFIG.TERRAIN.GROUND_COLOR  >>  8) & 0xff;
    const groundB  =  CONFIG.TERRAIN.GROUND_COLOR        & 0xff;
    const contourR = (CONFIG.TERRAIN.CONTOUR_COLOR >> 16) & 0xff;
    const contourG = (CONFIG.TERRAIN.CONTOUR_COLOR >>  8) & 0xff;
    const contourB =  CONFIG.TERRAIN.CONTOUR_COLOR        & 0xff;
    const shadowR  = (CONFIG.TERRAIN.SHADOW_COLOR  >> 16) & 0xff;
    const shadowG  = (CONFIG.TERRAIN.SHADOW_COLOR  >>  8) & 0xff;
    const shadowB  =  CONFIG.TERRAIN.SHADOW_COLOR        & 0xff;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const idx = i * 4;
        if (bitmap[i] !== 1) {
          data[idx + 3] = 0;
          continue;
        }
        const aboveAir  = y === 0 || bitmap[(y - 1) * width + x] !== 1;
        const above2Air = y <= 1 || bitmap[(y - 2) * width + x] !== 1;
        const above3Air = y <= 2 || bitmap[(y - 3) * width + x] !== 1;
        const above4Air = y <= 3 || bitmap[(y - 4) * width + x] !== 1;
        if (aboveAir || above2Air || above3Air) {
          data[idx] = contourR; data[idx + 1] = contourG; data[idx + 2] = contourB;
        } else if (above4Air) {
          data[idx] = shadowR;  data[idx + 1] = shadowG;  data[idx + 2] = shadowB;
        } else {
          data[idx] = groundR;  data[idx + 1] = groundG;  data[idx + 2] = groundB;
        }
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

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
    if (phaseChanged && this.turnManager.phase === 'TRANSITION') {
      this.wind = (Math.random() * 2 - 1) * CONFIG.WIND_MAX;
      this.hud.updateWind(this.wind);
    }

    // Camera: smoothly follow active worm
    const camTarget = Phaser.Math.Clamp(
      this.turnManager.activeWorm.x - CONFIG.WIDTH / 2,
      0, CONFIG.WORLD_WIDTH - CONFIG.WIDTH,
    );
    this.cameras.main.scrollX += (camTarget - this.cameras.main.scrollX) * 0.06;

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

    // Update clouds
    this.updateClouds(dt);

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

  private initClouds(): void {
    const rng = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5; return x - Math.floor(x); };
    // Layer config: [count, baseScale, speedMin, speedMax, yMin, yMax, puffSizeBase]
    const layerCfg = [
      { count: 5, baseScale: 0.35, speedMin:  5, speedMax: 12, yMin:  30, yMax: 160, puffBase: 18 }, // far
      { count: 5, baseScale: 0.60, speedMin: 13, speedMax: 22, yMin:  60, yMax: 220, puffBase: 24 }, // mid
      { count: 4, baseScale: 0.90, speedMin: 24, speedMax: 40, yMin:  80, yMax: 260, puffBase: 30 }, // near
    ];

    layerCfg.forEach((cfg, li) => {
      for (let i = 0; i < cfg.count; i++) {
        const seed = li * 100 + i;
        const puffs = [];
        const puffCount = 3 + Math.floor(rng(seed * 3) * 3);
        for (let p = 0; p < puffCount; p++) {
          puffs.push({
            dx: (rng(seed * 7 + p) - 0.3) * 80,
            dy: (rng(seed * 11 + p) - 0.5) * 30,
            r:  cfg.puffBase + rng(seed * 13 + p) * cfg.puffBase,
          });
        }
        this.cloudLayers[li].clouds.push({
          x:     rng(seed * 5) * CONFIG.WIDTH,
          y:     cfg.yMin + rng(seed * 9) * (cfg.yMax - cfg.yMin),
          scale: cfg.baseScale + rng(seed * 17) * 0.2,
          speed: cfg.speedMin + rng(seed * 19) * (cfg.speedMax - cfg.speedMin),
          puffs,
        });
      }
    });
  }

  private updateClouds(dt: number): void {
    const camX = this.cameras.main.scrollX;
    // Parallax: how much each layer shifts with camera (far barely moves, near moves most)
    const parallaxFactors = [0.12, 0.30, 0.55];
    const windFactors     = [0.15, 0.35, 0.65];
    const windDir = Math.sign(this.wind) || 1;
    const TILE = CONFIG.WIDTH + 500; // tiling period in screen space

    for (let li = 0; li < this.cloudLayers.length; li++) {
      const layer = this.cloudLayers[li];
      const pFactor   = parallaxFactors[li];
      const windDrift = this.wind * windFactors[li];

      layer.graphic.clear();
      layer.graphic.fillStyle(layer.color, layer.alpha);

      for (const c of layer.clouds) {
        c.x += (c.speed * windDir + windDrift) * dt;
        // Parallax render position: shift left proportional to camera scroll
        const raw = c.x - camX * pFactor;
        // Normalise into [-250, WIDTH+250] with seamless tiling
        const rx = ((raw % TILE) + TILE) % TILE - 250;
        for (const p of c.puffs) {
          layer.graphic.fillCircle(rx + p.dx * c.scale, c.y + p.dy * c.scale, p.r * c.scale);
        }
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
