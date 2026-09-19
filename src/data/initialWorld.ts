import type { Club, Player, TableRow, Tactics } from '../domain/types';
import { createClubFinance } from '../game/finance';

const squadPositions = ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD'] as const;

const defaultTactics: Tactics = {
  formation: '4-3-3',
  mentality: 'Balanced',
  tempo: 'Normal',
  pressing: 'Medium',
  defensiveLine: 'Normal',
  width: 'Balanced',
};

const clubSeeds = [
  ['northbridge', 'Northbridge FC', 'NBR', 'Northbridge', 78, 48_000_000, '#36d399'],
  ['eastford', 'Eastford United', 'EFD', 'Eastford', 74, 38_000_000, '#60a5fa'],
  ['redharbor', 'Red Harbor', 'RHB', 'Red Harbor', 71, 30_000_000, '#fb7185'],
  ['kingsport', 'Kingsport Athletic', 'KNG', 'Kingsport', 68, 24_000_000, '#fbbf24'],
  ['rivergate', 'Rivergate City', 'RIV', 'Rivergate', 65, 20_000_000, '#a78bfa'],
  ['oakvale', 'Oakvale Rovers', 'OKV', 'Oakvale', 62, 16_000_000, '#34d399'],
  ['southbank', 'Southbank FC', 'SBK', 'Southbank', 59, 12_000_000, '#f97316'],
  ['lakeside', 'Lakeside Albion', 'LAK', 'Lakeside', 56, 9_000_000, '#38bdf8'],
] as const;

const firstNames = [
  'Alex', 'Milan', 'Jonas', 'Noah', 'Leon', 'Elias', 'Luca', 'Theo', 'Adam', 'Niko',
  'Daniel', 'Mateo', 'Felix', 'Samir', 'David', 'Oscar', 'Emil', 'Leo', 'Adrian', 'Robin',
];

const lastNames = [
  'Meyer', 'Berg', 'Kovac', 'Silva', 'Rossi', 'Novak', 'Turner', 'Fischer', 'Costa', 'Moretti',
  'Jensen', 'Keller', 'Santos', 'Hart', 'Weber', 'Duarte', 'Lind', 'Parker', 'Varga', 'Mills',
];

function makePlayer(clubIndex: number, playerIndex: number, clubReputation: number): Player {
  const position = squadPositions[playerIndex % squadPositions.length];
  const base = Math.max(48, clubReputation - 5 + ((playerIndex * 7 + clubIndex * 3) % 10));
  const age = 18 + ((clubIndex * 5 + playerIndex * 3) % 16);
  const pace = Math.min(94, base + ((playerIndex * 5) % 14));
  const technical = Math.min(94, base + ((playerIndex * 3 + 4) % 13));
  const defending = position === 'DEF' ? Math.min(95, base + 8) : Math.min(90, base + ((playerIndex + 2) % 8));
  const shooting = position === 'FWD' ? Math.min(96, base + 11) : Math.min(88, base + ((playerIndex * 2) % 9));
  const goalkeeper = position === 'GK' ? Math.min(96, base + 13) : 15 + ((playerIndex * 4) % 25);
  const overall = Math.round((pace + technical + defending + shooting + goalkeeper) / 5);

  return {
    id: `player_${clubIndex}_${playerIndex}`,
    name: `${firstNames[(clubIndex * 3 + playerIndex) % firstNames.length]} ${lastNames[(clubIndex * 7 + playerIndex * 2) % lastNames.length]}`,
    age,
    position,
    overall,
    potential: Math.min(95, overall + (age < 23 ? 10 : age < 27 ? 5 : 1)),
    preferredFoot: (playerIndex + clubIndex) % 3 === 0 ? 'L' : 'R',
    value: Math.max(350_000, Math.round(overall * overall * 7_500)),
    wage: Math.max(900, Math.round(overall * 85)),
    attributes: {
      pace,
      shooting,
      passing: technical,
      technique: technical,
      dribbling: Math.min(94, technical + ((playerIndex + 3) % 7)),
      defending,
      physical: Math.min(94, base + ((playerIndex * 4) % 11)),
      stamina: Math.min(94, base + 4 + ((playerIndex * 2) % 9)),
      positioning: Math.min(95, base + ((playerIndex * 5) % 10)),
      mentality: Math.min(95, base + 3 + ((clubIndex + playerIndex) % 10)),
      goalkeeper,
    },
    form: 0,
    morale: 75,
    fitness: 100,
    goals: 0,
    assists: 0,
    appearances: 0,
  };
}

