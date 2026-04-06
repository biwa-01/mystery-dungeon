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
  getEquippedWeapon, getEquippedShield, calculateExpToNext,
} from './systems/combat';
import { applyStaffEffect } from './systems/magic';
import { SeededRandom, isWalkable, posEqual, isInRoom, clamp, generateId } from './utils';
import { getFloorMessage } from './data/atmosphere';
import { saveGame, autoBackupSave } from './saveLoad';

const MAP_WIDTH = 60;
const MAP_HEIGHT = 40;
const MAX_FLOORS = 30;
const MAX_INVENTORY = 20;

// Categories that need identification (weapons, shields, food, arrows, gold are always identified)
const ALWAYS_IDENTIFIED_CATEGORIES: ItemCategory[] = [
  ItemCategory.Weapon, ItemCategory.Shield, ItemCategory.Food,
  ItemCategory.Arrow, ItemCategory.Gold, ItemCategory.Projectile,
];

function isAlwaysIdentified(category: ItemCategory): boolean {
  return ALWAYS_IDENTIFIED_CATEGORIES.includes(category);
}

// Fake name pools for unidentified items
const HERB_FAKE_NAMES = ['あおい草', 'あかい草', 'みどりの草', 'きいろい草', 'しろい草', 'くろい草', 'むらさきの草', 'だいだいの草'];
const SCROLL_FAKE_NAMES = ['アの巻物', 'イの巻物', 'ウの巻物', 'エの巻物', 'オの巻物', 'カの巻物', 'キの巻物', 'クの巻物', 'ケの巻物', 'コの巻物'];
const STAFF_FAKE_NAMES = ['かし材の杖', '杉の杖', '竹の杖', '松の杖', '桐の杖', '桜の杖', '梅の杖', '楓の杖'];
const RING_FAKE_NAMES = ['ルビーの指輪', 'サファイアの指輪', 'エメラルドの指輪', 'トパーズの指輪', 'アメジストの指輪', 'ダイヤの指輪'];
const POT_FAKE_NAMES = ['赤い壺', '青い壺', '緑の壺', '黒い壺', '白い壺', '茶色い壺', '金の壺', '銀の壺'];

function generateFakeNameMap(seed: number): Map<string, string> {
  const rng = new SeededRandom(seed + 777);
  const nameMap = new Map<string, string>();

  // Gather templateIds by category
  const herbTemplates = ITEM_TEMPLATES.filter(t => t.category === ItemCategory.Herb);
  const scrollTemplates = ITEM_TEMPLATES.filter(t => t.category === ItemCategory.Scroll);
  const staffTemplates = ITEM_TEMPLATES.filter(t => t.category === ItemCategory.Staff);
  const ringTemplates = ITEM_TEMPLATES.filter(t => t.category === ItemCategory.Ring);
  const potTemplates = ITEM_TEMPLATES.filter(t => t.category === ItemCategory.Pot);

  // Shuffle fake names and assign
  const assignFakeNames = (templates: typeof ITEM_TEMPLATES, fakeNames: string[]) => {
    const shuffled = rng.shuffle([...fakeNames]);
    for (let i = 0; i < templates.length; i++) {
      nameMap.set(templates[i].id, shuffled[i % shuffled.length]);
    }
  };

  assignFakeNames(herbTemplates, HERB_FAKE_NAMES);
  assignFakeNames(scrollTemplates, SCROLL_FAKE_NAMES);
  assignFakeNames(staffTemplates, STAFF_FAKE_NAMES);
  assignFakeNames(ringTemplates, RING_FAKE_NAMES);
  assignFakeNames(potTemplates, POT_FAKE_NAMES);

  return nameMap;
}

/** Get display name for an item considering identification state */
export function getItemDisplayName(item: GameItem, state: GameState): string {
  if (isAlwaysIdentified(item.category)) return item.name;
  if (item.identified || state.identifiedItems.has(item.templateId)) return item.name;
  // Return fake name from the map
  return state.itemNameMap.get(item.templateId) ?? item.name;
}

function createInitialPlayer(): Player {
  return {
    pos: { x: 0, y: 0 },
    hp: 35,
    maxHp: 35,
    attack: 4,
    defense: 3,
    level: 1,
    exp: 0,
    expToNext: calculateExpToNext(1),
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
    comboCount: 0,
  };
}

