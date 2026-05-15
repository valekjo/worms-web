import { describe, it, expect } from 'vitest';
import { AI } from '../src/game/AI';
import { Worm } from '../src/game/Worm';
import { Team } from '../src/game/Team';

function makeTeam(index: number, wormCount = 2, isAI = false): Team {
  const team = new Team(index, `Team ${index}`, 0xffffff, isAI);
  for (let i = 0; i < wormCount; i++) {
    team.worms.push(new Worm(index * 10 + i, index, 200 + index * 300, 300));
  }
  return team;
}

describe('AI.chooseFiring', () => {
  it('returns a valid angle (finite number)', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = makeTeam(1, 2);
    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    expect(typeof result.angle).toBe('number');
    expect(isFinite(result.angle)).toBe(true);
  });

  it('returns power in range 0.6–0.9', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = makeTeam(1, 2);
    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    expect(result.power).toBeGreaterThanOrEqual(0.6);
    expect(result.power).toBeLessThanOrEqual(0.9);
  });

  it('returns a valid weapon type', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = makeTeam(1, 2);
    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    expect(['BAZOOKA', 'RIFLE', 'GRENADE']).toContain(result.weapon);
  });

  it('aims roughly toward the target', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    // Enemy directly to the right
    const enemyTeam = new Team(1, 'Enemy', 0xff0000);
    enemyTeam.worms.push(new Worm(10, 1, 600, 300));

    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    // Base angle toward enemy at same height to the right is 0 (Math.atan2(0, 500) = 0)
    // With ±15° noise the angle should be close to 0
    const angleDeg = result.angle * (180 / Math.PI);
    expect(angleDeg).toBeGreaterThanOrEqual(-20);
    expect(angleDeg).toBeLessThanOrEqual(20);
  });

  it('picks nearest enemy worm', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const nearEnemy = new Worm(10, 1, 200, 300);  // distance 100
    const farEnemy  = new Worm(11, 1, 800, 300);  // distance 700

    const enemyTeam = new Team(1, 'Enemy', 0xff0000);
    enemyTeam.worms.push(nearEnemy, farEnemy);

    // Run multiple times to average out randomness
    let nearPicked = 0;
    for (let i = 0; i < 20; i++) {
      const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
      // Angle toward nearEnemy (x=200) is around 0 rad; toward farEnemy also ~0 but further
      // Weapon choice changes: near = GRENADE (dist < 200), far = RIFLE (dist > 600)
      if (result.weapon === 'GRENADE') nearPicked++;
    }
    // With nearEnemy at dist 100 (<200), GRENADE should be chosen
    expect(nearPicked).toBeGreaterThan(0);
  });

  it('handles no enemies gracefully', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const result = AI.chooseFiring(activeWorm, [], 0);
    expect(result.angle).toBe(0);
    expect(result.power).toBe(0.7);
    expect(result.weapon).toBe('BAZOOKA');
  });

  it('handles all enemies dead gracefully', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = new Team(1, 'Enemy', 0xff0000);
    const deadWorm = new Worm(10, 1, 500, 300);
    deadWorm.takeDamage(1000); // kill it
    enemyTeam.worms.push(deadWorm);

    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    // No living enemies, should use fallback
    expect(result.angle).toBe(0);
    expect(result.power).toBe(0.7);
  });

  it('picks RIFLE for far targets (dist > 600)', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = new Team(1, 'Enemy', 0xff0000);
    enemyTeam.worms.push(new Worm(10, 1, 900, 300)); // dist = 800

    const result = AI.chooseFiring(activeWorm, [enemyTeam], 0);
    expect(result.weapon).toBe('RIFLE');
  });

  it('wind parameter is accepted without error', () => {
    const activeWorm = new Worm(0, 0, 100, 300);
    const enemyTeam = makeTeam(1, 1);
    // Should not throw regardless of wind value
    expect(() => AI.chooseFiring(activeWorm, [enemyTeam], 80)).not.toThrow();
    expect(() => AI.chooseFiring(activeWorm, [enemyTeam], -80)).not.toThrow();
  });
});
