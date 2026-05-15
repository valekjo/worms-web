import { describe, it, expect, beforeEach } from 'vitest';
import { TurnManager } from '../src/game/TurnManager';
import { Team } from '../src/game/Team';
import { Worm } from '../src/game/Worm';

function makeTeams(count = 2, wormsEach = 2): Team[] {
  const teams: Team[] = [];
  let wormId = 0;
  for (let i = 0; i < count; i++) {
    const team = new Team(i, `Team ${i}`, 0xffffff);
    for (let w = 0; w < wormsEach; w++) {
      team.worms.push(new Worm(wormId++, i, 100 * w, 100));
    }
    teams.push(team);
  }
  return teams;
}

describe('TurnManager', () => {
  let teams: Team[];
  let tm: TurnManager;

  beforeEach(() => {
    teams = makeTeams(2, 2);
    tm = new TurnManager(teams, 30, 5, 0);
  });

  it('starts in AIMING phase', () => {
    expect(tm.phase).toBe('AIMING');
  });

  it('starts on team 0', () => {
    expect(tm.activeTeamIndex).toBe(0);
  });

  it('timeLeft starts at turnTime', () => {
    expect(tm.timeLeft).toBe(30);
  });

  it('tick counts down timeLeft', () => {
    tm.tick(1);
    expect(tm.timeLeft).toBeCloseTo(29);
  });

  it('tick returns false when no phase change', () => {
    const changed = tm.tick(1);
    expect(changed).toBe(false);
  });

  it('tick transitions AIMING → TRANSITION → AIMING when timer expires', () => {
    const changed = tm.tick(31);
    expect(changed).toBe(true);
    // Team advances immediately at transition start
    expect(tm.activeTeamIndex).toBe(1);
    expect(tm.phase).toBe('TRANSITION');
    // One more tick to step through instant transition (transitionTime = 0)
    const changed2 = tm.tick(1);
    expect(changed2).toBe(true);
    expect(tm.phase).toBe('AIMING');
    expect(tm.timeLeft).toBe(30);
  });

  it('onFired changes phase to FIRED', () => {
    tm.onFired();
    expect(tm.phase).toBe('FIRED');
  });

  it('tick does not count down in FIRED phase', () => {
    tm.onFired();
    const changed = tm.tick(100);
    expect(changed).toBe(false);
    expect(tm.phase).toBe('FIRED');
  });

  it('onProjectilesSettled transitions FIRED → RETREAT', () => {
    tm.onFired();
    tm.onProjectilesSettled();
    expect(tm.phase).toBe('RETREAT');
    expect(tm.timeLeft).toBe(5);
  });

  it('tick transitions RETREAT → TRANSITION → AIMING when timer expires', () => {
    tm.onFired();
    tm.onProjectilesSettled();
    const changed = tm.tick(6);
    expect(changed).toBe(true);
    expect(tm.phase).toBe('TRANSITION');
    expect(tm.activeTeamIndex).toBe(1);
    // Step through instant transition
    const changed2 = tm.tick(1);
    expect(changed2).toBe(true);
    expect(tm.phase).toBe('AIMING');
  });

  it('endTurn advances to next team', () => {
    tm.endTurn();
    expect(tm.activeTeamIndex).toBe(1);
    expect(tm.turnNumber).toBe(1);
  });

  it('endTurn wraps around teams', () => {
    tm.endTurn(); // team 1
    tm.endTurn(); // team 0
    expect(tm.activeTeamIndex).toBe(0);
  });

  it('detects game over when only one team alive', () => {
    // Kill all worms in team 1
    for (const w of teams[1].worms) {
      w.takeDamage(1000);
    }
    tm.onFired();
    tm.onProjectilesSettled();
    expect(tm.phase).toBe('GAME_OVER');
  });

  it('skips dead teams on advance', () => {
    const threeTeams = makeTeams(3, 1);
    const tm3 = new TurnManager(threeTeams, 30, 5, 0);
    // Kill team 1
    threeTeams[1].worms[0].takeDamage(1000);
    tm3.endTurn(); // should skip team 1, go to team 2
    expect(tm3.activeTeamIndex).toBe(2);
  });

  it('activeWorm returns the correct worm', () => {
    const worm = tm.activeWorm;
    expect(worm).toBe(teams[0].worms[0]);
  });

  it('turnNumber increments on endTurn', () => {
    expect(tm.turnNumber).toBe(0);
    tm.endTurn();
    expect(tm.turnNumber).toBe(1);
    tm.endTurn();
    expect(tm.turnNumber).toBe(2);
  });
});