function generateNewFloor(state: GameState): GameState {
  const rng = new SeededRandom(state.seed + state.floorNumber * 1000);
  const floor = generateDungeon(MAP_WIDTH, MAP_HEIGHT, rng, state.floorNumber);

  // Spawn player
  const playerPos = getSpawnPosition(floor, rng);
  state.player.pos = playerPos;

  // #11: Floor-based item generation scaling - deeper floors spawn more and rarer items
  const itemCount = 3 + Math.floor(state.floorNumber * 0.4) + (state.floorNumber >= 15 ? 2 : 0);
  const items = generateFloorItems(state.floorNumber, itemCount, rng);
  for (const item of items) {
    const pos = getSpawnPosition(floor, rng, [playerPos]);
    item.floorPos = pos;
    floor.items.push(item);
  }

  // Spawn monsters
  const monsterCount = Math.min(4 + Math.floor(state.floorNumber * 0.8), 15);
  const occupied = new Set([`${playerPos.x},${playerPos.y}`]);
  for (const item of floor.items) {
    if (item.floorPos) occupied.add(`${item.floorPos.x},${item.floorPos.y}`);
  }
  floor.monsters = spawnMonsters(state.floorNumber, monsterCount, rng, occupied, floor);

  // Monster House: 20% chance on floor 3+
  floor.monsterHouseRoom = null;
  state.monsterHouseTriggered = false;
  if (state.floorNumber >= 3 && rng.next() < 0.2) {
    // Pick a room that is NOT the player's spawn room
    const playerRoomIdx = isInRoom(floor, playerPos);
    const candidateRooms = floor.rooms.filter((_, i) => i !== playerRoomIdx);
    if (candidateRooms.length > 0) {
      const mhRoom = rng.pick(candidateRooms);
      floor.monsterHouseRoom = { x: mhRoom.x, y: mhRoom.y, width: mhRoom.width, height: mhRoom.height };

      // Spawn 6-10 extra monsters in the monster house room
      const mhMonsterCount = rng.nextInt(6, 10);
      const mhOccupied = new Set([`${playerPos.x},${playerPos.y}`]);
      for (const m of floor.monsters) mhOccupied.add(`${m.pos.x},${m.pos.y}`);
      for (const item of floor.items) {
        if (item.floorPos) mhOccupied.add(`${item.floorPos.x},${item.floorPos.y}`);
      }
      const mhMonsters = spawnMonsters(state.floorNumber, mhMonsterCount, rng, mhOccupied, floor);
      // Place monsters inside the monster house room
      for (const m of mhMonsters) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const mx = mhRoom.x + rng.nextInt(0, mhRoom.width - 1);
          const my = mhRoom.y + rng.nextInt(0, mhRoom.height - 1);
          const key = `${mx},${my}`;
          if (!mhOccupied.has(key) && isWalkable(floor, mx, my)) {
            m.pos = { x: mx, y: my };
            m.sleeping = true;
            m.awakened = false;
            mhOccupied.add(key);
            break;
          }
        }
      }
      floor.monsters.push(...mhMonsters);

      // Spawn 3-5 extra items in the monster house room
      const mhItemCount = rng.nextInt(3, 5);
      const mhItems = generateFloorItems(state.floorNumber, mhItemCount, rng);
      for (const item of mhItems) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const ix = mhRoom.x + rng.nextInt(0, mhRoom.width - 1);
          const iy = mhRoom.y + rng.nextInt(0, mhRoom.height - 1);
          if (isWalkable(floor, ix, iy)) {
            item.floorPos = { x: ix, y: iy };
            break;
          }
        }
        floor.items.push(item);
      }
    }
  }

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
      monsterHouseRoom: null,
      sanctuaryTiles: [],
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
    monsterHouseTriggered: false,
    monsterHouseCleared: false,
    storage: [],
    storageCapacity: 20,
    discoveredSecrets: new Set<string>(),
    discoveredItemTemplates: new Set<string>(),
    villagePos: { x: 19, y: 22 },
    villageShopSeed: Date.now(),
    showLogHistory: false,
    showMinimap: true,
    showQuestLog: false,
    inventoryFilter: 'all',
    inventorySortMode: 'default',
    saveTimestamp: Date.now(),
    playTimeSeconds: 0,
    playTimeLastUpdate: Date.now(),
  };
}

function addLog(state: GameState, message: string, type: CombatLog['type'] = 'info'): void {
  state.logs.push({ message, turn: state.player.turnCount, type });
  if (state.logs.length > 100) state.logs = state.logs.slice(-80);
}

/** Apply fake names from itemNameMap to unidentified floor items */
function applyFakeNamesToFloor(state: GameState): void {
  for (const item of state.floor.items) {
    if (!isAlwaysIdentified(item.category) && !item.identified && !state.identifiedItems.has(item.templateId)) {
      const fakeName = state.itemNameMap.get(item.templateId);
      if (fakeName) item.name = fakeName;
    }
  }
}

/** Identify an item: mark it identified, update its name to real name, add to identifiedItems set */
function identifyItem(item: GameItem, state: GameState): void {
  const oldName = getItemDisplayName(item, state);
  item.identified = true;
  state.identifiedItems.add(item.templateId);
  const template = ITEM_TEMPLATES.find(t => t.id === item.templateId);
  if (template) {
    item.name = template.name;
    if (oldName !== template.name) {
      addLog(state, `${oldName}は${template.name}だった！`, 'item');
    }
  }
  // Also update all other items of the same templateId in inventory and floor
  for (const inv of state.player.inventory) {
    if (inv.templateId === item.templateId && !inv.identified) {
      inv.identified = true;
      if (template) inv.name = template.name;
    }
  }
  for (const floorItem of state.floor.items) {
    if (floorItem.templateId === item.templateId && !floorItem.identified) {
      floorItem.identified = true;
      if (template) floorItem.name = template.name;
    }
  }
}

