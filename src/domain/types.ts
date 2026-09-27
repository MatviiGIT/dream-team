export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Formation = '4-3-3' | '4-4-2' | '4-2-3-1';
export type Mentality = 'Very Defensive' | 'Defensive' | 'Balanced' | 'Attacking' | 'Very Attacking';
export type Tempo = 'Slow' | 'Normal' | 'Fast';
export type Pressing = 'Low' | 'Medium' | 'High';
export type DefensiveLine = 'Low' | 'Normal' | 'High';
export type Width = 'Narrow' | 'Balanced' | 'Wide';
export type ContractRole = 'starter' | 'rotation' | 'prospect' | 'reserve';

export interface PlayerContract {
  yearsRemaining: number;
  releaseClause: number;
  role: ContractRole;
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  technique: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina: number;
  positioning: number;
  mentality: number;
  goalkeeper: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  overall: number;
  potential: number;
  preferredFoot: 'L' | 'R';
  nationality?: string;
  transferListed?: boolean;
  contract?: PlayerContract;
  value: number;
  wage: number;
  attributes: PlayerAttributes;
  form: number;
  morale: number;
  fitness: number;
  goals: number;
  assists: number;
  appearances: number;
  developmentXp?: number;
}

export interface Tactics {
  formation: Formation;
  mentality: Mentality;
  tempo: Tempo;
  pressing: Pressing;
  defensiveLine: DefensiveLine;
  width: Width;
}

export interface ClubFinance {
  seasonIncome: number;
  seasonExpenses: number;
  seasonTransferIncome: number;
  seasonTransferExpenses: number;
  seasonContractExpenses: number;
  lastIncome: number;
  lastExpenses: number;
  lastNet: number;
  lastMatchdayIncome: number;
  lastBroadcastIncome: number;
  lastResultBonus: number;
  lastTransferIncome: number;
  lastTransferExpense: number;
  lastContractExpense: number;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  reputation: number;
  budget: number;
  wages: number;
  finance?: ClubFinance;
  playerIds: string[];
  startingXI?: string[];
  tactic: Tactics;
  color: string;
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: 'goal' | 'chance' | 'yellow' | 'substitution' | 'injury' | 'half-time' | 'full-time';
  teamId: string;
  playerId?: string;
  assistPlayerId?: string;
  description: string;
}

export interface MatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

export interface Fixture {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: MatchResult;
}

export interface TableRow {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface GameState {
  saveVersion: 2;
  careerId: string;
  managerName: string;
  clubId: string;
  season: number;
  currentRound: number;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Fixture[];
  table: TableRow[];
  lastMatch?: MatchResult;
  createdAt: string;
  updatedAt: string;
  trainingUsed?: boolean;
}
