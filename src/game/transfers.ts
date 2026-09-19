import type { Club, GameState, Player } from '../domain/types';
import { createClubFinance } from './finance';

export type TransferError =
  | 'player-not-found'
  | 'not-enough-budget'
  | 'seller-too-small'
  | 'not-owned'
  | 'cannot-sell-starter'
  | 'squad-too-small';

export interface TransferListing {
  player: Player;
  seller: Club;
  price: number;
}

const MIN_SQUAD_SIZE = 15;
const MARKET_VALUE_SCALE = 0.18;
const SALE_VALUE_SCALE = 0.13;

function roundTransferPrice(value: number): number {
  return Math.max(250_000, Math.round(value / 50_000) * 50_000);
}

function getOwnedStartingXI(club: Club): Set<string> {
  return new Set(club.startingXI?.length === 11 ? club.startingXI : club.playerIds.slice(0, 11));
}

export function getTransferPrice(player: Player, seller: Club, buyer: Club): number {
  const ageFactor = player.age <= 22 ? 1.12 : player.age >= 30 ? 0.9 : 1;
  const potentialFactor = 1 + Math.max(0, player.potential - player.overall) * 0.01;
  const reputationFactor = 1 + Math.max(0, seller.reputation - buyer.reputation) * 0.006;
  return roundTransferPrice(
    player.value * MARKET_VALUE_SCALE * ageFactor * potentialFactor * reputationFactor,
  );
}

export function getSalePrice(player: Player): number {
  return roundTransferPrice(player.value * SALE_VALUE_SCALE);
}

export function getTransferMarket(game: GameState): TransferListing[] {
  const buyer = game.clubs[game.clubId];
  if (!buyer) return [];

  return Object.values(game.clubs)
    .filter((club) => club.id !== buyer.id)
    .flatMap((seller) => {
      const starters = getOwnedStartingXI(seller);
      return seller.playerIds
        .filter((playerId) => seller.playerIds.length > MIN_SQUAD_SIZE && !starters.has(playerId))
        .map((playerId) => {
          const player = game.players[playerId];
          if (!player) return null;
          return {
            player,
            seller,
            price: getTransferPrice(player, seller, buyer),
          };
        })
        .filter((listing): listing is TransferListing => Boolean(listing));
    })
    .sort((a, b) =>
      b.player.overall - a.player.overall ||
      b.player.potential - a.player.potential ||
      a.price - b.price,
    );
}

function withFinanceDefaults(club: Club) {
  return {
    ...createClubFinance(),
    ...(club.finance ?? {}),
  };
}

export function buyPlayer(game: GameState, playerId: string):
  { state: GameState; error?: TransferError; price?: number } {
  const buyer = game.clubs[game.clubId];
  const player = game.players[playerId];
  if (!buyer || !player) return { state: game, error: 'player-not-found' };

  const seller = Object.values(game.clubs).find((club) =>
    club.playerIds.includes(playerId) && club.id !== buyer.id,
  );
  if (!seller) return { state: game, error: 'player-not-found' };

  const starters = getOwnedStartingXI(seller);
  if (starters.has(playerId) || seller.playerIds.length <= MIN_SQUAD_SIZE) {
    return { state: game, error: 'seller-too-small' };
  }

  const price = getTransferPrice(player, seller, buyer);
  if (buyer.budget < price) {
    return { state: game, error: 'not-enough-budget' };
  }

  const sellerFinance = withFinanceDefaults(seller);
  const buyerFinance = withFinanceDefaults(buyer);
  const nextSeller: Club = {
    ...seller,
    budget: seller.budget + price,
    wages: Math.max(0, seller.wages - player.wage),
    playerIds: seller.playerIds.filter((id) => id !== playerId),
    finance: {
      ...sellerFinance,
      seasonTransferIncome: sellerFinance.seasonTransferIncome + price,
      lastTransferIncome: price,
      lastTransferExpense: 0,
    },
  };
  const nextBuyer: Club = {
    ...buyer,
    budget: buyer.budget - price,
    wages: buyer.wages + player.wage,
    playerIds: [...buyer.playerIds, playerId],
    finance: {
      ...buyerFinance,
      seasonTransferExpenses: buyerFinance.seasonTransferExpenses + price,
      lastTransferIncome: 0,
      lastTransferExpense: price,
    },
  };

  return {
    state: {
      ...game,
      clubs: {
        ...game.clubs,
        [seller.id]: nextSeller,
        [buyer.id]: nextBuyer,
      },
      updatedAt: new Date().toISOString(),
    },
    price,
  };
}

export function sellPlayer(game: GameState, playerId: string):
  { state: GameState; error?: TransferError; price?: number } {
  const club = game.clubs[game.clubId];
  const player = game.players[playerId];
  if (!club || !player) return { state: game, error: 'player-not-found' };
  if (!club.playerIds.includes(playerId)) return { state: game, error: 'not-owned' };
  if (club.startingXI?.includes(playerId)) return { state: game, error: 'cannot-sell-starter' };
  if (club.playerIds.length <= MIN_SQUAD_SIZE) return { state: game, error: 'squad-too-small' };

  const price = getSalePrice(player);
  const finance = withFinanceDefaults(club);

  return {
    state: {
      ...game,
      clubs: {
        ...game.clubs,
        [club.id]: {
          ...club,
          budget: club.budget + price,
          wages: Math.max(0, club.wages - player.wage),
          playerIds: club.playerIds.filter((id) => id !== playerId),
          finance: {
            ...finance,
            seasonTransferIncome: finance.seasonTransferIncome + price,
            lastTransferIncome: price,
            lastTransferExpense: 0,
          },
        },
      },
      updatedAt: new Date().toISOString(),
    },
    price,
  };
}
