import type { Club, Fixture, GameState, MatchResult, TableRow } from '../domain/types';
import { clubOrder, createInitialWorld } from '../data/initialWorld';
import { simulateMatch } from '../simulation/matchSimulator';

function generateFixtures(teamIds: string[]): Fixture[] {
  const teams = [...teamIds];
  const fixed = teams.shift();
  if (!fixed) return [];

  const rotation = [...teams];
  const fixtures: Fixture[] = [];
  const rounds = teamIds.length;

  for (let round = 0; round < rounds; round += 1) {
    const current = [fixed, ...rotation];
    for (let i = 0; i < current.length / 2; i += 1) {
      const a = current[i];
      const b = current[current.length - 1 - i];
      const homeTeamId = round % 2 === 0 ? a : b;
      const awayTeamId = round % 2 === 0 ? b : a;
      fixtures.push({
        id: `fixture_${round + 1}_${i + 1}`,
        round: round + 1,
        homeTeamId,
        awayTeamId,
        played: false,
      });
    }
    rotation.unshift(rotation.pop()!);
  }

  const secondHalf = fixtures.map((fixture, index) => ({
    ...fixture,
    id: `${fixture.id}_r${rounds}`,
    round: fixture.round + rounds,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
  }));

  return [...fixtures, ...secondHalf];
}

function emptyTable(teamIds: string[]): TableRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

function sortTable(table: TableRow[]): TableRow[] {
  return [...table].sort((a, b) => {
    const points = b.points - a.points;
    if (points !== 0) return points;
    const goalDifference = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    if (goalDifference !== 0) return goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}

function applyResult(table: TableRow[], result: MatchResult): TableRow[] {
  return sortTable(table.map((row) => {
    if (row.teamId !== result.homeTeamId && row.teamId !== result.awayTeamId) return row;

    const isHome = row.teamId === result.homeTeamId;
    const goalsFor = isHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
    const win = goalsFor > goalsAgainst;
    const draw = goalsFor === goalsAgainst;

    return {
      ...row,
      played: row.played + 1,
      wins: row.wins + (win ? 1 : 0),
      draws: row.draws + (draw ? 1 : 0),
      losses: row.losses + (win || draw ? 0 : 1),
      goalsFor: row.goalsFor + goalsFor,
      goalsAgainst: row.goalsAgainst + goalsAgainst,
      points: row.points + (win ? 3 : draw ? 1 : 0),
    };
  }));
}

export function createCareer(managerName: string, clubId: string): GameState {
  const world = createInitialWorld();
  const now = new Date().toISOString();

  return {
    saveVersion: 1,
    managerName: managerName.trim() || 'Manager',
    clubId,
    season: 1,
    currentRound: 1,
    clubs: world.clubs,
    players: world.players,
    fixtures: generateFixtures(clubOrder),
    table: emptyTable(clubOrder),
    createdAt: now,
    updatedAt: now,
  };
}

export function playNextRound(state: GameState): GameState {
  const roundFixtures = state.fixtures.filter((fixture) => fixture.round === state.currentRound && !fixture.played);
  if (!roundFixtures.length) return state;

  let table = state.table;
  let playerMatch: MatchResult | undefined;
  const fixtures = state.fixtures.map((fixture) => {
    if (fixture.round !== state.currentRound || fixture.played) return fixture;

    const home = state.clubs[fixture.homeTeamId];
    const away = state.clubs[fixture.awayTeamId];
    const seed = state.season * 100_000 + state.currentRound * 1_000 + roundFixtures.indexOf(fixture) + 17;
    const result = simulateMatch(home, away, state.players, seed);
    table = applyResult(table, result);

    if (fixture.homeTeamId === state.clubId || fixture.awayTeamId === state.clubId) {
      playerMatch = result;
    }

    return { ...fixture, played: true, result };
  });

  const nextRound = state.currentRound + 1;
  const isSeasonComplete = nextRound > 14;
  const freshFixtures = isSeasonComplete
    ? generateFixtures(clubOrder)
    : fixtures;

  return {
    ...state,
    fixtures: freshFixtures,
    table: isSeasonComplete ? emptyTable(clubOrder) : table,
    currentRound: isSeasonComplete ? 1 : nextRound,
    season: isSeasonComplete ? state.season + 1 : state.season,
    lastMatch: playerMatch ?? state.lastMatch,
    updatedAt: new Date().toISOString(),
  };
}

export function getNextFixture(state: GameState): Fixture | undefined {
  return state.fixtures.find(
    (fixture) => fixture.round === state.currentRound && !fixture.played &&
      (fixture.homeTeamId === state.clubId || fixture.awayTeamId === state.clubId),
  );
}

export function getClubName(clubs: Record<string, Club>, id: string): string {
  return clubs[id]?.name ?? 'Unknown Club';
}
