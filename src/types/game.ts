// ===== Core Types =====

export interface Position {
  x: number;
  y: number;
}

export enum TileType {
  Wall = 0,
  Floor = 1,
  Corridor = 2,
  StairsDown = 3,
  Trap = 4,
  Water = 5,
}

export enum Direction {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
  UpLeft = 4,
  UpRight = 5,
  DownLeft = 6,
  DownRight = 7,
}

export const DIR_VECTORS: Record<Direction, Position> = {
  [Direction.Up]: { x: 0, y: -1 },
  [Direction.Down]: { x: 0, y: 1 },
  [Direction.Left]: { x: -1, y: 0 },
  [Direction.Right]: { x: 1, y: 0 },
  [Direction.UpLeft]: { x: -1, y: -1 },
  [Direction.UpRight]: { x: 1, y: -1 },
  [Direction.DownLeft]: { x: -1, y: 1 },
  [Direction.DownRight]: { x: 1, y: 1 },
};

// ===== Status Effects =====

export enum StatusEffect {
  Poison = 'poison',
  Confusion = 'confusion',
  Sleep = 'sleep',
  Blind = 'blind',
  Slow = 'slow',
  Sealed = 'sealed',
  Paralysis = 'paralysis',
}

export interface StatusInstance {
  type: StatusEffect;
  remaining: number;
}

// ===== Items =====

export enum ItemCategory {
  Weapon = 'weapon',
  Shield = 'shield',
  Arrow = 'arrow',
  Staff = 'staff',
  Scroll = 'scroll',
  Herb = 'herb',
  Pot = 'pot',
  Ring = 'ring',
  Food = 'food',
  Gold = 'gold',
  Projectile = 'projectile',
}

export enum SealType {
  DragonSlayer = 'dragonSlayer',
  UndeadSlayer = 'undeadSlayer',
  DoubleStrike = 'doubleStrike',
  Critical = 'critical',
  Drain = 'drain',
  RustProof = 'rustProof',
  SureHit = 'sureHit',
  TheftGuard = 'theftGuard',
  Counter = 'counter',
  HungerSlow = 'hungerSlow',
  ExpBoost = 'expBoost',
  FireResist = 'fireResist',
  Healing = 'healing',
}

export interface ItemBase {
  id: string;
  templateId: string;
  name: string;
  category: ItemCategory;
  identified: boolean;
  cursed: boolean;
  blessed: boolean;
  floorPos?: Position;
}

export interface WeaponItem extends ItemBase {
  category: ItemCategory.Weapon;
  attack: number;
  enhancement: number;
  seals: SealType[];
  maxSeals: number;
  equipped: boolean;
}

export interface ShieldItem extends ItemBase {
  category: ItemCategory.Shield;
  defense: number;
  enhancement: number;
  seals: SealType[];
  maxSeals: number;
  equipped: boolean;
}

export interface StaffItem extends ItemBase {
  category: ItemCategory.Staff;
  charges: number;
  maxCharges: number;
  effect: string;
}

export interface ScrollItem extends ItemBase {
  category: ItemCategory.Scroll;
  effect: string;
}

export interface HerbItem extends ItemBase {
  category: ItemCategory.Herb;
  effect: string;
  hpRestore: number;
}

export interface PotItem extends ItemBase {
  category: ItemCategory.Pot;
  capacity: number;
  contents: GameItem[];
  potType: 'storage' | 'synthesis' | 'recovery' | 'transform';
}

export interface FoodItem extends ItemBase {
  category: ItemCategory.Food;
  satiation: number;
}

export interface ArrowItem extends ItemBase {
  category: ItemCategory.Arrow;
  attack: number;
  count: number;
}

export interface RingItem extends ItemBase {
  category: ItemCategory.Ring;
  effect: string;
  equipped: boolean;
}

export interface GoldItem extends ItemBase {
  category: ItemCategory.Gold;
  amount: number;
}

export interface ProjectileItem extends ItemBase {
  category: ItemCategory.Projectile;
  attack: number;
}

export type GameItem =
  | WeaponItem
  | ShieldItem
  | StaffItem
  | ScrollItem
  | HerbItem
  | PotItem
  | FoodItem
  | ArrowItem
  | RingItem
  | GoldItem
  | ProjectileItem;

// ===== Monsters =====

export enum MonsterBehavior {
  Normal = 'normal',
  Stationary = 'stationary',
  Wandering = 'wandering',
  Aggressive = 'aggressive',
}

export interface MonsterSpecialAbility {
  type: 'split' | 'hypnosis' | 'itemify' | 'trapCreate' | 'steal' | 'drain' | 'levelDown' | 'summon' | 'fireBreath' | 'warp' | 'poison' | 'healAlly' | 'explode' | 'stealGold';
  chance: number;
  param?: number;
}

export interface Monster {
  id: string;
  templateId: string;
  name: string;
  displayChar: string;
  color: string;
  pos: Position;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  exp: number;
  level: number;
  speed: number; // 0=slow, 1=normal, 2=fast
  behavior: MonsterBehavior;
  abilities: MonsterSpecialAbility[];
  statuses: StatusInstance[];
  sleeping: boolean;
  droppedItem?: string;
  awakened: boolean;
  lastKnownPlayerPos?: Position;
  splitCount?: number;
  hasSummoned?: boolean;
  statusImmunities?: StatusEffect[];
}

// ===== Player =====

