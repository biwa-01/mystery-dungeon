import { GameState } from '@/types/game';

const SAVE_KEY = 'mystery_dungeon_save';

function serializeState(state: GameState): string {
  const serializable = {
    ...state,
    identifiedItems: Array.from(state.identifiedItems),
    itemNameMap: Array.from(state.itemNameMap.entries()),
  };
  return JSON.stringify(serializable);
}

function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    identifiedItems: new Set(parsed.identifiedItems),
    itemNameMap: new Map(parsed.itemNameMap),
  };
}

export function saveGame(state: GameState): boolean {
  try {
    const data = serializeState(state);
    localStorage.setItem(SAVE_KEY, data);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    return deserializeState(data);
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
