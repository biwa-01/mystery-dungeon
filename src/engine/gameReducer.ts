import {
  GameState, GameAction, GamePhase, MenuMode, Player, Direction,
  DIR_VECTORS, TileType, StatusEffect, ItemCategory, CombatLog,
  WeaponItem, ShieldItem, RingItem, HerbItem, ScrollItem, StaffItem,
  PotItem, FoodItem, ArrowItem, SealType, GameItem,
} from '@/types/game';
import { generateDungeon, getSpawnPosition } from './generators/dungeon';
import { generateFloorItems, createItemFromTemplate, ITEM_TEMPLATES } from './data/items';
import { spawnMonsters } from './systems/monsters';
import { processMonsterTurns } from './systems/monsters';
import { computeFOV } from './systems/fov';
import {
  playerAttackMonster, applyTrap, resolveStatusEffects,
  throwItem, calculatePlayerAttack, calculatePlayerDefense,
  getEquippedWeapon, getEquippedShield,
} from './systems/combat';
import { SeededRandom, isWalkable, posEqual, isInRoom, clamp } from './utils';
import { getFloorMessage } from './data/atmosphere';

const MAP_WIDTH = 60;
const MAP_HEIGHT = 40;
const MAX_FLOORS = 25;
const MAX_INVENTORY = 20;

function createInitialPlayer(): Player {
  return {
    pos: { x: 0, y: 0 },
    hp: 30,
    maxHp: 30,
    attack: 3,
    defense: 2,
    level: 1,
    exp: 0,
    expToNext: 15,
    gold: 0,
    satiation: 100,
    maxSatiation: 100,
    strength: 8,
    maxStrength: 8,
    inventory: [],
    equippedWeapon: null,
    equippedShield: null,
    equippedRing: null,
    statuses: [],
    facing: Direction.Down,
    turnCount: 0,
  };
}

function generateNewFloor(state: GameState): GameState {
  const rng = new SeededRandom(state.seed + state.floorNumber * 1000);
  const floor = generateDungeon(MAP_WIDTH, MAP_HEIGHT, rng, state.floorNumber);

  // Spawn player
  const playerPos = getSpawnPosition(floor, rng);
  state.player.pos = playerPos;

  // Spawn items
  const itemCount = 3 + Math.floor(state.floorNumber / 2);
  const items = generateFloorItems(state.floorNumber, itemCount, rng);
  for (const item of items) {
    const pos = getSpawnPosition(floor, rng, [playerPos]);
    item.floorPos = pos;
    floor.items.push(item);
  }

  // Spawn monsters
  const monsterCount = Math.min(3 + Math.floor(state.floorNumber * 0.8), 12);
  const occupied = new Set([`${playerPos.x},${playerPos.y}`]);
  for (const item of floor.items) {
    if (item.floorPos) occupied.add(`${item.floorPos.x},${item.floorPos.y}`);
  }
  floor.monsters = spawnMonsters(state.floorNumber, monsterCount, rng, occupied, floor);

  state.floor = floor;
  computeFOV(state.floor, state.player.pos);

  return state;
}

export function createInitialState(): GameState {
  return {
    phase: GamePhase.Title,
    player: createInitialPlayer(),
    floor: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      tiles: [],
      rooms: [],
      items: [],
      monsters: [],
      traps: [],
      stairsPos: { x: 0, y: 0 },
      visible: [],
      explored: [],
    },
    floorNumber: 1,
    maxFloors: MAX_FLOORS,
    logs: [{ message: '不思議のダンジョンへようこそ！', turn: 0, type: 'system' }],
    menuMode: MenuMode.None,
    selectedItemIndex: 0,
    selectedMenuItem: 0,
    identifiedItems: new Set<string>(),
    itemNameMap: new Map<string, string>(),
    seed: Date.now(),
    dashActive: false,
    dashDirection: null,
    animating: false,
  };
}

function addLog(state: GameState, message: string, type: CombatLog['type'] = 'info'): void {
  state.logs.push({ message, turn: state.player.turnCount, type });
  if (state.logs.length > 100) state.logs = state.logs.slice(-80);
}

