import { DungeonFloor, Room, TileType, Position, TrapType, TrapData, ItemCategory } from '@/types/game';
import { SeededRandom, generateId } from '../utils';
import { generateFloorItems, createItemFromTemplate } from '../data/items';

interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

const MIN_NODE_SIZE = 8;
const MIN_ROOM_SIZE = 4;
const BASE_MAX_ROOM_SIZE = 10;

function splitBSP(node: BSPNode, rng: SeededRandom): void {
  if (node.w < MIN_NODE_SIZE * 2 && node.h < MIN_NODE_SIZE * 2) return;

  const splitH = node.w < MIN_NODE_SIZE * 2
    ? true
    : node.h < MIN_NODE_SIZE * 2
      ? false
      : rng.next() > 0.5;

  if (splitH) {
    if (node.h < MIN_NODE_SIZE * 2) return;
    const split = rng.nextInt(MIN_NODE_SIZE, node.h - MIN_NODE_SIZE);
    node.left = { x: node.x, y: node.y, w: node.w, h: split };
    node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
  } else {
    if (node.w < MIN_NODE_SIZE * 2) return;
    const split = rng.nextInt(MIN_NODE_SIZE, node.w - MIN_NODE_SIZE);
    node.left = { x: node.x, y: node.y, w: split, h: node.h };
    node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
  }

  splitBSP(node.left!, rng);
  splitBSP(node.right!, rng);
}

function createRooms(node: BSPNode, rng: SeededRandom, rooms: Room[], floorNum: number = 1): void {
  if (node.left || node.right) {
    if (node.left) createRooms(node.left, rng, rooms, floorNum);
    if (node.right) createRooms(node.right, rng, rooms, floorNum);
    return;
  }

  const maxRoomSize = floorNum >= 15 ? 14 : BASE_MAX_ROOM_SIZE;
  const maxW = Math.min(maxRoomSize, node.w - 2);
  const maxH = Math.min(maxRoomSize, node.h - 2);
  if (maxW < MIN_ROOM_SIZE || maxH < MIN_ROOM_SIZE) return;

  const w = rng.nextInt(MIN_ROOM_SIZE, maxW);
  const h = rng.nextInt(MIN_ROOM_SIZE, maxH);
  const x = node.x + rng.nextInt(1, node.w - w - 1);
  const y = node.y + rng.nextInt(1, node.h - h - 1);

  const room: Room = { x, y, width: w, height: h, connected: false };
  node.room = room;
  rooms.push(room);
}

function getRoomCenter(room: Room): Position {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function getLeafRoom(node: BSPNode, rng: SeededRandom): Room | undefined {
  if (node.room) return node.room;
  const pickLeft = rng.next() > 0.5;
  if (pickLeft && node.left) {
    return getLeafRoom(node.left, rng) ?? (node.right ? getLeafRoom(node.right, rng) : undefined);
  }
  if (node.right) {
    return getLeafRoom(node.right, rng) ?? (node.left ? getLeafRoom(node.left, rng) : undefined);
  }
  return undefined;
}

function carveCorridor(tiles: TileType[][], from: Position, to: Position, rng: SeededRandom, wide: boolean = false): void {
  let { x, y } = from;
  const goHFirst = rng.next() > 0.5;
  const height = tiles.length;
  const width = tiles[0].length;

  const carve = (cx: number, cy: number) => {
    if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
      if (tiles[cy][cx] === TileType.Wall) tiles[cy][cx] = TileType.Corridor;
    }
    if (wide) {
      if (cy + 1 >= 0 && cy + 1 < height && cx >= 0 && cx < width) {
        if (tiles[cy + 1][cx] === TileType.Wall) tiles[cy + 1][cx] = TileType.Corridor;
      }
    }
  };

  if (goHFirst) {
    while (x !== to.x) {
      x += x < to.x ? 1 : -1;
      carve(x, y);
    }
    while (y !== to.y) {
      y += y < to.y ? 1 : -1;
      carve(x, y);
    }
  } else {
    while (y !== to.y) {
      y += y < to.y ? 1 : -1;
      carve(x, y);
    }
    while (x !== to.x) {
      x += x < to.x ? 1 : -1;
      carve(x, y);
    }
  }
}

