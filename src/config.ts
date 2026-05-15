export const CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,
  GRAVITY: 600,           // px/s²
  MOVE_SPEED: 120,        // px/s
  TURN_TIME: 30,          // seconds
  RETREAT_TIME: 5,        // seconds
  WIND_MAX: 80,           // max wind force px/s²
  TERRAIN: {
    GROUND_COLOR: 0x4a7c4e,
    CONTOUR_COLOR: 0x7ec850,   // bright grass edge
    SHADOW_COLOR: 0x2e5c32,    // dark sub-surface shadow
    SKY_COLOR: 0x87ceeb,
    MIN_HEIGHT: 200,      // min terrain height from top
    MAX_HEIGHT: 500,
  },
  TEAMS: [
    { name: 'Team Red',  color: 0xff4444 },
    { name: 'Team Blue', color: 0x4444ff },
  ],
  WEAPONS: {
    BAZOOKA: { damage: 50, blastRadius: 60, speed: 400, gravity: 200 },
    RIFLE:   { damage: 25, blastRadius: 20, speed: 900, gravity: 0   },
    GRENADE: { damage: 60, blastRadius: 80, speed: 350, gravity: 300, fuseTime: 3000 },
  },
};
