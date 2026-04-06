// ================================================================
//  Village System - Maps, NPCs, Tiles, Secrets
// ================================================================

export enum VTile {
  Void = 0, Grass = 1, Path = 2, Wall = 3, WallTop = 4,
  Door = 5, Water = 6, Tree = 7, Flower = 8, Fence = 9,
  Floor = 10, Counter = 11, Well = 12, Sign = 13,
  Chest = 14, Bookshelf = 15, Bed = 16, Table = 17,
  Chair = 18, Bridge = 19, DungeonEntry = 20,
  Carpet = 21, Throne = 22, Barrel = 23, Roof = 24,
  Stairs = 25, Torch = 26, Pot = 27,
  Fountain = 28, Dummy = 29,
}

const WALKABLE = new Set([
  VTile.Grass, VTile.Path, VTile.Door, VTile.Floor,
  VTile.Bridge, VTile.Carpet, VTile.Flower, VTile.Stairs,
  VTile.DungeonEntry, VTile.Fountain, VTile.Well,
]);

export function isVillageWalkable(t: VTile): boolean {
  return WALKABLE.has(t);
}

export interface VillageNPC {
  id: string;
  name: string;
  sprite: string; // base name e.g. 'elf_m'
  pos: { x: number; y: number };
  facing: number; // 0=down 1=up 2=left 3=right
  wander?: { x1: number; y1: number; x2: number; y2: number };
  dialogue: string[];
  shopType?: 'weapon' | 'item' | 'storage' | 'church' | 'magic';
  mapId: string;
  nameColor?: string;
  visualType?: 'king' | 'cat' | 'guard' | 'elder' | 'merchant' | 'bard' | 'priest' | 'mother' | 'adventurer';
  title?: string; // shown below name
}

export interface VillageQuest {
  id: string;
  name: string;
  description: string;
  giver: string; // NPC id
  type: 'kill' | 'reach_floor' | 'collect';
  target: string; // monster templateId or floor number
  targetCount: number;
  rewardGold: number;
  rewardMessage: string;
  dialogue: {
    offer: string[];
    inProgress: string[];
    complete: string[];
  };
}

export const VILLAGE_QUESTS: VillageQuest[] = [
  // --- Adventurer quests ---
  {
    id: 'adv_quest_1',
    name: '3階突破の試練',
    description: 'ダンジョン3階まで到達する',
    giver: 'adventurer',
    type: 'reach_floor',
    target: '3',
    targetCount: 0,
    rewardGold: 500,
    rewardMessage: '冒険者「やるじゃねぇか！500Gやるよ。」',
    dialogue: {
      offer: [
        '冒険者「まずは3階だ。話はそれからだ。」',
        '冒険者「500Gで悪くないだろ？」',
      ],
      inProgress: ['冒険者「まだ3階にも着いてねぇのか？」'],
      complete: ['冒険者「お、やったか。見込みがあるな。」'],
    },
  },
  {
    id: 'adv_quest_2',
    name: 'モンスター討伐依頼',
    description: 'モンスターを20体倒す',
    giver: 'adventurer',
    type: 'kill',
    target: 'any',
    targetCount: 20,
    rewardGold: 1500,
    rewardMessage: '冒険者「20体か、上出来だ。1500G受け取れ。」',
    dialogue: {
      offer: ['冒険者「モンスターを20体倒してこい。腕試しだ。」'],
      inProgress: ['冒険者「まだ数が足りねぇ。しっかり狩れ。」'],
      complete: ['冒険者「いい腕してるな。次はもっとキツいのを頼むぜ。」'],
    },
  },
  // --- Priest quests ---
  {
    id: 'priest_quest_1',
    name: '浄化の祈り',
    description: '5階到達して帰還する',
    giver: 'priest',
    type: 'reach_floor',
    target: '5',
    targetCount: 0,
    rewardGold: 1000,
    rewardMessage: '神父「光の導きに感謝を。1000Gを祝福と共にお渡しします。」',
    dialogue: {
      offer: [
        '神父「ダンジョン5階には闇の瘴気が溜まっています。」',
        '神父「5階まで辿り着き、無事帰還してください。1000Gをお約束します。」',
      ],
      inProgress: ['神父「まだ闇を祓えていませんか...祈っております。」'],
      complete: ['神父「おお、無事でしたか！光あれ。」'],
    },
  },
  // --- King quests ---
  {
    id: 'king_quest_1',
    name: '5階の脅威を排除せよ',
    description: '5階まで到達し、モンスター10体を倒す',
    giver: 'king',
    type: 'reach_floor',
    target: '5',
    targetCount: 10,
    rewardGold: 2000,
    rewardMessage: '王「見事だ！報酬として2000Gを授けよう。」',
    dialogue: {
      offer: [
        '王「勇者よ、まずは5階までのモンスターを掃討してほしい。」',
        '王「10体のモンスターを倒せば、2000Gの報酬を約束しよう。」',
      ],
      inProgress: [
        '王「まだ任務の途中か。焦らず着実に進め。」',
      ],
      complete: [
        '王「見事だ、勇者よ！約束通り報酬を授けよう。」',
        '王「次なる任務もある。準備ができたらまた来るがよい。」',
      ],
    },
  },
  {
    id: 'king_quest_2',
    name: '10階の探索',
    description: '10階まで到達する',
    giver: 'king',
    type: 'reach_floor',
    target: '10',
    targetCount: 0,
    rewardGold: 5000,
    rewardMessage: '王「10階到達とは...お前の父に匹敵する実力だ。5000Gを受け取るがよい。」',
    dialogue: {
      offer: [
        '王「次なる試練だ。ダンジョンの10階まで到達してほしい。」',
        '王「10階には強力なモンスターがいると聞く。十分な準備を。」',
      ],
      inProgress: [
        '王「10階はまだ遠いか...装備を整えて再挑戦するのだ。」',
      ],
      complete: [
        '王「10階到達か！お前の父に匹敵する実力だ。」',
        '王「5000Gの報酬と、さらなる情報を授けよう。」',
        '王「15階の奥に、かつてお前の父が残した剣があるという噂がある...」',
      ],
    },
  },
  {
    id: 'king_quest_3',
    name: '黄金の腕輪を求めて',
    description: '最深部30階に到達し、黄金の腕輪を持ち帰る',
    giver: 'king',
    type: 'reach_floor',
    target: '30',
    targetCount: 0,
    rewardGold: 30000,
    rewardMessage: '王「黄金の腕輪...ついに伝説が現実となった！30000Gと、この国の英雄の称号を授けよう！」',
    dialogue: {
      offer: [
        '王「最後の任務だ。ダンジョン最深部30階に眠る黄金の腕輪を手に入れてくれ。」',
        '王「これが成れば、ダンジョンを封印し、この村に真の平和が訪れる。」',
        '王「お前の父もこの任務に挑んだ...必ず無事に帰ってこい。」',
      ],
      inProgress: [
        '王「黄金の腕輪はまだか...だが焦るな。お前なら必ずやり遂げる。」',
      ],
      complete: [
        '王「おお...黄金の腕輪！ついに...ついにこの日が来た！」',
        '王「お前は真の英雄だ。この国の歴史に永遠に名を刻もう！」',
        '王「30000Gと英雄の称号を授ける。そして...お前の父も、きっと誇りに思っているだろう。」',
      ],
    },
  },
];

