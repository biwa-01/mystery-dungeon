import {
  GameState, Direction, DIR_VECTORS, CombatLog, StaffItem,
  StatusEffect, ItemCategory, Monster, Position,
} from '@/types/game';
import { isWalkable } from '../utils';
import { MONSTER_TEMPLATES } from '../data/monsters';
import { handleMonsterDeath } from './combat';

/**
 * Fire a staff bolt in a direction, find the first monster in line.
 * Returns the target monster or null if the bolt hits a wall first.
 */
function findBoltTarget(state: GameState, direction: Direction): Monster | null {
  const vec = DIR_VECTORS[direction];
  let cx = state.player.pos.x;
  let cy = state.player.pos.y;

  for (let d = 0; d < 10; d++) {
    cx += vec.x;
    cy += vec.y;
    if (!isWalkable(state.floor, cx, cy)) break;
    const m = state.floor.monsters.find(m => m.pos.x === cx && m.pos.y === cy);
    if (m) return m;
  }
  return null;
}

/**
 * Use a staff: fires a magic bolt in the given direction.
 * Returns combat logs. The caller is responsible for decrementing charges
 * and processing the turn.
 */
export function applyStaffEffect(
  state: GameState,
  staff: StaffItem,
  direction: Direction,
): CombatLog[] {
  const logs: CombatLog[] = [];
  const vec = DIR_VECTORS[direction];
  const target = findBoltTarget(state, direction);

  logs.push({
    message: `${staff.name}を振った！`,
    turn: state.player.turnCount,
    type: 'item',
  });

  if (!target) {
    logs.push({
      message: '魔法の弾は何にも当たらなかった。',
      turn: state.player.turnCount,
      type: 'info',
    });
    return logs;
  }

  logs.push({
    message: `魔法の弾は${target.name}に当たった！`,
    turn: state.player.turnCount,
    type: 'item',
  });

  switch (staff.effect) {
    case 'paralysis': {
      target.statuses.push({ type: StatusEffect.Paralysis, remaining: 10 });
      logs.push({
        message: `${target.name}はかなしばりになった！`,
        turn: state.player.turnCount,
        type: 'item',
      });
      break;
    }

    // #27: Knockback staff - push monster 3 tiles in facing direction
    case 'knockback': {
      let kx = target.pos.x;
      let ky = target.pos.y;
      let hitWall = false;
      let pushCount = 0;
      for (let d = 0; d < 3; d++) {
        const nx = kx + vec.x;
        const ny = ky + vec.y;
        if (!isWalkable(state.floor, nx, ny)) {
          hitWall = true;
          break;
        }
        // Don't push through other monsters
        if (state.floor.monsters.some(m => m.id !== target.id && m.pos.x === nx && m.pos.y === ny)) {
          hitWall = true;
          break;
        }
        kx = nx;
        ky = ny;
        pushCount++;
      }
      target.pos = { x: kx, y: ky };
      logs.push({
        message: `${target.name}を${pushCount}マス吹き飛ばした！`,
        turn: state.player.turnCount,
        type: 'item',
      });
      if (hitWall) {
        target.hp -= 5;
        logs.push({
          message: `${target.name}は壁にぶつかった！ 5のダメージ！`,
          turn: state.player.turnCount,
          type: 'damage',
        });
        if (target.hp <= 0) {
          logs.push(...handleMonsterDeath(state, target));
        }
      }
      break;
    }

    case 'lightning': {
      const damage = 20;
      target.hp -= damage;
      logs.push({
        message: `${target.name}に雷が落ちた！ ${damage}のダメージ！`,
        turn: state.player.turnCount,
        type: 'damage',
      });
      if (target.hp <= 0) {
        logs.push(...handleMonsterDeath(state, target));
      }
      break;
    }

    case 'transform': {
      // Transform into a random weaker monster
      const weakerTemplates = MONSTER_TEMPLATES.filter(
        t => t.hp < target.maxHp && t.id !== target.templateId
      );
      if (weakerTemplates.length > 0) {
        const newTemplate = weakerTemplates[Math.floor(Math.random() * weakerTemplates.length)];
        const oldName = target.name;
        target.templateId = newTemplate.id;
        target.name = newTemplate.name;
        target.displayChar = newTemplate.displayChar;
        target.color = newTemplate.color;
        target.hp = newTemplate.hp;
        target.maxHp = newTemplate.hp;
        target.attack = newTemplate.attack;
        target.defense = newTemplate.defense;
        target.exp = newTemplate.exp;
        target.speed = newTemplate.speed;
        target.behavior = newTemplate.behavior;
        target.abilities = [...newTemplate.abilities];
        target.statuses = [];
        logs.push({
          message: `${oldName}は${target.name}に変身した！`,
          turn: state.player.turnCount,
          type: 'item',
        });
      } else {
        logs.push({
          message: `${target.name}は変身しなかった。`,
          turn: state.player.turnCount,
          type: 'info',
        });
      }
      break;
    }

    // #28: Substitute staff - swap player and monster positions
    case 'swap': {
      const playerPos = { ...state.player.pos };
      const monsterPos = { ...target.pos };
      state.player.pos = monsterPos;
      target.pos = playerPos;
      logs.push({
        message: `${target.name}と場所を入れ替えた！`,
        turn: state.player.turnCount,
        type: 'item',
      });
      break;
    }

    case 'drain': {
      const oldHp = target.hp;
      target.hp = 1;
      logs.push({
        message: `${target.name}のHPを吸い出した！ (${oldHp} → 1)`,
        turn: state.player.turnCount,
        type: 'damage',
      });
      break;
    }

    // #29: Slow staff - apply Slow status for 10 turns
    case 'slow': {
      target.speed = Math.max(0, target.speed - 1);
      target.statuses.push({ type: StatusEffect.Slow, remaining: 10 });
      logs.push({
        message: `${target.name}の足が遅くなった！ (10ターン)`,
        turn: state.player.turnCount,
        type: 'item',
      });
      break;
    }

    case 'seal': {
      target.statuses.push({ type: StatusEffect.Sealed, remaining: 50 });
      logs.push({
        message: `${target.name}の能力を封印した！`,
        turn: state.player.turnCount,
        type: 'item',
      });
      break;
    }

    case 'warp': {
      const rooms = state.floor.rooms;
      if (rooms.length > 0) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        target.pos = {
          x: room.x + Math.floor(Math.random() * room.width),
          y: room.y + Math.floor(Math.random() * room.height),
        };
        logs.push({
          message: `${target.name}はどこかへ飛ばされた！`,
          turn: state.player.turnCount,
          type: 'item',
        });
      }
      break;
    }

    default:
      logs.push({
        message: `しかし何も起こらなかった。`,
        turn: state.player.turnCount,
        type: 'info',
      });
  }

  return logs;
}

// #30: Confusion scroll effect on all visible monsters
export function applyConfusionScrollEffect(state: GameState): CombatLog[] {
  const logs: CombatLog[] = [];
  let confusedCount = 0;
  for (const m of state.floor.monsters) {
    if (state.floor.visible[m.pos.y]?.[m.pos.x]) {
      m.statuses.push({ type: StatusEffect.Confusion, remaining: 10 });
      confusedCount++;
    }
  }
  if (confusedCount > 0) {
    logs.push({
      message: `混乱の巻物を読んだ！ ${confusedCount}体のモンスターが混乱した！`,
      turn: state.player.turnCount,
      type: 'item',
    });
  } else {
    logs.push({
      message: '混乱の巻物を読んだ！ しかし周囲にモンスターがいない。',
      turn: state.player.turnCount,
      type: 'info',
    });
  }
  return logs;
}
