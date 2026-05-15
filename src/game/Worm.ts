export class Worm {
  id: number;
  teamIndex: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  velX: number = 0;
  velY: number = 0;
  onGround: boolean = false;
  facingLeft: boolean = false;
  alive: boolean = true;
  name: string;

  constructor(
    id: number,
    teamIndex: number,
    x: number,
    y: number,
    maxHealth = 100,
  ) {
    this.id = id;
    this.teamIndex = teamIndex;
    this.x = x;
    this.y = y;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.name = `Worm ${id}`;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
    }
  }
}