export interface BuildingEntry {
  pos: { x: number; y: number };
  targetMap: string;
  spawnPos: { x: number; y: number };
  label: string;
}

export interface SecretSpot {
  id: string;
  pos: { x: number; y: number };
  mapId: string;
  message: string;
  reward?: { type: 'gold' | 'message'; amount?: number; text?: string };
}

export interface VillageMapData {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: number[][];
  npcs: VillageNPC[];
  entries: BuildingEntry[];
  secrets: SecretSpot[];
  spawnPos: { x: number; y: number };
  isInterior: boolean;
  exitTo?: { mapId: string; pos: { x: number; y: number } };
}

// ================================================================
//  Helper: fill rectangle
// ================================================================
function fill(m: number[][], x: number, y: number, w: number, h: number, t: number) {
  for (let r = y; r < y + h && r < m.length; r++)
    for (let c = x; c < x + w && c < m[0].length; c++)
      m[r][c] = t;
}

function outline(m: number[][], x: number, y: number, w: number, h: number, t: number) {
  for (let c = x; c < x + w; c++) {
    if (y >= 0 && y < m.length) m[y][c] = t;
    if (y + h - 1 < m.length) m[y + h - 1][c] = t;
  }
  for (let r = y; r < y + h; r++) {
    if (r < m.length) { m[r][x] = t; m[r][x + w - 1] = t; }
  }
}

function makeGrid(w: number, h: number, def: number): number[][] {
  return Array.from({ length: h }, () => new Array(w).fill(def));
}

// ================================================================
//  Building placer: creates wall outline + floor interior + roof top
// ================================================================
function placeBuilding(m: number[][], x: number, y: number, w: number, h: number, doorX: number, doorY: number) {
  // Top wall row
  fill(m, x, y, w, 1, VTile.WallTop);
  // Walls
  outline(m, x, y + 1, w, h - 1, VTile.Wall);
  // Floor interior
  fill(m, x + 1, y + 1, w - 2, h - 2, VTile.Floor);
  // Door
  m[doorY][doorX] = VTile.Door;
}

