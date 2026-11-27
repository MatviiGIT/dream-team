export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Formation = '4-3-3' | '4-4-2' | '4-2-3-1' | '4-5-1' | '3-5-2' | '3-4-3' | '5-3-2' | '5-4-1' | '4-1-4-1' | '3-4-2-1';
export type TacticalMentality = 'DEFENSIVE' | 'NEUTRAL' | 'ATTACKING';
export type TacticalPressure = 'LOW' | 'NORMAL' | 'HIGH';

export interface PlayerSkills {
  speed: number;
  passing: number;
  shooting: number;
  tackling: number;
  goalkeeping: number;
  technique?: number;
  physical?: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  nationality: string;
  skills: PlayerSkills;
  overall: number;
  potential: number;
  marketValue: number;
  wage: number;
  fitness: number;
  morale: number;
  goals: number;
  assists: number;
  appearances: number;
  careerGoals: number;
  careerAssists: number;
  careerAppearances: number;
  transferListed: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string;
  leagueId: string;
  reputation: number;
  budget: number;
  wageBill: number;
  playerIds: string[];
  startingXI: string[];
  formation: Formation;
  mentality?: TacticalMentality;
  pressure?: TacticalPressure;
  color: string;
  trophies: number;
}

export interface League {
  id: string;
  country: string;
  name: string;
  level: 1 | 2;
  clubIds: string[];
  promotionCount: number;
  relegationCount: number;
}

export interface Fixture {
  id: string;
  leagueId: string;
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

export interface MatchEvent {
  minute: number;
  teamId: string;
  playerId?: string;
  assistPlayerId?: string;
  type: 'goal' | 'chance' | 'yellow' | 'full-time';
}

export interface MatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

export interface JobOffer {
  clubId: string;
  reason: string;
}

export interface CareerHistorySeason {
  season: number;
  clubId: string;
  clubName: string;
  leagueName: string;
  position: number;
  trophies: number;
}

export interface GameState {
  saveVersion: 3;
  careerId: string;
  managerName: string;
  clubId: string;
  season: number;
  week: number;
  managerReputation: number;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  leagues: Record<string, League>;
  fixtures: Fixture[];
  tables: Record<string, TableRow[]>;
  lastMatch?: MatchResult;
  lastWeekResults: MatchResult[];
  history: CareerHistorySeason[];
  jobOffers: JobOffer[];
  createdAt: string;
  updatedAt: string;
  lastTrainingKey?: string;
}
