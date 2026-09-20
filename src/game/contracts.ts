import type { ContractRole, GameState, Player } from '../domain/types';
import { createClubFinance } from './finance';

export type ContractError =
  | 'player-not-found'
  | 'not-owned'
  | 'not-enough-budget'
  | 'invalid-years';

export interface RenewalOffer {
  years: number;
  newWage: number;
  signingBonus: number;
  budgetAfter: number;
}

function roundMoney(value: number, step = 500): number {
  return Math.max(step, Math.round(value / step) * step);
}

function roleFactor(role: ContractRole): number {
  switch (role) {
    case 'starter': return 1.16;
    case 'rotation': return 1.10;
    case 'prospect': return 1.08;
    case 'reserve': return 1.04;
  }
}

function withFinanceDefaults(club: GameState['clubs'][string]) {
  return {
    ...createClubFinance(),
    ...(club.finance ?? {}),
  };
}

export function getSquadRole(game: GameState, playerId: string): ContractRole {
  const club = game.clubs[game.clubId];
  const player = game.players[playerId];
  if (!club || !player) return 'reserve';

  if (club.startingXI?.includes(playerId)) return 'starter';
  if (player.age <= 22 && player.potential >= player.overall + 5) return 'prospect';
  if (player.overall >= club.reputation - 2) return 'rotation';
  return 'reserve';
}

export function getRenewalOffer(
  game: GameState,
  playerId: string,
  years: number,
): RenewalOffer | null {
  if (!Number.isInteger(years) || years < 2 || years > 4) return null;

  const club = game.clubs[game.clubId];
  const player = game.players[playerId];
  if (!club || !player || !club.playerIds.includes(playerId)) return null;

  const role = player.contract?.role ?? getSquadRole(game, playerId);
  const potentialGap = Math.max(0, player.potential - player.overall);
  const ageAdjustment = player.age <= 23 ? 0.03 : player.age >= 30 ? -0.02 : 0;
  const newWage = roundMoney(
    player.wage * (roleFactor(role) + potentialGap * 0.008 + ageAdjustment),
  );
  const signingBonus = Math.max(
    25_000,
    roundMoney(newWage * years * 0.7, 5_000),
  );

  return {
    years,
    newWage,
    signingBonus,
    budgetAfter: club.budget - signingBonus,
  };
}

export function renewContract(
  game: GameState,
  playerId: string,
  years: number,
): { state: GameState; error?: ContractError; offer?: RenewalOffer } {
  const club = game.clubs[game.clubId];
  const player = game.players[playerId];
  if (!club || !player) return { state: game, error: 'player-not-found' };
  if (!club.playerIds.includes(playerId)) return { state: game, error: 'not-owned' };

  const offer = getRenewalOffer(game, playerId, years);
  if (!offer) return { state: game, error: 'invalid-years' };
  if (club.budget < offer.signingBonus) {
    return { state: game, error: 'not-enough-budget', offer };
  }

  const finance = withFinanceDefaults(club);
  const currentYears = player.contract?.yearsRemaining ?? 1;
  const nextPlayer: Player = {
    ...player,
    wage: offer.newWage,
    transferListed: false,
    contract: {
      yearsRemaining: currentYears + offer.years,
      releaseClause: Math.max(
        player.contract?.releaseClause ?? 0,
        roundMoney(player.value * (2 + offer.years * 0.15), 50_000),
      ),
      role: player.contract?.role ?? getSquadRole(game, playerId),
    },
  };

  return {
    state: {
      ...game,
      clubs: {
        ...game.clubs,
        [club.id]: {
          ...club,
          budget: club.budget - offer.signingBonus,
          wages: Math.max(0, club.wages - player.wage + offer.newWage),
          finance: {
            ...finance,
            seasonContractExpenses: finance.seasonContractExpenses + offer.signingBonus,
            lastContractExpense: offer.signingBonus,
          },
        },
      },
      players: {
        ...game.players,
        [playerId]: nextPlayer,
      },
      updatedAt: new Date().toISOString(),
    },
    offer,
  };
}