const defaultStartingXI: Record<Tactics['formation'], Position[]> = {
  '4-3-3': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
  '4-4-2': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '4-2-3-1': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
};

function buildStartingXI(
  playerIds: string[],
  players: Record<string, Player>,
  formation: Tactics['formation'],
): string[] {
  const unused = new Set(playerIds);
  const lineup: string[] = [];

  for (const position of defaultStartingXI[formation]) {
    const exact = playerIds.find((id) => unused.has(id) && players[id]?.position === position);
    if (exact) {
      lineup.push(exact);
      unused.delete(exact);
    }
  }

  if (lineup.length < 11) {
    for (const id of playerIds) {
      if (!unused.has(id)) continue;
      lineup.push(id);
      unused.delete(id);
      if (lineup.length === 11) break;
    }
  }

  return lineup;
}

function needsStartingXIRepair(
  startingXI: string[] | undefined,
  players: Record<string, Player>,
  formation: Tactics['formation'],
): boolean {
  if (!startingXI || startingXI.length !== 11) return true;
  const required = defaultStartingXI[formation];
  return required.some((position, index) => players[startingXI[index]]?.position !== position);
}

export function createInitialWorld(): { clubs: Record<string, Club>; players: Record<string, Player>; table: TableRow[] } {
  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};

  clubSeeds.forEach(([id, name, shortName, city, reputation, budget, color], clubIndex) => {
    const playerIds: string[] = [];
    for (let i = 0; i < squadPositions.length; i += 1) {
      const player = makePlayer(clubIndex, i, reputation);
      players[player.id] = player;
      playerIds.push(player.id);
    }
    clubs[id] = {
      id,
      name,
      shortName,
      city,
      reputation,
      budget,
      wages: playerIds.reduce((sum, playerId) => sum + players[playerId].wage, 0),
      finance: createClubFinance(),
      playerIds,
      startingXI: buildStartingXI(playerIds, players, '4-3-3'),
      tactic: { ...defaultTactics },
      color,
    };
  });

  const table = Object.keys(clubs).map((teamId) => ({
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));

  return { clubs, players, table };
}

export function ensureSquadDepth(clubs: Record<string, Club>, players: Record<string, Player>): void {
  Object.values(clubs).forEach((club) => {
    if (club.playerIds.length >= squadPositions.length) {
      if (needsStartingXIRepair(club.startingXI, players, club.tactic.formation)) {
        club.startingXI = buildStartingXI(club.playerIds, players, club.tactic.formation);
      }
      return;
    }

    const clubIndex = Math.max(0, clubSeeds.findIndex(([id]) => id === club.id));
    for (let i = club.playerIds.length; i < squadPositions.length; i += 1) {
      const player = makePlayer(clubIndex, i, club.reputation);
      players[player.id] = player;
      club.playerIds.push(player.id);
    }

    club.startingXI = needsStartingXIRepair(club.startingXI, players, club.tactic.formation)
      ? buildStartingXI(club.playerIds, players, club.tactic.formation)
      : club.startingXI;
    club.wages = club.playerIds.reduce((sum, playerId) => sum + (players[playerId]?.wage ?? 0), 0);
  });
}

export const clubOrder = clubSeeds.map(([id]) => id);

