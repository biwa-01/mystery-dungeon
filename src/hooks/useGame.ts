'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { gameReducer, createInitialState } from '@/engine/gameReducer';
import { saveGame, loadGame, hasSave, deleteSave } from '@/engine/saveLoad';
import {
  GameState, GameAction, Direction, GamePhase, MenuMode,
  ItemCategory, WeaponItem, ShieldItem, RingItem, PotItem,
} from '@/types/game';

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track held keys for diagonal movement via simultaneous arrow/WASD
  const heldKeysRef = useRef<Set<string>>(new Set());

  // Auto-save every turn change + village state
  useEffect(() => {
    if (state.phase === GamePhase.Dungeon || state.phase === GamePhase.Village) {
      saveGame(state);
    }
    if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) {
      deleteSave();
    }
  }, [state.player.turnCount, state.phase, state.player.gold, state.player.inventory.length, state.storage.length]);

  // Dash continuation
  useEffect(() => {
    if (!state.dashActive || !state.dashDirection) return;
    if (state.phase !== GamePhase.Dungeon) return;
    if (state.menuMode !== MenuMode.None) return;

    // Stop dash conditions
    const adjacent = state.floor.monsters.some(m => {
      const dx = Math.abs(m.pos.x - state.player.pos.x);
      const dy = Math.abs(m.pos.y - state.player.pos.y);
      return dx <= 1 && dy <= 1;
    });

    const onItem = state.floor.items.some(
      i => i.floorPos && i.floorPos.x === state.player.pos.x && i.floorPos.y === state.player.pos.y
    );

    if (adjacent || onItem || state.player.hp < state.player.maxHp * 0.3) {
      dispatch({ type: 'DASH_STOP' });
      return;
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'MOVE', direction: state.dashDirection! });
    }, 50);
    return () => clearTimeout(timer);
  }, [state.dashActive, state.dashDirection, state.player.pos, state.phase, state.menuMode, state.floor.monsters, state.floor.items, state.player.hp, state.player.maxHp]);

  // Track held direction keys for directional attack
  const heldDirRef = useRef<Direction | null>(null);
  // #22: Key repeat throttle
  const lastKeyTimeRef = useRef(0);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    heldKeysRef.current.delete(e.key);
    const dir = getDirection(e);
    if (dir !== null && heldDirRef.current === dir) {
      heldDirRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const s = stateRef.current;
    heldKeysRef.current.add(e.key);

    // Detect diagonal via simultaneous arrow keys
    const held = heldKeysRef.current;
    const up = held.has('ArrowUp');
    const down = held.has('ArrowDown');
    const left = held.has('ArrowLeft');
    const right = held.has('ArrowRight');

    let pressedDir: Direction | null = null;
    if (up && left) pressedDir = Direction.UpLeft;
    else if (up && right) pressedDir = Direction.UpRight;
    else if (down && left) pressedDir = Direction.DownLeft;
    else if (down && right) pressedDir = Direction.DownRight;
    else pressedDir = getDirection(e);

    // Track direction keys
    if (pressedDir !== null) {
      heldDirRef.current = pressedDir;
    }

    // Title screen - handled by TitleScreen component
    if (s.phase === GamePhase.Title) {
      return;
    }

    // Game over / Victory - return to village
    if (s.phase === GamePhase.GameOver || s.phase === GamePhase.Victory) {
      if (e.key === 'Enter' || e.key === ' ') {
        dispatch({ type: 'RETURN_TO_VILLAGE' });
      }
      return;
    }

    // Village phase - handled by VillageScreen component
    if (s.phase === GamePhase.Village) {
      return;
    }

    // #6: Toggle log history with 'L' key (works in any dungeon state)
    if ((e.key === 'l' || e.key === 'L') && s.phase === GamePhase.Dungeon && s.menuMode === MenuMode.None && !e.shiftKey) {
      dispatch({ type: 'TOGGLE_LOG_HISTORY' });
      return;
    }

    // #34: Toggle minimap with 'M' key
    if (e.key === 'm' || e.key === 'M') {
      if (s.phase === GamePhase.Dungeon && s.menuMode === MenuMode.None) {
        dispatch({ type: 'TOGGLE_MINIMAP' });
        return;
      }
    }

    // #35: Toggle quest log with 'Q' key
    if (e.key === 'q' || e.key === 'Q') {
      if (s.phase === GamePhase.Dungeon && s.menuMode === MenuMode.None) {
        dispatch({ type: 'TOGGLE_QUEST_LOG' });
        return;
      }
    }

    // Menu mode
    if (s.menuMode === MenuMode.Inventory || s.menuMode === MenuMode.ItemAction) {
      handleMenuKey(e, s, dispatch);
      return;
    }

    if (s.menuMode === MenuMode.FloorMenu) {
      handleFloorMenuKey(e, s, dispatch);
      return;
    }

    // Dungeon mode
    if (s.phase !== GamePhase.Dungeon || s.menuMode !== MenuMode.None) return;

    // Close overlays if open
    if (s.showLogHistory || s.showQuestLog) {
      if (e.key === 'Escape') {
        if (s.showLogHistory) dispatch({ type: 'TOGGLE_LOG_HISTORY' });
        if (s.showQuestLog) dispatch({ type: 'TOGGLE_QUEST_LOG' });
        return;
      }
    }

    e.preventDefault();

    if (pressedDir !== null) {
      // #30: Shift+direction for dash
      if (e.shiftKey) {
        dispatch({ type: 'DASH_START', direction: pressedDir });
      } else {
        dispatch({ type: 'MOVE', direction: pressedDir });
      }
      return;
    }

    switch (e.key) {
      case ' ':
      case 'z':
      case 'a': {
        // Attack in held direction, or facing direction if no direction held
        const atkDir = heldDirRef.current ?? s.player.facing;
        dispatch({ type: 'ATTACK', direction: atkDir });
        break;
      }
      case '.':
        dispatch({ type: 'WAIT' });
        break;
      case 'Enter':
      case 'i':
        dispatch({ type: 'OPEN_INVENTORY' });
        break;
      case 'g':
      case ',':
        dispatch({ type: 'PICK_UP' });
        break;
      case '>':
      case 's':
        dispatch({ type: 'GO_STAIRS' });
        break;
      case 'Escape':
        dispatch({ type: 'DASH_STOP' });
        break;
      case 'f':
        dispatch({ type: 'OPEN_FLOOR_MENU' });
        break;
      // #32: 'R' key for quick rest
      case 'r':
      case 'R':
        dispatch({ type: 'QUICK_REST' });
        break;
      // #31: 'Tab' key to cycle through adjacent items on ground
      case 'Tab': {
        e.preventDefault();
        const footItems = s.floor.items.filter(
          it => it.floorPos && it.floorPos.x === s.player.pos.x && it.floorPos.y === s.player.pos.y
        );
        if (footItems.length > 0) {
          dispatch({ type: 'PICK_UP' });
        }
        break;
      }
      default: {
        // #33: Number keys 1-9 to quickly use inventory items by position
        const numKey = parseInt(e.key);
        if (numKey >= 1 && numKey <= 9) {
          const itemIdx = numKey - 1;
          if (itemIdx < s.player.inventory.length) {
            const item = s.player.inventory[itemIdx];
            // Quick use: use consumables, equip equipment
            if (item.category === ItemCategory.Herb ||
                item.category === ItemCategory.Scroll ||
                item.category === ItemCategory.Food) {
              dispatch({ type: 'USE_ITEM', itemId: item.id });
            } else if (item.category === ItemCategory.Staff) {
              dispatch({ type: 'USE_ITEM', itemId: item.id });
            } else if (item.category === ItemCategory.Weapon ||
                       item.category === ItemCategory.Shield ||
                       item.category === ItemCategory.Ring) {
              const equippable = item as WeaponItem | ShieldItem | RingItem;
              if (equippable.equipped) {
                dispatch({ type: 'UNEQUIP_ITEM', itemId: item.id });
              } else {
                dispatch({ type: 'EQUIP_ITEM', itemId: item.id });
              }
            }
          }
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return { state, dispatch };
}

const CATEGORY_ORDER_HOOK: ItemCategory[] = [
  ItemCategory.Weapon, ItemCategory.Shield, ItemCategory.Ring,
  ItemCategory.Arrow, ItemCategory.Staff, ItemCategory.Scroll,
  ItemCategory.Herb, ItemCategory.Pot, ItemCategory.Food,
];

/** Map visual index (in sorted/filtered inventory) to real inventory item */
function getSortedInventoryItem(state: GameState, visualIndex: number): GameState['player']['inventory'][0] | undefined {
  const { inventory } = state.player;
  const filter = state.inventoryFilter;
  const filtered = filter === 'all' ? inventory : inventory.filter(i => i.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    const ai = CATEGORY_ORDER_HOOK.indexOf(a.category);
    const bi = CATEGORY_ORDER_HOOK.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
  return sorted[visualIndex];
}

function getDirection(e: KeyboardEvent): Direction | null {
  // #33: Don't interpret number keys as directions when no shift
  // Numbers 1-9 are used for quick item use, so only use numpad-style when shifted
  switch (e.key) {
    case 'ArrowUp': case 'k': return Direction.Up;
    case 'ArrowDown': case 'j': return Direction.Down;
    case 'ArrowLeft': case 'h': return Direction.Left;
    case 'ArrowRight': return Direction.Right;
    case 'y': return Direction.UpLeft;
    case 'u': return Direction.UpRight;
    case 'b': return Direction.DownLeft;
    case 'n': return Direction.DownRight;
    default: return null;
  }
}

function handleMenuKey(e: KeyboardEvent, state: GameState, dispatch: React.Dispatch<GameAction>) {
  e.preventDefault();

  if (state.menuMode === MenuMode.Inventory) {
    switch (e.key) {
      case 'ArrowUp': case 'k':
        dispatch({ type: 'MENU_UP' });
        break;
      case 'ArrowDown': case 'j':
        dispatch({ type: 'MENU_DOWN' });
        break;
      case 'Enter': case ' ':
        if (state.player.inventory.length > 0) {
          // selectedItemIndex is visual index; pass it as-is since SELECT_ITEM
          // will transition to ItemAction mode which uses the same visual index
          dispatch({ type: 'SELECT_ITEM', index: state.selectedItemIndex });
        }
        break;
      case 'Escape': case 'i':
        dispatch({ type: 'CLOSE_MENU' });
        break;
    }
    return;
  }

  if (state.menuMode === MenuMode.ItemAction) {
    // selectedItemIndex is a visual index into the sorted inventory display
    // We need to map it to the real inventory index for item operations
    const item = getSortedInventoryItem(state, state.selectedItemIndex);
    if (!item) {
      dispatch({ type: 'CLOSE_MENU' });
      return;
    }

    const actions = getItemActions(item, state);

    // Clamp selectedMenuItem to valid range
    const menuIdx = Math.min(state.selectedMenuItem, actions.length - 1);

    switch (e.key) {
      case 'ArrowUp': case 'k':
        if (menuIdx > 0) dispatch({ type: 'MENU_UP' });
        break;
      case 'ArrowDown': case 'j':
        if (menuIdx < actions.length - 1) dispatch({ type: 'MENU_DOWN' });
        break;
      case 'Enter': case ' ': {
        const selected = actions[menuIdx];
        if (selected) {
          executeItemAction(selected.action, item, state, dispatch);
        }
        break;
      }
      case 'Escape':
        // Go back to inventory list
        dispatch({ type: 'OPEN_INVENTORY' });
        break;
    }
  }
}

function handleFloorMenuKey(e: KeyboardEvent, state: GameState, dispatch: React.Dispatch<GameAction>) {
  e.preventDefault();
  const maxFloorMenu = 2; // 拾う, 階段, 閉じる
  switch (e.key) {
    case 'Escape': case 'f':
      dispatch({ type: 'CLOSE_MENU' });
      break;
    case 'ArrowUp': case 'k':
      if (state.selectedMenuItem > 0) dispatch({ type: 'MENU_UP' });
      break;
    case 'ArrowDown': case 'j':
      if (state.selectedMenuItem < maxFloorMenu) dispatch({ type: 'MENU_DOWN' });
      break;
    case 'Enter': case ' ':
      if (state.selectedMenuItem === 0) {
        dispatch({ type: 'CLOSE_MENU' });
        dispatch({ type: 'PICK_UP' });
      } else if (state.selectedMenuItem === 1) {
        dispatch({ type: 'CLOSE_MENU' });
        dispatch({ type: 'GO_STAIRS' });
      } else {
        dispatch({ type: 'CLOSE_MENU' });
      }
      break;
  }
}

export interface ItemAction {
  label: string;
  action: string;
}

export function getItemActions(item: GameState['player']['inventory'][0], state: GameState): ItemAction[] {
  const actions: ItemAction[] = [];

  switch (item.category) {
    case ItemCategory.Weapon: {
      const w = item as WeaponItem;
      if (w.equipped) {
        actions.push({ label: 'はずす', action: 'unequip' });
      } else {
        actions.push({ label: '装備する', action: 'equip' });
      }
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    }
    case ItemCategory.Shield: {
      const s = item as ShieldItem;
      if (s.equipped) {
        actions.push({ label: 'はずす', action: 'unequip' });
      } else {
        actions.push({ label: '装備する', action: 'equip' });
      }
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    }
    case ItemCategory.Ring: {
      const r = item as RingItem;
      if (r.equipped) {
        actions.push({ label: 'はずす', action: 'unequip' });
      } else {
        actions.push({ label: '装備する', action: 'equip' });
      }
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    }
    case ItemCategory.Herb:
    case ItemCategory.Scroll:
    case ItemCategory.Food:
      actions.push({ label: '使う', action: 'use' });
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    case ItemCategory.Staff:
      actions.push({ label: '振る', action: 'use' });
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    case ItemCategory.Arrow:
      actions.push({ label: '撃つ', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    case ItemCategory.Pot: {
      const pot = item as PotItem;
      if ((pot.potType === 'storage' || pot.potType === 'synthesis') && pot.contents.length > 0) {
        actions.push({ label: '出す', action: 'takeFromPot' });
      }
      if (pot.contents.length < pot.capacity) {
        actions.push({ label: '入れる', action: 'putInPot' });
      }
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
      break;
    }
    default:
      actions.push({ label: '投げる', action: 'throw' });
      actions.push({ label: '置く', action: 'drop' });
  }

  // Put in pot option for non-pot items
  const pots = state.player.inventory.filter(
    i => i.category === ItemCategory.Pot && (i as PotItem).contents.length < (i as PotItem).capacity
  );
  if (pots.length > 0 && item.category !== ItemCategory.Pot) {
    actions.push({ label: '壺に入れる', action: 'putInPotSelect' });
  }

  actions.push({ label: '説明', action: 'info' });

  return actions;
}

function executeItemAction(action: string, item: GameState['player']['inventory'][0], state: GameState, dispatch: React.Dispatch<GameAction>) {
  switch (action) {
    case 'equip':
      dispatch({ type: 'EQUIP_ITEM', itemId: item.id });
      break;
    case 'unequip':
      dispatch({ type: 'UNEQUIP_ITEM', itemId: item.id });
      break;
    case 'use':
      dispatch({ type: 'USE_ITEM', itemId: item.id });
      break;
    case 'throw':
      dispatch({ type: 'THROW_ITEM', itemId: item.id, direction: state.player.facing });
      break;
    case 'drop':
      dispatch({ type: 'DROP_ITEM', itemId: item.id });
      break;
    case 'putInPotSelect': {
      const pots = state.player.inventory.filter(
        i => i.category === ItemCategory.Pot && (i as PotItem).contents.length < (i as PotItem).capacity
      );
      if (pots.length > 0) {
        dispatch({ type: 'PUT_IN_POT', itemId: item.id, potId: pots[0].id });
      }
      break;
    }
    case 'takeFromPot': {
      if (item.category === ItemCategory.Pot) {
        const pot = item as PotItem;
        if (pot.contents.length > 0) {
          dispatch({ type: 'TAKE_FROM_POT', potId: item.id, index: 0 });
        }
      }
      break;
    }
    default:
      dispatch({ type: 'CLOSE_MENU' });
  }
}
