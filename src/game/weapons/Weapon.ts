import { CONFIG } from '../../config';

export interface WeaponConfig {
  name: string;
  damage: number;
  blastRadius: number;
  speed: number;        // initial projectile speed px/s
  gravity: number;      // per-projectile gravity
  fuseTime?: number;    // ms until grenade explodes (undefined = on impact)
  windFactor?: number;  // 0–1, how much wind affects this weapon
  splitCount?: number;  // how many bomblets to spawn on explosion
}

export type WeaponType = 'BAZOOKA' | 'RIFLE' | 'GRENADE' | 'HOLY_GRENADE' | 'BANANA_BOMB';

export const BOMBLET_CONFIG: WeaponConfig = {
  name: 'Bomblet',
  ...CONFIG.WEAPONS.BOMBLET,
  windFactor: 0.2,
};

export function getWeaponConfig(type: WeaponType): WeaponConfig {
  switch (type) {
    case 'BAZOOKA':
      return { name: 'Bazooka', ...CONFIG.WEAPONS.BAZOOKA, windFactor: 1.0 };
    case 'RIFLE':
      return { name: 'Rifle', ...CONFIG.WEAPONS.RIFLE, windFactor: 0.1 };
    case 'GRENADE':
      return { name: 'Grenade', ...CONFIG.WEAPONS.GRENADE, windFactor: 0.3 };
    case 'HOLY_GRENADE':
      return { name: 'Holy Grenade', ...CONFIG.WEAPONS.HOLY_GRENADE, windFactor: 0.2 };
    case 'BANANA_BOMB':
      return { name: 'Banana Bomb', ...CONFIG.WEAPONS.BANANA_BOMB, windFactor: 0.35 };
  }
}
