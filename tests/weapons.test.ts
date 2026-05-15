import { describe, it, expect } from 'vitest';
import { getWeaponConfig, WeaponType } from '../src/game/weapons/Weapon';
import { Projectile } from '../src/game/weapons/Projectile';
import { Terrain } from '../src/game/Terrain';

// Stub Terrain that has no solid ground (so projectiles fly freely)
function makeClearTerrain(width = 1280, height = 720): Terrain {
  const t = new Terrain(width, height);
  // Don't call generate() — bitmap stays all zeros (air)
  return t;
}

// Stub Terrain that is entirely solid
function makeSolidTerrain(width = 1280, height = 720): Terrain {
  const t = new Terrain(width, height);
  // Manually fill via destroy trick in reverse: generate then don't destroy
  // Easier: just generate with extreme settings. Actually let's just use
  // a subclass approach via an object that satisfies the interface
  // Since Terrain is a concrete class we'll work with generate + known geometry
  t.generate(1); // just need some solid ground at bottom
  return t;
}

describe('getWeaponConfig', () => {
  it('returns correct config for BAZOOKA', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    expect(cfg.name).toBe('Bazooka');
    expect(cfg.damage).toBe(50);
    expect(cfg.blastRadius).toBe(60);
    expect(cfg.speed).toBe(400);
    expect(cfg.windFactor).toBe(1.0);
    expect(cfg.fuseTime).toBeUndefined();
  });

  it('returns correct config for RIFLE', () => {
    const cfg = getWeaponConfig('RIFLE');
    expect(cfg.name).toBe('Rifle');
    expect(cfg.damage).toBe(25);
    expect(cfg.speed).toBe(900);
    expect(cfg.windFactor).toBe(0.1);
  });

  it('returns correct config for GRENADE', () => {
    const cfg = getWeaponConfig('GRENADE');
    expect(cfg.name).toBe('Grenade');
    expect(cfg.damage).toBe(60);
    expect(cfg.fuseTime).toBe(3000);
    expect(cfg.windFactor).toBe(0.3);
  });

  it('all weapon types have required fields', () => {
    const types: WeaponType[] = ['BAZOOKA', 'RIFLE', 'GRENADE'];
    for (const t of types) {
      const cfg = getWeaponConfig(t);
      expect(cfg.damage).toBeGreaterThan(0);
      expect(cfg.blastRadius).toBeGreaterThan(0);
      expect(cfg.speed).toBeGreaterThan(0);
      expect(cfg.gravity).toBeGreaterThan(0);
    }
  });
});

describe('Projectile physics', () => {
  const terrain = makeClearTerrain();

  it('moves in the direction of the angle', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    const angle = 0; // straight right
    const proj = new Projectile(100, 100, angle, cfg, 0, 1);
    const initX = proj.state.x;
    proj.update(0.1, terrain, 0);
    expect(proj.state.x).toBeGreaterThan(initX);
  });

  it('applies gravity over time', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    const proj = new Projectile(100, 100, 0, cfg, 0, 1);
    const initVelY = proj.state.velY;
    proj.update(0.1, terrain, 0);
    expect(proj.state.velY).toBeGreaterThan(initVelY);
  });

  it('wind affects horizontal velocity (bazooka windFactor=1)', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    const wind = 50;
    const proj = new Projectile(100, 100, 0, cfg, wind, 1);
    const initVelX = proj.state.velX;
    proj.update(0.1, terrain, wind);
    // velX should increase due to wind
    expect(proj.state.velX).toBeGreaterThan(initVelX);
  });

  it('wind has minimal effect on rifle (windFactor=0.1)', () => {
    const cfgRifle = getWeaponConfig('RIFLE');
    const cfgBazooka = getWeaponConfig('BAZOOKA');
    const wind = 80;

    const rifle = new Projectile(100, 100, 0, cfgRifle, wind, 1);
    const bazooka = new Projectile(100, 100, 0, cfgBazooka, wind, 1);

    rifle.update(1, terrain, wind);
    bazooka.update(1, terrain, wind);

    // Rifle should be less affected by wind than bazooka
    // After 1s both have drifted, but bazooka more than rifle (relative to initial speed)
    const rifleDrift = rifle.state.velX - rifle.config.speed;
    const bazookaDrift = bazooka.state.velX - bazooka.config.speed;
    // bazooka windFactor is 10x rifle windFactor
    expect(bazookaDrift).toBeGreaterThan(rifleDrift);
  });

  it('goes out of bounds below and returns false (no explosion)', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    // Start just below map bottom
    const proj = new Projectile(100, 700, Math.PI / 2, cfg, 0, 1); // shooting downward
    // Simulate enough time to go out of bounds
    let exploded = false;
    for (let i = 0; i < 100; i++) {
      exploded = proj.update(0.1, terrain, 0);
      if (!proj.state.alive) break;
    }
    expect(proj.state.alive).toBe(false);
    expect(proj.state.exploded).toBe(false); // went off map, no explosion
  });

  it('grenade fuse timer counts down and explodes', () => {
    const cfg = getWeaponConfig('GRENADE');
    // Use a very tall terrain so the grenade doesn't go OOB before fuse expires
    const tallTerrain = makeClearTerrain(1280, 5000);
    // Fire upward so it stays in bounds during 3s fuse
    const proj = new Projectile(640, 2500, -Math.PI / 4, cfg, 0, 0.3);
    expect(proj.fuseTimer).toBe(3000);

    // Simulate up to 4 seconds (400 steps at 10ms)
    let exploded = false;
    let steps = 0;
    while (!exploded && steps < 400 && proj.state.alive) {
      exploded = proj.update(0.01, tallTerrain, 0);
      steps++;
    }
    expect(exploded).toBe(true);
    expect(proj.state.exploded).toBe(true);
  });

  it('projectile starts at given position', () => {
    const cfg = getWeaponConfig('RIFLE');
    const proj = new Projectile(300, 250, 0, cfg, 0, 1);
    expect(proj.state.x).toBe(300);
    expect(proj.state.y).toBe(250);
    expect(proj.state.alive).toBe(true);
    expect(proj.state.exploded).toBe(false);
  });

  it('power scales initial speed', () => {
    const cfg = getWeaponConfig('BAZOOKA');
    const fullPower = new Projectile(0, 0, 0, cfg, 0, 1.0);
    const halfPower = new Projectile(0, 0, 0, cfg, 0, 0.5);
    expect(fullPower.state.velX).toBeCloseTo(cfg.speed);
    expect(halfPower.state.velX).toBeCloseTo(cfg.speed * 0.5);
  });

  it('hits terrain and explodes', () => {
    // Create terrain with solid bottom half
    const t = new Terrain(100, 200);
    t.generate(5);

    const cfg = getWeaponConfig('BAZOOKA');
    // Fire downward from above terrain
    const proj = new Projectile(50, 10, Math.PI / 2, cfg, 0, 1);

    let exploded = false;
    for (let i = 0; i < 500 && !exploded && proj.state.alive; i++) {
      exploded = proj.update(0.02, t, 0);
    }
    expect(exploded).toBe(true);
    expect(proj.state.exploded).toBe(true);
  });
});