function connectBSP(node: BSPNode, tiles: TileType[][], rng: SeededRandom): void {
  if (!node.left || !node.right) return;

  connectBSP(node.left, tiles, rng);
  connectBSP(node.right, tiles, rng);

  const roomA = getLeafRoom(node.left, rng);
  const roomB = getLeafRoom(node.right, rng);
  if (roomA && roomB) {
    const wide = rng.next() < 0.1;
    carveCorridor(tiles, getRoomCenter(roomA), getRoomCenter(roomB), rng, wide);
  }
}

function generateTraps(rooms: Room[], rng: SeededRandom, floorNum: number): TrapData[] {
  const traps: TrapData[] = [];
  const trapTypes = Object.values(TrapType);
  const numTraps = rng.nextInt(2, Math.min(3 + Math.floor(floorNum / 2) + Math.floor(floorNum / 10), 15));

  for (let i = 0; i < numTraps; i++) {
    const room = rng.pick(rooms);
    const pos: Position = {
      x: room.x + rng.nextInt(0, room.width - 1),
      y: room.y + rng.nextInt(0, room.height - 1),
    };
    traps.push({
      pos,
      type: rng.pick(trapTypes),
      visible: false,
    });
  }
  return traps;
}

function verifyConnectivity(tiles: TileType[][], width: number, height: number, start: Position, rooms: Room[]): boolean {
  const visited = new Set<string>();
  const queue: Position[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      if (tiles[n.y][n.x] === TileType.Wall) continue;
      visited.add(key);
      queue.push(n);
    }
  }

  for (const room of rooms) {
    const cx = Math.floor(room.x + room.width / 2);
    const cy = Math.floor(room.y + room.height / 2);
    if (!visited.has(`${cx},${cy}`)) return false;
  }
  return true;
}

function findDeadEnds(tiles: TileType[][], width: number, height: number): Position[] {
  const deadEnds: Position[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TileType.Corridor) continue;
      let walkableNeighbors = 0;
      if (tiles[y - 1][x] !== TileType.Wall) walkableNeighbors++;
      if (tiles[y + 1][x] !== TileType.Wall) walkableNeighbors++;
      if (tiles[y][x - 1] !== TileType.Wall) walkableNeighbors++;
      if (tiles[y][x + 1] !== TileType.Wall) walkableNeighbors++;
      if (walkableNeighbors === 1) {
        deadEnds.push({ x, y });
      }
    }
  }
  return deadEnds;
}

// #19: River/water features - generate water channels in rooms (floor 8+)
function generateWaterFeatures(tiles: TileType[][], rooms: Room[], rng: SeededRandom, floorNum: number): void {
  if (floorNum < 8) return;
  for (const room of rooms) {
    if (rng.next() > 0.15) continue; // 15% chance per room
    if (room.width < 5 || room.height < 5) continue;
    // Horizontal or vertical water channel through middle of room
    const horizontal = rng.next() > 0.5;
    if (horizontal) {
      const wy = room.y + Math.floor(room.height / 2);
      for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
        if (tiles[wy][x] === TileType.Floor) {
          tiles[wy][x] = TileType.Water;
        }
      }
    } else {
      const wx = room.x + Math.floor(room.width / 2);
      for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
        if (tiles[y][wx] === TileType.Floor) {
          tiles[y][wx] = TileType.Water;
        }
      }
    }
  }
}

// #20: Pillar rooms - rooms with decorative pillar patterns
function generatePillarRooms(tiles: TileType[][], rooms: Room[], rng: SeededRandom): void {
  for (const room of rooms) {
    if (rng.next() > 0.12) continue; // 12% chance per room
    if (room.width < 6 || room.height < 6) continue;
    // Place pillars in a grid pattern (every other tile)
    for (let y = room.y + 1; y < room.y + room.height - 1; y += 2) {
      for (let x = room.x + 1; x < room.x + room.width - 1; x += 2) {
        if (tiles[y][x] === TileType.Floor) {
          tiles[y][x] = TileType.Wall;
        }
      }
    }
  }
}

