import { DungeonFloor, Room, TileType, Position, TrapType, TrapData } from '@/types/game';
import { SeededRandom, generateId } from '../utils';

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
const MAX_ROOM_SIZE = 10;

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

function createRooms(node: BSPNode, rng: SeededRandom, rooms: Room[]): void {
  if (node.left || node.right) {
    if (node.left) createRooms(node.left, rng, rooms);
    if (node.right) createRooms(node.right, rng, rooms);
    return;
  }

  const maxW = Math.min(MAX_ROOM_SIZE, node.w - 2);
  const maxH = Math.min(MAX_ROOM_SIZE, node.h - 2);
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

function carveCorridor(tiles: TileType[][], from: Position, to: Position, rng: SeededRandom): void {
  let { x, y } = from;
  const goHFirst = rng.next() > 0.5;

  if (goHFirst) {
    while (x !== to.x) {
      x += x < to.x ? 1 : -1;
      if (tiles[y][x] === TileType.Wall) tiles[y][x] = TileType.Corridor;
    }
    while (y !== to.y) {
      y += y < to.y ? 1 : -1;
      if (tiles[y][x] === TileType.Wall) tiles[y][x] = TileType.Corridor;
    }
  } else {
    while (y !== to.y) {
      y += y < to.y ? 1 : -1;
      if (tiles[y][x] === TileType.Wall) tiles[y][x] = TileType.Corridor;
    }
    while (x !== to.x) {
      x += x < to.x ? 1 : -1;
      if (tiles[y][x] === TileType.Wall) tiles[y][x] = TileType.Corridor;
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
    carveCorridor(tiles, getRoomCenter(roomA), getRoomCenter(roomB), rng);
  }
}

function generateTraps(rooms: Room[], rng: SeededRandom, floorNum: number): TrapData[] {
  const traps: TrapData[] = [];
  const trapTypes = Object.values(TrapType);
  const numTraps = rng.nextInt(2, Math.min(3 + Math.floor(floorNum / 3), 10));

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
  createRooms(root, rng, rooms);

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

  // Place stairs in a random room (not the first one if possible)
  const stairsRoom = rooms.length > 1 ? rng.pick(rooms.slice(1)) : rooms[0];
  const stairsPos: Position = {
    x: stairsRoom.x + rng.nextInt(0, stairsRoom.width - 1),
    y: stairsRoom.y + rng.nextInt(0, stairsRoom.height - 1),
  };
  tiles[stairsPos.y][stairsPos.x] = TileType.StairsDown;

  // Generate traps
  const traps = generateTraps(rooms, rng, floorNum);
  for (const trap of traps) {
    if (tiles[trap.pos.y][trap.pos.x] === TileType.Floor) {
      tiles[trap.pos.y][trap.pos.x] = TileType.Trap;
    }
  }

  const visible = Array.from({ length: height }, () => Array(width).fill(false));
  const explored = Array.from({ length: height }, () => Array(width).fill(false));

  return {
    width,
    height,
    tiles,
    rooms,
    items: [],
    monsters: [],
    traps,
    stairsPos,
    visible,
    explored,
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
  // Fallback: first floor tile
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (floor.tiles[y][x] === TileType.Floor) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}
