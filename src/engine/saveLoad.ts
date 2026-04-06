import { GameState, ItemCategory } from '@/types/game';

// #31: Multiple save slots (3 slots)
const SAVE_KEY_PREFIX = 'mystery_dungeon_save';
const SAVE_KEY = `${SAVE_KEY_PREFIX}_slot0`; // default slot
const SAVE_SLOT_COUNT = 3;
const BACKUP_KEY_PREFIX = 'mystery_dungeon_backup';

function getSaveKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}_slot${slot}`;
}

function serializeState(state: GameState): string {
  // Update play time before saving
  const now = Date.now();
  const elapsed = Math.floor((now - state.playTimeLastUpdate) / 1000);
  const serializable = {
    ...state,
    identifiedItems: Array.from(state.identifiedItems),
    itemNameMap: Array.from(state.itemNameMap.entries()),
    discoveredSecrets: Array.from(state.discoveredSecrets),
    discoveredItemTemplates: Array.from(state.discoveredItemTemplates),
    // #32: Save floor map state (explored tiles persist on load)
    floor: {
      ...state.floor,
      explored: state.floor.explored,
    },
    saveTimestamp: now,
    playTimeSeconds: state.playTimeSeconds + elapsed,
    playTimeLastUpdate: now,
  };
  return JSON.stringify(serializable);
}

function deserializeState(json: string): GameState | null {
  const parsed = JSON.parse(json);

  // #29: Save validation - basic integrity check
  if (!parsed.player || !parsed.floor || typeof parsed.floorNumber !== 'number') {
    return null;
  }
  if (!parsed.player.pos || typeof parsed.player.hp !== 'number' || typeof parsed.player.maxHp !== 'number') {
    return null;
  }
  if (!parsed.floor.tiles || !parsed.floor.rooms || !Array.isArray(parsed.floor.monsters)) {
    return null;
  }
  if (!parsed.phase || typeof parsed.seed !== 'number') {
    return null;
  }

  // Ensure new fields exist for old save data compatibility
  if (parsed.floor && !parsed.floor.sanctuaryTiles) {
    parsed.floor.sanctuaryTiles = [];
  }
  if (!parsed.storage) {
    parsed.storage = [];
  }
  if (!parsed.villagePos) {
    parsed.villagePos = { x: 19, y: 22 };
  }
  // New overlay states
  if (parsed.showLogHistory === undefined) parsed.showLogHistory = false;
  if (parsed.showMinimap === undefined) parsed.showMinimap = true;
  if (parsed.showQuestLog === undefined) parsed.showQuestLog = false;
  if (parsed.inventoryFilter === undefined) parsed.inventoryFilter = 'all';
  if (parsed.inventorySortMode === undefined) parsed.inventorySortMode = 'default';
  // Save metadata
  if (parsed.saveTimestamp === undefined) parsed.saveTimestamp = Date.now();
  if (parsed.playTimeSeconds === undefined) parsed.playTimeSeconds = 0;
  if (parsed.playTimeLastUpdate === undefined) parsed.playTimeLastUpdate = Date.now();
  // New game state fields
  if (parsed.monsterHouseCleared === undefined) parsed.monsterHouseCleared = false;
  if (parsed.storageCapacity === undefined) parsed.storageCapacity = 20;
  if (parsed.villageShopSeed === undefined) parsed.villageShopSeed = Date.now();

  return {
    ...parsed,
    identifiedItems: new Set(parsed.identifiedItems || []),
    itemNameMap: new Map(parsed.itemNameMap || []),
    discoveredSecrets: new Set(parsed.discoveredSecrets || []),
    discoveredItemTemplates: new Set(parsed.discoveredItemTemplates || []),
  };
}

// Default save (slot 0) - backwards compatible
export function saveGame(state: GameState): boolean {
  return saveGameToSlot(state, 0);
}

// #31: Save to specific slot
export function saveGameToSlot(state: GameState, slot: number): boolean {
  try {
    const data = serializeState(state);
    localStorage.setItem(getSaveKey(slot), data);
    // Also write to legacy key for backwards compatibility
    if (slot === 0) {
      localStorage.setItem('mystery_dungeon_save', data);
    }
    return true;
  } catch {
    return false;
  }
}

// #31: Load from specific slot
export function loadGameFromSlot(slot: number): GameState | null {
  try {
    const data = localStorage.getItem(getSaveKey(slot));
    if (!data) return null;
    return deserializeState(data);
  } catch {
    return null;
  }
}

export function loadGame(): GameState | null {
  try {
    // Try new key first, fall back to legacy
    let data = localStorage.getItem(SAVE_KEY);
    if (!data) data = localStorage.getItem('mystery_dungeon_save');
    if (!data) return null;
    return deserializeState(data);
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem('mystery_dungeon_save');
}

// #31: Delete specific slot
export function deleteSaveSlot(slot: number): void {
  localStorage.removeItem(getSaveKey(slot));
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null ||
    localStorage.getItem('mystery_dungeon_save') !== null;
}

// #31: Check if specific slot has save
export function hasSlotSave(slot: number): boolean {
  return localStorage.getItem(getSaveKey(slot)) !== null;
}

/** Get save metadata without full deserialization */
export function getSaveInfo(): { timestamp: number; playTimeSeconds: number; floorNumber: number } | null {
  return getSlotSaveInfo(0);
}

// #31: Get save info for specific slot
export function getSlotSaveInfo(slot: number): { timestamp: number; playTimeSeconds: number; floorNumber: number } | null {
  try {
    let data = localStorage.getItem(getSaveKey(slot));
    if (!data && slot === 0) data = localStorage.getItem('mystery_dungeon_save');
    if (!data) return null;
    const parsed = JSON.parse(data);
    return {
      timestamp: parsed.saveTimestamp || 0,
      playTimeSeconds: parsed.playTimeSeconds || 0,
      floorNumber: parsed.floorNumber || 1,
    };
  } catch {
    return null;
  }
}

// #33: Auto-backup save on milestone floors (separate from main save)
export function autoBackupSave(state: GameState, floor: number): boolean {
  try {
    const data = serializeState(state);
    localStorage.setItem(`${BACKUP_KEY_PREFIX}_floor${floor}`, data);
    return true;
  } catch {
    return false;
  }
}

// #33: Load backup from milestone floor
export function loadBackupSave(floor: number): GameState | null {
  try {
    const data = localStorage.getItem(`${BACKUP_KEY_PREFIX}_floor${floor}`);
    if (!data) return null;
    return deserializeState(data);
  } catch {
    return null;
  }
}

// #33: Check which backup floors exist
export function getAvailableBackups(): number[] {
  const floors = [5, 10, 15, 20, 25];
  return floors.filter(f => localStorage.getItem(`${BACKUP_KEY_PREFIX}_floor${f}`) !== null);
}
