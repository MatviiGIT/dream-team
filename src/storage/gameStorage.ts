import type { GameState } from '../domain/types';
import { ensureSquadDepth } from '../data/initialWorld';

const STORAGE_KEY = 'dream-team:careers:v2';
const LEGACY_STORAGE_KEY = 'dream-team:career:v1';

interface LegacyGameState extends Omit<GameState, 'saveVersion' | 'careerId'> {
  saveVersion: 1;
}

export interface StoredCareer {
  id: string;
  managerName: string;
  clubName: string;
  createdAt: string;
  updatedAt: string;
  state: GameState;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `career_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readV2(): StoredCareer[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredCareer[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.state?.saveVersion === 2 && item.state.careerId)
      .map((item) => {
        ensureSquadDepth(item.state.clubs, item.state.players);
        return {
          ...item,
          createdAt: item.createdAt ?? item.state.createdAt ?? item.updatedAt,
        };
      });
  } catch {
    return [];
  }
}

function migrateLegacy(): StoredCareer[] {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const old = JSON.parse(raw) as LegacyGameState;
    if (old.saveVersion !== 1 || !old.clubs || !old.players || !old.fixtures) return [];

    const state: GameState = {
      ...old,
      saveVersion: 2,
      careerId: makeId(),
      updatedAt: old.updatedAt ?? new Date().toISOString(),
    };

    ensureSquadDepth(state.clubs, state.players);

    const career: StoredCareer = {
      id: state.careerId,
      managerName: state.managerName,
      clubName: state.clubs[state.clubId]?.name ?? 'Dream Team',
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      state,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([career]));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return [career];
  } catch {
    return [];
  }
}

export function loadCareers(): StoredCareer[] {
  const current = readV2();
  if (current.length) return [...current].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return migrateLegacy();
}

export function saveGame(state: GameState): void {
  ensureSquadDepth(state.clubs, state.players);
  const careers = loadCareers().filter((career) => career.id !== state.careerId);
  const clubName = state.clubs[state.clubId]?.name ?? 'Dream Team';

  const existing = careers.find((career) => career.id === state.careerId);
  careers.push({
    id: state.careerId,
    managerName: state.managerName,
    clubName,
    createdAt: existing?.createdAt ?? state.createdAt,
    updatedAt: state.updatedAt,
    state,
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(careers));
}

export function deleteCareer(careerId: string): void {
  const careers = loadCareers().filter((career) => career.id !== careerId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(careers));
}

export function createCareerId(): string {
  return makeId();
}