function processPlayerTurn(state: GameState): void {
  state.player.turnCount++;

  // Hunger
  if (state.player.turnCount % 10 === 0) {
    const ring = state.player.equippedRing
      ? state.player.inventory.find(i => i.id === state.player.equippedRing) as RingItem | undefined
      : null;
    const hungerSlow = getEquippedWeapon(state.player)?.seals.includes(SealType.HungerSlow) ||
      getEquippedShield(state.player)?.seals.includes(SealType.HungerSlow);
    if (ring?.effect !== 'noHunger' && !hungerSlow) {
      state.player.satiation = Math.max(0, state.player.satiation - 1);
    }
  }

  // Starvation damage
  if (state.player.satiation <= 0) {
    state.player.hp -= 1;
    if (state.player.turnCount % 5 === 0) {
      addLog(state, 'お腹が減って倒れそうだ...', 'critical');
    }
  }

  // Natural HP regen
  if (state.player.satiation > 0 && state.player.turnCount % 2 === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
  }

  // Player status effects
  resolveStatusEffects(state.player);

  // Active monster spawn: maintain 3-5 monsters outside view range
  if (state.floor.monsters.length < 3 && state.player.turnCount % 3 === 0) {
    const spawnCount = Math.min(2, 5 - state.floor.monsters.length);
    const occupied = new Set(state.floor.monsters.map(m => `${m.pos.x},${m.pos.y}`));
    occupied.add(`${state.player.pos.x},${state.player.pos.y}`);
    for (const item of state.floor.items) {
      if (item.floorPos) occupied.add(`${item.floorPos.x},${item.floorPos.y}`);
    }
    const rng = new SeededRandom(state.seed + state.player.turnCount * 97);
    const newMonsters = spawnMonsters(state.floorNumber, spawnCount, rng, occupied, state.floor);
    // Only keep monsters spawned outside player view
    for (const m of newMonsters) {
      const dx = Math.abs(m.pos.x - state.player.pos.x);
      const dy = Math.abs(m.pos.y - state.player.pos.y);
      if (dx > 6 || dy > 6) {
        state.floor.monsters.push(m);
      }
    }
  }

  // Monster turns
  const monsterLogs = processMonsterTurns(state);
  state.logs.push(...monsterLogs);

  // Check death
  if (state.player.hp <= 0) {
    state.phase = GamePhase.GameOver;
    addLog(state, 'あなたは力尽きた...', 'system');
  }

  // Update FOV
  computeFOV(state.floor, state.player.pos);
}

function tryMove(state: GameState, direction: Direction): boolean {
  if (state.player.statuses.some(s => s.type === StatusEffect.Paralysis)) {
    addLog(state, '金縛りで動けない！', 'critical');
    processPlayerTurn(state);
    return true;
  }

  if (state.player.statuses.some(s => s.type === StatusEffect.Sleep)) {
    addLog(state, '眠っていて動けない...', 'info');
    processPlayerTurn(state);
    return true;
  }

  // Confusion: random direction
  let actualDir = direction;
  if (state.player.statuses.some(s => s.type === StatusEffect.Confusion)) {
    actualDir = Math.floor(Math.random() * 8) as Direction;
  }

  state.player.facing = actualDir;
  const vec = DIR_VECTORS[actualDir];
  const nx = state.player.pos.x + vec.x;
  const ny = state.player.pos.y + vec.y;

  // Diagonal movement wall check
  if (vec.x !== 0 && vec.y !== 0) {
    if (!isWalkable(state.floor, state.player.pos.x + vec.x, state.player.pos.y) ||
        !isWalkable(state.floor, state.player.pos.x, state.player.pos.y + vec.y)) {
      return false;
    }
  }

  // Attack monster if present
  const monster = state.floor.monsters.find(m => m.pos.x === nx && m.pos.y === ny);
  if (monster) {
    const logs = playerAttackMonster(state, monster);
    state.logs.push(...logs);
    processPlayerTurn(state);
    return true;
  }

  if (!isWalkable(state.floor, nx, ny)) {
    return false;
  }

  state.player.pos = { x: nx, y: ny };

  // Check traps
  const trap = state.floor.traps.find(
    t => t.pos.x === nx && t.pos.y === ny && !t.visible
  );
  if (trap) {
    const logs = applyTrap(state, trap);
    state.logs.push(...logs);
  }

  processPlayerTurn(state);
  return true;
}

