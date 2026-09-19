import type { Club, Formation, MatchEvent, MatchPlayerStats, MatchResult, Player, Position } from '../domain/types';
import { SeededRng } from './rng';

interface TeamProfile {
  attack: number;
  defense: number;
  midfield: number;
  goalkeeper: number;
  stamina: number;
  mentality: number;
  possession: number;
}

interface TacticalProfile {
  attack: number;
  defense: number;
  possession: number;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formationRoles(formation: Formation): Position[] {
  switch (formation) {
    case '4-4-2':
      return ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'];
    case '4-2-3-1':
      return ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'];
    case '4-3-3':
    default:
      return ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
  }
}

function positionFit(actual: Position, expected: Position): number {
  if (actual === expected) return 1;
  if (actual === 'GK' || expected === 'GK') return 0.2;
  if ((actual === 'DEF' && expected === 'MID') || (actual === 'MID' && expected === 'DEF')) return 0.62;
  if ((actual === 'MID' && expected === 'FWD') || (actual === 'FWD' && expected === 'MID')) return 0.68;
  if ((actual === 'DEF' && expected === 'FWD') || (actual === 'FWD' && expected === 'DEF')) return 0.45;
  return 0.55;
}

function lineupFit(club: Club, players: Record<string, Player>): number {
  const selectedIds = club.startingXI?.length === 11 ? club.startingXI : club.playerIds.slice(0, 11);
  const roles = formationRoles(club.tactic.formation);
  const fits = selectedIds.map((id, index) => {
    const player = players[id];
    return player ? positionFit(player.position, roles[index] ?? 'MID') : 0.35;
  });
  return average(fits);
}

function modifierForMentality(mentality: Club['tactic']['mentality']): number {
  switch (mentality) {
    case 'Very Defensive': return -0.12;
    case 'Defensive': return -0.05;
    case 'Attacking': return 0.08;
    case 'Very Attacking': return 0.14;
    default: return 0;
  }
}

function tacticProfile(
  club: Club,
  squad: Player[],
  fit: number,
): TacticalProfile {
  const { mentality, pressing, tempo, defensiveLine, width, formation } = club.tactic;
  const outfield = squad.filter((player) => player.position !== 'GK');
  const pace = average(outfield.map((player) => player.attributes.pace));
  const passing = average(outfield.map((player) => player.attributes.passing));
  const defending = average(outfield.map((player) => player.attributes.defending));

  const formationEffect = {
    '4-3-3': { attack: 0.025, defense: -0.005, possession: 0.012 },
    '4-4-2': { attack: 0.01, defense: 0.015, possession: 0.006 },
    '4-2-3-1': { attack: 0.015, defense: 0.02, possession: 0.018 },
  }[formation];

  const mentalityAttack = modifierForMentality(mentality);
  const pressingAttack = pressing === 'High'
    ? 0.04 + Math.max(0, pace - 72) / 2500
    : pressing === 'Low' ? -0.012 : 0;
  const tempoAttack = tempo === 'Fast'
    ? 0.045 + Math.max(0, pace - 70) / 2600
    : tempo === 'Slow' ? -0.018 : 0;
  const widthAttack = width === 'Wide' ? 0.022 : width === 'Narrow' ? -0.008 : 0;

  const defensiveLineEffect = defensiveLine === 'High'
    ? 0.01 + Math.max(0, pace - 72) / 3000 - Math.max(0, 70 - pace) / 3200
    : defensiveLine === 'Low' ? 0.035 : 0;

  const pressingDefense = pressing === 'High'
    ? 0.012 + Math.max(0, defending - 72) / 3200
    : pressing === 'Low' ? 0.012 : 0;

  const slowPossession = tempo === 'Slow' ? 0.032 + Math.max(0, passing - 72) / 3000 : 0;
  const fastPossession = tempo === 'Fast' ? -0.012 : 0;
  const widthPossession = width === 'Wide' ? 0.016 : width === 'Narrow' ? -0.006 : 0;
  const mentalityPossession = mentality === 'Very Defensive' ? -0.008 : mentality === 'Very Attacking' ? -0.006 : 0;

  const exactShapeBonus = 0.9 + fit * 0.1;

  return {
    attack: (mentalityAttack + pressingAttack + tempoAttack + widthAttack + formationEffect.attack) * exactShapeBonus,
    defense: (
      -mentalityAttack * 0.6 +
      defensiveLineEffect +
      pressingDefense +
      formationEffect.defense
    ) * (0.92 + fit * 0.08),
    possession: (
      slowPossession +
      fastPossession +
      widthPossession +
      mentalityPossession +
      formationEffect.possession
    ) * (0.9 + fit * 0.1),
  };
}

function buildProfile(club: Club, players: Record<string, Player>): TeamProfile {
  const selectedIds = club.startingXI?.length ? club.startingXI : club.playerIds.slice(0, 11);
  const squad = selectedIds.map((id) => players[id]).filter((player): player is Player => Boolean(player));
  const outfield = squad.filter((player) => player.position !== 'GK');
  const forwards = squad.filter((player) => player.position === 'FWD');
  const defenders = squad.filter((player) => player.position === 'DEF');
  const midfielders = squad.filter((player) => player.position === 'MID');
  const goalkeeper = squad.find((player) => player.position === 'GK');
  const fit = lineupFit(club, players);
  const tactic = tacticProfile(club, squad, fit);

  const fitnessFactor = average(squad.map((player) => player.fitness)) / 100;
  const formFactor = average(squad.map((player) => 1 + player.form / 1000));

  const attack = (
    average(forwards.map((player) => (player.attributes.shooting + player.attributes.technique + player.attributes.positioning) / 3)) * 0.5 +
    average(midfielders.map((player) => (player.attributes.passing + player.attributes.technique + player.attributes.dribbling) / 3)) * 0.3 +
    average(outfield.map((player) => player.overall)) * 0.2
  ) * fitnessFactor * formFactor;

  const defense = (
    average(defenders.map((player) => (player.attributes.defending + player.attributes.positioning + player.attributes.physical) / 3)) * 0.7 +
    (goalkeeper?.attributes.goalkeeper ?? 50) * 0.3
  ) * fitnessFactor * formFactor;

  const midfield = average(
    midfielders.map((player) => (player.attributes.passing + player.attributes.technique + player.attributes.stamina) / 3),
  ) * (0.94 + fit * 0.06);

  return {
    attack: attack * (1 + tactic.attack),
    defense: defense * (1 + tactic.defense),
    midfield,
    goalkeeper: goalkeeper?.attributes.goalkeeper ?? 50,
    stamina: average(squad.map((player) => player.attributes.stamina)),
    mentality: club.reputation,
    possession: tactic.possession,
  };
}

function selectScorer(club: Club, players: Record<string, Player>, rng: SeededRng): Player | undefined {
  const selectedIds = club.startingXI?.length ? club.startingXI : club.playerIds.slice(0, 11);
  const candidates = selectedIds
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.position !== 'GK');