// #21: Maze corridors - some corridors have dead-end branches
function generateMazeCorridors(tiles: TileType[][], rng: SeededRandom, width: number, height: number): void {
  if (rng.next() > 0.25) return; // 25% chance per floor
  // Find corridor tiles and add random branches
  const corridorTiles: Position[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y][x] === TileType.Corridor) {
        corridorTiles.push({ x, y });
      }
    }
  }
  const branchCount = rng.nextInt(2, 5);
  for (let b = 0; b < branchCount && corridorTiles.length > 0; b++) {
    const start = rng.pick(corridorTiles);
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    const dir = rng.pick(dirs);
    const length = rng.nextInt(2, 4);
    let cx = start.x;
    let cy = start.y;
    for (let i = 0; i < length; i++) {
      cx += dir.dx;
      cy += dir.dy;
      if (cx <= 1 || cx >= width - 1 || cy <= 1 || cy >= height - 1) break;
      if (tiles[cy][cx] === TileType.Wall) {
        tiles[cy][cx] = TileType.Corridor;
      } else {
        break; // Don't overwrite existing features
      }
    }
  }
}

// #22: Secret rooms - hidden rooms connected by breakable walls (floor 10+)
function generateSecretRooms(tiles: TileType[][], rooms: Room[], rng: SeededRandom, floorNum: number, width: number, height: number, floorItems: import('@/types/game').GameItem[]): void {
  if (floorNum < 10) return;
  if (rng.next() > 0.2) return; // 20% chance per floor

  // Find a wall section adjacent to an existing room
  const sourceRoom = rng.pick(rooms);
  const center = getRoomCenter(sourceRoom);

  // Try to place a 3x3 secret room nearby
  const directions = [
    { dx: sourceRoom.width + 2, dy: 0 },
    { dx: -(4), dy: 0 },
    { dx: 0, dy: sourceRoom.height + 2 },
    { dx: 0, dy: -(4) },
  ];

  for (const dir of rng.shuffle(directions)) {
    const sx = center.x + dir.dx;
    const sy = center.y + dir.dy;

    // Check bounds
    if (sx < 2 || sx + 3 >= width - 1 || sy < 2 || sy + 3 >= height - 1) continue;

    // Check if area is all walls
    let canPlace = true;
    for (let dy = 0; dy < 3 && canPlace; dy++) {
      for (let dx = 0; dx < 3 && canPlace; dx++) {
        if (tiles[sy + dy][sx + dx] !== TileType.Wall) canPlace = false;
      }
    }
    if (!canPlace) continue;

    // Carve secret room
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        tiles[sy + dy][sx + dx] = TileType.Floor;
      }
    }

    // Connect to source room with a corridor
    const secretCenter = { x: sx + 1, y: sy + 1 };
    carveCorridor(tiles, center, secretCenter, rng);

    // Add the room
    const secretRoom: Room = { x: sx, y: sy, width: 3, height: 3, connected: true };
    rooms.push(secretRoom);

    // Place a good item in the secret room
    const goodItems = ['revival_herb', 'blank_scroll', 'life_herb', 'katana', 'gold_shield'];
    const itemId = rng.pick(goodItems);
    const item = createItemFromTemplate(itemId, false);
    if (item) {
      item.floorPos = { x: sx + 1, y: sy + 1 };
      floorItems.push(item);
    }

    break;
  }
}

