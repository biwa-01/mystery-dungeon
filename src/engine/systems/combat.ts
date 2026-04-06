import {
  Player, Monster, GameState, CombatLog, StatusEffect, SealType,
  ItemCategory, WeaponItem, ShieldItem, Direction, DIR_VECTORS,
  GameItem, TrapType, TrapData, StatusInstance, Position,
} from '@/types/game';
import { posEqual, isWalkable, clamp, generateId, chebyshev } from '../utils';
import { MONSTER_TEMPLATES } from '../data/monsters';
import { createItemFromTemplate } from '../data/items';

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
  const base = attack * attack / (attack + defense);
  // #4: ±15% damage variance
  const variance = 0.85 + Math.random() * 0.30;
  return Math.max(1, Math.floor(base * variance));
}

export function checkHit(sureHit: boolean): boolean {
  if (sureHit) return true;
  return Math.random() < 0.92;
}

export function checkCritical(critSealBonus: boolean, playerLevel: number = 1, forceCombo: boolean = false): { isCrit: boolean; multiplier: number } {
  if (forceCombo) {
    const multiplier = Math.min(2.5, 1.5 + (playerLevel - 1) * 0.05);
    return { isCrit: true, multiplier };
  }
  const chance = 0.05 + (critSealBonus ? 0.25 : 0);
  const isCrit = Math.random() < chance;
  const multiplier = isCrit ? Math.min(2.5, 1.5 + (playerLevel - 1) * 0.05) : 1.0;
  return { isCrit, multiplier };
}

export function calculateExpToNext(level: number): number {
  if (level <= 10) {
    return level * 15;
  }
  return level * 15 + (level - 10) * 25;
}

// #5: Element weakness map - monster templateIds that take extra damage from seal types
const ELEMENT_WEAKNESS: Record<string, SealType[]> = {
  dragon_pup: [SealType.DragonSlayer],
  dragon_child: [SealType.DragonSlayer],
  dragon: [SealType.DragonSlayer],
  king_dragon: [SealType.DragonSlayer],
  skeleton: [SealType.UndeadSlayer],
  skeleton_knight: [SealType.UndeadSlayer],
  zombie: [SealType.UndeadSlayer],
  rotting_corpse: [SealType.UndeadSlayer],
  death_knight: [SealType.UndeadSlayer],
  ghost: [SealType.UndeadSlayer],
  lich: [SealType.UndeadSlayer],
  reaper: [SealType.UndeadSlayer],
};

function getElementBonus(monster: Monster, weapon: WeaponItem | undefined): number {
  if (!weapon) return 1;
  const weaknesses = ELEMENT_WEAKNESS[monster.templateId];
  if (!weaknesses) return 1;
  for (const seal of weapon.seals) {
    if (weaknesses.includes(seal)) return 1.5;
  }
  return 1;
}

const MISS_MESSAGES = [
  '${name}に攻撃を外した！',
  '${name}は素早く身をかわした！',
  '${name}に攻撃が届かなかった！',
  '${name}への攻撃は空を切った！',
];

function getRandomMissMessage(monsterName: string): string {
  const template = MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)];
  return template.replace('${name}', monsterName);
}

// #1: Weapon durability - track via enhancement going negative; break at enhancement <= -10
function degradeWeaponDurability(state: GameState, weapon: WeaponItem, logs: CombatLog[]): void {
  // 1 durability loss per hit, tracked as enhancement decrease
  // Only triggers 10% of the time to not be too punishing
  if (Math.random() < 0.1) {
    weapon.enhancement -= 1;
    if (weapon.enhancement <= -10) {
      logs.push({
        message: `${weapon.name}は壊れてしまった！`,
        turn: state.player.turnCount,
        type: 'critical',
      });
      // Unequip and remove
      state.player.equippedWeapon = null;
      state.player.inventory = state.player.inventory.filter(i => i.id !== weapon.id);
    }
  }
}