  if (!candidates.length) return undefined;
  const weights = candidates.map((player) => Math.max(1, player.attributes.shooting + player.attributes.positioning));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = rng.range(0, total);

  for (let i = 0; i < candidates.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}

function selectWeightedPlayer(
  candidates: Player[],
  weightForPlayer: (player: Player) => number,
  rng: SeededRng,
): Player | undefined {
  if (!candidates.length) return undefined;

  const weights = candidates.map((player) => Math.max(1, weightForPlayer(player)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = rng.range(0, total);

  for (let i = 0; i < candidates.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}

function selectAssistProvider(
  club: Club,
  players: Record<string, Player>,
  scorerId: string | undefined,
  rng: SeededRng,
): Player | undefined {
  const selectedIds = club.startingXI?.length ? club.startingXI : club.playerIds.slice(0, 11);
  const candidates = selectedIds
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.id !== scorerId && player.position !== 'GK');

  return selectWeightedPlayer(
    candidates,
    (player) => player.attributes.passing + player.attributes.technique +
      (player.position === 'MID' ? 18 : player.position === 'DEF' ? 8 : 4),
    rng,
  );
}

function buildTeamPlayerStats(
  club: Club,
  players: Record<string, Player>,
  totalShots: number,
  teamGoals: number,
  opponentGoals: number,
  events: MatchEvent[],
  rng: SeededRng,
): Record<string, MatchPlayerStats> {
  const selectedIds = club.startingXI?.length ? club.startingXI : club.playerIds.slice(0, 11);
  const selectedPlayers = selectedIds
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player));
  const roles = formationRoles(club.tactic.formation);
  const resultBonus = teamGoals > opponentGoals ? 0.32 : teamGoals === opponentGoals ? 0.06 : -0.24;
  const goalsByPlayer = new Map<string, number>();
  const assistsByPlayer = new Map<string, number>();

  for (const event of events) {
    if (event.type !== 'goal' || event.teamId !== club.id) continue;
    if (event.playerId) goalsByPlayer.set(event.playerId, (goalsByPlayer.get(event.playerId) ?? 0) + 1);
    if (event.assistPlayerId) assistsByPlayer.set(event.assistPlayerId, (assistsByPlayer.get(event.assistPlayerId) ?? 0) + 1);
  }

  const shotCounts = new Map(selectedPlayers.map((player) => [player.id, goalsByPlayer.get(player.id) ?? 0]));
  const remainingShots = Math.max(0, totalShots - teamGoals);

  for (let shot = 0; shot < remainingShots; shot += 1) {
    const selected = selectWeightedPlayer(
      selectedPlayers,
      (player) => {
        const index = selectedIds.indexOf(player.id);
        const expected = roles[index] ?? 'MID';
        const fit = positionFit(player.position, expected);
        const roleBonus = player.position === 'FWD' ? 28 : player.position === 'MID' ? 13 : 3;
        return (player.attributes.shooting + player.attributes.positioning + roleBonus) * (0.72 + fit * 0.28);
      },
      rng,
    );
    if (selected) shotCounts.set(selected.id, (shotCounts.get(selected.id) ?? 0) + 1);
  }

  return Object.fromEntries(selectedPlayers.map((player) => {
    const index = selectedIds.indexOf(player.id);
    const expected = roles[index] ?? 'MID';
    const fit = positionFit(player.position, expected);
    const shots = shotCounts.get(player.id) ?? 0;
    const goals = goalsByPlayer.get(player.id) ?? 0;
    const assists = assistsByPlayer.get(player.id) ?? 0;

    let rating = 6.25 +
      clamp((player.overall - 70) * 0.025, -0.45, 0.55) +
      player.form * 0.012 +
      (fit - 1) * 0.18 +
      resultBonus;

    const goalValue = player.position === 'FWD' ? 0.95 : player.position === 'MID' ? 1.05 : 1.15;
    rating += goals * goalValue + assists * 0.52;
    rating += Math.min(shots, 5) * 0.045;
    rating -= Math.max(0, shots - goals * 1.5 - 4) * 0.018;

    if (opponentGoals === 0 && player.position === 'GK') rating += 0.42;
    if (opponentGoals === 0 && player.position === 'DEF') rating += 0.18;

    return [
      player.id,
      {
        playerId: player.id,
        minutes: 90,
        rating: Number(clamp(rating, 4.8, 10).toFixed(1)),
        shots,
        goals,
        assists,
      },
    ];
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function simulateMatch(
  homeTeam: Club,
  awayTeam: Club,
  players: Record<string, Player>,
  seed = Date.now(),
): MatchResult {
  const rng = new SeededRng(seed);
  const home = buildProfile(homeTeam, players);
  const away = buildProfile(awayTeam, players);

  const totalMidfield = home.midfield + away.midfield || 1;
  const homePossession = clamp(
    50 + ((home.midfield - away.midfield) / totalMidfield) * 24 +
      home.possession * 100 +
      4,
    34,
    66,
  );
  const awayPossession = 100 - homePossession;

  const homeAdvantage = 1.1;
  const qualityScale = 0.92;
  const homeChance = clamp(
    0.82 * qualityScale * homeAdvantage * (1 + (home.attack - away.defense) / 140) * (0.88 + rng.range(0, 0.22)),
    0.2,
    3.4,
  );
  const awayChance = clamp(
    0.78 * qualityScale * (1 + (away.attack - home.defense) / 140) * (0.88 + rng.range(0, 0.22)),
    0.2,
    3.0,
  );

  let homeGoals = 0;
  let awayGoals = 0;
  const events: MatchEvent[] = [];

  for (let minute = 1; minute <= 90; minute += 1) {
    if (minute === 45) {
      events.push({
        id: `event_ht_${seed}`,
        minute,
        type: 'half-time',
        teamId: homeTeam.id,
        description: 'Half-time',
      });
    }

    const lateBoost = minute > 70 ? 1.1 : minute < 15 ? 0.95 : 1;
    const eventProbability = clamp(((homeChance + awayChance) / 90) * lateBoost, 0, 0.08);

    if (rng.chance(eventProbability)) {
      const homeShare = homeChance / (homeChance + awayChance);
      const scoringHome = rng.chance(homeShare);
      const scoringTeam = scoringHome ? homeTeam : awayTeam;
      const scorer = selectScorer(scoringTeam, players, rng);

      if (scoringHome) homeGoals += 1;
      else awayGoals += 1;

      events.push({
        id: `event_goal_${seed}_${minute}_${homeGoals}_${awayGoals}`,
        minute,
        type: 'goal',
        teamId: scoringTeam.id,
        playerId: scorer?.id,
        description: `${scorer?.name ?? 'A player'} scores for ${scoringTeam.name}!`,
      });
    } else if (rng.chance(0.045)) {
      const chanceHome = rng.chance(homeShare(homeChance, awayChance));
      const team = chanceHome ? homeTeam : awayTeam;
      events.push({
        id: `event_chance_${seed}_${minute}`,
        minute,
        type: 'chance',
        teamId: team.id,
        description: `${team.name} create a promising chance.`,
      });
    }
  }

  events.push({
    id: `event_ft_${seed}`,
    minute: 90,
    type: 'full-time',
    teamId: homeTeam.id,
    description: 'Full-time',
  });

  const homeShots = Math.max(homeGoals, Math.round(homeChance * rng.range(4.8, 7.1) + rng.range(1, 5)));
  const awayShots = Math.max(awayGoals, Math.round(awayChance * rng.range(4.8, 7.1) + rng.range(1, 5)));

  for (const event of events) {
    if (event.type !== 'goal' || !event.playerId) continue;
    const scoringTeam = event.teamId === homeTeam.id ? homeTeam : awayTeam;
    if (rng.chance(0.68)) {
      const assister = selectAssistProvider(scoringTeam, players, event.playerId, rng);
      if (assister) event.assistPlayerId = assister.id;
    }
  }

  const playerStats = {
    ...buildTeamPlayerStats(homeTeam, players, homeShots, homeGoals, awayGoals, events, rng),
    ...buildTeamPlayerStats(awayTeam, players, awayShots, awayGoals, homeGoals, events, rng),
  };

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeGoals,
    awayGoals,
    homeXg: Number(homeChance.toFixed(2)),
    awayXg: Number(awayChance.toFixed(2)),
    homeShots,
    awayShots,
    homePossession: Math.round(homePossession),
    awayPossession: Math.round(awayPossession),
    events,
    playerStats,
  };
}

function homeShare(homeXg: number, awayXg: number): number {
  return homeXg / (homeXg + awayXg);
}
