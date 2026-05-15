import { WeaponConfig } from './Weapon';
import { Terrain } from '../Terrain';

export interface ProjectileState {
  x: number;
  y: number;
  velX: number;
  velY: number;
  alive: boolean;
  exploded: boolean;
}

export class Projectile {
  state: ProjectileState;
  config: WeaponConfig;
  fuseTimer: number;        // ms remaining (grenade only)
  bounceCount: number = 0;

  constructor(
    x: number,
    y: number,
    angle: number,
    config: WeaponConfig,
    wind: number,
    power = 1,
  ) {
    this.config = config;
    this.fuseTimer = config.fuseTime ?? 0;

    const speed = config.speed * power;
    const windFactor = config.windFactor ?? 0;

    this.state = {
      x,
      y,
      velX: Math.cos(angle) * speed + windFactor * wind,
      velY: Math.sin(angle) * speed,
      alive: true,
      exploded: false,
    };
  }

  /**
   * Advance physics by dt seconds, check terrain collision.
   * Returns true if the projectile should explode this step.
   */
  update(dt: number, terrain: Terrain, wind: number): boolean {
    if (!this.state.alive) return false;

    const { config } = this;
    const windFactor = config.windFactor ?? 0;

    // Apply gravity
    this.state.velY += config.gravity * dt;

    // Apply continuous wind
    this.state.velX += windFactor * wind * dt;

    // Move
    this.state.x += this.state.velX * dt;
    this.state.y += this.state.velY * dt;

    // Fuse timer for grenades
    if (config.fuseTime !== undefined && config.fuseTime > 0) {
      this.fuseTimer -= dt * 1000;
      if (this.fuseTimer <= 0) {
        this.state.alive = false;
        this.state.exploded = true;
        return true;
      }
    }

    // Out of bounds check
    if (
      this.state.y > terrain.height + 100 ||
      this.state.x < -100 ||
      this.state.x > terrain.width + 100
    ) {
      this.state.alive = false;
      this.state.exploded = false; // went off-screen, no explosion
      return false;
    }

    // Terrain collision
    const px = Math.round(this.state.x);
    const py = Math.round(this.state.y);
    if (terrain.isSolid(px, py)) {
      return this.handleTerrainHit(px, py, terrain);
    }

    return false;
  }

  private handleTerrainHit(px: number, py: number, terrain: Terrain): boolean {
    // Grenades bounce (up to 3 times)
    if (this.config.fuseTime !== undefined && this.bounceCount < 3) {
      // Estimate surface normal by checking neighbours
      const solidLeft  = terrain.isSolid(px - 1, py);
      const solidRight = terrain.isSolid(px + 1, py);
      const solidUp    = terrain.isSolid(px, py - 1);
      const solidDown  = terrain.isSolid(px, py + 1);

      // Reflect velocity components based on which neighbours are open
      if (!solidLeft || !solidRight) {
        this.state.velX *= -0.6;
      }
      if (!solidUp || !solidDown) {
        this.state.velY *= -0.6;
      }

      // Push out of terrain slightly
      if (!solidUp)  this.state.y -= 2;
      else           this.state.y += 2;

      this.bounceCount++;
      return false;
    }

    // All other weapons (or grenade after max bounces) explode
    this.state.alive = false;
    this.state.exploded = true;
    return true;
  }
}
