import { Projectile } from './Projectile';
import { getWeaponConfig } from './Weapon';

const CONFIG = getWeaponConfig('BAZOOKA');

export function create(
  x: number,
  y: number,
  angle: number,
  power: number,
  wind: number,
): Projectile {
  return new Projectile(x, y, angle, CONFIG, wind, power);
}
