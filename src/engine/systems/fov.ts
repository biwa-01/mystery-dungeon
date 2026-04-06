import { DungeonFloor, TileType, Position } from '@/types/game';
import { isInRoom } from '../utils';

export function getTorchRadius(turnCount: number): number {
  return 1.0 + Math.sin(turnCount * 0.7) * 0.15;
}

// #24: Dark rooms - check if room should be dark (floor 12+, ~20% of rooms)
function isDarkRoom(roomIndex: number, floorNumber: number): boolean {
  if (floorNumber < 12) return false;
  // Use room index as a simple deterministic check
  // About 20% of rooms are dark on eligible floors
  return (roomIndex * 7 + floorNumber * 13) % 5 === 0;
}

export function computeFOV(floor: DungeonFloor, playerPos: Position, floorNumber: number = 1): void {
  // Reset visibility
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      floor.visible[y][x] = false;
    }
  }

  // Player tile always visible
  floor.visible[playerPos.y][playerPos.x] = true;
  floor.explored[playerPos.y][playerPos.x] = true;

  const roomIndex = isInRoom(floor, playerPos);

  if (roomIndex >= 0) {
    // #24: Dark rooms - only reveal 2-tile radius instead of full room
    if (isDarkRoom(roomIndex, floorNumber)) {
      // Limited visibility in dark rooms
      const darkRadius = 2;
      for (let dy = -darkRadius; dy <= darkRadius; dy++) {
        for (let dx = -darkRadius; dx <= darkRadius; dx++) {
          const nx = playerPos.x + dx;
          const ny = playerPos.y + dy;
          if (nx >= 0 && nx < floor.width && ny >= 0 && ny < floor.height) {
            floor.visible[ny][nx] = true;
            floor.explored[ny][nx] = true;
          }
        }
      }
    } else {
      // Normal room: reveal entire room + 1 tile border
      const room = floor.rooms[roomIndex];
      for (let y = room.y - 1; y <= room.y + room.height; y++) {
        for (let x = room.x - 1; x <= room.x + room.width; x++) {
          if (y >= 0 && y < floor.height && x >= 0 && x < floor.width) {
            floor.visible[y][x] = true;
            floor.explored[y][x] = true;
          }
        }
      }
      // Also reveal corridor entrances from the room
      revealCorridorsFromRoom(floor, room);
    }
  }

  // Shadowcasting for corridor vision (1-tile radius in corridors)
  castRays(floor, playerPos);
}

function revealCorridorsFromRoom(floor: DungeonFloor, room: { x: number; y: number; width: number; height: number }): void {
  for (let x = room.x; x < room.x + room.width; x++) {
    if (room.y - 1 >= 0 && floor.tiles[room.y - 1][x] === TileType.Corridor) {
      floor.visible[room.y - 1][x] = true;
      floor.explored[room.y - 1][x] = true;
    }
    const by = room.y + room.height;
    if (by < floor.height && floor.tiles[by][x] === TileType.Corridor) {
      floor.visible[by][x] = true;
      floor.explored[by][x] = true;
    }
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    if (room.x - 1 >= 0 && floor.tiles[y][room.x - 1] === TileType.Corridor) {
      floor.visible[y][room.x - 1] = true;
      floor.explored[y][room.x - 1] = true;
    }
    const rx = room.x + room.width;
    if (rx < floor.width && floor.tiles[y][rx] === TileType.Corridor) {
      floor.visible[y][rx] = true;
      floor.explored[y][rx] = true;
    }
  }
}

function castRays(floor: DungeonFloor, origin: Position): void {
  const radius = 1;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = origin.x + dx;
      const ny = origin.y + dy;
      if (nx >= 0 && nx < floor.width && ny >= 0 && ny < floor.height) {
        floor.visible[ny][nx] = true;
        floor.explored[ny][nx] = true;
      }
    }
  }

  // Extended corridor line-of-sight
  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];
  for (const { dx, dy } of dirs) {
    let cx = origin.x + dx;
    let cy = origin.y + dy;
    for (let d = 0; d < 10; d++) {
      if (cx < 0 || cx >= floor.width || cy < 0 || cy >= floor.height) break;
      const t = floor.tiles[cy][cx];
      if (t === TileType.Wall) {
        floor.visible[cy][cx] = true;
        floor.explored[cy][cx] = true;
        break;
      }
      floor.visible[cy][cx] = true;
      floor.explored[cy][cx] = true;
      cx += dx;
      cy += dy;
    }
  }
}