// ================================================================
//  MAIN VILLAGE MAP (40x30)
// ================================================================
export function createVillageMain(): VillageMapData {
  const W = 40, H = 30;
  const m = makeGrid(W, H, VTile.Grass);

  // Border trees
  fill(m, 0, 0, W, 1, VTile.Tree);
  fill(m, 0, H - 1, W, 1, VTile.Tree);
  for (let y = 0; y < H; y++) { m[y][0] = VTile.Tree; m[y][W - 1] = VTile.Tree; }
  fill(m, 1, 0, W - 2, 1, VTile.Tree);

  // Extra tree clusters
  const treeClusters = [[2,2],[3,2],[2,3],[35,2],[36,2],[35,3],[2,26],[3,27],[35,26],[36,27],[34,3],[3,10],[2,18],[35,10],[36,18]];
  for (const [tx, ty] of treeClusters) if (ty < H && tx < W) m[ty][tx] = VTile.Tree;

  // River (east side)
  for (let y = 0; y < H; y++) { m[y][37] = VTile.Water; m[y][38] = VTile.Water; }

  // Bridge across river
  m[14][37] = VTile.Bridge; m[14][38] = VTile.Bridge;
  m[15][37] = VTile.Bridge; m[15][38] = VTile.Bridge;

  // ---- ROADS ----
  // Main vertical road
  for (let y = 4; y < 27; y++) { m[y][19] = VTile.Path; m[y][20] = VTile.Path; }
  // Main horizontal road
  for (let x = 4; x < 37; x++) { m[14][x] = VTile.Path; m[15][x] = VTile.Path; }
  // Castle approach road
  for (let y = 2; y < 5; y++) { m[y][19] = VTile.Path; m[y][20] = VTile.Path; }
  // South road to dungeon
  for (let y = 26; y < 28; y++) { m[y][19] = VTile.Path; m[y][20] = VTile.Path; }

  // Small side paths
  for (let x = 7; x < 12; x++) { m[10][x] = VTile.Path; m[18][x] = VTile.Path; }
  for (let x = 28; x < 33; x++) { m[10][x] = VTile.Path; m[18][x] = VTile.Path; }

  // ---- CASTLE (top center) ----
  fill(m, 13, 1, 14, 1, VTile.WallTop);
  fill(m, 13, 2, 1, 4, VTile.Wall); fill(m, 26, 2, 1, 4, VTile.Wall);
  fill(m, 13, 5, 14, 1, VTile.Wall);
  fill(m, 14, 2, 12, 3, VTile.Floor);
  fill(m, 19, 2, 2, 1, VTile.Carpet); fill(m, 19, 3, 2, 1, VTile.Carpet);
  m[2][19] = VTile.Throne; m[2][20] = VTile.Throne;
  m[5][19] = VTile.Door; m[5][20] = VTile.Door;
  // Castle torches
  m[2][14] = VTile.Torch; m[2][25] = VTile.Torch;
  m[4][14] = VTile.Torch; m[4][25] = VTile.Torch;

  // ---- WEAPON SHOP (left, mid) ---- door at center south wall
  placeBuilding(m, 5, 8, 7, 5, 8, 12);
  m[9][6] = VTile.Counter; m[9][7] = VTile.Counter; m[9][8] = VTile.Counter;
  m[10][10] = VTile.Barrel;
  m[8][6] = VTile.Torch; m[8][10] = VTile.Torch;
  // Path from road to door
  m[13][8] = VTile.Path;
  m[13][7] = VTile.Sign; // shop sign

  // ---- ITEM SHOP (left, below road) ---- door at center south wall
  placeBuilding(m, 5, 16, 7, 5, 8, 20);
  m[17][6] = VTile.Counter; m[17][7] = VTile.Counter; m[17][8] = VTile.Counter;
  m[18][10] = VTile.Pot;
  m[16][6] = VTile.Torch; m[16][10] = VTile.Torch;
  // Path from secondary road to door (south approach)
  m[21][8] = VTile.Path; // already set by secondary road, reinforce
  m[15][7] = VTile.Sign; // shop sign

  // ---- TAVERN (right, mid) ---- door at center south wall
  placeBuilding(m, 27, 8, 8, 5, 31, 12);
  // Counter on north wall (behind keeper, NOT on keeper's tile)
  m[9][28] = VTile.Counter; m[9][29] = VTile.Counter;
  // Tables and chairs in seating area (leave path to keeper clear)
  m[10][29] = VTile.Table; m[10][30] = VTile.Table;
  m[11][29] = VTile.Chair; m[11][30] = VTile.Chair;
  // Barrels in corner (NOT blocking keeper access)
  m[9][33] = VTile.Barrel; m[10][33] = VTile.Barrel;
  m[8][28] = VTile.Torch; m[8][33] = VTile.Torch;
  // Path from road to door
  m[13][31] = VTile.Path;
  m[13][32] = VTile.Sign; // tavern sign

  // ---- CHURCH (right, below road) ---- door at center south wall
  placeBuilding(m, 27, 16, 8, 5, 31, 20);
  m[17][31] = VTile.Bookshelf; m[17][32] = VTile.Bookshelf; m[17][33] = VTile.Bookshelf;
  // Chairs on SIDES (not blocking door path at x=31)
  m[18][29] = VTile.Chair; m[18][30] = VTile.Chair;
  m[19][29] = VTile.Chair; m[19][30] = VTile.Chair;
  m[16][28] = VTile.Torch; m[16][33] = VTile.Torch;
  // Path from secondary road to door (south approach)
  m[21][31] = VTile.Path; // already set by secondary road, reinforce
  m[15][32] = VTile.Sign; // church sign

  // ---- HOME (lower left) ---- door at center south wall
  placeBuilding(m, 5, 22, 7, 5, 8, 26);
  m[23][6] = VTile.Bed; m[23][7] = VTile.Bed;
  m[24][9] = VTile.Table; m[24][10] = VTile.Chair;
  m[22][6] = VTile.Torch; m[22][10] = VTile.Torch;
  // Path from vertical road to door
  for (let x = 8; x <= 19; x++) m[26][x] = m[26][x] === VTile.Grass ? VTile.Path : m[26][x];

  // ---- STORAGE (lower right) ---- door at center south wall
  placeBuilding(m, 28, 22, 7, 5, 31, 26);
  m[23][30] = VTile.Chest; m[23][31] = VTile.Chest; m[23][32] = VTile.Chest;
  m[24][30] = VTile.Barrel; m[24][31] = VTile.Barrel;
  m[22][29] = VTile.Torch; m[22][33] = VTile.Torch;
  // Path from vertical road to door
  for (let x = 20; x <= 31; x++) m[26][x] = m[26][x] === VTile.Grass ? VTile.Path : m[26][x];

  // ---- WELL (center crossroads) ----
  m[13][19] = VTile.Well; m[13][20] = VTile.Well;

  // ---- FOUNTAIN (village square) ----
  m[12][19] = VTile.Fountain; m[12][20] = VTile.Fountain;

  // ---- TRAINING DUMMY (near weapon shop) ----
  m[10][4] = VTile.Dummy;

  // ---- SIGNS ----
  m[6][18] = VTile.Sign; // Castle sign
  m[13][18] = VTile.Sign; // Well sign
  m[26][18] = VTile.Sign; // Dungeon sign

  // ---- DUNGEON ENTRANCE (bottom center) ----
  fill(m, 18, 27, 4, 2, VTile.DungeonEntry);
  m[27][17] = VTile.Torch; m[27][22] = VTile.Torch;

  // ---- SECONDARY ROAD (y=21) for south-building access ----
  for (let x = 4; x < 37; x++) {
    if (m[21][x] === VTile.Grass) m[21][x] = VTile.Path;
  }
  // Connect vertical road to secondary road
  for (let y = 16; y <= 21; y++) {
    if (m[y][4] === VTile.Grass) m[y][4] = VTile.Path;
    if (m[y][36] === VTile.Grass) m[y][36] = VTile.Path;
  }

  // ---- FLOWERS ----
  const flowers = [[4,7],[5,7],[15,7],[16,7],[24,7],[25,7],[15,22],[16,22],[24,22],[25,22],[8,14],[8,15],[31,14],[31,15],[17,6],[22,6],[13,7],[14,7],[25,7],[26,7],[3,14],[3,15],[36,14],[36,15],
    // Extra flower patches: near bridge, castle entrance, dungeon
    [35,14],[34,14],[35,15],[17,4],[18,4],[17,26],[16,26],[18,26]];
  for (const [fx, fy] of flowers) if (fy < H && fx < W && m[fy][fx] === VTile.Grass) m[fy][fx] = VTile.Flower;

  // ---- LAMP POSTS along roads ----
  m[7][19] = VTile.Torch; m[7][20] = VTile.Torch;
  m[24][19] = VTile.Torch; m[24][20] = VTile.Torch;
  m[14][8] = VTile.Torch; m[14][32] = VTile.Torch;
  m[15][8] = VTile.Torch; m[15][32] = VTile.Torch;

  // ---- BENCHES along roads (use Chair tiles) ----
  m[13][15] = VTile.Chair; m[13][16] = VTile.Chair;
  m[16][23] = VTile.Chair; m[16][24] = VTile.Chair;

  // ---- GARDEN area near home (south-west) ----
  m[23][3] = VTile.Flower; m[24][3] = VTile.Flower;
  m[23][4] = VTile.Flower; m[24][4] = VTile.Flower;
  m[25][3] = VTile.Flower; m[25][4] = VTile.Flower;

  // ---- SECOND WELL (east area, near bridge) ----
  m[13][33] = VTile.Well;

  // ---- BARRELS near tavern exterior ----
  m[13][27] = VTile.Barrel; m[13][28] = VTile.Barrel;

  // ---- POTS near item shop exterior ----
  m[21][5] = VTile.Pot; m[21][6] = VTile.Pot;

  // ---- NOTICE BOARD (village center, east of well) ----
  m[12][21] = VTile.Sign;

  // ---- GRAVEYARD near church (small area) ----
  m[22][33] = VTile.Sign; m[22][34] = VTile.Sign; // tombstones (rendered as signs)
  m[23][33] = VTile.Sign; m[23][34] = VTile.Flower;

  // ---- CRATES near storage ----
  m[25][33] = VTile.Barrel; m[25][34] = VTile.Barrel;
  m[26][33] = VTile.Barrel;

  // ---- MARKET STALLS (near crossroads) ----
  m[13][22] = VTile.Counter; m[13][23] = VTile.Counter;
  m[16][17] = VTile.Counter; m[16][18] = VTile.Counter;

  // ---- BRIDGE TORCHES ----
  m[13][37] = VTile.Torch; m[16][37] = VTile.Torch;

  // ---- DUNGEON AREA FENCES ----
  for (let x = 17; x < 23; x++) m[27][x] === VTile.DungeonEntry || (m[26][x] = VTile.Fence);

  // ---- VILLAGE BOUNDARY FENCES (inside tree border) ----
  // North boundary
  for (let x = 2; x < W - 2; x++) {
    if (m[1][x] === VTile.Tree || m[1][x] === VTile.Grass) m[1][x] = VTile.Fence;
  }
  // South boundary
  for (let x = 2; x < W - 2; x++) {
    if (m[H - 2][x] === VTile.Grass || m[H - 2][x] === VTile.Tree) m[H - 2][x] = VTile.Fence;
  }
  // West boundary
  for (let y = 2; y < H - 2; y++) {
    if (m[y][1] === VTile.Grass || m[y][1] === VTile.Tree) m[y][1] = VTile.Fence;
  }
  // East boundary (before river)
  for (let y = 2; y < H - 2; y++) {
    if (m[y][36] === VTile.Grass) m[y][36] = VTile.Fence;
  }
  // Gate openings for roads
  m[1][19] = VTile.Path; m[1][20] = VTile.Path; // North gate (to castle)
  m[H - 2][19] = VTile.Path; m[H - 2][20] = VTile.Path; // South gate

  // ---- HIDDEN CHEST (behind trees, NW corner) ----
  m[3][3] = VTile.Grass; // clear a tree for a path
  m[4][3] = VTile.Chest; // hidden chest

  // #19: Well tile is already placed at (13,19)/(13,20) and (33,13)
  // Make well tiles walkable (they already are via WALKABLE set including VTile.Well? No, Well is not in WALKABLE)
  // We need to check... Well is NOT in the WALKABLE set, so let's leave as-is
  // The interaction is handled in VillageScreen

  const npcs: VillageNPC[] = [
    // #17: Additional ambient NPCs
    { id: 'farmer', name: '農夫', sprite: 'dwarf_m', pos: { x: 14, y: 22 }, facing: 0,
      nameColor: '#88AA66',
      wander: { x1: 10, y1: 20, x2: 18, y2: 26 }, dialogue: [
        '農夫「ダンジョンのせいで作物がまともに育たねぇ。早くなんとかしてくれよ。」',
        '農夫「おめぇの親父にはよく畑を手伝ってもらったもんだ。」',
        '農夫「土の中から時々変なもんが出てくるんだ。ダンジョンのせいかな。」',
      ], mapId: 'village_main' },
    { id: 'merchant_wanderer', name: '旅商人', sprite: 'lizard_m', pos: { x: 24, y: 14 }, facing: 2,
      nameColor: '#CCAA44', visualType: 'merchant',
      wander: { x1: 20, y1: 10, x2: 30, y2: 18 }, dialogue: [
        '旅商人「珍しいものを探してるのかい？ダンジョンの深層にはいいものがあるよ。」',
        '旅商人「あちこち旅してきたが、こんなダンジョンは初めてだ。」',
        '旅商人「ここの武器屋は品揃えがいいね。俺も仕入れさせてもらってるよ。」',
      ], mapId: 'village_main' },
    { id: 'child', name: '村の子供', sprite: 'elf_m', pos: { x: 12, y: 18 }, facing: 0,
      nameColor: '#AADDFF',
      wander: { x1: 8, y1: 14, x2: 18, y2: 22 }, dialogue: [
        '子供「ぼくもおっきくなったら冒険者になるんだ！」',
        '子供「ねえねえ、ダンジョンの中ってどんな感じ？怖い？」',
        '子供「お兄ちゃんすごいね！モンスター倒してるんでしょ？」',
      ], mapId: 'village_main' },
    // #18: Blacksmith NPC
    { id: 'blacksmith', name: '鍛冶屋', sprite: 'dwarf_m', pos: { x: 9, y: 10 }, facing: 2,
      nameColor: '#FF8844', visualType: 'merchant', title: '武器強化師',
      shopType: 'magic', dialogue: [
        '鍛冶屋「武器や盾を鍛えてやろう。金さえあればな。」',
        '鍛冶屋「強化値が高いほど費用もかかる。覚えておけ。」',
        '鍛冶屋「お前の親父も常連だったぜ。あの剣は俺が最後に研いでやった。」',
      ], mapId: 'village_main' },
    // #15: Fortune teller NPC
    { id: 'fortune_teller', name: '占い師', sprite: 'wizzard_f', pos: { x: 33, y: 10 }, facing: 2,
      nameColor: '#DD88FF', title: '星読みの使い手',
      dialogue: [
        '占い師「次の冒険の運勢を占ってあげましょう...」',
        '占い師「星が告げています...深い階にはモンスターハウスがあると。」',
        '占い師「5の倍数の階には特に危険が待っていると星が示しています。」',
        '占い師「持ち物を充実させてから挑みなさい。特に回復アイテムを忘れずに。」',
        '占い師「あなたの父の運命は...まだ途絶えていません。生きています。」',
      ], mapId: 'village_main' },
    // #20: Museum NPC
    { id: 'museum', name: '博物館員', sprite: 'elf_f', pos: { x: 25, y: 22 }, facing: 2,
      nameColor: '#88CCAA', title: 'アイテム研究家',
      dialogue: [
        '博物館員「ダンジョンで見つけたアイテムの記録をつけているの。」',
        '博物館員「色々なアイテムを見つけたら教えてね。コレクション率を教えてあげる。」',
        '博物館員「珍しいアイテムほど深い階にあるわ。頑張って探してきてね。」',
      ], mapId: 'village_main' },
    // Wandering villagers
    { id: 'villager1', name: '村人', sprite: 'elf_m', pos: { x: 16, y: 14 }, facing: 0,
      nameColor: '#AABBAA',
      wander: { x1: 12, y1: 12, x2: 25, y2: 17 }, dialogue: [
        '村人「最近モンスターが増えてきて、夜が怖いんだ...」',
        '村人「あんたの親父さんがダンジョンに行ってからもう半年か...」',
        '村人「川向こうに何かあるって噂だけど、橋が壊れかけてて危ないらしい。」',
        '村人「武器屋の親父が言ってたが、ダンジョンの中で拾った武器は鍛えると化けるらしい。」',
        '村人「最近、夜になると地鳴りがするんだ...ダンジョンの奥で何かが動いてるんじゃないか。」',
        '村人「この村は昔、もっと賑やかだったんだ。ダンジョンが現れてから人が減っちまった。」',
        '村人「長老の話だと、ダンジョンの最深部には世界を変える力があるらしい。」',
      ], mapId: 'village_main' },
    { id: 'villager2', name: '村の少女', sprite: 'elf_f', pos: { x: 22, y: 10 }, facing: 0,
      nameColor: '#FFB0C0',
      wander: { x1: 18, y1: 8, x2: 26, y2: 16 }, dialogue: [
        '少女「お兄ちゃん、ダンジョンに行くの？気をつけてね！」',
        '少女「お花がきれいでしょ？でもモンスターが来ると踏み荒らされちゃうの...」',
        '少女「猫ちゃんがね、時々キラキラするものをくわえて帰ってくるの。」',
        '少女「お兄ちゃんのお父さん、優しかったなぁ...いつもお菓子くれたの。」',
        '少女「ねぇ、あの猫さん時々光るものくわえてくるの。不思議だよね。」',
        '少女「お兄ちゃんが帰ってくると安心するんだ。」',
      ], mapId: 'village_main' },
    { id: 'guard1', name: '門番', sprite: 'dwarf_m', pos: { x: 18, y: 5 }, facing: 0,
      nameColor: '#A0C0E0', visualType: 'guard',
      dialogue: [
        '門番「城の中では王が待っている。ダンジョンのことで話がある。」',
        '門番「最近は夜になるとダンジョンの入り口から異様な気配がする...見回りも命がけだ。」',
        '門番「城壁の修理が追いつかん。モンスターの数が増える一方だ。」',
        '門番「お前の親父は出発前にここで見送ったんだ。あの時の背中を覚えてる。」',
      ], mapId: 'village_main' },
    { id: 'guard2', name: '兵士', sprite: 'elf_m', pos: { x: 21, y: 5 }, facing: 0,
      nameColor: '#A0C0E0', visualType: 'guard',
      dialogue: [
        '兵士「モンスター対策の兵は足りん...冒険者の力が必要だ。」',
        '兵士「お前の親父は...いや、何でもない。王に聞いてくれ。」',
        '兵士「ダンジョンの5階あたりで光る壁があるって報告がある。何か隠されてるのかもしれん。」',
        '兵士「東の橋は老朽化がひどい。渡るときは気をつけろ。」',
      ], mapId: 'village_main' },
    { id: 'cat', name: '猫', sprite: 'cat_custom', pos: { x: 15, y: 20 }, facing: 0,
      nameColor: '#FF9944', visualType: 'cat',
      wander: { x1: 8, y1: 12, x2: 23, y2: 24 }, dialogue: [
        'ニャー...（猫がこちらを見ている）',
        'ニャーン...（猫が足元にすり寄ってきた）',
        'フニャ！（猫が何かを掘り出した！...50G見つけた！）',
        'ゴロゴロゴロ...（猫が喉を鳴らしている。機嫌がいいようだ）',
        'ニャッ！（猫が小さなアイテムをくわえてきた！）',
        'ガリガリ...（猫が看板で爪を研いでいる。こら！）',
        '...（猫が丸くなって寝ている。起こさないでおこう）',
        'シャーッ！（猫がダンジョンの方向を睨んでいる...何か感じるのか？）',
      ], mapId: 'village_main' },
    { id: 'oldman', name: '長老', sprite: 'wizzard_m', pos: { x: 10, y: 14 }, facing: 3,
      nameColor: '#C0A0FF', visualType: 'elder', title: '村の守り手',
      dialogue: [
        '長老「わしはこの村で70年暮らしておるが、ダンジョンが現れたのは初めてじゃ。」',
        '長老「お前の父は勇敢な男じゃった。必ず生きておるはず。」',
        '長老「黄金の腕輪の伝承を知っておるか？あれを手にした者はダンジョンを封印できるそうじゃ。」',
        '長老「ダンジョンは生きておる。入るたびに姿を変え、挑む者を試すのじゃ。」',
        '長老「お前の父は15階で見つけた古い剣の話をしておった...特別な力を持つ剣だと。」',
        '長老「伝承によれば、ダンジョンは大地の怒りが形になったものだという。」',
        '長老「腕輪を持ち帰ったのは、300年前の英雄ただ一人。だがその英雄も多くの仲間を失った。」',
        '長老「お前の父はな...出発前の夜、わしにこう言った。『必ず腕輪を持ち帰る。息子のために。』」',
      ], mapId: 'village_main' },
    // Castle NPCs
    { id: 'king', name: '王', sprite: 'doc', pos: { x: 19, y: 2 }, facing: 0,
      nameColor: '#FFD700', visualType: 'king', title: '始まりの国の王',
      dialogue: [
        '王「よく来たな、勇者よ。この国のため、力を貸してほしい。」',
        '王「ダンジョンから溢れるモンスターが村を脅かしている。」',
        '王「任務を受けるか？ 【Enterで受諾】」',
        '王「お前の父は...かつてこの国一の冒険者だった。」',
        '王「ダンジョンの封印に必要な黄金の腕輪...お前の父も追い求めた。」',
        '王「装備を整え、知恵を磨き、仲間の助言に耳を傾けよ。」',
      ], mapId: 'village_main' },
    { id: 'advisor', name: '大臣', sprite: 'wizzard_f', pos: { x: 22, y: 3 }, facing: 2,
      nameColor: '#88BBDD',
      dialogue: [
        '大臣「ダンジョンの10階ごとに特に強力なモンスターがいるという報告がある。」',
        '大臣「準備は万端にして挑みなさい。武器屋と道具屋で装備を整えるのだ。」',
        '大臣「王は表には出さぬが、お前の父のことを深く案じておられる。」',
        '大臣「倉庫に大事な装備を預けておくのも賢明だ。死んでからでは遅い。」',
        '大臣「国庫も潤沢ではない。だが冒険者への報酬は惜しまぬ方針だ。」',
      ], mapId: 'village_main' },
    // Shop NPCs
    { id: 'weaponkeeper', name: '武器屋の主人', sprite: 'dwarf_m', pos: { x: 7, y: 9 }, facing: 0,
      nameColor: '#FF6644', visualType: 'merchant', title: '鍛冶師',
      dialogue: [
        '武器屋「おう！親父さんにも世話になったもんだ。いいもん揃えてるぜ！」',
        '武器屋「ダンジョンで拾った武器は鑑定してから使えよ。呪いがかかってることもある。」',
        '武器屋「剣は振るだけじゃダメだ。敵に合わせて武器を変える。それが生き残るコツだ。」',
        '武器屋「お前の親父が使ってた剣を見たことがある...あれは特別な一振りだった。」',
        '武器屋「鉄の剣は5階まで十分だ。それ以上はもっといいのが要る。」',
      ],
      shopType: 'weapon', mapId: 'village_main' },
    { id: 'itemkeeper', name: '道具屋', sprite: 'lizard_f', pos: { x: 7, y: 17 }, facing: 0,
      nameColor: '#66CC88', visualType: 'merchant',
      dialogue: [
        '道具屋「冒険に必要なものは揃えていきな。薬草は命綱だよ。」',
        '道具屋「巻物は読む前に状況をよく見な。使い所を間違えたら命取りだよ。」',
        '道具屋「おにぎりは腐る前に食べな。腐ったおにぎりなんて食べたくないだろ？」',
        '道具屋「杖は使い方次第で命を救う。敵を吹き飛ばしたり、逃げ道を作ったり。」',
        '道具屋「毒消し草は常に1個持ってな。毒で力が下がったら致命的だよ。」',
      ],
      shopType: 'item', mapId: 'village_main' },
    { id: 'tavernkeeper', name: '酒場の主人', sprite: 'dwarf_f', pos: { x: 31, y: 10 }, facing: 0,
      nameColor: '#CC8844', visualType: 'merchant',
      dialogue: [
        '酒場の主人「情報が欲しいのかい？ダンジョンの噂ならたくさんあるよ。」',
        '酒場の主人「冒険者ってのはみんな同じ目をしてるね。お前の親父もそうだった。」',
        '酒場の主人「あの冒険者、毎晩来ては10階の話ばかりしてるよ。何があったんだろうね。」',
        '酒場の主人「水はタダだよ。でもいい酒もあるからね、稼いできたら奢ってあげるよ。」',
        '酒場の主人「最近、変な噂を聞いたんだ...ダンジョンの壁に文字が浮かぶって。」',
        '酒場の主人「お前の親父はいつもここで仲間と作戦を練ってたんだよ。」',
      ],
      mapId: 'village_main' },
    { id: 'priest', name: '神父', sprite: 'angel', pos: { x: 31, y: 18 }, facing: 0,
      nameColor: '#FFFFFF', visualType: 'priest', title: '祈りの使い手',
      dialogue: [
        '神父「呪われた装備は危険です。500Gで祈りを捧げましょう。」',
        '神父「倒れた者の魂がダンジョンに囚われているのを感じます...お父上もその中に...」',
        '神父「光あれ。あなたの旅路が祝福されますように。」',
        '神父「ダンジョンで倒れた者の魂を感じます...解放してあげたいのですが、力が及ばず...」',
        '神父「呪いの装備は外せなくなります。必ず教会で解呪を。」',
        '神父「あなたのお父上のために、毎日祈りを捧げています。」',
      ],
      shopType: 'church', mapId: 'village_main' },
    { id: 'mother', name: '母', sprite: 'elf_f', pos: { x: 8, y: 24 }, facing: 3,
      nameColor: '#FFCC88', visualType: 'mother',
      dialogue: [
        '母「おかえり。ちゃんとご飯は食べてる？」',
        '母「お父さんもね、よくこうして出発前に帰ってきたものよ...」',
        '母「気をつけてね。必ず帰ってきて。」',
        '母「あなたの寝顔を見ていると、お父さんにそっくりで...ごめんね、泣いたりして。」',
        '母「お父さんが最後に残した手紙、まだ大事に持ってるわ。『必ず帰る』って...」',
        '母「無理はしないで。あなたまでいなくなったら、私...」',
        '母「あなたが帰ってくるたびに、ホッとするの。ありがとう、生きていてくれて。」',
      ], mapId: 'village_main' },
    { id: 'storagekeeper', name: '倉庫番', sprite: 'dwarf_m', pos: { x: 31, y: 24 }, facing: 2,
      nameColor: '#8899AA',
      dialogue: [
        '倉庫番「大事なアイテムは預けておけ。ダンジョンで倒れたら全部なくすぞ。」',
        '倉庫番「お前の親父も色々預けてたが...取りに来なくなっちまったな。」',
        '倉庫番「20個まで預かれる。それ以上は...倉庫を拡張する金が要るな。」',
        '倉庫番「ダンジョンで倒れても預けた物は無事だ。大事な物は預けとけ。」',
      ],
      shopType: 'storage', mapId: 'village_main' },
    // Tavern patrons
    { id: 'adventurer', name: '冒険者', sprite: 'lizard_m', pos: { x: 29, y: 11 }, facing: 0,
      nameColor: '#DD4444', visualType: 'adventurer', title: '歴戦の戦士',
      dialogue: [
        '冒険者「5階を超えるとモンスターが一気に強くなる。油断するなよ。」',
        '冒険者「モンスターハウスに出くわしたら、巻物が頼りだ。」',
        '冒険者「3階までは雑魚だ。ここで経験を積め。焦って深く潜る奴から死ぬ。」',
        '冒険者「7〜9階はワナが多い。足元をよく見ろ。」',
        '冒険者「10階のボスは...俺はあそこで仲間を失った。二度と行きたくねぇ。」',
        '冒険者「15階以降は未知の領域だ。俺も行ったことがない。だがお前の親父は行った。」',
        '冒険者「通路では角に気をつけろ。曲がった先にモンスターがいたら即死だ。」',
      ], mapId: 'village_main' },
    { id: 'bard', name: '吟遊詩人', sprite: 'elf_f', pos: { x: 30, y: 11 }, facing: 2,
      nameColor: '#CC88FF', visualType: 'bard', title: '放浪の歌い手',
      dialogue: [
        '吟遊詩人「♪ 闇深き迷宮の底に眠る 黄金の輝き...♪」',
        '吟遊詩人「30階...そこに腕輪があるって伝承を歌にしたの。」',
        '吟遊詩人「♪ 勇者は征く 父の背を追い 光なき道を ただ一人...♪」',
        '吟遊詩人「♪ 鉄の剣 折れても心は折れず 再び立ち上がる者に 栄光あれ...♪」',
        '吟遊詩人「歌には力があるの。古い歌ほど強い力を秘めている。」',
        '吟遊詩人「♪ 深き階 闇の中に光ひとつ それは帰りを待つ者の祈り...♪」',
        '吟遊詩人「あなたのお父さんの冒険譚、いつか歌にしたいわ。...ハッピーエンドでね。」',
      ], mapId: 'village_main' },
  ];

  // Dungeon entrance variation messages
  const dungeonLabels = [
    'ダンジョンに入る',
    '不思議のダンジョンへ突入する',
    '闇の中へ踏み込む',
    '地下迷宮へ降りる',
    '冒険の始まり...ダンジョンへ',
    '父の足跡を辿る...ダンジョンへ',
    '覚悟を決めてダンジョンに入る',
  ];
  const dungeonLabel = dungeonLabels[Math.floor(Math.random() * dungeonLabels.length)];

  const entries: BuildingEntry[] = [
    // Dungeon entrance
    { pos: { x: 19, y: 27 }, targetMap: '__dungeon__', spawnPos: { x: 0, y: 0 }, label: dungeonLabel },
    { pos: { x: 20, y: 27 }, targetMap: '__dungeon__', spawnPos: { x: 0, y: 0 }, label: dungeonLabel },
    { pos: { x: 19, y: 28 }, targetMap: '__dungeon__', spawnPos: { x: 0, y: 0 }, label: dungeonLabel },
    { pos: { x: 20, y: 28 }, targetMap: '__dungeon__', spawnPos: { x: 0, y: 0 }, label: dungeonLabel },
  ];

  const secrets: SecretSpot[] = [
    { id: 'hidden_chest_nw', pos: { x: 4, y: 3 }, mapId: 'village_main',
      message: '木陰に隠された宝箱を見つけた！ 100G手に入れた！',
      reward: { type: 'gold', amount: 100 } },
    { id: 'well_message', pos: { x: 19, y: 13 }, mapId: 'village_main',
      message: '井戸の底をのぞくと...石壁に文字が刻まれている。「我、この先に進む。必ず腕輪を持ち帰る ――父より」' },
    { id: 'dungeon_sign', pos: { x: 18, y: 26 }, mapId: 'village_main',
      message: '看板「この先、不思議のダンジョン。入りし者、生きて帰れる保証なし。」' },
    { id: 'castle_sign', pos: { x: 18, y: 6 }, mapId: 'village_main',
      message: '看板「始まりの城 ――王が冒険者を待っている」' },
    { id: 'weapon_shop_sign', pos: { x: 7, y: 13 }, mapId: 'village_main',
      message: '看板「武器屋 ―― 剣・盾・各種武具取り揃え」' },
    { id: 'item_shop_sign', pos: { x: 7, y: 15 }, mapId: 'village_main',
      message: '看板「道具屋 ―― 薬草・巻物・冒険の必需品」' },
    { id: 'tavern_sign', pos: { x: 32, y: 13 }, mapId: 'village_main',
      message: '看板「酒場・風の憩い ―― 情報と酒、どちらもあるよ」' },
    { id: 'church_sign', pos: { x: 32, y: 15 }, mapId: 'village_main',
      message: '看板「教会 ―― 呪い解除・祈りの場」' },
    { id: 'bookshelf_lore', pos: { x: 31, y: 17 }, mapId: 'village_main',
      message: '古文書「不思議のダンジョンは毎回構造が変化する。同じ攻略法は通用しない。唯一の武器は、経験と知恵である。」' },
    { id: 'barrel_secret', pos: { x: 10, y: 10 }, mapId: 'village_main',
      message: '樽の中に50Gが隠されていた！',
      reward: { type: 'gold', amount: 50 } },
    { id: 'flower_message', pos: { x: 15, y: 7 }, mapId: 'village_main',
      message: '花壇の中に小さな石碑がある。「この村に平和が戻りますように ――村人一同」' },
    { id: 'river_fishing', pos: { x: 36, y: 14 }, mapId: 'village_main',
      message: '橋のたもとで釣りをしている老人がいた。「ここの魚は旨いぞ。...お前の父もよくここで釣りをしていたな。」' },
    { id: 'notice_board', pos: { x: 21, y: 12 }, mapId: 'village_main',
      message: '掲示板「冒険者求む！ダンジョン5階以降の情報提供者には報酬あり。――冒険者ギルド」' },
    { id: 'graveyard_1', pos: { x: 33, y: 22 }, mapId: 'village_main',
      message: '墓碑銘「ここに眠るは勇敢なる冒険者 カイン。ダンジョン20階にて永眠。」' },
    { id: 'graveyard_2', pos: { x: 34, y: 22 }, mapId: 'village_main',
      message: '墓碑銘「名もなき冒険者たちよ、安らかに眠れ。」...多くの名が刻まれている。' },
    { id: 'market_stall', pos: { x: 22, y: 13 }, mapId: 'village_main',
      message: '露店の主人は留守のようだ。「日曜のみ営業」と書かれた紙が置いてある。' },
    { id: 'bench_rest', pos: { x: 15, y: 13 }, mapId: 'village_main',
      message: 'ベンチに座って一息つく。...遠くにダンジョンの入り口が見える。' },
    { id: 'bridge_view', pos: { x: 37, y: 14 }, mapId: 'village_main',
      message: '橋から川を眺める。透き通った水の中に魚が泳いでいる。...平和な光景だ。' },
    { id: 'throne_secret', pos: { x: 20, y: 2 }, mapId: 'village_main',
      message: '玉座の裏に小さな隠し引き出しがある。中に200Gが入っていた！',
      reward: { type: 'gold', amount: 200 } },
    { id: 'home_bed', pos: { x: 6, y: 23 }, mapId: 'village_main',
      message: 'ベッドの枕の下に父の写真がある。裏に「必ず帰る」と書かれている。' },
    { id: 'storage_barrel', pos: { x: 30, y: 24 }, mapId: 'village_main',
      message: '樽の中に古いコインが入っていた！75G手に入れた！',
      reward: { type: 'gold', amount: 75 } },
    { id: 'well_east', pos: { x: 33, y: 13 }, mapId: 'village_main',
      message: '東の井戸を覗くと、水面にかすかに光が見える...不思議だ。' },
    { id: 'cat_spot', pos: { x: 15, y: 20 }, mapId: 'village_main',
      message: '地面に猫の足跡がたくさんある。この辺りが猫のお気に入りらしい。' },
    { id: 'fence_gap', pos: { x: 1, y: 14 }, mapId: 'village_main',
      message: '柵の隙間から外が見える。遠くに山脈が広がっている。' },
    { id: 'garden_stone', pos: { x: 3, y: 25 }, mapId: 'village_main',
      message: '花壇の中に小さな石像がある。「豊穣の女神」と刻まれている。' },
    { id: 'castle_torch', pos: { x: 14, y: 2 }, mapId: 'village_main',
      message: '松明の裏の壁に古代文字が刻まれている。「勇気ある者に光を...」' },
    { id: 'tavern_barrel', pos: { x: 33, y: 9 }, mapId: 'village_main',
      message: '酒樽からいい匂いがする。ラベルには「特級エール 熟成20年」と書いてある。' },
    { id: 'church_book', pos: { x: 32, y: 17 }, mapId: 'village_main',
      message: '古い祈祷書が開いている。「光よ、闇を祓い、迷える者に道を示せ」' },
    { id: 'weapon_barrel', pos: { x: 10, y: 10 }, mapId: 'village_main',
      message: '研ぎ石と油布が入っている。武器の手入れ用だ。' },
    { id: 'training_dummy', pos: { x: 4, y: 10 }, mapId: 'village_main',
      message: '素振りの練習...攻撃力が少し上がった気がする。' },
  ];

  return {
    id: 'village_main', name: '始まりの村', width: W, height: H,
    tiles: m, npcs, entries, secrets,
    spawnPos: { x: 19, y: 22 }, isInterior: false,
  };
}

