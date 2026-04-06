import {
  Monster, GameState, StatusEffect, MonsterBehavior, CombatLog, Position,
} from '@/types/game';
import { MONSTER_TEMPLATES } from '../data/monsters';
import { SeededRandom, astar, posKey, chebyshev, isWalkable, generateId, isInRoom } from '../utils';
import { monsterAttackPlayer, handleMonsterAbility, handleMonsterRangedAbility } from './combat';

export function spawnMonsters(
  floorNum: number,
  count: number,
  rng: SeededRandom,
  occupiedPositions: Set<string>,
  floor: { rooms: { x: number; y: number; width: number; height: number }[]; tiles: number[][]; width: number; height: number }
): Monster[] {
  const available = MONSTER_TEMPLATES.filter(
    t => t.minFloor <= floorNum && t.maxFloor >= floorNum
  );
  if (available.length === 0) return [];

  const minVariety = Math.min(3, available.length);
  const guaranteedTypes = rng.shuffle([...available]).slice(0, minVariety);

  const monsters: Monster[] = [];
  for (let i = 0; i < count; i++) {
    const template = i < guaranteedTypes.length ? guaranteedTypes[i] : rng.pick(available);
    let pos = { x: 0, y: 0 };
    for (let attempt = 0; attempt < 100; attempt++) {
      const room = rng.pick(floor.rooms);
      const x = room.x + rng.nextInt(0, room.width - 1);
      const y = room.y + rng.nextInt(0, room.height - 1);
      const key = `${x},${y}`;
      if (!occupiedPositions.has(key) && floor.tiles[y][x] === 1) {
        pos = { x, y };
        occupiedPositions.add(key);
        break;
      }
    }

    const sleeping = rng.next() < template.sleepChance;

    // #15: Monster level scaling - +1 to all stats per 5 floors past their minFloor
    const floorBonus = Math.floor(Math.max(0, floorNum - template.minFloor) / 5);
    const scaledHp = template.hp + Math.floor(floorNum * 0.5) + floorBonus * 2;
    const scaledAtk = template.attack + Math.floor(floorNum * 0.3) + floorBonus;
    const scaledDef = template.defense + Math.floor(floorNum * 0.2) + floorBonus;

    monsters.push({
      id: generateId(),
      templateId: template.id,
      name: template.name,
      displayChar: template.displayChar,
      color: template.color,
      pos,
      hp: scaledHp,
      maxHp: scaledHp,
      attack: scaledAtk,
      defense: scaledDef,
      exp: template.exp + floorNum,
      level: 1 + Math.floor(floorNum / 3),
      speed: template.speed,
      behavior: template.behavior,
      abilities: [...template.abilities],
      statuses: [],
      sleeping,
      awakened: !sleeping,
      statusImmunities: template.statusImmunities ? [...template.statusImmunities] : undefined,
    });
  }
  return monsters;
}

function isSanctuaryTile(state: GameState, x: number, y: number): boolean {
  return (state.floor.sanctuaryTiles ?? []).some(t => t.x === x && t.y === y);
}

// #12: Simple BFS pathfinding for monsters (max 10 steps)
function bfsPathfind(state: GameState, from: Position, to: Position, monsterPositions: Set<string>): Position | null {
  const queue: { pos: Position; path: Position[] }[] = [{ pos: from, path: [] }];
  const visited = new Set<string>();
  visited.add(posKey(from));

  let steps = 0;
  while (queue.length > 0 && steps < 10) {
    steps++;
    const current = queue.shift()!;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];

    for (const { dx, dy } of dirs) {
      const nx = current.pos.x + dx;
      const ny = current.pos.y + dy;
      const nKey = posKey({ x: nx, y: ny });

      if (visited.has(nKey)) continue;
      if (!isWalkable(state.floor, nx, ny)) continue;
      // Prevent diagonal movement through walls
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(state.floor, current.pos.x + dx, current.pos.y) ||
            !isWalkable(state.floor, current.pos.x, current.pos.y + dy)) {
          continue;
        }
      }

      visited.add(nKey);
      const newPath = [...current.path, { x: nx, y: ny }];

      if (nx === to.x && ny === to.y) {
        return newPath.length > 0 ? newPath[0] : null;
      }

      if (!monsterPositions.has(nKey)) {
        queue.push({ pos: { x: nx, y: ny }, path: newPath });
      }
    }
  }
  return null;
}

// #14: Smart monster targeting - find adjacent tile closest to player
function getBestAdjacentMove(monster: Monster, target: Position, state: GameState, monsterPositions: Set<string>): Position | null {
  let bestPos: Position | null = null;
  let bestDist = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = monster.pos.x + dx;
      const ny = monster.pos.y + dy;

      if (!isWalkable(state.floor, nx, ny)) continue;
      if (isSanctuaryTile(state, nx, ny)) continue;
      if (state.player.pos.x === nx && state.player.pos.y === ny) continue;
      const nKey = posKey({ x: nx, y: ny });
      if (monsterPositions.has(nKey)) continue;

      // Prevent diagonal through walls
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(state.floor, monster.pos.x + dx, monster.pos.y) ||
            !isWalkable(state.floor, monster.pos.x, monster.pos.y + dy)) {
          continue;
        }
      }

      const dist = chebyshev({ x: nx, y: ny }, target);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = { x: nx, y: ny };
      }
    }
  }
  return bestPos;
}

