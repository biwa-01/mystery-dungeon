import {
  Player, Monster, GameState, CombatLog, StatusEffect, SealType,
  ItemCategory, WeaponItem, ShieldItem, Direction, DIR_VECTORS,
  GameItem, TrapType, TrapData, StatusInstance,
} from '@/types/game';
import { posEqual, isWalkable, clamp } from '../utils';

export function calculatePlayerAttack(player: Player): number {
  let atk = player.attack + player.strength;
  const weapon = player.inventory.find(
    i => i.category === ItemCategory.Weapon && i.id === player.equippedWeapon
  ) as WeaponItem | undefined;
  if (weapon) {
    atk += weapon.attack + weapon.enhancement;
  }
  return Math.max(1, atk);
}

export function calculatePlayerDefense(player: Player): number {
  let def = player.defense;
  const shield = player.inventory.find(
    i => i.category === ItemCategory.Shield && i.id === player.equippedShield
  ) as ShieldItem | undefined;
  if (shield) {
    def += shield.defense + shield.enhancement;
  }
  return Math.max(0, def);
}

export function getEquippedWeapon(player: Player): WeaponItem | undefined {
  return player.inventory.find(
    i => i.category === ItemCategory.Weapon && i.id === player.equippedWeapon
  ) as WeaponItem | undefined;
}

export function getEquippedShield(player: Player): ShieldItem | undefined {
  return player.inventory.find(
    i => i.category === ItemCategory.Shield && i.id === player.equippedShield
  ) as ShieldItem | undefined;
}

export function calculateDamage(attack: number, defense: number): number {
  const base = Math.max(1, attack - defense / 2);
  const variance = Math.max(1, Math.floor(base * 0.15));
  return Math.max(1, base + Math.floor(Math.random() * variance * 2) - variance);
}

export function playerAttackMonster(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  const atk = calculatePlayerAttack(state.player);
  const weapon = getEquippedWeapon(state.player);

  // Check seals
  let hitCount = 1;
  let critBonus = 1;
  let dragonBonus = 1;

  if (weapon) {
    if (weapon.seals.includes(SealType.DoubleStrike)) hitCount = 2;
    if (weapon.seals.includes(SealType.Critical) && Math.random() < 0.25) critBonus = 1.5;
    if (weapon.seals.includes(SealType.DragonSlayer) &&
      (monster.templateId === 'dragon_pup')) dragonBonus = 1.5;
  }

  for (let h = 0; h < hitCount; h++) {
    const damage = Math.floor(calculateDamage(atk, monster.defense) * critBonus * dragonBonus);
    monster.hp -= damage;

    if (critBonus > 1) {
      logs.push({
        message: `会心の一撃！ ${monster.name}に${damage}のダメージ！`,
        turn: state.player.turnCount,
        type: 'critical',
      });
    } else {
      logs.push({
        message: `${monster.name}に${damage}のダメージを与えた。`,
        turn: state.player.turnCount,
        type: 'damage',
      });
    }

    if (weapon?.seals.includes(SealType.Drain)) {
      const heal = Math.floor(damage * 0.15);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
      if (heal > 0) {
        logs.push({
          message: `HPを${heal}回復した。`,
          turn: state.player.turnCount,
          type: 'heal',
        });
      }
    }

    if (monster.hp <= 0) {
      logs.push(...handleMonsterDeath(state, monster));
      break;
    }
  }

  return logs;
}

export function monsterAttackPlayer(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  const def = calculatePlayerDefense(state.player);
  const shield = getEquippedShield(state.player);
  const damage = calculateDamage(monster.attack, def);

  state.player.hp -= damage;
  logs.push({
    message: `${monster.name}から${damage}のダメージを受けた。`,
    turn: state.player.turnCount,
    type: 'damage',
  });

  // Counter seal
  if (shield?.seals.includes(SealType.Counter)) {
    const counterDmg = Math.floor(damage * 0.3);
    monster.hp -= counterDmg;
    logs.push({
      message: `${counterDmg}のダメージを跳ね返した！`,
      turn: state.player.turnCount,
      type: 'damage',
    });
    if (monster.hp <= 0) {
      logs.push(...handleMonsterDeath(state, monster));
    }
  }

  return logs;
}

export function handleMonsterDeath(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  const weapon = getEquippedWeapon(state.player);
  let exp = monster.exp;

  if (weapon?.seals.includes(SealType.ExpBoost)) {
    exp = Math.floor(exp * 1.2);
  }

  state.player.exp += exp;
  logs.push({
    message: `${monster.name}を倒した！ 経験値${exp}を獲得。`,
    turn: state.player.turnCount,
    type: 'info',
  });

  // Level up check
  while (state.player.exp >= state.player.expToNext) {
    state.player.exp -= state.player.expToNext;
    state.player.level++;
    const hpGain = 3 + Math.floor(Math.random() * 3);
    state.player.maxHp += hpGain;
    state.player.hp = Math.min(state.player.hp + hpGain, state.player.maxHp);
    state.player.attack += 1;
    state.player.defense += 1;
    state.player.expToNext = Math.floor(state.player.expToNext * 1.4);
    logs.push({
      message: `レベルアップ！ Lv.${state.player.level} 最大HP+${hpGain}`,
      turn: state.player.turnCount,
      type: 'system',
    });
  }

  // Remove monster
  state.floor.monsters = state.floor.monsters.filter(m => m.id !== monster.id);

  return logs;
}