export function playerAttackMonster(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  const atk = calculatePlayerAttack(state.player);
  const weapon = getEquippedWeapon(state.player);

  // Check seals
  let hitCount = 1;
  const hasSureHit = weapon?.seals.includes(SealType.SureHit) ?? false;
  const hasCritSeal = weapon?.seals.includes(SealType.Critical) ?? false;

  if (weapon) {
    if (weapon.seals.includes(SealType.DoubleStrike)) hitCount = 2;
  }

  // #5: Element weakness bonus
  const elementBonus = getElementBonus(monster, weapon);

  // #8: Combo finisher - at combo count 10+, next attack deals 3x and resets
  let comboFinisher = false;
  if (state.player.comboCount >= 10) {
    comboFinisher = true;
  }

  for (let h = 0; h < hitCount; h++) {
    // Hit check (92% base)
    if (!checkHit(hasSureHit)) {
      // #3: Counter-attack on miss (monster misses not applicable here; this is player miss)
      state.player.comboCount = 0;
      logs.push({
        message: getRandomMissMessage(monster.name),
        turn: state.player.turnCount,
        type: 'info',
      });
      continue;
    }

    // Combo counter: increment and check for auto-critical every 5th hit
    state.player.comboCount++;
    const isComboHit = state.player.comboCount > 0 && state.player.comboCount % 5 === 0;

    // Critical check (5% base + 25% from seal), level-scaled multiplier
    const { isCrit, multiplier: critMultiplier } = checkCritical(hasCritSeal, state.player.level, isComboHit);

    // #8: Combo finisher multiplier
    const comboMultiplier = comboFinisher ? 3.0 : 1.0;

    const damage = Math.max(1, Math.floor(calculateDamage(atk, monster.defense) * critMultiplier * elementBonus * comboMultiplier));
    monster.hp -= damage;

    // #8: Log and reset combo finisher
    if (comboFinisher) {
      logs.push({
        message: `${state.player.comboCount}コンボフィニッシュ！ ${monster.name}に${damage}の大ダメージ！`,
        turn: state.player.turnCount,
        type: 'critical',
      });
      state.player.comboCount = 0;
      comboFinisher = false;
    } else if (isCrit) {
      const comboMsg = isComboHit ? ` ${state.player.comboCount}コンボ！` : '';
      logs.push({
        message: `会心の一撃！${comboMsg} ${monster.name}に${damage}のダメージ！`,
        turn: state.player.turnCount,
        type: 'critical',
      });

      // #6: Bleed effect on critical hit - 2 dmg/turn for 3 turns
      if (!monster.statuses.some(s => s.type === StatusEffect.Poison)) {
        // Use poison status as bleed proxy (since we can't add new status types)
        // We track bleed as a 3-turn poison
        monster.statuses.push({ type: StatusEffect.Poison, remaining: 3 });
        logs.push({
          message: `${monster.name}は出血している！`,
          turn: state.player.turnCount,
          type: 'damage',
        });
      }
    } else {
      logs.push({
        message: `${monster.name}に${damage}のダメージを与えた。`,
        turn: state.player.turnCount,
        type: 'damage',
      });
    }

    // #1: Weapon durability degradation
    if (weapon) {
      degradeWeaponDurability(state, weapon, logs);
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
      // Overkill bonus
      const overkillDamage = damage;
      const hpBeforeHit = monster.hp + damage;
      if (overkillDamage >= hpBeforeHit * 2) {
        monster.exp = Math.floor(monster.exp * 1.2);
      }
      logs.push(...handleMonsterDeath(state, monster));
      break;
    }

    // Check split ability
    logs.push(...handleSplitAbility(state, monster));
  }

  return logs;
}