// ================================================================
//  Pre-build all maps
// ================================================================
let _allMaps: Map<string, VillageMapData> | null = null;

export function getAllVillageMaps(): Map<string, VillageMapData> {
  if (_allMaps) return _allMaps;
  _allMaps = new Map();
  const main = createVillageMain();
  _allMaps.set(main.id, main);
  return _allMaps;
}

// Force rebuild maps (e.g. after hot reload)
export function resetVillageMaps() {
  _allMaps = null;
}

// ================================================================
//  Tile rendering colors
// ================================================================
export const TILE_COLORS: Record<number, { bg: string; fg?: string }> = {
  [VTile.Void]:      { bg: '#050508' },
  [VTile.Grass]:     { bg: '#1a2e15' },
  [VTile.Path]:      { bg: '#3a3020' },
  [VTile.Wall]:      { bg: '#3a3a45' },
  [VTile.WallTop]:   { bg: '#2a2a35' },
  [VTile.Door]:      { bg: '#5a4020' },
  [VTile.Water]:     { bg: '#152540' },
  [VTile.Tree]:      { bg: '#0a1a08', fg: '#1a3a15' },
  [VTile.Flower]:    { bg: '#1a2e15', fg: '#c06060' },
  [VTile.Fence]:     { bg: '#1a2e15', fg: '#4a3a20' },
  [VTile.Floor]:     { bg: '#3a3025' },
  [VTile.Counter]:   { bg: '#5a4a28' },
  [VTile.Well]:      { bg: '#3a3020', fg: '#5a5a60' },
  [VTile.Sign]:      { bg: '#1a2e15', fg: '#6a5a30' },
  [VTile.Chest]:     { bg: '#3a3025', fg: '#c9a84c' },
  [VTile.Bookshelf]: { bg: '#2a2018' },
  [VTile.Bed]:       { bg: '#3a3025', fg: '#6a3030' },
  [VTile.Table]:     { bg: '#3a3025', fg: '#5a4a28' },
  [VTile.Chair]:     { bg: '#3a3025', fg: '#4a3a20' },
  [VTile.Bridge]:    { bg: '#4a3a18' },
  [VTile.DungeonEntry]: { bg: '#0a0508' },
  [VTile.Carpet]:    { bg: '#4a1a1a' },
  [VTile.Throne]:    { bg: '#4a1a1a', fg: '#c9a84c' },
  [VTile.Barrel]:    { bg: '#3a3025', fg: '#5a4020' },
  [VTile.Roof]:      { bg: '#3a1a15' },
  [VTile.Stairs]:    { bg: '#3a3025', fg: '#6a6a70' },
  [VTile.Torch]:     { bg: '#3a3025', fg: '#c08020' },
  [VTile.Pot]:       { bg: '#3a3025', fg: '#6a5a40' },
  [VTile.Fountain]:  { bg: '#1a2e15', fg: '#4080c0' },
  [VTile.Dummy]:     { bg: '#1a2e15', fg: '#8a6a30' },
};

