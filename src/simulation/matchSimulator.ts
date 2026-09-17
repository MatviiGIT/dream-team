import type { Club, MatchEvent, MatchResult, Player } from '../domain/types';
import { SeededRng } from './rng';

interface TeamProfile {
  attack: number;
  defense: number;
  midfield: number;
  goalkeeper: number;
  stamina: number;
  mentality: number;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
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

function tacticProfile(club: Club): { attack: number; defense: number; stamina: number; possession: number } {
  const { mentality, pressing, tempo, defensiveLine, width } = club.tactic;
  return {
    attack:
      modifierForMentality(mentality) +
      (pressing === 'High' ? 0.05 : pressing === 'Low' ? -0.02 : 0) +
      (tempo === 'Fast' ? 0.06 : tempo === 'Slow' ? -0.03 : 0) +
      (width === 'Wide' ? 0.025 : width === 'Narrow' ? -0.01 : 0),
    defense:
      -modifierForMentality(mentality) * 0.65 +
      (defensiveLine === 'High' ? -0.025 : defensiveLine === 'Low' ? 0.03 : 0),
    stamina: pressing === 'High' ? -0.08 : pressing === 'Low' ? 0.04 : 0,
    possession: (tempo === 'Slow' ? 0.035 : tempo === 'Fast' ? -0.015 : 0) +
      (width === 'Wide' ? 0.015 : width === 'Narrow' ? -0.01 : 0),
  };
}

function buildProfile(club: Club, players: Record<string, Player>): TeamProfile {
  const squad = club.playerIds.map((id) => players[id]).filter(Boolean);
  const outfield = squad.filter((player) => player.position !== 'GK');
  const forwards = squad.filter((player) => player.position === 'FWD');
  const defenders = squad.filter((player) => player.position === 'DEF');
  const midfielders = squad.filter((player) => player.position === 'MID');
  const goalkeeper = squad.find((player) => player.position === 'GK');
  const tactic = tacticProfile(club);

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

  const midfield = average(midfielders.map((player) => (player.attributes.passing + player.attributes.technique + player.attributes.stamina) / 3));

  return {
    attack: attack * (1 + tactic.attack),
    defense: defense * (1 + tactic.defense),
    midfield,
    goalkeeper: goalkeeper?.attributes.goalkeeper ?? 50,
    stamina: average(squad.map((player) => player.attributes.stamina)) + tactic.stamina * 100,
    mentality: club.reputation,
  };
}

function selectScorer(club: Club, players: Record<string, Player>, rng: SeededRng): Player | undefined {
  const candidates = club.playerIds
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
    50 + ((home.midfield - away.midfield) / totalMidfield) * 24 + tacticProfile(homeTeam).possession * 100 + 4,
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

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeGoals,
    awayGoals,
    homeXg: Number(homeChance.toFixed(2)),
    awayXg: Number(awayChance.toFixed(2)),
    homeShots: Math.max(homeGoals, Math.round(homeChance * rng.range(4.8, 7.1) + rng.range(1, 5))),
    awayShots: Math.max(awayGoals, Math.round(awayChance * rng.range(4.8, 7.1) + rng.range(1, 5))),
    homePossession: Math.round(homePossession),
    awayPossession: Math.round(awayPossession),
    events,
  };
}

function homeShare(homeXg: number, awayXg: number): number {
  return homeXg / (homeXg + awayXg);
}