// #11: Pack behavior - wolf-type (aggressive) monsters try to cluster
function isPackMonster(templateId: string): boolean {
  return templateId === 'army_ant' || templateId === 'skeleton_knight' || templateId === 'wolf';
}

function findNearestPackAlly(state: GameState, monster: Monster): Position | null {
  let nearest: Position | null = null;
  let nearestDist = Infinity;
  for (const other of state.floor.monsters) {
    if (other.id === monster.id) continue;
    if (other.templateId !== monster.templateId) continue;
    const d = chebyshev(monster.pos, other.pos);
    if (d > 1 && d <= 6 && d < nearestDist) {
      nearestDist = d;
      nearest = other.pos;
    }
  }
  return nearest;
}

export function processMonsterTurns(state: GameState): CombatLog[] {
  const logs: CombatLog[] = [];
  const monsterPositions = new Set(state.floor.monsters.map(m => posKey(m.pos)));

  for (const monster of [...state.floor.monsters]) {
    if (monster.hp <= 0) continue;

    // Status effects
    if (monster.statuses.some(s => s.type === StatusEffect.Paralysis)) {
      for (const s of monster.statuses) s.remaining--;
      monster.statuses = monster.statuses.filter(s => s.remaining > 0);
      continue;
    }
    if (monster.statuses.some(s => s.type === StatusEffect.Sleep)) {
      for (const s of monster.statuses) {
        if (s.type === StatusEffect.Sleep) s.remaining--;
      }
      monster.statuses = monster.statuses.filter(s => s.remaining > 0);
      if (!monster.statuses.some(s => s.type === StatusEffect.Sleep)) {
        monster.awakened = true;
      }
      continue;
    }

    // Slow speed: skip every other turn
    if (monster.speed === 0 && state.player.turnCount % 2 === 0) continue;

    // Speed 2: acts twice
    const actCount = monster.speed === 2 ? 2 : 1;

    for (let act = 0; act < actCount; act++) {
      if (monster.hp <= 0) break;

      const dist = chebyshev(monster.pos, state.player.pos);

      // Sleeping check
      const aggroRange = Math.min(2 + Math.floor(state.floorNumber / 5), 6);
      if (monster.sleeping && !monster.awakened) {
        // #18: Sleeping monster random wake - 5% chance per turn for sleeping monsters in player's room
        const playerRoom = isInRoom(state.floor, state.player.pos);
        const monsterRoom = isInRoom(state.floor, monster.pos);
        if (playerRoom >= 0 && playerRoom === monsterRoom && Math.random() < 0.05) {
          monster.sleeping = false;
          monster.awakened = true;
          logs.push({
            message: `${monster.name}は目を覚ました！`,
            turn: state.player.turnCount,
            type: 'info',
          });
        } else if (dist <= aggroRange) {
          monster.sleeping = false;
          monster.awakened = true;
        } else {
          continue;
        }
      }

      // Adjacent to player? Attack or use ability
      if (dist <= 1) {
        if (isSanctuaryTile(state, state.player.pos.x, state.player.pos.y)) {
          continue;
        }
        // Try special ability first
        if (monster.abilities.length > 0 && Math.random() < 0.4) {
          const abilityLogs = handleMonsterAbility(state, monster);
          if (abilityLogs.length > 0) {
            logs.push(...abilityLogs);
            continue;
          }
        }
        // Normal attack
        logs.push(...monsterAttackPlayer(state, monster));
        continue;
      }

      // Try ranged/conditional abilities when not adjacent
      if (monster.abilities.length > 0) {
        const rangedLogs = handleMonsterRangedAbility(state, monster);
        if (rangedLogs.length > 0) {
          logs.push(...rangedLogs);
          continue;
        }
      }

      // Confused: random movement
      if (monster.statuses.some(s => s.type === StatusEffect.Confusion)) {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const nx = monster.pos.x + dx;
        const ny = monster.pos.y + dy;
        if (isWalkable(state.floor, nx, ny) &&
          !isSanctuaryTile(state, nx, ny) &&
          !(state.player.pos.x === nx && state.player.pos.y === ny) &&
          !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === nx && m.pos.y === ny)) {
          monsterPositions.delete(posKey(monster.pos));
          monster.pos = { x: nx, y: ny };
          monsterPositions.add(posKey(monster.pos));
        }
        continue;
      }

      // Movement AI
      if (monster.behavior === MonsterBehavior.Stationary) continue;

      // #7: Monster flee behavior - monsters below 20% HP use fleeChance field
      const tmpl = MONSTER_TEMPLATES.find(t => t.id === monster.templateId);
      const isThiefType = monster.templateId === 'thief' || monster.templateId === 'rat' || monster.templateId === 'thief_leader';
      const hasFleeChance = tmpl?.fleeChance && Math.random() < tmpl.fleeChance;
      const lowHpFlee = monster.hp < monster.maxHp * 0.2 && tmpl?.fleeChance !== undefined && tmpl.fleeChance > 0;
      const shouldFlee = hasFleeChance || lowHpFlee || (isThiefType && (monster.droppedItem !== undefined || monster.hp < monster.maxHp * 0.5));

      if (shouldFlee && dist <= 8) {
        const dx = monster.pos.x - state.player.pos.x;
        const dy = monster.pos.y - state.player.pos.y;
        const nd = Math.sqrt(dx * dx + dy * dy) || 1;
        const fleeX = Math.round(dx / nd);
        const fleeY = Math.round(dy / nd);
        const nx = monster.pos.x + fleeX;
        const ny = monster.pos.y + fleeY;
        if (isWalkable(state.floor, nx, ny) &&
          !isSanctuaryTile(state, nx, ny) &&
          !(state.player.pos.x === nx && state.player.pos.y === ny) &&
          !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === nx && m.pos.y === ny)) {
          monsterPositions.delete(posKey(monster.pos));
          monster.pos = { x: nx, y: ny };
          monsterPositions.add(posKey(monster.pos));
        }
        continue;
      }

      // #17: Monster memory - track last known player position
      const canSeePlayer = dist <= 10 && state.floor.visible[monster.pos.y]?.[monster.pos.x];
      const isAggressive = monster.behavior === MonsterBehavior.Aggressive;

      if (canSeePlayer || isAggressive || (monster.lastKnownPlayerPos && dist <= 15)) {
        if (canSeePlayer) {
          monster.lastKnownPlayerPos = { ...state.player.pos };
        }

        const target = monster.lastKnownPlayerPos ?? state.player.pos;

        // #11: Pack behavior - if pack monster and ally nearby, try to move toward ally first (30% chance)
        if (isPackMonster(monster.templateId) && Math.random() < 0.3) {
          const allyPos = findNearestPackAlly(state, monster);
          if (allyPos) {
            const packMove = getBestAdjacentMove(monster, allyPos, state, monsterPositions);
            if (packMove && chebyshev(packMove, state.player.pos) <= chebyshev(monster.pos, state.player.pos) + 2) {
              monsterPositions.delete(posKey(monster.pos));
              monster.pos = packMove;
              monsterPositions.add(posKey(monster.pos));
              continue;
            }
          }
        }

        // #12: BFS pathfinding when A* fails or for short range
        const path = astar(state.floor, monster.pos, target, 50, true, monsterPositions);

        if (path.length > 0) {
          const next = path[0];
          if (!(next.x === state.player.pos.x && next.y === state.player.pos.y) &&
            !isSanctuaryTile(state, next.x, next.y) &&
            !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === next.x && m.pos.y === next.y)) {
            monsterPositions.delete(posKey(monster.pos));
            monster.pos = next;
            monsterPositions.add(posKey(monster.pos));
          }
        } else {
          // #12: Fallback to BFS with max 10 steps
          const bfsNext = bfsPathfind(state, monster.pos, target, monsterPositions);
          if (bfsNext && !(bfsNext.x === state.player.pos.x && bfsNext.y === state.player.pos.y) &&
            !isSanctuaryTile(state, bfsNext.x, bfsNext.y)) {
            monsterPositions.delete(posKey(monster.pos));
            monster.pos = bfsNext;
            monsterPositions.add(posKey(monster.pos));
          }
        }

        // #17: If monster reached last known pos and player not there, clear memory
        if (monster.lastKnownPlayerPos && !canSeePlayer &&
          monster.pos.x === monster.lastKnownPlayerPos.x && monster.pos.y === monster.lastKnownPlayerPos.y) {
          monster.lastKnownPlayerPos = undefined;
        }
      } else if (monster.behavior === MonsterBehavior.Wandering) {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const nx = monster.pos.x + dx;
        const ny = monster.pos.y + dy;
        if (isWalkable(state.floor, nx, ny) &&
          !isSanctuaryTile(state, nx, ny) &&
          !(state.player.pos.x === nx && state.player.pos.y === ny) &&
          !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === nx && m.pos.y === ny)) {
          monsterPositions.delete(posKey(monster.pos));
          monster.pos = { x: nx, y: ny };
          monsterPositions.add(posKey(monster.pos));
        }
      }
    }
  }

  // Process monster status effects
  for (const monster of state.floor.monsters) {
    if (monster.statuses.some(s => s.type === StatusEffect.Poison)) {
      // #6: Bleed/poison damage - 2 base for bleed compatibility
      const poisonDmg = Math.max(2, 1 + Math.floor(state.floorNumber / 5));
      monster.hp = Math.max(1, monster.hp - poisonDmg);
    }
    for (const s of monster.statuses) {
      if (s.type !== StatusEffect.Sleep && s.type !== StatusEffect.Paralysis) {
        s.remaining--;
      }
    }
    monster.statuses = monster.statuses.filter(s => s.remaining > 0);
  }

  return logs;
}
