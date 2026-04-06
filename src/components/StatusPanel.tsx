'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  GameState, ItemCategory, WeaponItem, ShieldItem, SealType, StatusEffect,
} from '@/types/game';
import { calculatePlayerAttack, calculatePlayerDefense } from '@/engine/systems/combat';

interface Props {
  state: GameState;
}

const STATUS_LABELS: Record<StatusEffect, string> = {
  [StatusEffect.Poison]: '毒',
  [StatusEffect.Confusion]: '混乱',
  [StatusEffect.Sleep]: '睡眠',
  [StatusEffect.Blind]: '盲目',
  [StatusEffect.Slow]: '鈍足',
  [StatusEffect.Sealed]: '封印',
  [StatusEffect.Paralysis]: '金縛',
};

const STATUS_STYLES: Record<StatusEffect, string> = {
  [StatusEffect.Poison]: '#8a3aaa',
  [StatusEffect.Confusion]: '#aa8a2a',
  [StatusEffect.Sleep]: '#4a6aaa',
  [StatusEffect.Blind]: '#5a5a5a',
  [StatusEffect.Slow]: '#3a7a8a',
  [StatusEffect.Sealed]: '#aa3a3a',
  [StatusEffect.Paralysis]: '#aa6a2a',
};

const SEAL_GLYPHS: Partial<Record<SealType, string>> = {
  [SealType.DragonSlayer]: '竜',
  [SealType.UndeadSlayer]: '屍',
  [SealType.DoubleStrike]: '連',
  [SealType.Critical]: '会',
  [SealType.Drain]: '吸',
  [SealType.RustProof]: '金',
  [SealType.SureHit]: '必',
  [SealType.TheftGuard]: '守',
  [SealType.Counter]: '返',
  [SealType.HungerSlow]: '食',
  [SealType.ExpBoost]: '得',
  [SealType.FireResist]: '炎',
  [SealType.Healing]: '癒',
};