export function monsterAttackPlayer(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];

  // Monster hit check (92% base)
  if (!checkHit(false)) {
    logs.push({
      message: `${monster.name}の攻撃を避けた！`,
      turn: state.player.turnCount,
      type: 'info',
    });

    // #3: Counter-attack - 15% chance player auto-attacks when monster misses
    if (Math.random() < 0.15) {
      const counterAtk = calculatePlayerAttack(state.player);
      const counterDmg = calculateDamage(counterAtk, monster.defense);
      monster.hp -= counterDmg;
      logs.push({
        message: `反撃！ ${monster.name}に${counterDmg}のダメージ！`,
        turn: state.player.turnCount,
        type: 'damage',
      });
      if (monster.hp <= 0) {
        logs.push(...handleMonsterDeath(state, monster));
      }
    }

    return logs;
  }

  const def = calculatePlayerDefense(state.player);
  const shield = getEquippedShield(state.player);
  const damage = calculateDamage(monster.attack, def);

  state.player.hp -= damage;
  logs.push({
    message: `${monster.name}から${damage}のダメージを受けた。`,
    turn: state.player.turnCount,
    type: 'damage',
  });

  // #2: Shield bash - when player defense > monster attack, 10% stun
  if (def > monster.attack && Math.random() < 0.10) {
    if (!monster.statuses.some(s => s.type === StatusEffect.Paralysis)) {
      monster.statuses.push({ type: StatusEffect.Paralysis, remaining: 1 });
      logs.push({
        message: `盾で${monster.name}をはじきとばした！ ${monster.name}は動けない！`,
        turn: state.player.turnCount,
        type: 'info',
      });
    }
  }

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

  // #10: Heal on kill - 5% chance to heal 10% maxHP
  if (Math.random() < 0.05) {
    const healAmount = Math.floor(state.player.maxHp * 0.10);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    logs.push({
      message: `力がみなぎってきた！ HPが${healAmount}回復した。`,
      turn: state.player.turnCount,
      type: 'heal',
    });
  }

  // #13: Monster drops - check template for drop table
  const tmpl = MONSTER_TEMPLATES.find(t => t.id === monster.templateId);
  if (tmpl?.dropTable) {
    for (const drop of tmpl.dropTable) {
      if (Math.random() < drop.chance) {
        const dropItem = createItemFromTemplate(drop.itemId, false);
        if (dropItem) {
          dropItem.floorPos = { ...monster.pos };
          state.floor.items.push(dropItem);
          logs.push({
            message: `${monster.name}は${dropItem.name}を落とした！`,
            turn: state.player.turnCount,
            type: 'item',
          });
        }
        break; // Only one drop per kill
      }
    }
  }

  // Level up check
  while (state.player.exp >= state.player.expToNext) {
    state.player.exp -= state.player.expToNext;
    state.player.level++;
    const hpGain = 3 + Math.floor(Math.random() * 3);
    state.player.maxHp += hpGain;
    state.player.hp = state.player.maxHp;
    const atkGain = state.player.level % 2 === 0 ? 1 : 0;
    const defGain = state.player.level % 3 === 0 ? 1 : 0;
    const strGain = state.player.level % 5 === 0 ? 1 : 0;
    state.player.attack += atkGain;
    state.player.defense += defGain;
    if (strGain > 0) {
      state.player.strength += strGain;
      state.player.maxStrength = Math.max(state.player.maxStrength, state.player.strength);
    }
    state.player.expToNext = calculateExpToNext(state.player.level);
    let msg = `レベルアップ！ Lv.${state.player.level} 最大HP+${hpGain}`;
    if (atkGain > 0) msg += ` 攻撃力+${atkGain}`;
    if (defGain > 0) msg += ` 防御力+${defGain}`;
    if (strGain > 0) msg += ` ちから+${strGain}`;
    logs.push({
      message: msg,
      turn: state.player.turnCount,
      type: 'system',
    });
  }

  // explode: deal AOE damage on death
  if (monster.abilities.some(a => a.type === 'explode')) {
    const explodeAbility = monster.abilities.find(a => a.type === 'explode')!;
    const explosionDmg = explodeAbility.param ?? 30;
    const distToPlayer = chebyshev(monster.pos, state.player.pos);
    if (distToPlayer <= 2) {
      state.player.hp -= explosionDmg;
      logs.push({
        message: `${monster.name}は大爆発した！ ${explosionDmg}のダメージ！`,
        turn: state.player.turnCount,
        type: 'critical',
      });
    } else {
      logs.push({
        message: `${monster.name}は大爆発した！`,
        turn: state.player.turnCount,
        type: 'info',
      });
    }
    for (const nearby of state.floor.monsters) {
      if (nearby.id === monster.id) continue;
      if (chebyshev(monster.pos, nearby.pos) <= 2) {
        nearby.hp -= explosionDmg;
      }
    }
  }

  // trapCreate: leave a trap on death tile
  if (monster.abilities.some(a => a.type === 'trapCreate')) {
    const trapTypes = [TrapType.Sleep, TrapType.Poison, TrapType.Spin, TrapType.Pit, TrapType.Landmine];
    const trapType = trapTypes[Math.floor(Math.random() * trapTypes.length)];
    if (!state.floor.traps.some(t => t.pos.x === monster.pos.x && t.pos.y === monster.pos.y)) {
      state.floor.traps.push({
        pos: { ...monster.pos },
        type: trapType,
        visible: false,
      });
      logs.push({
        message: `${monster.name}はたおれぎわにワナをしかけた！`,
        turn: state.player.turnCount,
        type: 'critical',
      });
    }
  }

  // Remove monster
  state.floor.monsters = state.floor.monsters.filter(m => m.id !== monster.id);

  return logs;
}

