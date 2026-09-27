import type { GameState, Player, PlayerAttributes, Position } from '../domain/types';

export type TrainingFocus = 'attack' | 'passing' | 'defense' | 'physical';

const FOCUS_ATTRIBUTES: Record<TrainingFocus, Array<keyof PlayerAttributes>> = {
  attack: ['shooting', 'technique', 'dribbling', 'positioning'],
  passing: ['passing', 'technique', 'dribbling', 'mentality'],
  defense: ['defending', 'positioning', 'physical', 'mentality'],
  physical: ['pace', 'physical', 'stamina'],
};

const POSITION_EFFICIENCY: Record<TrainingFocus, Record<Position, number>> = {
  attack: { GK: 0.35, DEF: 0.7, MID: 1.15, FWD: 1.35 },
  passing: { GK: 0.65, DEF: 1.0, MID: 1.35, FWD: 1.1 },
  defense: { GK: 1.25, DEF: 1.35, MID: 1.05, FWD: 0.7 },
  physical: { GK: 0.9, DEF: 1.0, MID: 1.05, FWD: 1.1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trainingXpGain(player: Player, focus: TrainingFocus): number {
  const potentialGap = Math.max(0, player.potential - player.overall);
  const ageBonus = player.age <= 21 ? 4 : player.age <= 24 ? 2 : 0;
  const baseXp = clamp(8 + potentialGap * 0.35 + ageBonus, 5, 18);
  return baseXp * POSITION_EFFICIENCY[focus][player.position];
}

function recalculateOverall(player: Player): Player {
  const { pace, passing, defending, shooting, goalkeeper } = player.attributes;
  const overall = Math.min(player.potential, Math.round((pace + passing + defending + shooting + goalkeeper) / 5));
  if (overall === player.overall) return player;

  return {
    ...player,
    overall,
    value: Math.max(350_000, Math.round(overall * overall * 7_500)),
    wage: Math.max(900, Math.round(overall * 85)),
  };
}

function improvePlayer(player: Player, focus: TrainingFocus): Player {
  const startingXp = clamp(player.developmentXp ?? 0, 0, 99.99);
  let xp = startingXp + trainingXpGain(player, focus);
  let next = {
    ...player,
    developmentXp: xp,
    fitness: clamp(player.fitness - 4, 0, 100),
    morale: clamp(player.morale + 1, 0, 100),
  };

  while (xp >= 100 && next.overall < next.potential) {
    xp -= 100;
    const candidates = FOCUS_ATTRIBUTES[focus].filter((attribute) => next.attributes[attribute] < 99);
    if (!candidates.length) break;

    const attribute = candidates.reduce((best, current) =>
      next.attributes[current] < next.attributes[best] ? current : best,
    );

    next = {
      ...next,
      attributes: {
        ...next.attributes,
        [attribute]: clamp(next.attributes[attribute] + 1, 0, 99),
      },
      developmentXp: xp,
    };
    next = recalculateOverall(next);
  }

  next.developmentXp = xp;
  return next;
}

export function getTrainingPreview(state: GameState, focus: TrainingFocus): {
  players: number;
  averageXp: number;
  bestPositions: Position[];
} {
  const club = state.clubs[state.clubId];
  if (!club) return { players: 0, averageXp: 0, bestPositions: [] };

  const roster = club.playerIds.map((id) => state.players[id]).filter(Boolean);
  if (!roster.length) return { players: 0, averageXp: 0, bestPositions: [] };

  const averageXp = roster.reduce((sum, player) => sum + trainingXpGain(player, focus), 0) / roster.length;
  const efficiency = POSITION_EFFICIENCY[focus];
  const maxEfficiency = Math.max(...Object.values(efficiency));
  const bestPositions = (Object.keys(efficiency) as Position[]).filter((position) => efficiency[position] === maxEfficiency);

  return {
    players: roster.length,
    averageXp,
    bestPositions,
  };
}

export function applyTraining(state: GameState, focus: TrainingFocus): GameState {
  if (state.trainingUsed) return state;

  const club = state.clubs[state.clubId];
  if (!club) return state;

  const players = { ...state.players };
  for (const playerId of club.playerIds) {
    const player = players[playerId];
    if (player) players[playerId] = improvePlayer(player, focus);
  }

  return {
    ...state,
    players,
    trainingUsed: true,
    updatedAt: new Date().toISOString(),
  };
}