export interface Player {
  pos: Position;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  level: number;
  exp: number;
  expToNext: number;
  gold: number;
  satiation: number;
  maxSatiation: number;
  strength: number;
  maxStrength: number;
  inventory: GameItem[];
  equippedWeapon: string | null;
  equippedShield: string | null;
  equippedRing: string | null;
  statuses: StatusInstance[];
  facing: Direction;
  turnCount: number;
  comboCount: number;
}

// ===== Dungeon =====

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  connected: boolean;
}

export interface DungeonFloor {
  width: number;
  height: number;
  tiles: TileType[][];
  rooms: Room[];
  items: GameItem[];
  monsters: Monster[];
  traps: TrapData[];
  stairsPos: Position;
  visible: boolean[][];
  explored: boolean[][];
  monsterHouseRoom: { x: number; y: number; width: number; height: number } | null;
  sanctuaryTiles: Position[];
}

export interface TrapData {
  pos: Position;
  type: TrapType;
  visible: boolean;
}

export enum TrapType {
  Sleep = 'sleep',
  Poison = 'poison',
  Spin = 'spin',
  Pit = 'pit',
  MonsterHouse = 'monsterHouse',
  Summon = 'summon',
  Landmine = 'landmine',
  Rust = 'rust',
  Hunger = 'hunger',
}

// ===== Game State =====

export interface CombatLog {
  message: string;
  turn: number;
  type: 'info' | 'damage' | 'heal' | 'item' | 'system' | 'critical';
}

export enum GamePhase {
  Title = 'title',
  Village = 'village',
  Dungeon = 'dungeon',
  Inventory = 'inventory',
  GameOver = 'gameOver',
  Victory = 'victory',
}

export enum MenuMode {
  None = 'none',
  Main = 'main',
  Inventory = 'inventory',
  ItemAction = 'itemAction',
  PotSelect = 'potSelect',
  DirectionSelect = 'directionSelect',
  FloorMenu = 'floorMenu',
}

export interface GameState {
  phase: GamePhase;
  playerName: string;
  player: Player;
  floor: DungeonFloor;
  floorNumber: number;
  maxFloors: number;
  logs: CombatLog[];
  menuMode: MenuMode;
  selectedItemIndex: number;
  selectedMenuItem: number;
  identifiedItems: Set<string>;
  itemNameMap: Map<string, string>;
  seed: number;
  dashActive: boolean;
  dashDirection: Direction | null;
  animating: boolean;
  monsterHouseTriggered: boolean;
  monsterHouseCleared: boolean;
  storage: GameItem[];
  storageCapacity: number;
  discoveredSecrets: Set<string>;
  discoveredItemTemplates: Set<string>;
  villagePos: Position;
  villageShopSeed: number;
  // UI overlay states
  showLogHistory: boolean;
  showMinimap: boolean;
  showQuestLog: boolean;
  inventoryFilter: ItemCategory | 'all';
  inventorySortMode: 'default' | 'sorted';
  // Save metadata
  saveTimestamp: number;
  playTimeSeconds: number;
  playTimeLastUpdate: number;
}

// ===== Actions =====

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'ATTACK'; direction: Direction }
  | { type: 'WAIT' }
  | { type: 'DASH_START'; direction: Direction }
  | { type: 'DASH_STOP' }
  | { type: 'OPEN_INVENTORY' }
  | { type: 'CLOSE_MENU' }
  | { type: 'SELECT_ITEM'; index: number }
  | { type: 'USE_ITEM'; itemId: string }
  | { type: 'EQUIP_ITEM'; itemId: string }
  | { type: 'UNEQUIP_ITEM'; itemId: string }
  | { type: 'THROW_ITEM'; itemId: string; direction: Direction }
  | { type: 'DROP_ITEM'; itemId: string }
  | { type: 'PUT_IN_POT'; itemId: string; potId: string }
  | { type: 'TAKE_FROM_POT'; potId: string; index: number }
  | { type: 'PICK_UP' }
  | { type: 'GO_STAIRS' }
  | { type: 'MENU_UP' }
  | { type: 'MENU_DOWN' }
  | { type: 'MENU_CONFIRM' }
  | { type: 'OPEN_FLOOR_MENU' }
  | { type: 'START_GAME' }
  | { type: 'NEW_GAME'; playerName?: string }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'RETURN_TO_TITLE' }
  | { type: 'ENTER_DUNGEON' }
  | { type: 'RETURN_TO_VILLAGE' }
  | { type: 'BUY_ITEM'; templateId: string; price: number }
  | { type: 'SELL_ITEM'; itemId: string; price: number }
  | { type: 'STORE_ITEM'; itemId: string }
  | { type: 'WITHDRAW_ITEM'; index: number }
  | { type: 'REMOVE_CURSE'; itemId: string }
  | { type: 'CHURCH_HEAL'; cost: number }
  | { type: 'DISCOVER_SECRET'; secretId: string; goldReward?: number }
  | { type: 'VILLAGE_MOVE'; direction: Direction }
  | { type: 'TOGGLE_LOG_HISTORY' }
  | { type: 'TOGGLE_MINIMAP' }
  | { type: 'TOGGLE_QUEST_LOG' }
  | { type: 'SET_INVENTORY_FILTER'; filter: ItemCategory | 'all' }
  | { type: 'TOGGLE_INVENTORY_SORT' }
  | { type: 'QUICK_REST' }
  | { type: 'TRAIN'; cost: number }
  | { type: 'BLACKSMITH_ENHANCE'; itemId: string; cost: number }
  | { type: 'UPGRADE_STORAGE'; cost: number }
  | { type: 'WELL_HEAL' };
