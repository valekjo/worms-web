import { Worm } from './Worm';

export class Team {
  index: number;
  name: string;
  color: number;
  worms: Worm[];
  activeWormIndex: number = 0;
  isAI: boolean;

  constructor(index: number, name: string, color: number, isAI = false) {
    this.index = index;
    this.name = name;
    this.color = color;
    this.worms = [];
    this.isAI = isAI;
  }

  get activeWorm(): Worm {
    return this.worms[this.activeWormIndex];
  }

  /** Advance to the next living worm (round-robin). */
  nextWorm(): void {
    if (this.worms.length === 0) return;
    const start = this.activeWormIndex;
    let next = (start + 1) % this.worms.length;
    while (!this.worms[next].alive && next !== start) {
      next = (next + 1) % this.worms.length;
    }
    this.activeWormIndex = next;
  }

  get alive(): boolean {
    return this.worms.some((w) => w.alive);
  }
}