export function handleMonsterAbility(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  if (monster.statuses.some(s => s.type === StatusEffect.Sealed)) return logs;

  const adjacentTypes = new Set(['steal', 'drain', 'hypnosis', 'levelDown', 'itemify', 'poison', 'stealGold']);
  const adjacentAbilities = monster.abilities.filter(a => adjacentTypes.has(a.type));

  for (const ability of adjacentAbilities) {
    if (Math.random() > ability.chance) continue;

    switch (ability.type) {
      case 'steal': {
        const stealable = state.player.inventory.filter(item =>
          item.id !== state.player.equippedWeapon &&
          item.id !== state.player.equippedShield &&
          item.id !== state.player.equippedRing
        );
        if (stealable.length > 0) {
          const shield = getEquippedShield(state.player);
          if (shield?.seals.includes(SealType.TheftGuard)) {
            logs.push({
              message: `${monster.name}はアイテムをぬすもうとしたが、盗み守りの印で防いだ！`,
              turn: state.player.turnCount,
              type: 'info',
            });
            return logs;
          }
          const stolen = stealable[Math.floor(Math.random() * stealable.length)];
          const idx = state.player.inventory.findIndex(i => i.id === stolen.id);
          state.player.inventory.splice(idx, 1);
          monster.droppedItem = stolen.id;
          logs.push({
            message: `${monster.name}は${stolen.name}をぬすんだ！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          monster.pos = { ...state.floor.stairsPos };
          logs.push({
            message: `${monster.name}は階段のほうへにげていった！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }
      case 'drain': {
        const loss = ability.param ?? 3;
        state.player.maxHp = Math.max(15, state.player.maxHp - loss);
        state.player.hp = Math.min(state.player.hp, state.player.maxHp);
        logs.push({
          message: `${monster.name}に最大HPを${loss}下げられた！`,
          turn: state.player.turnCount,
          type: 'critical',
        });
        return logs;
      }
      case 'hypnosis': {
        if (!state.player.statuses.some(s => s.type === StatusEffect.Sleep)) {
          state.player.statuses.push({ type: StatusEffect.Sleep, remaining: 5 });
          logs.push({
            message: `${monster.name}はさいみんじゅつをつかった！ 眠ってしまった！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }
      case 'levelDown': {
        if (state.player.level > 1) {
          state.player.level--;
          const hpLoss = 3;
          state.player.maxHp = Math.max(15, state.player.maxHp - hpLoss);
          state.player.hp = Math.min(state.player.hp, state.player.maxHp);
          const atkLoss = state.player.level % 2 === 0 ? 1 : 0;
          const defLoss = state.player.level % 3 === 0 ? 1 : 0;
          state.player.attack = Math.max(1, state.player.attack - atkLoss);
          state.player.defense = Math.max(0, state.player.defense - defLoss);
          state.player.expToNext = calculateExpToNext(state.player.level);
          logs.push({
            message: `${monster.name}にレベルを下げられた！ Lv.${state.player.level}`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }
      case 'itemify': {
        const transformable = state.player.inventory.filter(item =>
          item.id !== state.player.equippedWeapon &&
          item.id !== state.player.equippedShield &&
          item.id !== state.player.equippedRing
        );
        if (transformable.length > 0) {
          const target = transformable[Math.floor(Math.random() * transformable.length)];
          const targetIdx = state.player.inventory.findIndex(i => i.id === target.id);
          const oldName = target.name;
          const replacements = ['heal_herb', 'poison_herb', 'sleep_herb', 'riceball', 'strength_herb'];
          const replId = replacements[Math.floor(Math.random() * replacements.length)];
          const newItem = createItemFromTemplate(replId, true);
          if (newItem) {
            state.player.inventory.splice(targetIdx, 1, newItem);
            logs.push({
              message: `${monster.name}は${oldName}をべつのアイテムにかえた！ ${newItem.name}になった！`,
              turn: state.player.turnCount,
              type: 'critical',
            });
            return logs;
          }
        }
        break;
      }
      case 'poison': {
        if (!state.player.statuses.some(s => s.type === StatusEffect.Poison)) {
          state.player.statuses.push({ type: StatusEffect.Poison, remaining: 10 });
          state.player.strength = Math.max(0, state.player.strength - 1);
          logs.push({
            message: `${monster.name}の毒攻撃！ 毒を受けた！ ちからが1下がった。`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }
      case 'stealGold': {
        if (state.player.gold > 0) {
          const stolen = Math.min(state.player.gold, Math.floor(50 + Math.random() * 100));
          state.player.gold -= stolen;
          logs.push({
            message: `${monster.name}はゴールドを${stolen}G盗んだ！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          monster.pos = { ...state.floor.stairsPos };
          logs.push({
            message: `${monster.name}は階段のほうへにげていった！`,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }
    }
    break;
  }
  return logs;
}

// Handle ranged/conditional abilities
export function handleMonsterRangedAbility(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  if (monster.statuses.some(s => s.type === StatusEffect.Sealed)) return logs;

  const dist = chebyshev(monster.pos, state.player.pos);

  for (const ability of monster.abilities) {
    switch (ability.type) {
      case 'fireBreath': {
        if (dist > 3 || dist <= 0) break;
        if (Math.random() > (ability.chance ?? 0.25)) break;

        const dx = state.player.pos.x - monster.pos.x;
        const dy = state.player.pos.y - monster.pos.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const isLine = dx === 0 || dy === 0 || adx === ady;
        if (!isLine) break;

        const stepX = dx === 0 ? 0 : dx / adx;
        const stepY = dy === 0 ? 0 : dy / ady;
        let blocked = false;
        let cx = monster.pos.x + stepX;
        let cy = monster.pos.y + stepY;
        const maxSteps = Math.max(adx, ady);
        for (let i = 0; i < maxSteps; i++) {
          if (cx === state.player.pos.x && cy === state.player.pos.y) break;
          if (!isWalkable(state.floor, cx, cy)) { blocked = true; break; }
          cx += stepX;
          cy += stepY;
        }
        if (blocked) break;

        const baseDmg = (ability.param ?? 15) + Math.floor(Math.random() * 11);
        const shield = getEquippedShield(state.player);
        const actualDmg = shield?.seals.includes(SealType.FireResist) ? Math.floor(baseDmg / 2) : baseDmg;
        state.player.hp -= actualDmg;
        logs.push({
          message: `${monster.name}はほのおをはいた！ ${actualDmg}のダメージ！`,
          turn: state.player.turnCount,
          type: 'critical',
        });
        return logs;
      }

      case 'summon': {
        // #16: Summoner behavior - also summons when HP < 50%
        const lowHpSummon = monster.hp < monster.maxHp * 0.5;
        if (monster.hasSummoned && !lowHpSummon) break;
        if (Math.random() > (ability.chance ?? 0.2) && !lowHpSummon) break;
        if (state.floor.monsters.length >= 20) break;

        if (!lowHpSummon) {
          monster.hasSummoned = true;
        }
        const summonCount = 1 + Math.floor(Math.random() * 2);
        let summoned = 0;

        for (let s = 0; s < summonCount; s++) {
          let placed = false;
          for (let dy2 = -1; dy2 <= 1 && !placed; dy2++) {
            for (let dx2 = -1; dx2 <= 1 && !placed; dx2++) {
              if (dx2 === 0 && dy2 === 0) continue;
              const nx = monster.pos.x + dx2;
              const ny = monster.pos.y + dy2;
              if (isWalkable(state.floor, nx, ny) &&
                !state.floor.monsters.some(m => m.pos.x === nx && m.pos.y === ny) &&
                !(state.player.pos.x === nx && state.player.pos.y === ny)) {
                const available = MONSTER_TEMPLATES.filter(
                  t => t.minFloor <= state.floorNumber && t.maxFloor >= state.floorNumber
                );
                if (available.length === 0) break;
                const tmpl = available[Math.floor(Math.random() * available.length)];
                // #15: Monster level scaling - +1 to all stats per 5 floors past minFloor
                const floorBonus = Math.floor(Math.max(0, state.floorNumber - tmpl.minFloor) / 5);
                const scaledHp = tmpl.hp + Math.floor(state.floorNumber * 0.5) + floorBonus * 2;
                const scaledAtk = tmpl.attack + Math.floor(state.floorNumber * 0.3) + floorBonus;
                const scaledDef = tmpl.defense + Math.floor(state.floorNumber * 0.2) + floorBonus;
                const newMon: Monster = {
                  id: generateId(),
                  templateId: tmpl.id,
                  name: tmpl.name,
                  displayChar: tmpl.displayChar,
                  color: tmpl.color,
                  pos: { x: nx, y: ny },
                  hp: scaledHp,
                  maxHp: scaledHp,
                  attack: scaledAtk,
                  defense: scaledDef,
                  exp: tmpl.exp + state.floorNumber,
                  level: 1 + Math.floor(state.floorNumber / 3),
                  speed: tmpl.speed,
                  behavior: tmpl.behavior,
                  abilities: [...tmpl.abilities],
                  statuses: [],
                  sleeping: false,
                  awakened: true,
                };
                state.floor.monsters.push(newMon);
                summoned++;
                placed = true;
              }
            }
          }
        }

        if (summoned > 0) {
          const msg = lowHpSummon
            ? `${monster.name}は助けを求めてなかまをよびよせた！`
            : `${monster.name}はなかまをよびよせた！`;
          logs.push({
            message: msg,
            turn: state.player.turnCount,
            type: 'critical',
          });
          return logs;
        }
        break;
      }

      case 'warp': {
        if (monster.hp >= monster.maxHp * 0.3) break;
        const rooms = state.floor.rooms;
        if (rooms.length > 0) {
          for (let attempt = 0; attempt < 30; attempt++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            const nx = room.x + Math.floor(Math.random() * room.width);
            const ny = room.y + Math.floor(Math.random() * room.height);
            if (isWalkable(state.floor, nx, ny) &&
              !state.floor.monsters.some(m => m.id !== monster.id && m.pos.x === nx && m.pos.y === ny) &&
              !(state.player.pos.x === nx && state.player.pos.y === ny)) {
              monster.pos = { x: nx, y: ny };
              logs.push({
                message: `${monster.name}はどこかへワープした！`,
                turn: state.player.turnCount,
                type: 'info',
              });
              return logs;
            }
          }
        }
        break;
      }

      case 'healAlly': {
        if (Math.random() > (ability.chance ?? 0.3)) break;
        const healAmount = ability.param ?? 20;
        let healed = false;
        for (const ally of state.floor.monsters) {
          if (ally.id === monster.id) continue;
          if (ally.hp >= ally.maxHp) continue;
          const allyDist = chebyshev(monster.pos, ally.pos);
          if (allyDist <= 3) {
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
            if (!healed) {
              logs.push({
                message: `${monster.name}は仲間を回復した！`,
                turn: state.player.turnCount,
                type: 'info',
              });
              healed = true;
            }
          }
        }
        if (healed) return logs;
        break;
      }
    }
  }
  return logs;
}

// Handle split ability
export function handleSplitAbility(state: GameState, monster: Monster): CombatLog[] {
  const logs: CombatLog[] = [];
  const splitAbility = monster.abilities.find(a => a.type === 'split');
  if (!splitAbility) return logs;
  if (monster.hp <= 0) return logs;
  if (monster.hp > monster.maxHp * 0.5) return logs;
  if ((monster.splitCount ?? 0) >= 3) return logs;
  if (state.floor.monsters.length >= 20) return logs;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = monster.pos.x + dx;
      const ny = monster.pos.y + dy;
      if (isWalkable(state.floor, nx, ny) &&
        !state.floor.monsters.some(m => m.pos.x === nx && m.pos.y === ny) &&
        !(state.player.pos.x === nx && state.player.pos.y === ny)) {
        const newMonster: Monster = {
          id: generateId(),
          templateId: monster.templateId,
          name: monster.name,
          displayChar: monster.displayChar,
          color: monster.color,
          pos: { x: nx, y: ny },
          hp: monster.maxHp,
          maxHp: monster.maxHp,
          attack: monster.attack,
          defense: monster.defense,
          exp: monster.exp,
          level: monster.level,
          speed: monster.speed,
          behavior: monster.behavior,
          abilities: [...monster.abilities],
          statuses: [],
          sleeping: false,
          awakened: true,
          splitCount: (monster.splitCount ?? 0) + 1,
        };
        monster.splitCount = (monster.splitCount ?? 0) + 1;
        state.floor.monsters.push(newMonster);
        logs.push({
          message: `${monster.name}は分裂した！`,
          turn: state.player.turnCount,
          type: 'info',
        });
        return logs;
      }
    }
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

export function resolveStatusEffects(entity: { statuses: StatusInstance[], hp: number }, floorNumber: number = 1): CombatLog[] {
  const logs: CombatLog[] = [];
  const expired: number[] = [];

  for (let i = 0; i < entity.statuses.length; i++) {
    const s = entity.statuses[i];
    s.remaining--;

    if (s.type === StatusEffect.Poison) {
      const poisonDmg = 1 + Math.floor(floorNumber / 5);
      entity.hp = Math.max(1, entity.hp - poisonDmg);
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
        // #9: Ranged attack improvement - thrown items deal bonus damage based on strength
        dmg = calculateDamage(item.attack + calculatePlayerAttack(state.player) / 2 + state.player.strength, hitMonster.defense);
      } else if (item.category === ItemCategory.Weapon) {
        dmg = calculateDamage(item.attack + state.player.strength, hitMonster.defense);
      } else if (item.category === ItemCategory.Herb && (item as { effect: string }).effect === 'poison') {
        dmg = 10 + state.player.strength;
      } else {
        // #9: Generic thrown items also benefit from strength
        dmg = 2 + Math.floor(state.player.strength / 2);
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
