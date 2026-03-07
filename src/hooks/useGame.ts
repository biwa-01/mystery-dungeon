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

  // Auto-save every turn change
  useEffect(() => {
    if (state.phase === GamePhase.Dungeon) {
      saveGame(state);
    }
    if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) {
      deleteSave();
    }
  }, [state.player.turnCount, state.phase]);

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const s = stateRef.current;

    // Title screen
    if (s.phase === GamePhase.Title) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (hasSave()) {
          const saved = loadGame();
          if (saved) {
            dispatch({ type: 'LOAD_GAME', state: saved });
            return;
          }
        }
        dispatch({ type: 'START_GAME' });
      }
      return;
    }

    // Game over / Victory
    if (s.phase === GamePhase.GameOver || s.phase === GamePhase.Victory) {
      if (e.key === 'Enter' || e.key === ' ') {
        dispatch({ type: 'RETURN_TO_TITLE' });
      }
      return;
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

    e.preventDefault();

    const dir = getDirection(e);
    if (dir !== null) {
      if (e.shiftKey) {
        dispatch({ type: 'DASH_START', direction: dir });
      } else {
        dispatch({ type: 'MOVE', direction: dir });
      }
      return;
    }

    switch (e.key) {
      case ' ':
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
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { state, dispatch };
}

function getDirection(e: KeyboardEvent): Direction | null {
  switch (e.key) {
    case 'ArrowUp': case 'k': case '8': return Direction.Up;
    case 'ArrowDown': case 'j': case '2': return Direction.Down;
    case 'ArrowLeft': case 'h': case '4': return Direction.Left;
    case 'ArrowRight': case 'l': case '6': return Direction.Right;
    case 'y': case '7': return Direction.UpLeft;
    case 'u': case '9': return Direction.UpRight;
    case 'b': case '1': return Direction.DownLeft;
    case 'n': case '3': return Direction.DownRight;
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
    const item = state.player.inventory[state.selectedItemIndex];
    if (!item) {
      dispatch({ type: 'CLOSE_MENU' });
      return;
    }

    const actions = getItemActions(item, state);

    switch (e.key) {
      case 'ArrowUp': case 'k':
        dispatch({ type: 'MENU_UP' });
        break;
      case 'ArrowDown': case 'j':
        dispatch({ type: 'MENU_DOWN' });
        break;
      case 'Enter': case ' ': {
        const selected = actions[state.selectedMenuItem];
        if (selected) {
          executeItemAction(selected.action, item, state, dispatch);
        }
        break;
      }
      case 'Escape':
        dispatch({ type: 'SELECT_ITEM', index: -1 });
        dispatch({ type: 'CLOSE_MENU' });
        // Go back to inventory
        const ns = { ...state };
        ns.menuMode = MenuMode.Inventory;
        // dispatch won't handle this cleanly, just close
        dispatch({ type: 'CLOSE_MENU' });
        dispatch({ type: 'OPEN_INVENTORY' });
        break;
    }
  }
}

function handleFloorMenuKey(e: KeyboardEvent, state: GameState, dispatch: React.Dispatch<GameAction>) {
  e.preventDefault();
  switch (e.key) {
    case 'Escape': case 'f':
      dispatch({ type: 'CLOSE_MENU' });
      break;
    case 'ArrowUp': case 'k':
      dispatch({ type: 'MENU_UP' });
      break;
    case 'ArrowDown': case 'j':
      dispatch({ type: 'MENU_DOWN' });
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
      if (pot.potType === 'storage' && pot.contents.length > 0) {
        actions.push({ label: '出す', action: 'takeFromPot' });
      }
      actions.push({ label: '入れる', action: 'putInPot' });
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
