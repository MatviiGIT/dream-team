import type { GameState } from '../domain/types';

const STORAGE_KEY = 'dream-team:career:v1';

export function saveGame(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.saveVersion !== 1 || !parsed.clubs || !parsed.players || !parsed.fixtures) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function deleteGame(): void {
  localStorage.removeItem(STORAGE_KEY);
}
