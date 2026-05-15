import { Team } from './Team';
import { Worm } from './Worm';

export type TurnPhase = 'AIMING' | 'FIRED' | 'RETREAT' | 'TRANSITION' | 'GAME_OVER';

export class TurnManager {
  teams: Team[];
  activeTeamIndex: number = 0;
  phase: TurnPhase = 'AIMING';
  timeLeft: number;         // seconds, countdown
  turnNumber: number = 0;

  private readonly turnTime: number;
  private readonly retreatTime: number;
  private readonly transitionTime: number;

  constructor(teams: Team[], turnTime: number, retreatTime: number, transitionTime: number = 3) {
    this.teams = teams;
    this.turnTime = turnTime;
    this.retreatTime = retreatTime;
    this.transitionTime = transitionTime;
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
      if (this.phase === 'AIMING' || this.phase === 'RETREAT') {
        this.beginTransition();
        return true;
      } else if (this.phase === 'TRANSITION') {
        this.startTurn();
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

  /** Immediately advance to the next turn, skipping the transition delay. */
  endTurn(): void {
    const aliveTeams = this.teams.filter((t) => t.alive);
    if (aliveTeams.length <= 1) { this.phase = 'GAME_OVER'; return; }
    this.advanceTeam();
    this.phase = 'AIMING';
    this.timeLeft = this.turnTime;
    this.turnNumber++;
  }

  private beginTransition(): void {
    const aliveTeams = this.teams.filter((t) => t.alive);
    if (aliveTeams.length <= 1) {
      this.phase = 'GAME_OVER';
      return;
    }
    this.advanceTeam();
    this.phase = 'TRANSITION';
    this.timeLeft = this.transitionTime;
    this.turnNumber++;
  }

  private startTurn(): void {
    this.phase = 'AIMING';
    this.timeLeft = this.turnTime;
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