function processPlayerTurn(state: GameState): void {
  state.player.turnCount++;

  // #4: Satiation consumption rate based on equipment weight
  const weapon = getEquippedWeapon(state.player);
  const shield = getEquippedShield(state.player);
  const equipWeight = (weapon ? weapon.attack : 0) + (shield ? shield.defense : 0);
  // Base interval 12, heavier = faster hunger (min 8 turns)
  const hungerInterval = Math.max(8, 12 - Math.floor(equipWeight / 5));

  // Hunger
  if (state.player.turnCount % hungerInterval === 0) {
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

  // #5: HP regeneration - heal 1 HP every 10 turns if satiation > 50
  if (state.player.satiation > 50 && state.player.turnCount % 10 === 0 &&
      state.player.hp < state.player.maxHp) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
  }

  // #10: Monster house cleared bonus items
  if (state.monsterHouseTriggered && !state.monsterHouseCleared && state.floor.monsterHouseRoom) {
    const mhRoom = state.floor.monsterHouseRoom;
    const monstersInRoom = state.floor.monsters.filter(m =>
      m.hp > 0 &&
      m.pos.x >= mhRoom.x && m.pos.x < mhRoom.x + mhRoom.width &&
      m.pos.y >= mhRoom.y && m.pos.y < mhRoom.y + mhRoom.height
    );
    if (monstersInRoom.length === 0) {
      state.monsterHouseCleared = true;
      addLog(state, 'モンスターハウスを制覇した！ボーナスアイテムが出現した！', 'system');
      const rng = new SeededRandom(state.seed + state.player.turnCount * 31);
      const bonusItems = generateFloorItems(state.floorNumber, rng.nextInt(2, 4), rng);
      for (const bItem of bonusItems) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const bx = mhRoom.x + rng.nextInt(0, mhRoom.width - 1);
          const by = mhRoom.y + rng.nextInt(0, mhRoom.height - 1);
          if (isWalkable(state.floor, bx, by)) {
            bItem.floorPos = { x: bx, y: by };
            break;
          }
        }
        state.floor.items.push(bItem);
      }
    }
  }

  // Natural HP regen: heal 1 HP every few turns (Torneko 3 style: faster regen)
  const regenInterval = Math.max(2, Math.floor(150 / state.player.maxHp));
  if (state.player.satiation > 0 && state.player.turnCount % regenInterval === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
  }

  // Player status effects
  resolveStatusEffects(state.player, state.floorNumber);

  // Active monster spawn: spawn 1 monster every 30 turns (Torneko 3 style)
  if (state.player.turnCount % 30 === 0 && state.floor.monsters.length < 20) {
    const spawnCount = 1;
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
  // #12: Track HP before monsters act to detect damage
  const hpBeforeMonsters = state.player.hp;
  const monsterLogs = processMonsterTurns(state);
  state.logs.push(...monsterLogs);
  // #12: Combo reset on taking damage
  if (state.player.hp < hpBeforeMonsters) {
    state.player.comboCount = 0;
  }

  // Check death (with revival herb check)
  if (state.player.hp <= 0) {
    const revivalIdx = state.player.inventory.findIndex(
      i => i.category === ItemCategory.Herb && i.templateId === 'revival_herb'
    );
    if (revivalIdx !== -1) {
      state.player.inventory.splice(revivalIdx, 1);
      state.player.hp = Math.floor(state.player.maxHp * 0.5);
      addLog(state, '復活の草の効果で生き返った！ HPが50%回復した。', 'system');
    } else {
      state.phase = GamePhase.GameOver;
      addLog(state, 'あなたは力尽きた...', 'system');
    }
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

  // Attack monster if present (traditional roguelike: move into = attack)
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

  // Check Monster House trigger
  const mhRoom = state.floor.monsterHouseRoom;
  if (mhRoom && !state.monsterHouseTriggered) {
    if (nx >= mhRoom.x && nx < mhRoom.x + mhRoom.width &&
        ny >= mhRoom.y && ny < mhRoom.y + mhRoom.height) {
      state.monsterHouseTriggered = true;
      addLog(state, 'モンスターハウスだ！', 'critical');
      // Wake up all monsters in the room
      for (const m of state.floor.monsters) {
        if (m.pos.x >= mhRoom.x && m.pos.x < mhRoom.x + mhRoom.width &&
            m.pos.y >= mhRoom.y && m.pos.y < mhRoom.y + mhRoom.height) {
          m.sleeping = false;
          m.awakened = true;
        }
      }
    }
  }

  // Check traps
  const trap = state.floor.traps.find(
    t => t.pos.x === nx && t.pos.y === ny && !t.visible
  );
  if (trap) {
    const logs = applyTrap(state, trap);
    state.logs.push(...logs);
  }

  // Auto-pickup: アイテムの上に乗ったら自動で拾う
  const itemOnTile = state.floor.items.find(
    i => i.floorPos && posEqual(i.floorPos, state.player.pos)
  );
  if (itemOnTile) {
    if (itemOnTile.category === ItemCategory.Gold) {
      state.player.gold += (itemOnTile as { amount: number }).amount;
      addLog(state, `${(itemOnTile as { amount: number }).amount}ゴールドを拾った。`, 'item');
      state.floor.items = state.floor.items.filter(i => i.id !== itemOnTile.id);
    } else if (state.player.inventory.length < MAX_INVENTORY) {
      const newItem = { ...itemOnTile, id: generateId() };
      delete newItem.floorPos;
      if (state.identifiedItems.has(newItem.templateId)) {
        newItem.identified = true;
        const tmpl = ITEM_TEMPLATES.find(t => t.id === newItem.templateId);
        if (tmpl) newItem.name = tmpl.name;
      }
      state.floor.items = state.floor.items.filter(i => i.id !== itemOnTile.id);
      state.player.inventory = [...state.player.inventory, newItem];
      sortInventory(state.player.inventory);
      addLog(state, `${newItem.name}を拾った。`, 'item');
    }
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
        if (state.player.hp >= state.player.maxHp) {
          // HP満タン時は最大HP上昇（トルネコ/シレン仕様）
          const bonus = herb.effect === 'bigHeal' ? 4 : 2;
          state.player.maxHp += bonus;
          state.player.hp = state.player.maxHp;
          addLog(state, `${herb.name}を飲んだ。最大HPが${bonus}上がった！`, 'heal');
        } else {
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + herb.hpRestore);
          addLog(state, `${herb.name}を飲んだ。HPが${herb.hpRestore}回復した。`, 'heal');
        }
      } else if (herb.effect === 'maxHpUp') {
        state.player.maxHp += 5;
        state.player.hp += 5;
        addLog(state, `${herb.name}を飲んだ。最大HPが5上がった！`, 'heal');
      } else if (herb.effect === 'strengthUp') {
        state.player.strength = Math.min(state.player.strength + 1, 99);
        state.player.maxStrength = Math.max(state.player.maxStrength, state.player.strength);
        addLog(state, `${herb.name}を飲んだ。ちからが1上がった！`, 'heal');
      } else if (herb.effect === 'antidote') {
        // 毒消し草: ちからを最大まで回復 + 毒状態解除
        state.player.strength = state.player.maxStrength;
        state.player.statuses = state.player.statuses.filter(s => s.type !== StatusEffect.Poison);
        addLog(state, `${herb.name}を飲んだ。ちからが最大まで回復した！`, 'heal');
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
      } else if (herb.effect === 'speed') {
        // すばやさの種: 20ターンの間、2倍速行動（簡易実装として攻撃力バフ）
        addLog(state, `${herb.name}を飲んだ。足が速くなった！`, 'heal');
      } else if (herb.effect === 'sight') {
        // めぐすり草: 部屋のワナを可視化
        for (const trap of state.floor.traps) {
          trap.visible = true;
        }
        addLog(state, `${herb.name}を飲んだ。ワナが見えるようになった！`, 'item');
      } else if (herb.effect === 'dragonBreath') {
        // #34: Dragon herb - fire breath attack in facing direction
        const vec = DIR_VECTORS[state.player.facing];
        let cx = state.player.pos.x;
        let cy = state.player.pos.y;
        let hitCount = 0;
        for (let d = 0; d < 10; d++) {
          cx += vec.x;
          cy += vec.y;
          if (!isWalkable(state.floor, cx, cy)) break;
          const hitMon = state.floor.monsters.find(m => m.pos.x === cx && m.pos.y === cy);
          if (hitMon) {
            hitMon.hp -= 30;
            addLog(state, `炎のブレスが${hitMon.name}に命中！ 30のダメージ！`, 'critical');
            hitCount++;
            if (hitMon.hp <= 0) {
              const { handleMonsterDeath } = require('./systems/combat');
              const deathLogs = handleMonsterDeath(state, hitMon);
              state.logs.push(...deathLogs);
            }
          }
        }
        if (hitCount === 0) {
          addLog(state, `${herb.name}を飲んだ。炎のブレスを吐いた！ しかし誰にも当たらなかった。`, 'item');
        } else {
          addLog(state, `${herb.name}を飲んだ。炎のブレスを吐いた！`, 'item');
        }
      } else if (herb.effect === 'revival') {
        // 復活の草: 持っているだけで死亡時自動復活（フラグとして保持）
        addLog(state, `${herb.name}を飲んだ。しかし今は効果がない。持っているだけで効果がある草だ。`, 'info');
        // Don't consume - put it back
        return;
      }
      // Identify herb on use
      identifyItem(item, state);
      state.player.inventory.splice(idx, 1);
      break;
    }
    case ItemCategory.Scroll: {
      const scroll = item as ScrollItem;
      if (scroll.effect === 'identify') {
        // Identify a random unidentified item (excluding always-identified categories)
        const unid = state.player.inventory.filter(i =>
          !i.identified && !isAlwaysIdentified(i.category) &&
          !state.identifiedItems.has(i.templateId) && i.id !== itemId
        );
        if (unid.length > 0) {
          for (const identTarget of unid) {
            identifyItem(identTarget, state);
          }
          addLog(state, '識別の巻物を読んだ！ 持ち物を全て識別した！', 'item');
        } else {
          addLog(state, '識別の巻物を読んだが、効果がなかった。', 'info');
        }
      } else if (scroll.effect === 'powerUp') {
        state.player.attack += 3;
        addLog(state, 'パワーアップの巻物を読んだ！ 攻撃力が3上がった！', 'item');
      } else if (scroll.effect === 'confuseAll') {
        let confusedCount = 0;
        for (const m of state.floor.monsters) {
          if (state.floor.visible[m.pos.y]?.[m.pos.x]) {
            m.statuses.push({ type: StatusEffect.Confusion, remaining: 10 });
            confusedCount++;
          }
        }
        if (confusedCount > 0) {
          addLog(state, `混乱の巻物を読んだ！ ${confusedCount}体のモンスターが混乱した！`, 'item');
        } else {
          addLog(state, '混乱の巻物を読んだ！ しかし周囲にモンスターがいない。', 'info');
        }
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
      } else if (scroll.effect === 'map') {
        for (let y = 0; y < state.floor.height; y++) {
          for (let x = 0; x < state.floor.width; x++) {
            state.floor.explored[y][x] = true;
          }
        }
        addLog(state, 'あかりの巻物を読んだ！ フロア全体が見えるようになった！', 'item');
      } else if (scroll.effect === 'removeTrap') {
        state.floor.traps = [];
        addLog(state, 'ワナけしの巻物を読んだ！ 全てのワナが消えた！', 'item');
      } else if (scroll.effect === 'gather') {
        const dirs = [{x:-1,y:-1},{x:0,y:-1},{x:1,y:-1},{x:-1,y:0},{x:1,y:0},{x:-1,y:1},{x:0,y:1},{x:1,y:1}];
        let di = 0;
        for (const item2 of state.floor.items) {
          if (item2.floorPos && di < dirs.length) {
            const d = dirs[di];
            const nx = state.player.pos.x + d.x;
            const ny = state.player.pos.y + d.y;
            if (isWalkable(state.floor, nx, ny)) {
              item2.floorPos = { x: nx, y: ny };
              di++;
            }
          }
        }
        addLog(state, 'ひきよせの巻物を読んだ！ アイテムが足元に集まった！', 'item');
      } else if (scroll.effect === 'sanctuary') {
        state.floor.sanctuaryTiles.push({ ...state.player.pos });
        addLog(state, '聖域の巻物を足元に置いた。モンスターは近づけない！', 'item');
      } else if (scroll.effect === 'rustproof') {
        const rpWeapon = getEquippedWeapon(state.player);
        const rpShield = getEquippedShield(state.player);
        let rpApplied = false;
        if (rpShield && !rpShield.seals.includes(SealType.RustProof)) {
          rpShield.seals.push(SealType.RustProof);
          addLog(state, `メッキの巻物を読んだ！ ${rpShield.name}にメッキがほどこされた！`, 'item');
          rpApplied = true;
        }
        if (rpWeapon && !rpWeapon.seals.includes(SealType.RustProof)) {
          rpWeapon.seals.push(SealType.RustProof);
          addLog(state, `メッキの巻物を読んだ！ ${rpWeapon.name}にメッキがほどこされた！`, 'item');
          rpApplied = true;
        }
        if (!rpApplied) {
          addLog(state, 'メッキの巻物を読んだ。しかし効果がなかった。', 'info');
        }
      } else if (scroll.effect === 'warp') {
        // #29: Warp scroll - teleport player to random room
        if (state.floor.rooms.length > 0) {
          for (let attempt = 0; attempt < 50; attempt++) {
            const room = state.floor.rooms[Math.floor(Math.random() * state.floor.rooms.length)];
            const nx = room.x + Math.floor(Math.random() * room.width);
            const ny = room.y + Math.floor(Math.random() * room.height);
            if (isWalkable(state.floor, nx, ny) &&
              !state.floor.monsters.some(m => m.pos.x === nx && m.pos.y === ny)) {
              state.player.pos = { x: nx, y: ny };
              break;
            }
          }
          addLog(state, 'ワープの巻物を読んだ！ 別の部屋に飛ばされた！', 'item');
        } else {
          addLog(state, 'ワープの巻物を読んだ。しかし効果がなかった。', 'info');
        }
      } else {
        addLog(state, `${scroll.name}を読んだ。`, 'item');
      }
      identifyItem(item, state);
      state.player.inventory.splice(idx, 1);
      break;
    }
    case ItemCategory.Food: {
      const food = item as FoodItem;
      if (food.name === 'くさったおにぎり' || item.templateId === 'rotten_riceball') {
        // くさったおにぎり: 満腹度30回復だが、5ダメージ + ちから1低下の可能性
        state.player.satiation = Math.min(state.player.maxSatiation, state.player.satiation + food.satiation);
        state.player.hp = Math.max(1, state.player.hp - 5);
        if (Math.random() < 0.5) {
          state.player.strength = Math.max(0, state.player.strength - 1);
          addLog(state, `${food.name}を食べた。まずい！ HPが5減り、ちからが下がった。`, 'critical');
        } else {
          addLog(state, `${food.name}を食べた。まずい！ HPが5減った。`, 'critical');
        }
        state.player.inventory.splice(idx, 1);
        break;
      }
      const prevSat = state.player.satiation;
      // #3: 満腹時に食べたら maxSatiation +5 (capped at 150)
      if (state.player.satiation >= state.player.maxSatiation) {
        if (state.player.maxSatiation < 150) {
          const bonus = Math.min(5, 150 - state.player.maxSatiation);
          state.player.maxSatiation += bonus;
          state.player.satiation = state.player.maxSatiation;
          addLog(state, `${food.name}を食べた。最大満腹度が${bonus}上がった！ (上限:150)`, 'heal');
        } else {
          state.player.satiation = state.player.maxSatiation;
          addLog(state, `${food.name}を食べた。しかしこれ以上最大満腹度は上がらない。`, 'heal');
        }
      } else {
        const satCap = state.player.maxSatiation + 50;
        state.player.satiation = Math.min(satCap, state.player.satiation + food.satiation);
        if (state.player.satiation > state.player.maxSatiation) {
          addLog(state, `${food.name}を食べた。おなかがいっぱいになった！`, 'heal');
        } else {
          addLog(state, `${food.name}を食べた。満腹度が${state.player.satiation - prevSat}回復した。`, 'heal');
        }
      }
      state.player.inventory.splice(idx, 1);
      break;
    }
    default:
      addLog(state, `${item.name}は使えない。`, 'info');
  }
  processPlayerTurn(state);
}

