import { Projectile } from './Projectile';
import { getWeaponConfig } from './Weapon';

const CONFIG = getWeaponConfig('HOLY_GRENADE');

export function create(
  x: number,
  y: number,
  angle: number,
  power: number,
  wind: number,
): Projectile {
  return new Projectile(x, y, angle, CONFIG, wind, power);
}
