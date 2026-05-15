import { Worm } from './Worm';
import { Team } from './Team';
import { WeaponType } from './weapons/Weapon';

export class AI {
  /**
   * Returns { angle, power, weapon } for the active worm to fire at the best enemy target.
   * Simple strategy: aim at nearest living enemy worm, add random ±15° offset, power 0.6–0.9.
   */
  static chooseFiring(
    activeWorm: Worm,
    enemyTeams: Team[],
    wind: number,
  ): { angle: number; power: number; weapon: WeaponType } {
    // Collect all living enemy worms
    const enemies: Worm[] = [];
    for (const team of enemyTeams) {
      for (const worm of team.worms) {
        if (worm.alive) enemies.push(worm);
      }
    }

    // Pick nearest enemy
    let target = enemies[0];
    if (!target) {
      // No enemies – fire straight right as fallback
      return { angle: 0, power: 0.7, weapon: 'BAZOOKA' };
    }

    let minDist = Infinity;
    for (const e of enemies) {
      const dx = e.x - activeWorm.x;
      const dy = e.y - activeWorm.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        target = e;
      }
    }

    // Compute base angle toward target
    const dx = target.x - activeWorm.x;
    const dy = target.y - activeWorm.y;
    const baseAngle = Math.atan2(dy, dx);

    // Add random ±15° offset
    const offsetDeg = (Math.random() - 0.5) * 30;
    const angle = baseAngle + (offsetDeg * Math.PI) / 180;

    // Random power 0.6–0.9
    const power = 0.6 + Math.random() * 0.3;

    // Wind compensation hint: prefer bazooka when wind is low, rifle for far targets
    let weapon: WeaponType = 'BAZOOKA';
    if (minDist > 600) {
      weapon = 'RIFLE';
    } else if (minDist < 200) {
      weapon = 'GRENADE';
    }

    // Suppress wind variable unused warning
    void wind;

    return { angle, power, weapon };
  }
}