export default function StatusBar({ state }: Props) {
  const { player, floorNumber } = state;
  const weapon = player.equippedWeapon
    ? player.inventory.find(i => i.id === player.equippedWeapon) as WeaponItem | undefined
    : null;
  const shield = player.equippedShield
    ? player.inventory.find(i => i.id === player.equippedShield) as ShieldItem | undefined
    : null;
  const atk = calculatePlayerAttack(player);
  const def = calculatePlayerDefense(player);
  const hpPct = player.hp / player.maxHp;
  const satPct = player.satiation / player.maxSatiation;
  const expPct = player.expToNext > 0 ? player.exp / player.expToNext : 0;

  // HP shake
  const prevHpRef = useRef(player.hp);
  const [hpShake, setHpShake] = useState(false);
  useEffect(() => {
    const diff = prevHpRef.current - player.hp;
    if (diff > player.maxHp * 0.15) {
      setHpShake(true);
      const t = setTimeout(() => setHpShake(false), 400);
      prevHpRef.current = player.hp;
      return () => clearTimeout(t);
    }
    prevHpRef.current = player.hp;
  }, [player.hp, player.maxHp]);

  // Gold bounce
  const prevGoldRef = useRef(player.gold);
  const [goldBounce, setGoldBounce] = useState(false);
  useEffect(() => {
    if (player.gold > prevGoldRef.current) {
      setGoldBounce(true);
      const t = setTimeout(() => setGoldBounce(false), 400);
      prevGoldRef.current = player.gold;
      return () => clearTimeout(t);
    }
    prevGoldRef.current = player.gold;
  }, [player.gold]);

  const hpColor = hpPct < 0.25 ? '#cc3333' : hpPct < 0.5 ? '#ddaa33' : '#44cc66';
  const hpBarColor = hpPct < 0.25 ? '#cc3333' : hpPct < 0.5 ? '#aa8a3a' : '#3a8a4a';
  const hpBarWidth = Math.max(0, Math.min(100, hpPct * 100));
  const expBarWidth = Math.max(0, Math.min(100, expPct * 100));

  // #3: Enhancement color coding
  const getEnhColor = (enh: number) => enh < 0 ? '#cc3333' : enh > 0 ? '#44cc66' : '#8a7a5a';

  const weaponLabel = weapon ? `${weapon.name}${weapon.enhancement >= 0 ? '+' : ''}${weapon.enhancement}` : '';
  const shieldLabel = shield ? `${shield.name}${shield.enhancement >= 0 ? '+' : ''}${shield.enhancement}` : '';

  // #4: Check if equipment is sealed
  const playerSealed = player.statuses.some(s => s.type === StatusEffect.Sealed);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.7)',
      padding: '4px 12px',
      fontFamily: 'var(--font-game), monospace',
      fontSize: '14px',
      fontWeight: 700,
      lineHeight: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      color: '#e0e0e0',
      whiteSpace: 'nowrap',
      minHeight: '28px',
    }}>
      {/* #15 Floor number display with dungeon name */}
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}>
        <span style={{ color: '#c9a84c', fontSize: '15px', lineHeight: '16px' }}>{floorNumber}F</span>
        <span style={{ color: '#5a4d38', fontSize: '8px', lineHeight: '10px', letterSpacing: '0.05em' }}>
          {floorNumber <= 5 ? '石窟' : floorNumber <= 10 ? '苔洞' : floorNumber <= 15 ? '氷穴' : floorNumber <= 20 ? '溶岩' : floorNumber <= 25 ? '暗黒' : '黄金'}
        </span>
      </span>

      {/* Level */}
      <span style={{ color: '#7a9aaa' }}>Lv.{player.level}</span>

      {/* HP with inline bar + EXP bar below */}
      <span style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '1px',
        animation: hpShake ? 'hpShake 0.4s ease-out' : 'none',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#888', fontSize: '12px' }}>HP</span>
          <span style={{ color: hpColor }}>{player.hp}</span>
          <span style={{ color: '#555' }}>/</span>
          <span style={{ color: '#aaa' }}>{player.maxHp}</span>
          <span style={{
            display: 'inline-block',
            width: '48px',
            height: '6px',
            background: '#1a1a1a',
            borderRadius: '2px',
            overflow: 'hidden',
            border: '1px solid #333',
            verticalAlign: 'middle',
          }}>
            {/* #13 Animated HP bar — smooth transition with glow */}
            <span style={{
              display: 'block',
              width: `${hpBarWidth}%`,
              height: '100%',
              background: hpBarColor,
              transition: 'width 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), background 0.3s',
              boxShadow: hpPct < 0.25 ? `0 0 4px ${hpBarColor}` : 'none',
            }} />
          </span>
        </span>
        {/* #1: EXP progress bar */}
        <span style={{
          display: 'inline-block',
          width: '48px',
          height: '3px',
          background: '#1a1a1a',
          borderRadius: '1px',
          overflow: 'hidden',
          border: '1px solid #222',
          marginLeft: 'auto',
        }}>
          <span style={{
            display: 'block',
            width: `${expBarWidth}%`,
            height: '100%',
            background: '#3a5aaa',
            transition: 'width 0.3s',
          }} />
        </span>
      </span>

      {/* ATK with weapon */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
        <span style={{ color: '#666', fontSize: '11px' }}>ATK</span>
        <span style={{ color: '#aa5a4a' }}>{atk}</span>
        {weaponLabel && (
          <span style={{ color: weapon ? getEnhColor(weapon.enhancement) : '#8a7a5a', fontSize: '11px' }}>
            ({weaponLabel})
          </span>
        )}
        {/* #4: Sealed indicator on weapon */}
        {weapon && playerSealed && (
          <span style={{ color: '#cc3333', fontSize: '10px', fontWeight: 900, position: 'absolute', top: '-2px', right: '-6px' }}>X</span>
        )}
      </span>

      {/* DEF with shield */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
        <span style={{ color: '#666', fontSize: '11px' }}>DEF</span>
        <span style={{ color: '#4a6aaa' }}>{def}</span>
        {shieldLabel && (
          <span style={{ color: shield ? getEnhColor(shield.enhancement) : '#8a7a5a', fontSize: '11px' }}>
            ({shieldLabel})
          </span>
        )}
        {/* #4: Sealed indicator on shield */}
        {shield && playerSealed && (
          <span style={{ color: '#cc3333', fontSize: '10px', fontWeight: 900, position: 'absolute', top: '-2px', right: '-6px' }}>X</span>
        )}
      </span>

      {/* #16 Strength stat display */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <span style={{ color: '#666', fontSize: '11px' }}>力</span>
        <span style={{ color: '#aa7a4a' }}>{player.strength}</span>
        <span style={{ color: '#555', fontSize: '10px' }}>/{player.maxStrength}</span>
      </span>

      {/* Gold */}
      <span style={{
        color: '#FFD060',
        animation: goldBounce ? 'goldBounce 0.4s ease-out' : 'none',
        textShadow: goldBounce ? '0 0 8px rgba(201,168,76,0.6)' : 'none',
      }}>
        {player.gold}G
      </span>

      {/* Satiation + #2: hunger warning icon */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        color: satPct <= 0.2 ? '#cc3333' : satPct > 0.5 ? '#5a8a5a' : '#aa8a3a',
        fontSize: '12px',
        animation: satPct <= 0.2 ? 'hungerBlink 0.5s ease-in-out infinite' : 'none',
      }}>
        {satPct < 0.3 && (
          <span style={{
            animation: 'hungerBlink 0.8s ease-in-out infinite',
            fontSize: '13px',
          }}>
            &#x1F4A7;
          </span>
        )}
        <span style={{ color: '#666', fontSize: '11px' }}>満腹</span>
        {player.satiation}/{player.maxSatiation}
      </span>

      {/* #5: Turn counter */}
      <span style={{ color: '#444', fontSize: '10px' }}>T:{player.turnCount}</span>

      {/* #14 Status effect icons with countdown timers */}
      {player.statuses.length > 0 && (
        <span style={{ display: 'inline-flex', gap: '4px', marginLeft: '2px' }}>
          {player.statuses.map((s, i) => (
            <span key={i} style={{
              fontSize: '10px',
              padding: '0 4px',
              borderRadius: '2px',
              background: `${STATUS_STYLES[s.type]}25`,
              border: `1px solid ${STATUS_STYLES[s.type]}50`,
              color: STATUS_STYLES[s.type],
              lineHeight: '16px',
              animation: s.remaining <= 3 ? 'statusPulse 1s ease-in-out infinite' : 'none',
              position: 'relative' as const,
            }}>
              <span style={{ marginRight: '2px' }}>
                {s.type === StatusEffect.Poison ? '☠' : s.type === StatusEffect.Sleep ? '💤' : s.type === StatusEffect.Confusion ? '💫' : s.type === StatusEffect.Blind ? '🌑' : s.type === StatusEffect.Slow ? '🐢' : s.type === StatusEffect.Sealed ? '🔒' : s.type === StatusEffect.Paralysis ? '⚡' : ''}
              </span>
              {STATUS_LABELS[s.type]}
              <span style={{ fontWeight: 700, marginLeft: '1px', color: s.remaining <= 3 ? '#ff6666' : STATUS_STYLES[s.type] }}>
                {s.remaining}
              </span>
            </span>
          ))}
        </span>
      )}

      <style jsx>{`
        @keyframes hungerBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes hpShake {
          0% { transform: translate(0, 0); }
          15% { transform: translate(-3px, 0); }
          30% { transform: translate(3px, 0); }
          45% { transform: translate(-2px, 0); }
          60% { transform: translate(2px, 0); }
          75% { transform: translate(-1px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes goldBounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