export function handleMonsterAbility(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  if (monster.statuses.some(s => s.type === StatusEffect.Sealed)) return logs;

  for (const ability of monster.abilities) {
    if (Math.random() > ability.chance) continue;

    switch (ability.type) {
      case 'steal': {
        if (state.player.inventory.length > 0) {
          const idx = Math.floor(Math.random() * state.player.inventory.length);
          const stolen = state.player.inventory[idx];
          if (stolen.id === state.player.equippedWeapon || stolen.id === state.player.equippedShield || stolen.id === state.player.equippedRing) break;
          state.player.inventory.splice(idx, 1);
          logs.push({
            message: `${monster.name}が${stolen.name}を盗んだ！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          monster.droppedItem = stolen.id;
        }
        break;
      }
      case 'drain': {
        const loss = ability.param ?? 1;
        state.player.strength = Math.max(0, state.player.strength - loss);
        logs.push({
          message: `${monster.name}にちからを${loss}下げられた！`,
          turn: state.player.turnCount,
          type: 'critical',
        });
        break;
      }
      case 'hypnosis': {
        if (!state.player.statuses.some(s => s.type === StatusEffect.Sleep)) {
          state.player.statuses.push({ type: StatusEffect.Sleep, remaining: 3 });
          logs.push({
            message: `${monster.name}の催眠術！ 眠ってしまった！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
        }
        break;
      }
      case 'fireBreath': {
        const dmg = ability.param ?? 15;
        const shield = getEquippedShield(state.player);
        const actualDmg = shield?.seals.includes(SealType.FireResist) ? Math.floor(dmg / 2) : dmg;
        state.player.hp -= actualDmg;
        logs.push({
          message: `${monster.name}が炎を吐いた！ ${actualDmg}のダメージ！`,
          turn: state.player.turnCount,
          type: 'critical',
        });
        break;
      }
      case 'warp': {
        // Warp player to random location
        const rooms = state.floor.rooms;
        if (rooms.length > 0) {
          const room = rooms[Math.floor(Math.random() * rooms.length)];
          state.player.pos = {
            x: room.x + Math.floor(Math.random() * room.width),
            y: room.y + Math.floor(Math.random() * room.height),
          };
          logs.push({
            message: `${monster.name}にワープさせられた！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
        }
        break;
      }
      case 'levelDown': {
        if (state.player.level > 1) {
          state.player.level--;
          state.player.maxHp = Math.max(15, state.player.maxHp - 3);
          state.player.hp = Math.min(state.player.hp, state.player.maxHp);
          logs.push({
            message: `${monster.name}にレベルを下げられた！ Lv.${state.player.level}`,
            turn: state.player.turnCount,
            type: 'critical',
          });
        }
        break;
      }
      case 'split': {
        if (state.floor.monsters.length < 20) {
          const newMonster = { ...monster };
          newMonster.id = Math.random().toString(36).substring(2, 10);
          newMonster.hp = monster.maxHp;
          // Find adjacent free cell
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = monster.pos.x + dx;
              const ny = monster.pos.y + dy;
              if (isWalkable(state.floor, nx, ny) &&
                !state.floor.monsters.some(m => m.pos.x === nx && m.pos.y === ny) &&
                !(state.player.pos.x === nx && state.player.pos.y === ny)) {
                newMonster.pos = { x: nx, y: ny };
                state.floor.monsters.push(newMonster);
                logs.push({
                  message: `${monster.name}が分裂した！`,
                  turn: state.player.turnCount,
                  type: 'info',
                });
                return logs;
              }
            }
          }
        }
        break;
      }
      case 'summon': {
        if (state.floor.monsters.length < 15) {
          logs.push({
            message: `${monster.name}がモンスターを呼び寄せた！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
        }
        break;
      }
    }
    break; // Only one ability per turn
  }
  return logs;
}

export function applyTrap(state: GameState, trap: TrapData): CombatLog[] {
  const logs: CombatLog[] = [];
  trap.visible = true;

  switch (trap.type) {
    case TrapType.Sleep:
      state.player.statuses.push({ type: StatusEffect.Sleep, remaining: 5 });
      logs.push({ message: '睡眠のワナを踏んだ！ 眠ってしまった！', turn: state.player.turnCount, type: 'critical' });
      break;
    case TrapType.Poison:
      state.player.strength = Math.max(0, state.player.strength - 1);
      logs.push({ message: '毒のワナを踏んだ！ ちからが1下がった。', turn: state.player.turnCount, type: 'critical' });
      break;
    case TrapType.Spin:
      state.player.statuses.push({ type: StatusEffect.Confusion, remaining: 10 });
      logs.push({ message: '回転板のワナ！ 混乱してしまった！', turn: state.player.turnCount, type: 'critical' });
      break;
    case TrapType.Pit: {
      const dmg = 5 + Math.floor(Math.random() * 5);
      state.player.hp -= dmg;
      logs.push({ message: `落とし穴に落ちた！ ${dmg}のダメージ！`, turn: state.player.turnCount, type: 'damage' });
      break;
    }
    case TrapType.Landmine: {
      const dmg = Math.floor(state.player.hp * 0.4);
      state.player.hp -= dmg;
      logs.push({ message: `地雷を踏んだ！ ${dmg}のダメージ！`, turn: state.player.turnCount, type: 'critical' });
      break;
    }
    case TrapType.Rust: {
      const shield = getEquippedShield(state.player);
      if (shield && !shield.seals.includes(SealType.RustProof)) {
        shield.enhancement = Math.max(-10, shield.enhancement - 1);
        logs.push({ message: `サビのワナ！ ${shield.name}の強化値が下がった！`, turn: state.player.turnCount, type: 'critical' });
      } else {
        logs.push({ message: 'サビのワナを踏んだ！ しかし何も起こらなかった。', turn: state.player.turnCount, type: 'info' });
      }
      break;
    }
    case TrapType.Hunger:
      state.player.satiation = Math.max(0, state.player.satiation - 30);
      logs.push({ message: '空腹のワナ！ 満腹度が30減った。', turn: state.player.turnCount, type: 'critical' });
      break;
    case TrapType.Summon:
      logs.push({ message: '召喚のワナ！ モンスターが現れた！', turn: state.player.turnCount, type: 'critical' });
      break;
    case TrapType.MonsterHouse:
      logs.push({ message: 'モンスターハウスだ！', turn: state.player.turnCount, type: 'critical' });
      break;
  }
  return logs;
}

export function resolveStatusEffects(entity: { statuses: StatusInstance[], hp: number }): CombatLog[] {
  const logs: CombatLog[] = [];
  const expired: number[] = [];

  for (let i = 0; i < entity.statuses.length; i++) {
    const s = entity.statuses[i];
    s.remaining--;

    if (s.type === StatusEffect.Poison) {
      entity.hp = Math.max(1, entity.hp - 1);
    }

    if (s.remaining <= 0) {
      expired.push(i);
    }
  }

  for (let i = expired.length - 1; i >= 0; i--) {
    entity.statuses.splice(expired[i], 1);
  }

  return logs;
}

export function throwItem(
  state: GameState,
  item: GameItem,
  direction: Direction
): CombatLog[] {
  const logs: CombatLog[] = [];
  const vec = DIR_VECTORS[direction];
  let cx = state.player.pos.x;
  let cy = state.player.pos.y;

  for (let dist = 0; dist < 10; dist++) {
    cx += vec.x;
    cy += vec.y;

    if (!isWalkable(state.floor, cx, cy)) {
      // Hit wall, drop at previous position
      item.floorPos = { x: cx - vec.x, y: cy - vec.y };
      state.floor.items.push(item);
      logs.push({
        message: `${item.name}は壁に当たって落ちた。`,
        turn: state.player.turnCount,
        type: 'info',
      });
      break;
    }

    const hitMonster = state.floor.monsters.find(m => m.pos.x === cx && m.pos.y === cy);
    if (hitMonster) {
      let dmg = 0;
      if (item.category === ItemCategory.Arrow) {
        dmg = calculateDamage(item.attack + calculatePlayerAttack(state.player) / 2, hitMonster.defense);
      } else if (item.category === ItemCategory.Weapon) {
        dmg = calculateDamage(item.attack, hitMonster.defense);
      } else if (item.category === ItemCategory.Herb && (item as { effect: string }).effect === 'poison') {
        dmg = 10;
      } else {
        dmg = 2; // Generic thrown item
      }
      dmg = Math.max(1, Math.floor(dmg));
      hitMonster.hp -= dmg;
      logs.push({
        message: `${item.name}が${hitMonster.name}に当たって${dmg}のダメージ！`,
        turn: state.player.turnCount,
        type: 'damage',
      });
      if (hitMonster.hp <= 0) {
        logs.push(...handleMonsterDeath(state, hitMonster));
      }
      break;
    }

    if (dist === 9) {
      item.floorPos = { x: cx, y: cy };
      state.floor.items.push(item);
      logs.push({
        message: `${item.name}は遠くに飛んでいった。`,
        turn: state.player.turnCount,
        type: 'info',
      });
    }
  }

  return logs;
}