// #23: Item shops - generate shop rooms on floor 5+ (10% chance)
function generateShopRoom(rooms: Room[], rng: SeededRandom, floorNum: number, floorItems: import('@/types/game').GameItem[]): void {
  if (floorNum < 5) return;
  if (rng.next() > 0.10) return; // 10% chance

  const shopCandidates = rooms.filter(r => r.width >= 4 && r.height >= 4);
  if (shopCandidates.length === 0) return;

  const shopRoom = rng.pick(shopCandidates);
  const shopItemCount = rng.nextInt(3, 6);

  for (let i = 0; i < shopItemCount; i++) {
    // Shop items are rarer/more expensive
    const shopTemplateIds = [
      'big_heal_herb', 'life_herb', 'strength_herb', 'revival_herb',
      'sanctuary_scroll', 'blank_scroll', 'map_scroll',
      'paralysis_staff', 'seal_staff', 'substitute_staff',
      'katana', 'steel_sword', 'gold_shield', 'heavy_shield',
      'special_riceball',
    ];
    const templateId = rng.pick(shopTemplateIds);
    const item = createItemFromTemplate(templateId, true);
    if (item) {
      const ix = shopRoom.x + rng.nextInt(0, shopRoom.width - 1);
      const iy = shopRoom.y + rng.nextInt(0, shopRoom.height - 1);
      item.floorPos = { x: ix, y: iy };
      // Mark as shop item with blessed (shop items are identified and blessed)
      item.identified = true;
      item.blessed = true;
      floorItems.push(item);
    }
  }
}

// #25: Fountain tiles - stepping heals 5 HP (one-time use, tracked externally)
function generateFountains(tiles: TileType[][], rooms: Room[], rng: SeededRandom, floorNum: number): Position[] {
  const fountains: Position[] = [];
  if (floorNum < 3) return fountains;

  for (const room of rooms) {
    if (rng.next() > 0.08) continue; // 8% chance per room
    const fx = room.x + rng.nextInt(1, Math.max(1, room.width - 2));
    const fy = room.y + rng.nextInt(1, Math.max(1, room.height - 2));
    if (tiles[fy][fx] === TileType.Floor) {
      // Mark as Water tile to visually indicate fountain
      tiles[fy][fx] = TileType.Water;
      fountains.push({ x: fx, y: fy });
    }
  }
  return fountains;
}

