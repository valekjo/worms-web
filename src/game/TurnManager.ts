import { Team } from './Team';
import { Worm } from './Worm';

export type TurnPhase = 'AIMING' | 'FIRED' | 'RETREAT' | 'GAME_OVER';

export class TurnManager {
  teams: Team[];
  activeTeamIndex: number = 0;
  phase: TurnPhase = 'AIMING';
  timeLeft: number;         // seconds, countdown
  turnNumber: number = 0;

  private readonly turnTime: number;
  private readonly retreatTime: number;

  constructor(teams: Team[], turnTime: number, retreatTime: number) {
    this.teams = teams;
    this.turnTime = turnTime;
    this.retreatTime = retreatTime;
    this.timeLeft = turnTime;
  }

  get activeTeam(): Team {
    return this.teams[this.activeTeamIndex];
  }

  get activeWorm(): Worm {
    return this.activeTeam.activeWorm;
  }

  /**
   * Call every frame with delta in seconds.
   * Returns true if the phase changed this tick.
   */
  tick(delta: number): boolean {
    if (this.phase === 'GAME_OVER' || this.phase === 'FIRED') return false;

    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.phase === 'AIMING') {
        // Time ran out while aiming → end turn directly
        this.endTurn();
        return true;
      } else if (this.phase === 'RETREAT') {
        this.endTurn();
        return true;
      }
    }
    return false;
  }

  /** Called when a weapon is fired. */
  onFired(): void {
    if (this.phase === 'AIMING') {
      this.phase = 'FIRED';
    }
  }

  /** Called when all projectiles have settled. */
  onProjectilesSettled(): void {
    if (this.phase === 'FIRED') {
      // Check for game over
      const aliveTeams = this.teams.filter((t) => t.alive);
      if (aliveTeams.length <= 1) {
        this.phase = 'GAME_OVER';
        return;
      }
      this.phase = 'RETREAT';
      this.timeLeft = this.retreatTime;
    }
  }

  /** Called when retreat time ends or manually skipped. */
  endTurn(): void {
    const aliveTeams = this.teams.filter((t) => t.alive);
    if (aliveTeams.length <= 1) {
      this.phase = 'GAME_OVER';
      return;
    }
    this.advanceTeam();
    this.phase = 'AIMING';
    this.timeLeft = this.turnTime;
    this.turnNumber++;
  }

  private advanceTeam(): void {
    const start = this.activeTeamIndex;
    let next = (start + 1) % this.teams.length;
    // Skip dead teams
    while (!this.teams[next].alive && next !== start) {
      next = (next + 1) % this.teams.length;
    }
    this.activeTeamIndex = next;
    this.teams[next].nextWorm();
  }
}