function useItem(state: GameState, itemId: string): void {
  const idx = state.player.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const item = state.player.inventory[idx];

  switch (item.category) {
    case ItemCategory.Herb: {
      const herb = item as HerbItem;
      if (herb.effect === 'heal' || herb.effect === 'bigHeal') {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + herb.hpRestore);
        addLog(state, `${herb.name}を飲んだ。HPが${herb.hpRestore}回復した。`, 'heal');
      } else if (herb.effect === 'maxHpUp') {
        state.player.maxHp += 5;
        state.player.hp += 5;
        addLog(state, `${herb.name}を飲んだ。最大HPが5上がった！`, 'heal');
      } else if (herb.effect === 'strengthUp') {
        state.player.strength = Math.min(state.player.strength + 1, 99);
        state.player.maxStrength = Math.max(state.player.maxStrength, state.player.strength);
        addLog(state, `${herb.name}を飲んだ。ちからが1上がった！`, 'heal');
      } else if (herb.effect === 'poison') {
        state.player.hp = Math.max(1, state.player.hp - 5);
        state.player.strength = Math.max(0, state.player.strength - 1);
        addLog(state, `${herb.name}を飲んだ。毒だった！`, 'critical');
      } else if (herb.effect === 'confusion') {
        state.player.statuses.push({ type: StatusEffect.Confusion, remaining: 10 });
        addLog(state, `${herb.name}を飲んだ。混乱した！`, 'critical');
      } else if (herb.effect === 'sleep') {
        state.player.statuses.push({ type: StatusEffect.Sleep, remaining: 5 });
        addLog(state, `${herb.name}を飲んだ。眠ってしまった！`, 'critical');
      }
      // Identify
      state.identifiedItems.add(item.templateId);
      state.player.inventory.splice(idx, 1);
      break;
    }
    case ItemCategory.Scroll: {
      const scroll = item as ScrollItem;
      if (scroll.effect === 'identify') {
        // Identify a random unidentified item
        const unid = state.player.inventory.filter(i => !i.identified && i.id !== itemId);
        if (unid.length > 0) {
          const target = unid[Math.floor(Math.random() * unid.length)];
          target.identified = true;
          state.identifiedItems.add(target.templateId);
          const template = ITEM_TEMPLATES.find(t => t.id === target.templateId);
          if (template) target.name = template.name;
          addLog(state, `${target.name}を識別した！`, 'item');
        } else {
          addLog(state, '識別の巻物を読んだが、効果がなかった。', 'info');
        }
      } else if (scroll.effect === 'powerUp') {
        const weapon = getEquippedWeapon(state.player);
        if (weapon) {
          weapon.enhancement++;
          addLog(state, `${weapon.name}の強化値が+${weapon.enhancement}になった！`, 'item');
        } else {
          addLog(state, 'パワーアップの巻物を読んだ。しかし武器を装備していない。', 'info');
        }
      } else if (scroll.effect === 'confuseAll') {
        for (const m of state.floor.monsters) {
          if (state.floor.visible[m.pos.y]?.[m.pos.x]) {
            m.statuses.push({ type: StatusEffect.Confusion, remaining: 20 });
          }
        }
        addLog(state, '混乱の巻物を読んだ！ 周囲のモンスターが混乱した！', 'item');
      } else if (scroll.effect === 'removeCurse') {
        for (const inv of state.player.inventory) {
          if (inv.cursed) {
            inv.cursed = false;
          }
        }
        addLog(state, 'おはらいの巻物を読んだ。呪いが解けた！', 'item');
      } else if (scroll.effect === 'bigRoom') {
        // Convert all walls between rooms to floor
        for (let y = 1; y < state.floor.height - 1; y++) {
          for (let x = 1; x < state.floor.width - 1; x++) {
            if (state.floor.tiles[y][x] === TileType.Wall) {
              state.floor.tiles[y][x] = TileType.Floor;
            }
          }
        }
        state.floor.rooms = [{ x: 1, y: 1, width: state.floor.width - 2, height: state.floor.height - 2, connected: true }];
        addLog(state, '大部屋の巻物を読んだ！ 壁が崩れ落ちた！', 'item');
      } else if (scroll.effect === 'sanctuary') {
        addLog(state, '聖域の巻物を足元に置いた。モンスターは近づけない！', 'item');
        // Place on floor as sanctuary
      } else {
        addLog(state, `${scroll.name}を読んだ。`, 'item');
      }
      state.identifiedItems.add(item.templateId);
      state.player.inventory.splice(idx, 1);
      break;
    }
    case ItemCategory.Food: {
      const food = item as FoodItem;
      state.player.satiation = Math.min(state.player.maxSatiation, state.player.satiation + food.satiation);
      addLog(state, `${food.name}を食べた。満腹度が${food.satiation}回復した。`, 'heal');
      state.player.inventory.splice(idx, 1);
      break;
    }
    default:
      addLog(state, `${item.name}は使えない。`, 'info');
  }
  processPlayerTurn(state);
}

