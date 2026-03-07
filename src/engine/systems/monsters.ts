import {
  Monster, GameState, StatusEffect, MonsterBehavior, CombatLog,
} from '@/types/game';
import { MONSTER_TEMPLATES } from '../data/monsters';
import { SeededRandom, astar, posKey, chebyshev, isWalkable, generateId } from '../utils';
import { monsterAttackPlayer, handleMonsterAbility } from './combat';

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

  const monsters: Monster[] = [];
  for (let i = 0; i < count; i++) {
    const template = rng.pick(available);
    // Find position
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
    const scaledHp = template.hp + Math.floor(floorNum * 0.5);
    const scaledAtk = template.attack + Math.floor(floorNum * 0.3);
    const scaledDef = template.defense + Math.floor(floorNum * 0.2);

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
    });
  }
  return monsters;
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

    // Speed 2: acts twice (simplified - just acts once for now with bonus damage)
    const actCount = monster.speed === 2 ? 2 : 1;

    for (let act = 0; act < actCount; act++) {
      if (monster.hp <= 0) break;

      const dist = chebyshev(monster.pos, state.player.pos);

      // Sleeping check
      if (monster.sleeping && !monster.awakened) {
        if (dist <= 2) {
          monster.sleeping = false;
          monster.awakened = true;
        } else {
          continue;
        }
      }

      // Adjacent to player? Attack or use ability
      if (dist <= 1) {
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

      // Confused: random movement
      if (monster.statuses.some(s => s.type === StatusEffect.Confusion)) {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const nx = monster.pos.x + dx;
        const ny = monster.pos.y + dy;
        if (isWalkable(state.floor, nx, ny) &&
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

      // If visible or aggressive, pathfind to player
      const canSeePlayer = dist <= 10 && state.floor.visible[monster.pos.y]?.[monster.pos.x];
      const isAggressive = monster.behavior === MonsterBehavior.Aggressive;

      if (canSeePlayer || isAggressive || (monster.lastKnownPlayerPos && dist <= 15)) {
        if (canSeePlayer) {
          monster.lastKnownPlayerPos = { ...state.player.pos };
        }

        const target = monster.lastKnownPlayerPos ?? state.player.pos;
        const path = astar(state.floor, monster.pos, target, 50, true, monsterPositions);

        if (path.length > 0) {
          const next = path[0];
          if (!(next.x === state.player.pos.x && next.y === state.player.pos.y) &&
            !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === next.x && m.pos.y === next.y)) {
            monsterPositions.delete(posKey(monster.pos));
            monster.pos = next;
            monsterPositions.add(posKey(monster.pos));
          }
        }
      } else if (monster.behavior === MonsterBehavior.Wandering) {
        // Random walk
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const nx = monster.pos.x + dx;
        const ny = monster.pos.y + dy;
        if (isWalkable(state.floor, nx, ny) &&
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
      monster.hp = Math.max(1, monster.hp - 1);
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
