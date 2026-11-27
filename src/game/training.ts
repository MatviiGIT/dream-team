import type { GameState, Player, PlayerSkills, Position } from '../domain/types';

export type TrainingFocus = 'attack' | 'passing' | 'defense' | 'physical';

const POSITION_EFFICIENCY: Record<TrainingFocus, Record<Position, number>> = {
  attack: { GK: 0.35, DEF: 0.7, MID: 1.15, FWD: 1.35 },
  passing: { GK: 0.7, DEF: 0.95, MID: 1.3, FWD: 1.05 },
  defense: { GK: 1.3, DEF: 1.35, MID: 1.0, FWD: 0.7 },
  physical: { GK: 0.9, DEF: 1.0, MID: 1.05, FWD: 1.1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type VisibleTrainingSkill = 'speed' | 'passing' | 'shooting' | 'tackling' | 'goalkeeping';

function targetSkill(player: Player, focus: TrainingFocus): VisibleTrainingSkill {
  if (focus === 'attack') return 'shooting';
  if (focus === 'passing') return 'passing';
  if (focus === 'defense') return player.position === 'GK' ? 'goalkeeping' : 'tackling';
  return 'speed';
}

function secondarySkill(focus: TrainingFocus): 'technique' | 'physical' {
  return focus === 'attack' || focus === 'passing' ? 'technique' : 'physical';
}

function xpGain(player: Player, focus: TrainingFocus): number {
  const potentialGap = Math.max(0, player.potential - player.overall);
  const ageBonus = player.age <= 21 ? 4 : player.age <= 24 ? 2 : player.age >= 30 ? -3 : 0;
  const base = clamp(10 + potentialGap * 0.35 + ageBonus, 5, 19);
  return base * POSITION_EFFICIENCY[focus][player.position];
}

function estimatedHiddenSkills(skills: PlayerSkills) {
  return {
    technique: skills.technique ?? Math.round((skills.passing + skills.shooting) / 2),
    physical: skills.physical ?? Math.round((skills.speed + skills.tackling) / 2),
  };
}

function calculateOverall(skills: PlayerSkills, position: Position): number {
  const hidden = estimatedHiddenSkills(skills);
  if (position === 'GK') {
    return Math.round(skills.goalkeeping * 0.78 + skills.passing * 0.08 + skills.speed * 0.06 + skills.tackling * 0.08);
  }
  if (position === 'DEF') {
    return Math.round(skills.tackling * 0.4 + skills.speed * 0.18 + skills.passing * 0.18 + hidden.physical * 0.24);
  }
  if (position === 'MID') {
    return Math.round(skills.passing * 0.34 + skills.speed * 0.18 + skills.shooting * 0.18 + skills.tackling * 0.12 + hidden.technique * 0.18);
  }
  return Math.round(skills.shooting * 0.4 + skills.speed * 0.25 + skills.passing * 0.1 + hidden.technique * 0.25);
}

function marketValueFor(player: Player, overall: number): number {
  const ageFactor = player.age < 24 ? 1.05 : player.age > 30 ? 0.65 : 0.9;
  return Math.max(100_000, Math.round(overall * overall * ageFactor / 100) * 10_000);
}

function improvePlayer(player: Player, focus: TrainingFocus): Player {
  if (player.overall >= player.potential) return player;

  let xp = Math.max(0, Math.min(99.99, player.developmentXp ?? 0)) + xpGain(player, focus);
  let next: Player = {
    ...player,
    developmentXp: xp,
    fitness: clamp(player.fitness - (focus === 'physical' ? 4 : 2), 30, 100),
    morale: clamp(player.morale + 1, 0, 100),
  };

  while (xp >= 100 && next.overall < next.potential) {
    xp -= 100;
    const skill = targetSkill(next, focus);
    const beforeOverall = calculateOverall(next.skills, next.position);
    const updatedSkills: PlayerSkills = {
      ...next.skills,
      [skill]: clamp(next.skills[skill] + 1, 0, 99),
      [secondarySkill(focus)]: clamp((next.skills[secondarySkill(focus)] ?? 50) + 1, 0, 99),
    };
    const afterOverall = calculateOverall(updatedSkills, next.position);
    const overallGain = Math.max(0, afterOverall - beforeOverall);
    const overall = Math.min(next.potential, next.overall + overallGain);

    next = {
      ...next,
      skills: updatedSkills,
      overall,
      marketValue: marketValueFor(next, overall),
      wage: Math.max(450, Math.round(overall * (next.age > 30 ? 15 : 18))),
    };
  }

  next.developmentXp = next.overall >= next.potential ? 0 : xp;
  return next;
}

export function trainingKey(state: GameState): string {
  return state.season + ':' + state.week;
}

export function getTrainingPreview(state: GameState, focus: TrainingFocus) {
  const club = state.clubs[state.clubId];
  const roster = club.playerIds.map((id) => state.players[id]).filter((player): player is Player => Boolean(player));
  const eligible = roster.filter((player) => player.overall < player.potential);
  const averageXp = eligible.length
    ? eligible.reduce((sum, player) => sum + xpGain(player, focus), 0) / eligible.length
    : 0;
  const efficiencies = POSITION_EFFICIENCY[focus];
  const highest = Math.max(...Object.values(efficiencies));
  const bestPositions = (Object.keys(efficiencies) as Position[]).filter((position) => efficiencies[position] === highest);

  return {
    playerCount: roster.length,
    eligibleCount: eligible.length,
    averageXp,
    bestPositions,
    target: focus === 'attack' ? 'Shooting' : focus === 'passing' ? 'Passing' : focus === 'defense' ? 'Tackling / Goalkeeping' : 'Speed',
    fitnessCost: focus === 'physical' ? 4 : 2,
  };
}

export function applyTraining(state: GameState, focus: TrainingFocus): GameState {
  const key = trainingKey(state);
  if (state.lastTrainingKey === key) return state;

  const club = state.clubs[state.clubId];
  if (!club) return state;

  const players = { ...state.players };
  for (const playerId of club.playerIds) {
    const player = players[playerId];
    if (player) players[playerId] = improvePlayer(player, focus);
  }

  const wageBill = club.playerIds.reduce((sum, playerId) => sum + (players[playerId]?.wage ?? 0), 0);
  return {
    ...state,
    players,
    clubs: {
      ...state.clubs,
      [club.id]: { ...club, wageBill },
    },
    lastTrainingKey: key,
    updatedAt: new Date().toISOString(),
  };
}