function useStaff(state: GameState, itemId: string, direction: Direction): void {
  const idx = state.player.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const staff = state.player.inventory[idx] as StaffItem;
  if (staff.charges <= 0) {
    addLog(state, `${staff.name}は回数が残っていない。`, 'info');
    return;
  }

  staff.charges--;
  state.identifiedItems.add(staff.templateId);
  state.player.facing = direction;

  const vec = DIR_VECTORS[direction];
  // Find first monster in line
  let cx = state.player.pos.x;
  let cy = state.player.pos.y;
  let targetMonster = null;
  for (let d = 0; d < 10; d++) {
    cx += vec.x;
    cy += vec.y;
    if (!isWalkable(state.floor, cx, cy)) break;
    const m = state.floor.monsters.find(m => m.pos.x === cx && m.pos.y === cy);
    if (m) { targetMonster = m; break; }
  }

  if (!targetMonster) {
    addLog(state, `${staff.name}を振った。しかし何も当たらなかった。`, 'info');
    processPlayerTurn(state);
    return;
  }

  switch (staff.effect) {
    case 'knockback': {
      let kx = targetMonster.pos.x;
      let ky = targetMonster.pos.y;
      for (let d = 0; d < 5; d++) {
        const nx = kx + vec.x;
        const ny = ky + vec.y;
        if (!isWalkable(state.floor, nx, ny)) {
          targetMonster.hp -= 5;
          addLog(state, `${targetMonster.name}は壁にぶつかった！ 5のダメージ！`, 'damage');
          break;
        }
        kx = nx;
        ky = ny;
      }
      targetMonster.pos = { x: kx, y: ky };
      addLog(state, `${targetMonster.name}を吹き飛ばした！`, 'item');
      break;
    }
    case 'slow':
      targetMonster.speed = Math.max(0, targetMonster.speed - 1);
      addLog(state, `${targetMonster.name}の足が遅くなった！`, 'item');
      break;
    case 'paralysis':
      targetMonster.statuses.push({ type: StatusEffect.Paralysis, remaining: 15 });
      addLog(state, `${targetMonster.name}はかなしばりになった！`, 'item');
      break;
    case 'seal':
      targetMonster.statuses.push({ type: StatusEffect.Sealed, remaining: 50 });
      addLog(state, `${targetMonster.name}の能力を封印した！`, 'item');
      break;
    case 'warp': {
      const rooms = state.floor.rooms;
      if (rooms.length > 0) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        targetMonster.pos = {
          x: room.x + Math.floor(Math.random() * room.width),
          y: room.y + Math.floor(Math.random() * room.height),
        };
        addLog(state, `${targetMonster.name}はどこかへ飛ばされた！`, 'item');
      }
      break;
    }
  }
  processPlayerTurn(state);
}