// #13: Village shop inventory that changes each visit
export interface DynamicShopItem {
  templateId: string;
  name: string;
  price: number;
  description: string;
}

const ALL_WEAPON_SHOP_POOL: DynamicShopItem[] = [
  { templateId: 'wooden_sword', name: 'こんぼう', price: 500, description: '攻撃力3 - 初心者向けの武器' },
  { templateId: 'bronze_sword', name: 'ブロンズソード', price: 1500, description: '攻撃力5 - 青銅製の剣' },
  { templateId: 'iron_sword', name: 'てつの剣', price: 3000, description: '攻撃力8 - 頼れる鉄の剣' },
  { templateId: 'steel_sword', name: 'はがねの剣', price: 5000, description: '攻撃力12 - 鍛錬された鋼鉄' },
  { templateId: 'katana', name: 'カタナ', price: 8000, description: '攻撃力15 - 鋭い斬撃' },
  { templateId: 'iron_shield', name: 'てつのたて', price: 1200, description: '防御力7 - 鉄製の盾' },
  { templateId: 'bronze_shield', name: 'うろこの盾', price: 800, description: '防御力4 - 青銅の盾' },
  { templateId: 'steel_shield', name: 'はがねの盾', price: 3500, description: '防御力10 - 頑丈な鋼鉄盾' },
  { templateId: 'wooden_shield', name: '木のたて', price: 300, description: '防御力2 - 木製の盾' },
];

