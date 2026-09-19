import type { Club, Fixture, GameState, MatchResult, Player, TableRow } from '../domain/types';
import { clubOrder, createInitialWorld } from '../data/initialWorld';
import { simulateMatch } from '../simulation/matchSimulator';
import { createCareerId } from '../storage/gameStorage';
import { applyRoundFinance, resetSeasonFinance } from './finance';

const TOTAL_SEASON_ROUNDS = 14;

function generateFixtures(teamIds: string[]): Fixture[] {
  const teams = [...teamIds];
  const fixed = teams.shift();
  if (!fixed) return [];

  const rotation = [...teams];
  const fixtures: Fixture[] = [];
  const rounds = teamIds.length - 1;

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
    id: `${fixture.id}_r${rounds}_${index}`,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function updatePlayerAfterMatch(
  player: Player,
  club: Club,
  result: MatchResult,
): Player {
  const startingXI = club.startingXI?.length ? club.startingXI : club.playerIds.slice(0, 11);
  const played = startingXI.includes(player.id);

  if (!played) {
    return {
      ...player,
      fitness: clamp(player.fitness + 5, 0, 100),
      form: clamp(player.form * 0.8, -20, 20),
    };
  }

  const clubGoals = result.homeTeamId === club.id ? result.homeGoals : result.awayGoals;
  const opponentGoals = result.homeTeamId === club.id ? result.awayGoals : result.homeGoals;
  const stats = result.playerStats?.[player.id];
  const goals = stats?.goals ?? result.events.filter((event) => event.type === 'goal' && event.playerId === player.id).length;
  const assists = stats?.assists ?? result.events.filter((event) => event.type === 'goal' && event.assistPlayerId === player.id).length;
  const resultForm = clubGoals > opponentGoals ? 4 : clubGoals === opponentGoals ? 1 : -3;
  const scorerForm = goals > 0 ? Math.min(5, goals * 2) : 0;
  const creatorForm = assists > 0 ? Math.min(3, assists) : 0;

  return {
    ...player,
    appearances: player.appearances + 1,
    goals: player.goals + goals,
    assists: player.assists + assists,
    fitness: clamp(player.fitness - 8, 0, 100),
    form: clamp(player.form * 0.72 + resultForm + scorerForm + creatorForm, -20, 20),
  };
}

function applyPlayerMatchEffects(
  players: Record<string, Player>,
  clubs: Record<string, Club>,
  results: MatchResult[],
): Record<string, Player> {
  const nextPlayers = { ...players };

  for (const result of results) {
    const participatingClubs = [clubs[result.homeTeamId], clubs[result.awayTeamId]];
    for (const club of participatingClubs) {
      if (!club) continue;
      for (const playerId of club.playerIds) {
        const player = nextPlayers[playerId];
        if (player) nextPlayers[playerId] = updatePlayerAfterMatch(player, club, result);
      }
    }
  }

  return nextPlayers;
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
  const name = managerName.trim();
  if (!name) throw new Error('Manager name is required.');

  const world = createInitialWorld();
  const now = new Date().toISOString();

  return {
    saveVersion: 2,
    careerId: createCareerId(),
    managerName: name,
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
  const roundResults: MatchResult[] = [];

  const fixtures = state.fixtures.map((fixture) => {
    if (fixture.round !== state.currentRound || fixture.played) return fixture;

    const home = state.clubs[fixture.homeTeamId];
    const away = state.clubs[fixture.awayTeamId];
    const seed = state.season * 100_000 + state.currentRound * 1_000 + roundFixtures.indexOf(fixture) + 17;
    const result = simulateMatch(home, away, state.players, seed);
    table = applyResult(table, result);
    roundResults.push(result);

    if (fixture.homeTeamId === state.clubId || fixture.awayTeamId === state.clubId) {
      playerMatch = result;
    }

    return { ...fixture, played: true, result };
  });

  const nextPlayers = applyPlayerMatchEffects(state.players, state.clubs, roundResults);
  const nextRound = state.currentRound + 1;
  const isSeasonComplete = nextRound > TOTAL_SEASON_ROUNDS;
  const freshFixtures = isSeasonComplete ? generateFixtures(clubOrder) : fixtures;
  const fundedClubs = applyRoundFinance(state.clubs, roundResults);
  const nextClubs = isSeasonComplete ? resetSeasonFinance(fundedClubs) : fundedClubs;

  return {
    ...state,
    fixtures: freshFixtures,
    table: isSeasonComplete ? emptyTable(clubOrder) : table,
    clubs: nextClubs,
    players: nextPlayers,
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