// Synthesis system for pots
function handleSynthesisPot(pot: PotItem, state: GameState): void {
  if (pot.potType !== 'synthesis' || pot.contents.length < 2) return;

  const weapons = pot.contents.filter(i => i.category === ItemCategory.Weapon) as WeaponItem[];
  const shields = pot.contents.filter(i => i.category === ItemCategory.Shield) as ShieldItem[];

  if (weapons.length >= 2) {
    const base = weapons[0];
    for (let i = 1; i < weapons.length; i++) {
      base.enhancement += weapons[i].enhancement;
      for (const seal of weapons[i].seals) {
        if (base.seals.length < base.maxSeals && !base.seals.includes(seal)) {
          base.seals.push(seal);
        }
      }
    }
    pot.contents = [base, ...pot.contents.filter(i => i.category !== ItemCategory.Weapon)];
    addLog(state, `武器が合成された！ ${base.name}+${base.enhancement}`, 'item');
  }

  if (shields.length >= 2) {
    const base = shields[0];
    for (let i = 1; i < shields.length; i++) {
      base.enhancement += shields[i].enhancement;
      for (const seal of shields[i].seals) {
        if (base.seals.length < base.maxSeals && !base.seals.includes(seal)) {
          base.seals.push(seal);
        }
      }
    }
    pot.contents = [base, ...pot.contents.filter(i => i.category !== ItemCategory.Shield)];
    addLog(state, `盾が合成された！ ${base.name}+${base.enhancement}`, 'item');
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const newState = { ...state, player: { ...state.player }, floor: { ...state.floor }, logs: [...state.logs] };

  switch (action.type) {
    case 'START_GAME': {
      const fresh = createInitialState();
      fresh.phase = GamePhase.Dungeon;
      fresh.seed = Date.now();
      // Give starting items
      const startWeapon = createItemFromTemplate('wooden_sword', true);
      const startShield = createItemFromTemplate('wooden_shield', true);
      const startFood = createItemFromTemplate('big_riceball', true);
      if (startWeapon) fresh.player.inventory.push(startWeapon);
      if (startShield) fresh.player.inventory.push(startShield);
      if (startFood) fresh.player.inventory.push(startFood);
      generateNewFloor(fresh);
      addLog(fresh, `不思議のダンジョン 地下${fresh.floorNumber}F`, 'system');
      addLog(fresh, getFloorMessage(fresh.floorNumber), 'info');
      return fresh;
    }

    case 'LOAD_GAME':
      return action.state;

    case 'RETURN_TO_TITLE':
      return createInitialState();

    case 'MOVE': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      newState.dashActive = false;
      newState.dashDirection = null;
      tryMove(newState, action.direction);
      return newState;
    }

    case 'WAIT': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      addLog(newState, '足踏みをした。', 'info');
      processPlayerTurn(newState);
      return newState;
    }

    case 'DASH_START': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      const moved = tryMove(newState, action.direction);
      if (moved) {
        newState.dashActive = true;
        newState.dashDirection = action.direction;
      }
      return newState;
    }

    case 'DASH_STOP':
      newState.dashActive = false;
      newState.dashDirection = null;
      return newState;

    case 'PICK_UP': {
      if (newState.phase !== GamePhase.Dungeon) return state;
      const itemOnFloor = newState.floor.items.find(
        i => i.floorPos && posEqual(i.floorPos, newState.player.pos)
      );
      if (!itemOnFloor) {
        addLog(newState, '足元には何もない。', 'info');
        return newState;
      }
      if (itemOnFloor.category === ItemCategory.Gold) {
        newState.player.gold += (itemOnFloor as { amount: number }).amount;
        addLog(newState, `${(itemOnFloor as { amount: number }).amount}ゴールドを拾った。`, 'item');
        newState.floor.items = newState.floor.items.filter(i => i.id !== itemOnFloor.id);
      } else if (newState.player.inventory.length >= MAX_INVENTORY) {
        addLog(newState, '持ち物がいっぱいで拾えない。', 'info');
      } else {
        // Check if identified
        if (newState.identifiedItems.has(itemOnFloor.templateId)) {
          itemOnFloor.identified = true;
          const tmpl = ITEM_TEMPLATES.find(t => t.id === itemOnFloor.templateId);
          if (tmpl) itemOnFloor.name = tmpl.name;
        }
        delete itemOnFloor.floorPos;
        newState.player.inventory.push(itemOnFloor);
        newState.floor.items = newState.floor.items.filter(i => i.id !== itemOnFloor.id);
        addLog(newState, `${itemOnFloor.name}を拾った。`, 'item');
      }
      processPlayerTurn(newState);
      return newState;
    }

    case 'GO_STAIRS': {
      if (newState.phase !== GamePhase.Dungeon) return state;
      if (!posEqual(newState.player.pos, newState.floor.stairsPos)) {
        addLog(newState, 'ここに階段はない。', 'info');
        return newState;
      }
      if (newState.floorNumber >= MAX_FLOORS) {
        newState.phase = GamePhase.Victory;
        addLog(newState, '不思議のダンジョンを踏破した！', 'system');
        return newState;
      }
      newState.floorNumber++;
      generateNewFloor(newState);
      addLog(newState, `地下${newState.floorNumber}Fに降りた。`, 'system');
      addLog(newState, getFloorMessage(newState.floorNumber), 'info');
      return newState;
    }

    case 'OPEN_INVENTORY':
      if (newState.phase !== GamePhase.Dungeon) return state;
      newState.menuMode = MenuMode.Inventory;
      newState.selectedItemIndex = 0;
      newState.selectedMenuItem = 0;
      return newState;

    case 'CLOSE_MENU':
      newState.menuMode = MenuMode.None;
      newState.selectedItemIndex = 0;
      newState.selectedMenuItem = 0;
      return newState;

    case 'SELECT_ITEM':
      newState.selectedItemIndex = action.index;
      newState.menuMode = MenuMode.ItemAction;
      newState.selectedMenuItem = 0;
      return newState;

    case 'MENU_UP':
      if (newState.menuMode === MenuMode.Inventory) {
        newState.selectedItemIndex = Math.max(0, newState.selectedItemIndex - 1);
      } else if (newState.menuMode === MenuMode.ItemAction) {
        newState.selectedMenuItem = Math.max(0, newState.selectedMenuItem - 1);
      }
      return newState;

    case 'MENU_DOWN':
      if (newState.menuMode === MenuMode.Inventory) {
        newState.selectedItemIndex = Math.min(
          newState.player.inventory.length - 1,
          newState.selectedItemIndex + 1
        );
      } else if (newState.menuMode === MenuMode.ItemAction) {
        newState.selectedMenuItem = Math.min(5, newState.selectedMenuItem + 1);
      }
      return newState;

    case 'EQUIP_ITEM': {
      const item = newState.player.inventory.find(i => i.id === action.itemId);
      if (!item) return state;
      if (item.category === ItemCategory.Weapon) {
        const w = item as WeaponItem;
        // Unequip previous
        if (newState.player.equippedWeapon) {
          const prev = newState.player.inventory.find(i => i.id === newState.player.equippedWeapon) as WeaponItem | undefined;
          if (prev) prev.equipped = false;
        }
        w.equipped = true;
        newState.player.equippedWeapon = w.id;
        addLog(newState, `${w.name}を装備した。`, 'item');
      } else if (item.category === ItemCategory.Shield) {
        const s = item as ShieldItem;
        if (newState.player.equippedShield) {
          const prev = newState.player.inventory.find(i => i.id === newState.player.equippedShield) as ShieldItem | undefined;
          if (prev) prev.equipped = false;
        }
        s.equipped = true;
        newState.player.equippedShield = s.id;
        addLog(newState, `${s.name}を装備した。`, 'item');
      } else if (item.category === ItemCategory.Ring) {
        const r = item as RingItem;
        if (newState.player.equippedRing) {
          const prev = newState.player.inventory.find(i => i.id === newState.player.equippedRing) as RingItem | undefined;
          if (prev) prev.equipped = false;
        }
        r.equipped = true;
        newState.player.equippedRing = r.id;
        addLog(newState, `${r.name}を装備した。`, 'item');
      }
      newState.menuMode = MenuMode.None;
      processPlayerTurn(newState);
      return newState;
    }

    case 'UNEQUIP_ITEM': {
      const item = newState.player.inventory.find(i => i.id === action.itemId);
      if (!item) return state;
      if (item.cursed) {
        addLog(newState, '呪われていて外せない！', 'critical');
        return newState;
      }
      if (item.category === ItemCategory.Weapon) {
        (item as WeaponItem).equipped = false;
        newState.player.equippedWeapon = null;
        addLog(newState, `${item.name}を外した。`, 'item');
      } else if (item.category === ItemCategory.Shield) {
        (item as ShieldItem).equipped = false;
        newState.player.equippedShield = null;
        addLog(newState, `${item.name}を外した。`, 'item');
      } else if (item.category === ItemCategory.Ring) {
        (item as RingItem).equipped = false;
        newState.player.equippedRing = null;
        addLog(newState, `${item.name}を外した。`, 'item');
      }
      newState.menuMode = MenuMode.None;
      return newState;
    }

    case 'USE_ITEM': {
      const item = newState.player.inventory.find(i => i.id === action.itemId);
      if (!item) return state;

      if (item.category === ItemCategory.Staff) {
        // Need direction - for now, use facing direction
        useStaff(newState, action.itemId, newState.player.facing);
      } else {
        useItem(newState, action.itemId);
      }
      newState.menuMode = MenuMode.None;
      return newState;
    }

    case 'THROW_ITEM': {
      const idx = newState.player.inventory.findIndex(i => i.id === action.itemId);
      if (idx === -1) return state;
      const item = newState.player.inventory.splice(idx, 1)[0];

      if (item.category === ItemCategory.Arrow) {
        const arrow = item as ArrowItem;
        const thrown = { ...arrow, count: 1 } as ArrowItem;
        arrow.count--;
        if (arrow.count > 0) {
          newState.player.inventory.splice(idx, 0, arrow);
        }
        const logs = throwItem(newState, thrown, action.direction);
        newState.logs.push(...logs);
      } else {
        const logs = throwItem(newState, item, action.direction);
        newState.logs.push(...logs);
      }

      newState.menuMode = MenuMode.None;
      processPlayerTurn(newState);
      return newState;
    }

    case 'DROP_ITEM': {
      const idx = newState.player.inventory.findIndex(i => i.id === action.itemId);
      if (idx === -1) return state;
      const item = newState.player.inventory[idx];
      if (item.cursed && (
        item.id === newState.player.equippedWeapon ||
        item.id === newState.player.equippedShield ||
        item.id === newState.player.equippedRing
      )) {
        addLog(newState, '呪われていて置けない！', 'critical');
        return newState;
      }
      newState.player.inventory.splice(idx, 1);
      item.floorPos = { ...newState.player.pos };
      newState.floor.items.push(item);
      addLog(newState, `${item.name}を足元に置いた。`, 'item');
      if (item.id === newState.player.equippedWeapon) newState.player.equippedWeapon = null;
      if (item.id === newState.player.equippedShield) newState.player.equippedShield = null;
      if (item.id === newState.player.equippedRing) newState.player.equippedRing = null;
      newState.menuMode = MenuMode.None;
      return newState;
    }

    case 'PUT_IN_POT': {
      const pot = newState.player.inventory.find(i => i.id === action.potId) as PotItem | undefined;
      const item = newState.player.inventory.find(i => i.id === action.itemId);
      if (!pot || !item || pot.category !== ItemCategory.Pot) return state;
      if (pot.contents.length >= pot.capacity) {
        addLog(newState, '壺がいっぱいだ。', 'info');
        return newState;
      }
      newState.player.inventory = newState.player.inventory.filter(i => i.id !== action.itemId);
      pot.contents.push(item);
      addLog(newState, `${item.name}を${pot.name}に入れた。`, 'item');

      if (pot.potType === 'synthesis') {
        handleSynthesisPot(pot, newState);
      } else if (pot.potType === 'recovery') {
        // Heal on insert
        newState.player.hp = Math.min(newState.player.maxHp, newState.player.hp + 30);
        addLog(newState, 'HPが30回復した。', 'heal');
      }

      newState.menuMode = MenuMode.None;
      return newState;
    }

    case 'TAKE_FROM_POT': {
      const pot = newState.player.inventory.find(i => i.id === action.potId) as PotItem | undefined;
      if (!pot || pot.category !== ItemCategory.Pot || pot.potType !== 'storage') return state;
      if (action.index < 0 || action.index >= pot.contents.length) return state;
      if (newState.player.inventory.length >= MAX_INVENTORY) {
        addLog(newState, '持ち物がいっぱいだ。', 'info');
        return newState;
      }
      const item = pot.contents.splice(action.index, 1)[0];
      newState.player.inventory.push(item);
      addLog(newState, `${item.name}を${pot.name}から出した。`, 'item');
      newState.menuMode = MenuMode.None;
      return newState;
    }

    case 'OPEN_FLOOR_MENU':
      if (newState.phase !== GamePhase.Dungeon) return state;
      newState.menuMode = MenuMode.FloorMenu;
      newState.selectedMenuItem = 0;
      return newState;

    case 'MENU_CONFIRM': {
      // Handled by UI layer
      return state;
    }

    default:
      return state;
  }
}