const ALL_ITEM_SHOP_POOL: DynamicShopItem[] = [
  { templateId: 'heal_herb', name: '薬草', price: 100, description: 'HP25回復' },
  { templateId: 'big_heal_herb', name: '高級薬草', price: 300, description: 'HP100回復' },
  { templateId: 'big_riceball', name: 'おにぎり', price: 200, description: '満腹度100回復' },
  { templateId: 'special_riceball', name: '特製おにぎり', price: 500, description: '満腹度MAX回復' },
  { templateId: 'identify_scroll', name: '識別の巻物', price: 300, description: 'アイテムを識別' },
  { templateId: 'powerup_scroll', name: 'パワーアップの巻物', price: 800, description: '攻撃力一時上昇' },
  { templateId: 'knockback_staff', name: 'ふきとばしの杖', price: 500, description: 'モンスターを吹き飛ばす' },
  { templateId: 'slow_staff', name: '鈍足の杖', price: 600, description: 'モンスターの速度を下げる' },
  { templateId: 'paralysis_staff', name: 'かなしばりの杖', price: 900, description: 'モンスターを金縛り' },
  { templateId: 'antidote_herb', name: '毒消し草', price: 150, description: 'ちからを最大まで回復' },
  { templateId: 'strength_herb', name: 'ちからの種', price: 400, description: 'ちから+1 永続効果' },
  { templateId: 'warp_scroll', name: 'ワープの巻物', price: 400, description: 'ランダムな部屋にワープ' },
  { templateId: 'map_scroll', name: 'あかりの巻物', price: 600, description: 'フロア全体を表示' },
  { templateId: 'sight_herb', name: 'めぐすり草', price: 250, description: 'ワナを可視化' },
  { templateId: 'riceball', name: '小さいおにぎり', price: 100, description: '満腹度50回復' },
];

