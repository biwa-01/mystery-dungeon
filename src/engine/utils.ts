import { Position, TileType, DungeonFloor } from '@/types/game';

// Seeded RNG (xorshift128)
export class SeededRandom {
  private state: [number, number, number, number];

  constructor(seed: number) {
    this.state = [seed, seed ^ 0x6d2b79f5, seed ^ 0xb5390a12, seed ^ 0x31cb4a8e];
    for (let i = 0; i < 20; i++) this.next();
  }

  next(): number {
    const t = this.state[3];
    let s = this.state[0];
    this.state[3] = this.state[2];
    this.state[2] = this.state[1];
    this.state[1] = s;
    let x = t ^ (t << 11);
    x = x ^ (x >>> 8);
    s = x ^ s ^ (s >>> 19);
    this.state[0] = s;
    return (s >>> 0) / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function posEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

export function isWalkable(floor: DungeonFloor, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  const t = floor.tiles[y][x];
  return t === TileType.Floor || t === TileType.Corridor || t === TileType.StairsDown || t === TileType.Trap;
}

export function isInRoom(floor: DungeonFloor, pos: Position): number {
  for (let i = 0; i < floor.rooms.length; i++) {
    const r = floor.rooms[i];
    if (pos.x >= r.x && pos.x < r.x + r.width && pos.y >= r.y && pos.y < r.y + r.height) {
      return i;
    }
  }
  return -1;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// A* pathfinding
export function astar(
  floor: DungeonFloor,
  start: Position,
  goal: Position,
  maxSteps: number = 200,
  avoidMonsters: boolean = true,
  monsterPositions?: Set<string>
): Position[] {
  const open: { pos: Position; g: number; f: number; parent: string | null }[] = [];
  const closed = new Map<string, { g: number; parent: string | null }>();

  const startKey = posKey(start);
  open.push({ pos: start, g: 0, f: chebyshev(start, goal), parent: null });

  let steps = 0;
  while (open.length > 0 && steps < maxSteps) {
    steps++;
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const currentKey = posKey(current.pos);

    if (posEqual(current.pos, goal)) {
      const path: Position[] = [];
      let key: string | null = currentKey;
      while (key && key !== startKey) {
        const [cx, cy] = key.split(',').map(Number);
        path.unshift({ x: cx, y: cy });
        key = closed.get(key)?.parent ?? null;
      }
      return path;
    }

    closed.set(currentKey, { g: current.g, parent: current.parent });

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.pos.x + dx;
        const ny = current.pos.y + dy;
        if (!isWalkable(floor, nx, ny)) continue;

        // Prevent diagonal movement through walls
        if (dx !== 0 && dy !== 0) {
          if (!isWalkable(floor, current.pos.x + dx, current.pos.y) ||
              !isWalkable(floor, current.pos.x, current.pos.y + dy)) {
            continue;
          }
        }

        const nKey = posKey({ x: nx, y: ny });
        if (closed.has(nKey)) continue;
        if (avoidMonsters && monsterPositions?.has(nKey) && !posEqual({ x: nx, y: ny }, goal)) continue;

        const g = current.g + (dx !== 0 && dy !== 0 ? 1.4 : 1);
        const existing = open.find(o => posKey(o.pos) === nKey);
        if (existing && existing.g <= g) continue;
        if (existing) {
          existing.g = g;
          existing.f = g + chebyshev({ x: nx, y: ny }, goal);
          existing.parent = currentKey;
        } else {
          open.push({
            pos: { x: nx, y: ny },
            g,
            f: g + chebyshev({ x: nx, y: ny }, goal),
            parent: currentKey,
          });
        }
      }
    }
  }
  return [];
}