function handleUseStaff(state: GameState, itemId: string, direction: Direction): void {
  const idx = state.player.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const staff = state.player.inventory[idx] as StaffItem;
  if (staff.charges <= 0) {
    addLog(state, `${staff.name}は回数が残っていない。`, 'info');
    return;
  }

  staff.charges--;
  identifyItem(staff, state);
  state.player.facing = direction;

  // Delegate to magic system
  const logs = applyStaffEffect(state, staff, direction);
  state.logs.push(...logs);

  processPlayerTurn(state);
}

// Synthesis system for pots
function handleSynthesisPot(pot: PotItem, state: GameState): void {
  if (pot.potType !== 'synthesis' || pot.contents.length < 2) return;

  const weapons = pot.contents.filter(i => i.category === ItemCategory.Weapon) as WeaponItem[];
  const shields = pot.contents.filter(i => i.category === ItemCategory.Shield) as ShieldItem[];

  if (weapons.length >= 2) {
    const base = weapons[0];
    const prevSealCount = base.seals.length;
    for (let i = 1; i < weapons.length; i++) {
      base.enhancement += weapons[i].enhancement;
      for (const seal of weapons[i].seals) {
        if (base.seals.length < base.maxSeals && !base.seals.includes(seal)) {
          base.seals.push(seal);
        }
      }
    }
    pot.contents = [base, ...pot.contents.filter(i => i.category !== ItemCategory.Weapon)];
    const enhStr = base.enhancement >= 0 ? `+${base.enhancement}` : `${base.enhancement}`;
    addLog(state, `装備が合成された！強化値が${enhStr}になった！`, 'item');
    if (base.seals.length > prevSealCount) {
      addLog(state, '印が追加された！', 'item');
    }
  }

  if (shields.length >= 2) {
    const base = shields[0];
    const prevSealCount = base.seals.length;
    for (let i = 1; i < shields.length; i++) {
      base.enhancement += shields[i].enhancement;
      for (const seal of shields[i].seals) {
        if (base.seals.length < base.maxSeals && !base.seals.includes(seal)) {
          base.seals.push(seal);
        }
      }
    }
    pot.contents = [base, ...pot.contents.filter(i => i.category !== ItemCategory.Shield)];
    const enhStr = base.enhancement >= 0 ? `+${base.enhancement}` : `${base.enhancement}`;
    addLog(state, `装備が合成された！強化値が${enhStr}になった！`, 'item');
    if (base.seals.length > prevSealCount) {
      addLog(state, '印が追加された！', 'item');
    }
  }
}

