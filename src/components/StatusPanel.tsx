'use client';

import React from 'react';
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

function GoldDivider() {
  return <div className="gold-line my-2" />;
}

function StatBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full h-[6px] rounded-sm overflow-hidden" style={{ background: '#0a0a12', border: '1px solid #1a1520' }}>
      <div
        className={`h-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function EquipSlot({ label, item }: { label: string; item: WeaponItem | ShieldItem | null }) {
  if (!item) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: '#08080e', border: '1px solid #151218' }}>
        <span style={{ color: '#2a2530', fontSize: '10px', fontFamily: 'var(--font-display)' }}>{label}</span>
        <span style={{ color: '#1a1820', fontSize: '11px' }}>―</span>
      </div>
    );
  }

  const enh = item.enhancement >= 0 ? `+${item.enhancement}` : `${item.enhancement}`;
  return (
    <div
      className="px-2 py-1.5 rounded"
      style={{
        background: item.cursed ? 'rgba(80,15,25,0.15)' : 'rgba(10,10,18,0.8)',
        border: `1px solid ${item.cursed ? '#3a1520' : '#1a1520'}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ color: '#4a4035', fontSize: '10px', fontFamily: 'var(--font-display)' }}>{label}</span>
        <span style={{ color: item.cursed ? '#8a3030' : '#b0a080', fontSize: '11px', fontWeight: 500 }}>{item.name}</span>
        <span style={{
          color: item.enhancement > 0 ? '#5a9a6a' : item.enhancement < 0 ? '#8a3030' : '#4a4035',
          fontSize: '11px', fontWeight: 700,
        }}>{enh}</span>
      </div>
      {item.seals.length > 0 && (
        <div className="flex gap-[3px] mt-1 ml-5">
          {item.seals.map((seal, i) => (
            <span key={i} style={{
              fontSize: '9px', padding: '0 3px', borderRadius: '2px',
              background: 'rgba(100,80,50,0.12)', border: '1px solid rgba(100,80,50,0.15)',
              color: '#8a7a5a', fontFamily: 'var(--font-body)',
            }}>
              {SEAL_GLYPHS[seal] ?? '?'}
            </span>
          ))}
          {Array.from({ length: item.maxSeals - item.seals.length }).map((_, i) => (
            <span key={`e${i}`} style={{
              fontSize: '9px', padding: '0 3px', borderRadius: '2px',
              background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(30,25,20,0.3)',
              color: '#1a1815',
            }}>
              -
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatusPanel({ state }: Props) {
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

  return (
    <div
      className="w-[220px] panel-ornate p-3 flex flex-col"
      style={{ fontFamily: 'var(--font-game)', fontSize: '11px' }}
    >
      {/* Floor Header */}
      <div className="text-center pb-1.5">
        <div
          className="text-glow-gold tracking-[0.2em]"
          style={{
            fontFamily: 'var(--font-display)',
            color: '#c9a84c',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          {floorNumber}F
        </div>
        <div style={{ color: '#2a2520', fontSize: '9px', fontFamily: 'var(--font-display)', letterSpacing: '0.15em' }}>
          不思議のダンジョン
        </div>
      </div>

      <GoldDivider />

      {/* Level + Turn */}
      <div className="flex justify-between items-baseline mb-2">
        <span style={{ fontFamily: 'var(--font-display)', color: '#7a9aaa', fontWeight: 700, fontSize: '13px' }}>
          Lv.{player.level}
        </span>
        <span style={{ color: '#2a2520', fontSize: '9px' }}>
          Turn {player.turnCount}
        </span>
      </div>

      {/* HP */}
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <span style={{ color: '#4a4035', fontSize: '10px' }}>HP</span>
          <span style={{
            color: hpPct < 0.25 ? '#cc3333' : hpPct < 0.5 ? '#aa8a3a' : '#6a9a6a',
            fontSize: '11px', fontWeight: hpPct < 0.25 ? 700 : 400,
          }}>
            {player.hp} / {player.maxHp}
          </span>
        </div>
        <StatBar value={player.hp} max={player.maxHp}
          colorClass={hpPct < 0.25 ? 'hp-bar-danger' : hpPct < 0.5 ? 'hp-bar-warn' : 'hp-bar-gradient'} />
      </div>

      {/* Satiation */}
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <span style={{ color: '#4a4035', fontSize: '10px' }}>満腹度</span>
          <span style={{ color: satPct < 0.2 ? '#cc3333' : '#8a7050', fontSize: '10px' }}>
            {player.satiation} / {player.maxSatiation}
          </span>
        </div>
        <StatBar value={player.satiation} max={player.maxSatiation}
          colorClass={satPct < 0.2 ? 'hp-bar-danger' : 'bg-amber-800'} />
      </div>

      {/* EXP */}
      <div className="mb-1">
        <div className="flex justify-between mb-0.5">
          <span style={{ color: '#4a4035', fontSize: '10px' }}>Exp</span>
          <span style={{ color: '#4a5a7a', fontSize: '10px' }}>
            {player.exp} / {player.expToNext}
          </span>
        </div>
        <StatBar value={player.exp} max={player.expToNext} colorClass="bg-blue-900" />
      </div>

      <GoldDivider />

      {/* Combat Stats Grid */}
      <div
        className="grid grid-cols-2 gap-x-3 gap-y-1 p-2 rounded"
        style={{ background: '#08080e', border: '1px solid #151218' }}
      >
        {[
          { label: 'ATK', value: atk, color: '#aa5a4a' },
          { label: 'DEF', value: def, color: '#4a6aaa' },
          { label: 'STR', value: `${player.strength}/${player.maxStrength}`, color: '#aa7a3a' },
          { label: 'GOLD', value: player.gold, color: '#c9a84c' },
        ].map(stat => (
          <div key={stat.label} className="flex items-baseline gap-1.5">
            <span style={{ color: '#3a3530', fontSize: '9px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
              {stat.label}
            </span>
            <span style={{ color: stat.color, fontSize: '12px', fontWeight: 700 }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <GoldDivider />

      {/* Equipment Slots */}
      <div className="space-y-1.5">
        <EquipSlot label="剣" item={weapon ?? null} />
        <EquipSlot label="盾" item={shield ?? null} />
      </div>

      {/* Status Effects */}
      {player.statuses.length > 0 && (
        <>
          <GoldDivider />
          <div className="flex flex-wrap gap-1">
            {player.statuses.map((s, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  background: `${STATUS_STYLES[s.type]}15`,
                  border: `1px solid ${STATUS_STYLES[s.type]}30`,
                  color: STATUS_STYLES[s.type],
                }}
              >
                {STATUS_LABELS[s.type]} {s.remaining}
              </span>
            ))}
          </div>
        </>
      )}

      <GoldDivider />

      {/* Inventory gauge */}
      <div className="flex items-center justify-between">
        <span style={{ color: '#2a2520', fontSize: '9px' }}>持ち物</span>
        <div className="flex items-center gap-1.5">
          <div className="w-14 h-1 rounded-sm overflow-hidden" style={{ background: '#0a0a12', border: '1px solid #151218' }}>
            <div className="h-full transition-all"
              style={{
                width: `${(player.inventory.length / 20) * 100}%`,
                background: player.inventory.length >= 18 ? '#8a3030' : '#3a3530',
              }}
            />
          </div>
          <span style={{ color: player.inventory.length >= 18 ? '#8a3030' : '#3a3530', fontSize: '9px' }}>
            {player.inventory.length}/20
          </span>
        </div>
      </div>

      {/* Keybinds */}
      <div className="mt-2 pt-1.5 space-y-0.5" style={{ borderTop: '1px solid #12101a', color: '#1a1815', fontSize: '8px' }}>
        <div>矢印/hjklyubn ― 移動 &nbsp; Shift ― ダッシュ</div>
        <div>Space 足踏 &nbsp; I 持物 &nbsp; G 拾う &nbsp; S 階段</div>
      </div>
    </div>
  );
}