export function generateDungeon(
  width: number,
  height: number,
  rng: SeededRandom,
  floorNum: number
): DungeonFloor {
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array(width).fill(TileType.Wall)
  );
  const rooms: Room[] = [];

  const root: BSPNode = { x: 0, y: 0, w: width, h: height };
  splitBSP(root, rng);
  createRooms(root, rng, rooms, floorNum);

  // Carve rooms into tiles
  for (const room of rooms) {
    for (let ry = room.y; ry < room.y + room.height; ry++) {
      for (let rx = room.x; rx < room.x + room.width; rx++) {
        if (ry > 0 && ry < height - 1 && rx > 0 && rx < width - 1) {
          tiles[ry][rx] = TileType.Floor;
        }
      }
    }
  }

  // Connect rooms via BSP corridors
  connectBSP(root, tiles, rng);

  // Ensure full connectivity with a fallback pass
  if (rooms.length > 1) {
    for (let i = 1; i < rooms.length; i++) {
      const prev = getRoomCenter(rooms[i - 1]);
      const curr = getRoomCenter(rooms[i]);
      carveCorridor(tiles, prev, curr, rng);
    }
  }

  // #20: Pillar rooms
  generatePillarRooms(tiles, rooms, rng);

  // #19: Water features
  generateWaterFeatures(tiles, rooms, rng, floorNum);

  // #21: Maze corridors
  generateMazeCorridors(tiles, rng, width, height);

  // Place stairs in a random room (not the first one if possible)
  const stairsRoom = rooms.length > 1 ? rng.pick(rooms.slice(1)) : rooms[0];
  const stairsPos: Position = {
    x: stairsRoom.x + rng.nextInt(0, stairsRoom.width - 1),
    y: stairsRoom.y + rng.nextInt(0, stairsRoom.height - 1),
  };
  // Ensure stairs is on a floor tile (not pillar/water)
  if (tiles[stairsPos.y][stairsPos.x] !== TileType.Floor) {
    // Find nearest floor tile in the room
    for (let dy = 0; dy < stairsRoom.height; dy++) {
      for (let dx = 0; dx < stairsRoom.width; dx++) {
        const sx = stairsRoom.x + dx;
        const sy = stairsRoom.y + dy;
        if (tiles[sy][sx] === TileType.Floor) {
          stairsPos.x = sx;
          stairsPos.y = sy;
          break;
        }
      }
      if (tiles[stairsPos.y][stairsPos.x] === TileType.Floor) break;
    }
  }
  tiles[stairsPos.y][stairsPos.x] = TileType.StairsDown;

  // BFS connectivity verification
  if (rooms.length > 1) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (verifyConnectivity(tiles, width, height, stairsPos, rooms)) break;
      for (const room of rooms) {
        carveCorridor(tiles, getRoomCenter(room), stairsPos, rng);
      }
    }
  }

  // Generate traps
  const traps = generateTraps(rooms, rng, floorNum);
  for (const trap of traps) {
    if (tiles[trap.pos.y][trap.pos.x] === TileType.Floor) {
      tiles[trap.pos.y][trap.pos.x] = TileType.Trap;
    }
  }

  const visible = Array.from({ length: height }, () => Array(width).fill(false));
  const explored = Array.from({ length: height }, () => Array(width).fill(false));

  // #24: Dark rooms - some rooms start unexplored even when entered (floor 12+)
  // (This is handled by FOV system - we mark rooms as dark via a flag)
  // For now, we don't pre-explore them, which is default behavior

  // Treasure room on floors 5+ (10% chance)
  const floorItems: import('@/types/game').GameItem[] = [];
  if (floorNum >= 5 && rng.next() < 0.1 && rooms.length > 2) {
    const smallRooms = rooms.filter(r => r.width <= 6 && r.height <= 6);
    if (smallRooms.length > 0) {
      const treasureRoom = rng.pick(smallRooms);
      const treasureCount = rng.nextInt(3, 5);
      const treasureItems = generateFloorItems(floorNum, treasureCount, rng);
      for (const item of treasureItems) {
        const ix = treasureRoom.x + rng.nextInt(0, treasureRoom.width - 1);
        const iy = treasureRoom.y + rng.nextInt(0, treasureRoom.height - 1);
        if (tiles[iy][ix] === TileType.Floor) {
          item.floorPos = { x: ix, y: iy };
          floorItems.push(item);
        }
      }
    }
  }

  // Place items at corridor dead ends
  const deadEnds = findDeadEnds(tiles, width, height);
  for (const de of deadEnds) {
    if (rng.next() < 0.3) {
      const deItems = generateFloorItems(floorNum, 1, rng);
      if (deItems.length > 0) {
        deItems[0].floorPos = { x: de.x, y: de.y };
        floorItems.push(deItems[0]);
      }
    }
  }

  // #22: Secret rooms
  generateSecretRooms(tiles, rooms, rng, floorNum, width, height, floorItems);

  // #23: Item shops
  generateShopRoom(rooms, rng, floorNum, floorItems);

  // #25: Fountain tiles
  const fountainPositions = generateFountains(tiles, rooms, rng, floorNum);

  return {
    width,
    height,
    tiles,
    rooms,
    items: floorItems,
    monsters: [],
    traps,
    stairsPos,
    visible,
    explored,
    monsterHouseRoom: null,
    sanctuaryTiles: [],
  };
}

export function getSpawnPosition(floor: DungeonFloor, rng: SeededRandom, avoidPositions: Position[] = []): Position {
  const avoidSet = new Set(avoidPositions.map(p => `${p.x},${p.y}`));
  for (let attempt = 0; attempt < 200; attempt++) {
    const room = rng.pick(floor.rooms);
    const x = room.x + rng.nextInt(0, room.width - 1);
    const y = room.y + rng.nextInt(0, room.height - 1);
    const key = `${x},${y}`;
    if (
      floor.tiles[y][x] === TileType.Floor &&
      !avoidSet.has(key) &&
      !floor.monsters.some(m => m.pos.x === x && m.pos.y === y)
    ) {
      return { x, y };
    }
  }
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (floor.tiles[y][x] === TileType.Floor) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}