/** Generate a randomized shop inventory based on a seed */
export function generateShopInventory(seed: number, pool: DynamicShopItem[], count: number): DynamicShopItem[] {
  // Simple seeded shuffle
  const shuffled = [...pool];
  let s = Math.abs(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getWeaponShopPool(): DynamicShopItem[] { return ALL_WEAPON_SHOP_POOL; }
export function getItemShopPool(): DynamicShopItem[] { return ALL_ITEM_SHOP_POOL; }

// #14: Training ground cost calculation
export function getTrainingCost(level: number): number {
  return level * 500 + 500;
}

// #15: Fortune teller hints
export function getFortuneTellerHint(floorNumber: number, seed: number): string {
  const hints = [
    `占い師「次の階(${floorNumber + 1}F)には罠が多いようです...足元に気をつけて。」`,
    `占い師「${floorNumber + 2}F付近にモンスターハウスの気配がします...準備を万全に。」`,
    `占い師「深い階ほどレアなアイテムが眠っています。${Math.min(30, floorNumber + 5)}Fまで行けば良いものが...」`,
    `占い師「5の倍数の階にはボス級のモンスターがいます。回復アイテムを多めに。」`,
    `占い師「あなたには強い運命の力が...きっと深層でも生き残れるでしょう。」`,
    `占い師「通路では角を曲がる時に要注意。不意打ちを受けやすい場所です。」`,
  ];
  const idx = Math.abs(seed + floorNumber * 7) % hints.length;
  return hints[idx];
}

// #18: Blacksmith enhancement cost
export function getBlacksmithCost(currentEnhancement: number): number {
  return currentEnhancement * 500 + 500;
}

// #20: Museum collection percentage
export function getMuseumStats(discoveredTemplates: Set<string>, totalTemplates: number): { discovered: number; total: number; percentage: number } {
  const discovered = discoveredTemplates.size;
  return {
    discovered,
    total: totalTemplates,
    percentage: totalTemplates > 0 ? Math.floor((discovered / totalTemplates) * 100) : 0,
  };
}

// Seasonal flower palette: seeded by a floor-like value so colors vary per session
export function getSeasonalFlowerColors(seed: number): string[] {
  const palettes = [
    ['#d06060', '#d0a060', '#8060d0', '#d060a0', '#60a0d0'], // spring
    ['#ff6060', '#ff8040', '#ff4080', '#ff60c0', '#e04060'], // summer
    ['#c08040', '#d0a030', '#a06020', '#c06040', '#b08060'], // autumn
    ['#8080d0', '#6060c0', '#a0a0e0', '#9090c0', '#b0b0f0'], // winter
  ];
  const idx = Math.abs(Math.floor(seed * 7919)) % palettes.length;
  return palettes[idx];
}
