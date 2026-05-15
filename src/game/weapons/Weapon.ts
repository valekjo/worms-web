import { CONFIG } from '../../config';

export interface WeaponConfig {
  name: string;
  damage: number;
  blastRadius: number;
  speed: number;        // initial projectile speed px/s
  gravity: number;      // per-projectile gravity
  fuseTime?: number;    // ms until grenade explodes (undefined = on impact)
  windFactor?: number;  // 0–1, how much wind affects this weapon
}

export type WeaponType = 'BAZOOKA' | 'RIFLE' | 'GRENADE';

export function getWeaponConfig(type: WeaponType): WeaponConfig {
  switch (type) {
    case 'BAZOOKA':
      return {
        name: 'Bazooka',
        ...CONFIG.WEAPONS.BAZOOKA,
        windFactor: 1.0,
      };
    case 'RIFLE':
      return {
        name: 'Rifle',
        ...CONFIG.WEAPONS.RIFLE,
        windFactor: 0.1,
      };
    case 'GRENADE':
      return {
        name: 'Grenade',
        ...CONFIG.WEAPONS.GRENADE,
        windFactor: 0.3,
      };
  }
}
