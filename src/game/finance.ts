import type { Club, ClubFinance, MatchResult } from '../domain/types';

export interface FinanceRoundDelta {
  income: number;
  expenses: number;
  net: number;
  matchdayIncome: number;
  broadcastIncome: number;
  resultBonus: number;
}

const RESULT_BONUS = {
  win: 120_000,
  draw: 50_000,
  loss: 20_000,
} as const;

export function createClubFinance(): ClubFinance {
  return {
    seasonIncome: 0,
    seasonExpenses: 0,
    lastIncome: 0,
    lastExpenses: 0,
    lastNet: 0,
    lastMatchdayIncome: 0,
    lastBroadcastIncome: 0,
    lastResultBonus: 0,
  };
}

export function ensureClubFinance(club: Club): void {
  club.finance ??= createClubFinance();
}

function getResultBonus(clubId: string, result: MatchResult): number {
  const isHome = result.homeTeamId === clubId;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;

  if (goalsFor > goalsAgainst) return RESULT_BONUS.win;
  if (goalsFor === goalsAgainst) return RESULT_BONUS.draw;
  return RESULT_BONUS.loss;
}

export function calculateRoundFinance(club: Club, result: MatchResult): FinanceRoundDelta {
  const isHome = result.homeTeamId === club.id;
  const matchdayIncome = isHome
    ? 120_000 + club.reputation * 7_000 + result.homeGoals * 15_000
    : 80_000 + club.reputation * 2_500;
  const broadcastIncome = 110_000 + club.reputation * 2_500;
  const resultBonus = getResultBonus(club.id, result);
  const income = matchdayIncome + broadcastIncome + resultBonus;
  const expenses = club.wages;
  return {
    income,
    expenses,
    net: income - expenses,
    matchdayIncome,
    broadcastIncome,
    resultBonus,
  };
}

export function applyRoundFinance(clubs: Record<string, Club>, results: MatchResult[]): Record<string, Club> {
  const nextClubs = { ...clubs };

  for (const result of results) {
    const teamIds = [result.homeTeamId, result.awayTeamId];
    for (const teamId of teamIds) {
      const club = nextClubs[teamId];
      if (!club) continue;

      ensureClubFinance(club);
      const delta = calculateRoundFinance(club, result);
      const finance = club.finance!;

      nextClubs[teamId] = {
        ...club,
        budget: Math.max(0, club.budget + delta.net),
        finance: {
          seasonIncome: finance.seasonIncome + delta.income,
          seasonExpenses: finance.seasonExpenses + delta.expenses,
          lastIncome: delta.income,
          lastExpenses: delta.expenses,
          lastNet: delta.net,
          lastMatchdayIncome: delta.matchdayIncome,
          lastBroadcastIncome: delta.broadcastIncome,
          lastResultBonus: delta.resultBonus,
        },
      };
    }
  }

  return nextClubs;
}