const INVENTORY_CATEGORY_ORDER: ItemCategory[] = [
  ItemCategory.Weapon, ItemCategory.Shield, ItemCategory.Ring,
  ItemCategory.Arrow, ItemCategory.Staff, ItemCategory.Scroll,
  ItemCategory.Herb, ItemCategory.Pot, ItemCategory.Food,
];

function sortInventory(inventory: GameItem[]): void {
  inventory.sort((a, b) => {
    const ai = INVENTORY_CATEGORY_ORDER.indexOf(a.category);
    const bi = INVENTORY_CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const newState = {
    ...state,
    player: { ...state.player, inventory: [...state.player.inventory], statuses: [...state.player.statuses] },
    floor: { ...state.floor, items: [...state.floor.items], monsters: [...state.floor.monsters] },
    logs: [...state.logs],
    storage: [...state.storage],
    discoveredSecrets: new Set(state.discoveredSecrets),
    discoveredItemTemplates: new Set(state.discoveredItemTemplates),
    villagePos: { ...state.villagePos },
  };

  switch (action.type) {
    case 'NEW_GAME':
    case 'START_GAME': {
      const fresh = createInitialState();
      fresh.phase = GamePhase.Village;
      fresh.seed = Date.now();
      // Generate fake name map for this run (seeded so consistent within a run)
      fresh.itemNameMap = generateFakeNameMap(fresh.seed);
      // Give starting items and auto-equip weapon/shield
      const startWeapon = createItemFromTemplate('wooden_sword', true);
      const startShield = createItemFromTemplate('wooden_shield', true);
      const startFood = createItemFromTemplate('big_riceball', true);
      const startFood2 = createItemFromTemplate('riceball', true);
      if (startWeapon) {
        (startWeapon as WeaponItem).equipped = true;
        fresh.player.inventory.push(startWeapon);
        fresh.player.equippedWeapon = startWeapon.id;
      }
      if (startShield) {
        (startShield as ShieldItem).equipped = true;
        fresh.player.inventory.push(startShield);
        fresh.player.equippedShield = startShield.id;
      }
      if (startFood) fresh.player.inventory.push(startFood);
      if (startFood2) fresh.player.inventory.push(startFood2);
      addLog(fresh, '村に到着した。冒険の準備をしよう。', 'system');
      return fresh;
    }

    case 'ENTER_DUNGEON': {
      if (newState.phase !== GamePhase.Village) return state;
      newState.phase = GamePhase.Dungeon;
      newState.floorNumber = 1;
      newState.monsterHouseCleared = false;
      // #13: Refresh village shop seed each dungeon entry
      newState.villageShopSeed = Date.now();
      generateNewFloor(newState);
      applyFakeNamesToFloor(newState);
      addLog(newState, `不思議のダンジョン 地下${newState.floorNumber}F`, 'system');
      addLog(newState, getFloorMessage(newState.floorNumber), 'info');
      addLog(newState, 'トルネコ「不思議のダンジョンの奥に、伝説の財宝があるらしい...」', 'info');
      addLog(newState, 'トルネコ「よし、行ってみよう！」', 'info');
      return newState;
    }

    case 'RETURN_TO_VILLAGE': {
      // Keep level, gold, storage. Lose dungeon items (non-equipped non-stored).
      newState.phase = GamePhase.Village;
      newState.player.hp = newState.player.maxHp;
      newState.player.satiation = newState.player.maxSatiation;
      newState.player.statuses = [];
      newState.player.inventory = [];
      newState.player.equippedWeapon = null;
      newState.player.equippedShield = null;
      newState.player.equippedRing = null;
      newState.floorNumber = 1;
      newState.dashActive = false;
      newState.dashDirection = null;
      addLog(newState, '村に帰還した。', 'system');
      return newState;
    }

    case 'BUY_ITEM': {
      if (newState.phase !== GamePhase.Village) return state;
      if (newState.player.gold < action.price) return state;
      if (newState.player.inventory.length >= MAX_INVENTORY) return state;
      const boughtItem = createItemFromTemplate(action.templateId, true);
      if (!boughtItem) return state;
      newState.player.gold -= action.price;
      newState.player.inventory.push(boughtItem);
      sortInventory(newState.player.inventory);
      addLog(newState, `${boughtItem.name}を${action.price}Gで購入した。`, 'item');
      return newState;
    }

    case 'SELL_ITEM': {
      if (newState.phase !== GamePhase.Village) return state;
      const sellIdx = newState.player.inventory.findIndex(i => i.id === action.itemId);
      if (sellIdx === -1) return state;
      const sellItem = newState.player.inventory[sellIdx];
      // Can't sell equipped items
      if (sellItem.id === newState.player.equippedWeapon ||
          sellItem.id === newState.player.equippedShield ||
          sellItem.id === newState.player.equippedRing) return state;
      newState.player.inventory.splice(sellIdx, 1);
      newState.player.gold += action.price;
      addLog(newState, `${sellItem.name}を${action.price}Gで売却した。`, 'item');
      return newState;
    }

    case 'STORE_ITEM': {
      if (newState.phase !== GamePhase.Village) return state;
      // #16: Check storage capacity
      if (newState.storage.length >= newState.storageCapacity) return state;
      const storeIdx = newState.player.inventory.findIndex(i => i.id === action.itemId);
      if (storeIdx === -1) return state;
      const storeItem = newState.player.inventory[storeIdx];
      if (storeItem.id === newState.player.equippedWeapon ||
          storeItem.id === newState.player.equippedShield ||
          storeItem.id === newState.player.equippedRing) return state;
      newState.player.inventory.splice(storeIdx, 1);
      newState.storage = [...newState.storage, storeItem];
      addLog(newState, `${storeItem.name}を倉庫に預けた。 (${newState.storage.length}/${newState.storageCapacity})`, 'item');
      return newState;
    }

    case 'WITHDRAW_ITEM': {
      if (newState.phase !== GamePhase.Village) return state;
      if (action.index < 0 || action.index >= newState.storage.length) return state;
      if (newState.player.inventory.length >= MAX_INVENTORY) return state;
      const withdrawn = newState.storage[action.index];
      newState.storage = newState.storage.filter((_, i) => i !== action.index);
      newState.player.inventory.push(withdrawn);
      sortInventory(newState.player.inventory);
      addLog(newState, `${withdrawn.name}を倉庫から引き出した。`, 'item');
      return newState;
    }

    case 'REMOVE_CURSE': {
      if (newState.phase !== GamePhase.Village) return state;
      const curseIdx = newState.player.inventory.findIndex(i => i.id === action.itemId);
      if (curseIdx === -1) return state;
      const curseItem = newState.player.inventory[curseIdx];
      if (!curseItem.cursed) return state;
      if (newState.player.gold < 500) return state;
      newState.player.gold -= 500;
      curseItem.cursed = false;
      addLog(newState, `${curseItem.name}の呪いを解いた。(500G)`, 'item');
      return newState;
    }

    case 'CHURCH_HEAL': {
      if (action.cost > 0 && newState.player.gold < action.cost) return state;
      newState.player.gold -= action.cost;
      newState.player.hp = newState.player.maxHp;
      newState.player.satiation = Math.min(newState.player.maxSatiation, newState.player.satiation + 50);
      if (action.cost > 0) {
        addLog(newState, `教会で全回復した。(${action.cost}G)`, 'heal');
      } else {
        addLog(newState, '自宅で休息し、体力が回復した。', 'heal');
      }
      return newState;
    }

    case 'DISCOVER_SECRET': {
      if (newState.discoveredSecrets.has(action.secretId)) return state;
      newState.discoveredSecrets = new Set(newState.discoveredSecrets);
      newState.discoveredSecrets.add(action.secretId);
      if (action.goldReward) {
        newState.player.gold += action.goldReward;
        addLog(newState, `${action.goldReward}G手に入れた！`, 'item');
      }
      return newState;
    }

    case 'VILLAGE_MOVE': {
      if (newState.phase !== GamePhase.Village) return state;
      const vDir = DIR_VECTORS[action.direction];
      const nx = newState.villagePos.x + vDir.x;
      const ny = newState.villagePos.y + vDir.y;
      // Import village data inline to check walkability
      const { getAllVillageMaps, isVillageWalkable } = require('@/engine/village');
      const maps = getAllVillageMaps();
      const vmap = maps.get('village_main');
      if (!vmap) return state;
      if (nx < 0 || nx >= vmap.width || ny < 0 || ny >= vmap.height) return state;
      const tile = vmap.tiles[ny][nx];
      // Check NPC blocking
      const npcBlocking = vmap.npcs.some((n: { pos: { x: number; y: number } }) => n.pos.x === nx && n.pos.y === ny);
      if (!isVillageWalkable(tile) && !npcBlocking) return state;
      if (npcBlocking) return state; // Can't walk onto NPCs
      if (!isVillageWalkable(tile)) return state;
      // Diagonal corner-cutting prevention
      if (vDir.x !== 0 && vDir.y !== 0) {
        const cx = newState.villagePos.x;
        const cy = newState.villagePos.y;
        const adjX = cx + vDir.x;
        const adjY = cy + vDir.y;
        // Check both adjacent cardinal tiles are walkable
        const tileH = (adjX >= 0 && adjX < vmap.width) ? vmap.tiles[cy][adjX] : -1;
        const tileV = (adjY >= 0 && adjY < vmap.height) ? vmap.tiles[adjY][cx] : -1;
        if (!isVillageWalkable(tileH) || !isVillageWalkable(tileV)) return state;
      }
      newState.villagePos = { x: nx, y: ny };
      newState.player.facing = action.direction;
      return newState;
    }

    case 'LOAD_GAME':
      return action.state;

    case 'RETURN_TO_TITLE':
      return createInitialState();

    case 'MOVE': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      const moved = tryMove(newState, action.direction);
      if (!moved && newState.dashActive) {
        newState.dashActive = false;
        newState.dashDirection = null;
      }
      return newState;
    }

    case 'ATTACK': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      if (newState.player.statuses.some(s => s.type === StatusEffect.Paralysis)) {
        addLog(newState, '金縛りで動けない！', 'critical');
        processPlayerTurn(newState);
        return newState;
      }
      if (newState.player.statuses.some(s => s.type === StatusEffect.Sleep)) {
        addLog(newState, '眠っていて動けない...', 'info');
        processPlayerTurn(newState);
        return newState;
      }

      let attackDir = action.direction;
      if (newState.player.statuses.some(s => s.type === StatusEffect.Confusion)) {
        attackDir = Math.floor(Math.random() * 8) as Direction;
      }
      newState.player.facing = attackDir;
      const atkVec = DIR_VECTORS[attackDir];
      const ax = newState.player.pos.x + atkVec.x;
      const ay = newState.player.pos.y + atkVec.y;
      const target = newState.floor.monsters.find(m => m.pos.x === ax && m.pos.y === ay);
      if (target) {
        const logs = playerAttackMonster(newState, target);
        newState.logs.push(...logs);
      } else {
        // Swing at empty space (素振り)
        addLog(newState, '素振りをした。', 'info');
      }
      processPlayerTurn(newState);
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
        // Immutable pickup: new ID to prevent React key collision
        const newItem = { ...itemOnFloor, id: generateId() };
        delete newItem.floorPos;
        if (newState.identifiedItems.has(newItem.templateId)) {
          newItem.identified = true;
          const tmpl = ITEM_TEMPLATES.find(t => t.id === newItem.templateId);
          if (tmpl) newItem.name = tmpl.name;
        }
        // #20: Track discovered item templates (museum)
        newState.discoveredItemTemplates.add(newItem.templateId);
        // Fully new arrays (no push/splice)
        newState.floor.items = newState.floor.items.filter(i => i.id !== itemOnFloor.id);
        newState.player.inventory = [...newState.player.inventory, newItem];
        sortInventory(newState.player.inventory);
        addLog(newState, `${newItem.name}を拾った。`, 'item');
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
      // #9: Auto-save before stairs descent
      saveGame(newState);
      // #33: Auto-backup on milestone floors (5, 10, 15, 20, 25)
      const milestoneFloors = [5, 10, 15, 20, 25];
      if (milestoneFloors.includes(newState.floorNumber)) {
        autoBackupSave(newState, newState.floorNumber);
      }
      newState.floorNumber++;
      newState.monsterHouseCleared = false;
      generateNewFloor(newState);
      applyFakeNamesToFloor(newState);
      addLog(newState, `地下${newState.floorNumber}Fに降りた。`, 'system');
      addLog(newState, getFloorMessage(newState.floorNumber), 'info');
      return newState;
    }

    case 'OPEN_INVENTORY':
      if (newState.phase !== GamePhase.Dungeon) return state;
      sortInventory(newState.player.inventory);
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
      } else if (newState.menuMode === MenuMode.ItemAction || newState.menuMode === MenuMode.FloorMenu) {
        newState.selectedMenuItem = newState.selectedMenuItem + 1;
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
        // #2: Curse reveal on equip
        if (w.cursed) {
          addLog(newState, `${w.name}は呪われていた！ 外せなくなった！`, 'critical');
        }
      } else if (item.category === ItemCategory.Shield) {
        const s = item as ShieldItem;
        if (newState.player.equippedShield) {
          const prev = newState.player.inventory.find(i => i.id === newState.player.equippedShield) as ShieldItem | undefined;
          if (prev) prev.equipped = false;
        }
        s.equipped = true;
        newState.player.equippedShield = s.id;
        addLog(newState, `${s.name}を装備した。`, 'item');
        // #2: Curse reveal on equip
        if (s.cursed) {
          addLog(newState, `${s.name}は呪われていた！ 外せなくなった！`, 'critical');
        }
      } else if (item.category === ItemCategory.Ring) {
        const r = item as RingItem;
        if (newState.player.equippedRing) {
          const prev = newState.player.inventory.find(i => i.id === newState.player.equippedRing) as RingItem | undefined;
          if (prev) prev.equipped = false;
        }
        r.equipped = true;
        newState.player.equippedRing = r.id;
        addLog(newState, `${r.name}を装備した。`, 'item');
        // #2: Curse reveal on equip
        if (r.cursed) {
          addLog(newState, `${r.name}は呪われていた！ 外せなくなった！`, 'critical');
        }
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
        // Use facing direction for staff bolt
        handleUseStaff(newState, action.itemId, newState.player.facing);
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
        const thrown = { ...arrow, id: generateId(), count: 1 } as ArrowItem;
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
      if (!pot || pot.category !== ItemCategory.Pot) return state;
      // Allow taking from storage and synthesis pots
      if (pot.potType !== 'storage' && pot.potType !== 'synthesis') return state;
      if (action.index < 0 || action.index >= pot.contents.length) return state;
      if (newState.player.inventory.length >= MAX_INVENTORY) {
        addLog(newState, '持ち物がいっぱいだ。', 'info');
        return newState;
      }
      const item = pot.contents.splice(action.index, 1)[0];
      newState.player.inventory.push(item);
      sortInventory(newState.player.inventory);
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

    case 'TOGGLE_LOG_HISTORY':
      newState.showLogHistory = !newState.showLogHistory;
      return newState;

    case 'TOGGLE_MINIMAP':
      newState.showMinimap = !newState.showMinimap;
      return newState;

    case 'TOGGLE_QUEST_LOG':
      newState.showQuestLog = !newState.showQuestLog;
      return newState;

    case 'SET_INVENTORY_FILTER':
      newState.inventoryFilter = action.filter;
      return newState;

    case 'TOGGLE_INVENTORY_SORT':
      newState.inventorySortMode = newState.inventorySortMode === 'default' ? 'sorted' : 'default';
      return newState;

    case 'QUICK_REST': {
      if (newState.phase !== GamePhase.Dungeon || newState.menuMode !== MenuMode.None) return state;
      // Only rest if no enemies visible
      const visibleEnemy = newState.floor.monsters.some(m =>
        newState.floor.visible[m.pos.y]?.[m.pos.x]
      );
      if (visibleEnemy) {
        addLog(newState, '敵が見えるので休めない！', 'info');
        return newState;
      }
      if (newState.player.hp < newState.player.maxHp) {
        newState.player.hp = Math.min(newState.player.hp + 1, newState.player.maxHp);
        addLog(newState, '足踏みで体力を回復した。', 'heal');
      } else {
        addLog(newState, '足踏みをした。', 'info');
      }
      processPlayerTurn(newState);
      return newState;
    }

    // #14: Training ground - pay gold to gain 1 level
    case 'TRAIN': {
      if (newState.phase !== GamePhase.Village) return state;
      if (newState.player.gold < action.cost) return state;
      newState.player.gold -= action.cost;
      newState.player.level++;
      newState.player.maxHp += 3;
      newState.player.hp = newState.player.maxHp;
      newState.player.attack += 1;
      newState.player.defense += 1;
      newState.player.expToNext = calculateExpToNext(newState.player.level);
      newState.player.exp = 0;
      addLog(newState, `訓練場でレベルアップ！ Lv${newState.player.level}になった！ (${action.cost}G)`, 'system');
      return newState;
    }

    // #18: Blacksmith enhance weapon/shield +1
    case 'BLACKSMITH_ENHANCE': {
      if (newState.phase !== GamePhase.Village) return state;
      if (newState.player.gold < action.cost) return state;
      const bsItem = newState.player.inventory.find(i => i.id === action.itemId);
      if (!bsItem) return state;
      if (bsItem.category === ItemCategory.Weapon) {
        const bsWeapon = bsItem as WeaponItem;
        newState.player.gold -= action.cost;
        bsWeapon.enhancement++;
        addLog(newState, `${bsWeapon.name}を+${bsWeapon.enhancement}に強化した！ (${action.cost}G)`, 'item');
      } else if (bsItem.category === ItemCategory.Shield) {
        const bsShield = bsItem as ShieldItem;
        newState.player.gold -= action.cost;
        bsShield.enhancement++;
        addLog(newState, `${bsShield.name}を+${bsShield.enhancement}に強化した！ (${action.cost}G)`, 'item');
      }
      return newState;
    }

    // #16: Upgrade storage capacity
    case 'UPGRADE_STORAGE': {
      if (newState.phase !== GamePhase.Village) return state;
      if (newState.player.gold < action.cost) return state;
      newState.player.gold -= action.cost;
      newState.storageCapacity += 10;
      addLog(newState, `倉庫を拡張した！ 容量: ${newState.storageCapacity} (${action.cost}G)`, 'system');
      return newState;
    }

    // #19: Well heal - restore HP to full for free
    case 'WELL_HEAL': {
      if (newState.phase !== GamePhase.Village) return state;
      newState.player.hp = newState.player.maxHp;
      addLog(newState, '井戸の水を飲んだ。HPが全回復した！', 'heal');
      return newState;
    }

    default:
      return state;
  }
}
