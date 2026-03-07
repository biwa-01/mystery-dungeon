'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, TileType, Direction, ItemCategory, WeaponItem, ShieldItem, SealType, StatusEffect } from '@/types/game';
import {
  drawSprite, drawGlow,
  SPRITE_STAIRS, SPRITE_TRAP,
  SPRITE_PLAYER_DOWN, SPRITE_PLAYER_UP, SPRITE_PLAYER_ARMED,
  MONSTER_SPRITES, ITEM_SPRITES,
} from '@/engine/sprites';

// ================================================================
//  TORNEKO 3 QUARTER-VIEW ENGINE - ULTIMATE LIVING EDITION
//
//  Perlin torch, lerp movement, bounce walk, breathing idle,
//  dodge anim, EXP orb absorption, radial level-up lines,
//  hunger pulse, slash arcs, death dissolution, wall dither,
//  bloom, dust, weapon trails, magic circles, spotlight, lightning
// ================================================================

const TW = 48;
const TH = 24;
const WH = 72;
const SP = 34;
const CW = 800;
const CH = 580;
const RANGE = 14;

const MOVE_DUR = 130;
const ATK_DUR = 180;
const HIT_DUR = 250;
const HIT_STOP_DUR = 50;
const SLASH_DUR = 200;
const MON_ATK_DUR = 300;
const DEATH_FX_DUR = 600;
const DODGE_DUR = 280;

function toScr(mx: number, my: number, cx: number, cy: number): [number, number] {
  return [
    CW / 2 + (mx - cx - (my - cy)) * (TW / 2),
    CH / 2 + (mx - cx + (my - cy)) * (TH / 2),
  ];
}

function H(x: number, y: number): number {
  let v = (x * 374761393 + y * 668265263) | 0;
  v = ((v ^ (v >> 13)) * 1274126177) | 0;
  return ((v ^ (v >> 16)) & 0x7fffffff) / 0x7fffffff;
}
function H3(x: number, y: number, z: number): number { return H(x * 31 + z, y * 17 + z * 7); }

function easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }
function easeOutBack(t: number): number { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// ============ Perlin-style noise for torch flicker ============
const _perm: number[] = [];
(function initPerm() {
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
    140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
    247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
    57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
    74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
    60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54];
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 95];
})();
function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number): number { return a + t * (b - a); }
function grad1(hash: number, x: number): number { return (hash & 1) === 0 ? x : -x; }
function perlin1(x: number): number {
  const xi = Math.floor(x) & 255;
  const xf = x - Math.floor(x);
  return lerp(grad1(_perm[xi], xf), grad1(_perm[xi + 1], xf - 1), fade(xf));
}

// ================================================================
const COL = {
  flBase: [178, 158, 128], flHi: [210, 192, 162], flSh: [138, 118, 92],
  flMortar: [108, 92, 72], corBase: [155, 140, 115],
  wTop: [148, 128, 102], wTopHi: [178, 160, 132],
  wSouthT: [158, 135, 105], wSouthM: [118, 100, 78], wSouthB: [68, 58, 45],
  wEast: [95, 80, 62], wEastD: [58, 48, 38],
  bg: [22, 18, 12],
};
function rgb(b: readonly number[], n: number, s: number): string {
  return `rgb(${Math.min(255, b[0] + n * s) | 0},${Math.min(255, b[1] + n * s * 0.85) | 0},${Math.min(255, b[2] + n * s * 0.7) | 0})`;
}

// ============ VFX Systems ============
interface Popup { id: number; x: number; y: number; text: string; color: string; t0: number; vx: number; vy: number; size?: number; }
let _pid = 0;

interface ImpactParticle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
let _impactParticles: ImpactParticle[] = [];
function spawnImpact(x: number, y: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    _impactParticles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
      life: 300 + Math.random() * 200, maxLife: 300 + Math.random() * 200, size: 1.5 + Math.random() * 2, color });
  }
}

interface Shockwave { x: number; y: number; t0: number; color: string; maxR: number; }
let _shockwaves: Shockwave[] = [];
function spawnShockwave(x: number, y: number, color: string, maxR: number = 30) {
  _shockwaves.push({ x, y, t0: performance.now(), color, maxR });
}

// Slash arc effect
interface SlashArc { x: number; y: number; t0: number; angle: number; dir: number; color: string; }
let _slashArcs: SlashArc[] = [];
function spawnSlashArc(x: number, y: number, angle: number, dir: number, color: string = '#FFFDE0') {
  _slashArcs.push({ x, y, t0: performance.now(), angle, dir, color });
}

// Death dissolution
interface DeathFx { x: number; y: number; t0: number; templateId: string; particles: { ox: number; oy: number; vx: number; vy: number; c: string; }[]; }
let _deathFxList: DeathFx[] = [];
function spawnDeathFx(x: number, y: number, templateId: string) {
  const particles: DeathFx['particles'] = [];
  for (let i = 0; i < 40; i++) {
    particles.push({
      ox: (Math.random() - 0.5) * SP, oy: (Math.random() - 0.5) * SP,
      vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
      c: ['#FFE080', '#FF8844', '#FFCC44', '#FFA060', '#FFFFFF'][Math.floor(Math.random() * 5)],
    });
  }
  _deathFxList.push({ x, y, t0: performance.now(), templateId, particles });
}

// Dust puffs
interface DustPuff { x: number; y: number; t0: number; }
let _dustPuffs: DustPuff[] = [];
function spawnDust(x: number, y: number) {
  _dustPuffs.push({ x, y, t0: performance.now() });
}

// Lightning bolt
interface LightningBolt { x: number; y: number; t0: number; }
let _lightningBolts: LightningBolt[] = [];

// Monster attack animation
interface MonsterAtkAnim { id: string; x: number; y: number; tx: number; ty: number; t0: number; }
let _monsterAtks: MonsterAtkAnim[] = [];

// Trap spark effect
interface TrapSpark { x: number; y: number; t0: number; }
let _trapSparks: TrapSpark[] = [];

// Dodge animation (monster evades)
interface DodgeAnim { id: string; x: number; y: number; dir: number; t0: number; }
let _dodgeAnims: DodgeAnim[] = [];
function spawnDodge(x: number, y: number, id: string) {
  const dir = Math.random() > 0.5 ? 1 : -1;
  _dodgeAnims.push({ id, x, y, dir, t0: performance.now() });
}

// EXP orb absorption
interface ExpOrb { x: number; y: number; tx: number; ty: number; t0: number; color: string; delay: number; }
let _expOrbs: ExpOrb[] = [];
function spawnExpOrbs(x: number, y: number, tx: number, ty: number, count: number) {
  for (let i = 0; i < count; i++) {
    _expOrbs.push({
      x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20,
      tx, ty, t0: performance.now(), delay: i * 40 + Math.random() * 60,
      color: ['#4488FF', '#66AAFF', '#88CCFF', '#AADDFF'][Math.floor(Math.random() * 4)],
    });
  }
}

// Level-up radial lines
interface RadialLine { angle: number; speed: number; len: number; color: string; }
let _levelUpLines: RadialLine[] = [];
let _levelUpT0 = 0;
function spawnLevelUpLines() {
  _levelUpLines = [];
  _levelUpT0 = performance.now();
  for (let i = 0; i < 24; i++) {
    _levelUpLines.push({
      angle: (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.15,
      speed: 2 + Math.random() * 4,
      len: 40 + Math.random() * 80,
      color: i % 3 === 0 ? '#F0D060' : i % 3 === 1 ? '#D4A840' : '#FFE880',
    });
  }
}

// Film grain
let _gr: HTMLCanvasElement | null = null;
function getGrain(): HTMLCanvasElement {
  if (_gr) return _gr;
  _gr = document.createElement('canvas');
  _gr.width = 128; _gr.height = 128;
  const c = _gr.getContext('2d')!;
  const d = c.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 8;
  }
  c.putImageData(d, 0, 0);
  return _gr;
}

// Scanline + dither patterns
let _sl: HTMLCanvasElement | null = null;
function getScanlines(): HTMLCanvasElement {
  if (_sl) return _sl;
  _sl = document.createElement('canvas');
  _sl.width = 4; _sl.height = 4;
  const c = _sl.getContext('2d')!;
  c.fillStyle = 'rgba(0,0,0,0)';
  c.fillRect(0, 0, 4, 4);
  c.fillStyle = 'rgba(0,0,0,0.035)';
  c.fillRect(0, 0, 4, 1);
  c.fillRect(0, 2, 4, 1);
  return _sl;
}

let _dither: HTMLCanvasElement | null = null;
function getDither(): HTMLCanvasElement {
  if (_dither) return _dither;
  _dither = document.createElement('canvas');
  _dither.width = 4; _dither.height = 4;
  const c = _dither.getContext('2d')!;
  c.fillStyle = 'rgba(0,0,0,0)';
  c.fillRect(0, 0, 4, 4);
  c.fillStyle = 'rgba(0,0,0,1)';
  c.fillRect(0, 0, 1, 1); c.fillRect(2, 0, 1, 1);
  c.fillRect(1, 1, 1, 1); c.fillRect(3, 1, 1, 1);
  c.fillRect(0, 2, 1, 1); c.fillRect(2, 2, 1, 1);
  c.fillRect(1, 3, 1, 1); c.fillRect(3, 3, 1, 1);
  return _dither;
}

// ================================================================
interface Props {
  state: GameState;
  screenShake: { x: number; y: number };
  damageFlash: number;
  levelUpEffect: number;
  criticalFlash: number;
  stairsFade: number;
  deathSlowmo: boolean;
}

export default function DungeonRenderer({ state, screenShake, damageFlash, levelUpEffect, criticalFlash, stairsFade, deathSlowmo }: Props) {
  const cRef = useRef<HTMLCanvasElement>(null);
  const aRef = useRef<number>(0);
  const popRef = useRef<Popup[]>([]);
  const ppHP = useRef(state.player.hp);
  const pmHP = useRef<Map<string, number>>(new Map());
  const prevMonIds = useRef<Set<string>>(new Set());
  const prevLevelRef = useRef(state.player.level);

  const { player, floor } = state;

  // Animation state
  const pFrom = useRef({ x: player.pos.x, y: player.pos.y });
  const pTo = useRef({ x: player.pos.x, y: player.pos.y });
  const pMoveT = useRef(0);

  const mFrom = useRef<Map<string, { x: number; y: number }>>(new Map());
  const mTo = useRef<Map<string, { x: number; y: number }>>(new Map());
  const mMoveT = useRef<Map<string, number>>(new Map());

  const atkDir = useRef({ dx: 0, dy: 0 });
  const atkT = useRef(0);
  const mHitT = useRef<Map<string, number>>(new Map());
  const pHitT = useRef(0);
  const hitStopUntil = useRef(0);

  const prevTrapVis = useRef<Map<string, boolean>>(new Map());

  // Player movement detect -> dust puffs
  useEffect(() => {
    if (player.pos.x !== pTo.current.x || player.pos.y !== pTo.current.y) {
      pFrom.current = { ...pTo.current };
      pTo.current = { x: player.pos.x, y: player.pos.y };
      pMoveT.current = performance.now();
      spawnDust(CW / 2, CH / 2 + 4);
    }
  }, [player.pos.x, player.pos.y]);

  // Monster movement + death detection
  useEffect(() => {
    const now = performance.now();
    const currentIds = new Set<string>();
    for (const mon of floor.monsters) {
      currentIds.add(mon.id);
      const prev = mTo.current.get(mon.id);
      if (prev && (prev.x !== mon.pos.x || prev.y !== mon.pos.y)) {
        mFrom.current.set(mon.id, { ...prev });
        mMoveT.current.set(mon.id, now);
      }
      mTo.current.set(mon.id, { x: mon.pos.x, y: mon.pos.y });
    }

    // Death dissolution + EXP orb absorption
    for (const oldId of prevMonIds.current) {
      if (!currentIds.has(oldId)) {
        const lastPos = mTo.current.get(oldId);
        if (lastPos) {
          const [sx, sy] = toScr(lastPos.x, lastPos.y, player.pos.x, player.pos.y);
          spawnDeathFx(sx, sy - SP / 2, oldId);
          // EXP orbs fly to player
          spawnExpOrbs(sx, sy - SP / 2, CW / 2, CH / 2 - SP / 2, 8);
          // EXP popup
          const expMsg = state.logs.slice(-5).find(l => l.message.includes('経験値'));
          const expMatch = expMsg?.message.match(/経験値(\d+)/);
          const expVal = expMatch ? expMatch[1] : '??';
          popRef.current.push({
            id: _pid++, x: sx, y: sy - SP - 10,
            text: `+${expVal} Exp`, color: '#4488ff', t0: now, vx: 0, vy: -2,
          });
        }
      }
    }
    prevMonIds.current = currentIds;
  }, [floor.monsters, player.pos, state.logs]);

  // Level up -> radial lines
  useEffect(() => {
    if (player.level > prevLevelRef.current) {
      spawnLevelUpLines();
    }
    prevLevelRef.current = player.level;
  }, [player.level]);

  // Trap reveal -> lightning + sparks
  useEffect(() => {
    for (const trap of floor.traps) {
      const key = `${trap.pos.x},${trap.pos.y}`;
      const was = prevTrapVis.current.get(key);
      if (trap.visible && !was) {
        const [sx, sy] = toScr(trap.pos.x, trap.pos.y, player.pos.x, player.pos.y);
        _trapSparks.push({ x: trap.pos.x, y: trap.pos.y, t0: performance.now() });
        _lightningBolts.push({ x: sx, y: sy, t0: performance.now() });
        spawnImpact(sx, sy, 12, '#FF8844');
        spawnImpact(sx, sy, 8, '#FFDD44');
      }
      prevTrapVis.current.set(key, trap.visible);
    }
  }, [floor.traps, player.pos]);

  // HP tracking -> popups + slash arcs + hit stop + monster attack + dodge detect
  useEffect(() => {
    const now = performance.now();
    const pd = ppHP.current - player.hp;
    ppHP.current = player.hp;
    if (pd > 0) {
      popRef.current.push({
        id: _pid++, x: CW / 2, y: CH / 2 - SP,
        text: `-${pd}`, color: '#ff4444', t0: now,
        vx: (Math.random() - 0.5) * 2, vy: -4.5, size: Math.min(22, 17 + pd * 0.3),
      });
      pHitT.current = now;
      hitStopUntil.current = now + HIT_STOP_DUR;
      spawnImpact(CW / 2, CH / 2 - SP / 2, 6 + pd, '#FF6060');
      spawnShockwave(CW / 2, CH / 2 - SP / 3, 'rgba(255,80,80,0.5)', 20 + pd * 2);

      // Detect attacking monster -> trigger monster attack anim
      for (const m of floor.monsters) {
        const dx = Math.abs(m.pos.x - player.pos.x);
        const dy = Math.abs(m.pos.y - player.pos.y);
        if (dx <= 1 && dy <= 1) {
          const [msx, msy] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y);
          _monsterAtks.push({ id: m.id, x: msx, y: msy, tx: CW / 2, ty: CH / 2, t0: now });
          break;
        }
      }
    } else if (pd < 0) {
      popRef.current.push({
        id: _pid++, x: CW / 2, y: CH / 2 - SP,
        text: `+${-pd}`, color: '#44ff66', t0: now,
        vx: (Math.random() - 0.5) * 1.5, vy: -3,
      });
    }

    // Inventory full "?" popup
    const recentLog = state.logs[state.logs.length - 1];
    if (recentLog?.message.includes('持ち物がいっぱい')) {
      popRef.current.push({
        id: _pid++, x: CW / 2, y: CH / 2 - SP * 1.5,
        text: '?', color: '#ffcc44', t0: now, vx: 0, vy: -2.5,
      });
    }

    // Dodge detection from logs
    const dodgeLog = state.logs.slice(-3).find(l => l.message.includes('かわした') || l.message.includes('外れた'));
    if (dodgeLog) {
      for (const m of floor.monsters) {
        const dx = Math.abs(m.pos.x - player.pos.x);
        const dy = Math.abs(m.pos.y - player.pos.y);
        if (dx <= 1 && dy <= 1 && !_dodgeAnims.find(d => d.id === m.id && now - d.t0 < DODGE_DUR)) {
          const [msx, msy] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y);
          spawnDodge(msx, msy - SP / 2, m.id);
          break;
        }
      }
    }

    const nm = new Map<string, number>();
    for (const m of floor.monsters) {
      const p = pmHP.current.get(m.id); nm.set(m.id, m.hp);
      if (p !== undefined && p > m.hp) {
        const dmg = p - m.hp;
        const [mx, my] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y);
        popRef.current.push({
          id: _pid++, x: mx, y: my - SP,
          text: `${dmg}`, color: '#ffcc44', t0: now,
          vx: (Math.random() - 0.5) * 3, vy: -5, size: Math.min(24, 17 + dmg * 0.5),
        });
        mHitT.current.set(m.id, now);
        hitStopUntil.current = now + HIT_STOP_DUR;
        spawnImpact(mx, my - SP / 2, 8 + dmg, '#FFE080');
        spawnShockwave(mx, my - SP / 3, 'rgba(255,220,120,0.6)', 25 + dmg * 2);
        const ddx = m.pos.x - player.pos.x, ddy = m.pos.y - player.pos.y;
        if (Math.abs(ddx) <= 1 && Math.abs(ddy) <= 1) {
          atkDir.current = { dx: ddx, dy: ddy };
          atkT.current = now;
          const angle = Math.atan2(ddy, ddx);
          spawnSlashArc(mx, my - SP / 3, angle, 1, dmg > 10 ? '#FF8844' : '#FFFDE0');
        }
      }
    }
    pmHP.current = nm;
  }, [player.hp, floor.monsters, player.pos, state.logs]);

  const iW = useCallback((x: number, y: number): boolean => {
    if (x < 0 || x >= floor.width || y < 0 || y >= floor.height) return true;
    return (floor.tiles[y]?.[x] ?? TileType.Wall) === TileType.Wall;
  }, [floor]);

  // ================================================================
  //  FLOOR TILE
  // ================================================================
  const drawFloorTile = useCallback((
    ctx: CanvasRenderingContext2D, sx: number, sy: number,
    mx: number, my: number, alpha: number, isCorridor: boolean
  ) => {
    ctx.save(); ctx.globalAlpha = alpha;
    const n = H(mx, my);
    const base = isCorridor ? COL.corBase : COL.flBase;

    ctx.beginPath();
    ctx.moveTo(sx, sy - TH / 2); ctx.lineTo(sx + TW / 2, sy);
    ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy);
    ctx.closePath();
    ctx.fillStyle = rgb(base, n, 14);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy - TH / 2); ctx.lineTo(sx + TW / 2, sy);
    ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy);
    ctx.closePath(); ctx.clip();

    for (let i = 0; i < 4; i++) {
      const px = (H3(mx, my, i * 5) - 0.5) * TW * 0.6;
      const py = (H3(mx, my, i * 11 + 30) - 0.5) * TH * 0.6;
      const r = 3 + H3(mx, my, i * 17) * 5;
      ctx.fillStyle = H3(mx, my, i * 23) > 0.5 ? 'rgba(255,248,220,0.07)' : 'rgba(0,0,0,0.06)';
      ctx.beginPath(); ctx.ellipse(sx + px, sy + py, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (H(mx * 37, my * 53) > 0.45) {
      ctx.strokeStyle = 'rgba(60,48,35,0.2)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const cx0 = sx + (H(mx * 7, my) - 0.5) * TW * 0.4;
      const cy0 = sy + (H(mx, my * 7) - 0.5) * TH * 0.4;
      ctx.moveTo(cx0, cy0);
      const segs = 2 + Math.floor(H3(mx, my, 77) * 3);
      for (let s = 0; s < segs; s++) {
        ctx.lineTo(cx0 + (H3(mx, my, s * 13) - 0.5) * 14, cy0 + (H3(mx, my, s * 17 + 40) - 0.5) * 8);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 3; i++) {
      const px = (H3(mx, my, i * 3 + 80) - 0.5) * TW * 0.6;
      const py = (H3(mx, my, i * 7 + 90) - 0.5) * TH * 0.5;
      ctx.fillStyle = H3(mx, my, i * 13 + 100) > 0.5 ? 'rgba(255,245,210,0.08)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(sx + px, sy + py, 2, 1);
    }

    if (!isCorridor) {
      if (iW(mx, my - 1) && H3(mx, my, 200) > 0.5) {
        ctx.fillStyle = 'rgba(60,80,40,0.1)'; ctx.fillRect(sx - TW / 4, sy - TH / 2 + 1, TW / 2, 4);
      }
      if (iW(mx - 1, my) && H3(mx, my, 210) > 0.5) {
        ctx.fillStyle = 'rgba(60,80,40,0.08)'; ctx.fillRect(sx - TW / 2 + 1, sy - 3, 5, 6);
      }
    }
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - TW / 2 + 2, sy); ctx.lineTo(sx, sy - TH / 2 + 1); ctx.lineTo(sx + TW / 2 - 2, sy);
    ctx.strokeStyle = `rgba(${COL.flHi[0]},${COL.flHi[1]},${COL.flHi[2]},0.65)`; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + TW / 2 - 2, sy); ctx.lineTo(sx, sy + TH / 2 - 1); ctx.lineTo(sx - TW / 2 + 2, sy);
    ctx.strokeStyle = `rgba(${COL.flSh[0]},${COL.flSh[1]},${COL.flSh[2]},0.7)`; ctx.stroke();

    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(sx, sy - TH / 2); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.closePath();
    ctx.strokeStyle = `rgba(${COL.flMortar[0]},${COL.flMortar[1]},${COL.flMortar[2]},0.35)`; ctx.stroke();

    if (iW(mx, my - 1) || iW(mx - 1, my)) {
      ctx.beginPath(); ctx.moveTo(sx - TW / 2 + 3, sy); ctx.lineTo(sx, sy - TH / 2 + 2); ctx.lineTo(sx + 10, sy - TH / 2 + 5); ctx.lineTo(sx - TW / 2 + 10, sy + 4); ctx.closePath();
      ctx.fillStyle = 'rgba(55,42,28,0.22)'; ctx.fill();
    }
    if (iW(mx + 1, my) || iW(mx, my + 1)) {
      ctx.beginPath(); ctx.moveTo(sx + TW / 2 - 3, sy); ctx.lineTo(sx, sy + TH / 2 - 2); ctx.lineTo(sx - 10, sy + TH / 2 - 5); ctx.lineTo(sx + TW / 2 - 10, sy - 4); ctx.closePath();
      ctx.fillStyle = 'rgba(55,42,28,0.12)'; ctx.fill();
    }
    ctx.restore();
  }, [iW]);

  // ================================================================
  //  WALL BLOCK
  // ================================================================
  const drawWallBlock = useCallback((
    ctx: CanvasRenderingContext2D, sx: number, sy: number,
    mx: number, my: number, alpha: number, lightDist: number,
    ditherMode: boolean
  ) => {
    ctx.save(); ctx.globalAlpha = ditherMode ? alpha * 0.4 : alpha;
    const n = H(mx * 3, my * 5);
    const topY = sy - WH;
    const lb = Math.max(0, 0.06 - lightDist * 0.004);
    const wallS = iW(mx, my + 1), wallE = iW(mx + 1, my), wallW = iW(mx - 1, my), wallN = iW(mx, my - 1);

    const showSouth = !iW(mx, my + 1) || !iW(mx - 1, my + 1);
    if (showSouth) {
      ctx.beginPath(); ctx.moveTo(sx - TW / 2, topY); ctx.lineTo(sx, topY + TH / 2); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.closePath();
      const gS = ctx.createLinearGradient(sx - TW / 4, topY, sx - TW / 4, sy);
      gS.addColorStop(0, `rgb(${COL.wSouthT[0] + lb * 300 + n * 10 | 0},${COL.wSouthT[1] + lb * 250 + n * 8 | 0},${COL.wSouthT[2] + lb * 200 + n * 6 | 0})`);
      gS.addColorStop(0.12, `rgb(${COL.wSouthT[0] + n * 8 | 0},${COL.wSouthT[1] + n * 6 | 0},${COL.wSouthT[2] + n * 4 | 0})`);
      gS.addColorStop(0.5, `rgb(${COL.wSouthM[0] + n * 6 | 0},${COL.wSouthM[1] + n * 5 | 0},${COL.wSouthM[2] + n * 3 | 0})`);
      gS.addColorStop(1, `rgb(${COL.wSouthB[0]},${COL.wSouthB[1]},${COL.wSouthB[2]})`);
      ctx.fillStyle = gS; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(sx - TW / 2, topY); ctx.lineTo(sx, topY + TH / 2); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.closePath(); ctx.clip();
      const bH = 16, bW = TW / 2;
      for (let by = 0; by <= WH; by += bH) {
        const rowI = Math.floor(by / bH); const stag = (rowI % 2) * (bW / 2);
        if (by > 0 && by < WH) { ctx.fillStyle = 'rgba(30,25,18,0.35)'; ctx.fillRect(sx - TW / 2, topY + by - 0.5, TW, 2); ctx.fillStyle = 'rgba(180,160,130,0.05)'; ctx.fillRect(sx - TW / 2, topY + by + 1.5, TW, 1); }
        for (let bx = -bW * 2; bx <= bW * 3; bx += bW) { const lx = bx + stag; if (lx > 0 && lx < TW) { ctx.fillStyle = 'rgba(25,20,14,0.3)'; ctx.fillRect(sx - TW / 2 + lx - 0.5, topY + Math.max(0, by - bH), 2, bH + 1); } }
        for (let bx = 0; bx < TW; bx += bW) { const sv = H3(mx * 100 + bx, by, rowI + 99); if (sv > 0.7) { ctx.fillStyle = 'rgba(255,240,200,0.05)'; ctx.fillRect(sx - TW / 2 + bx + 3, topY + by + 2, bW - 6, bH - 4); } else if (sv < 0.2) { ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(sx - TW / 2 + bx + 3, topY + by + 2, bW - 6, bH - 4); } }
      }
      if (H(mx * 71, my * 43) > 0.6) { const mossX = sx - TW / 2 + H3(mx, my, 150) * TW * 0.3; ctx.fillStyle = 'rgba(50,75,35,0.12)'; ctx.fillRect(mossX, topY + WH - 12, 8 + H3(mx, my, 160) * 8, 10); }
      if (H(mx * 41, my * 59) > 0.55) { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8; ctx.beginPath(); const cx0 = sx - TW / 4 + (H(mx * 2, my * 3) - 0.5) * 10; ctx.moveTo(cx0, topY + 8); ctx.lineTo(cx0 + (H(mx * 5, my) - 0.5) * 18, topY + WH * 0.4); ctx.lineTo(cx0 + (H(mx, my * 5) - 0.5) * 14, topY + WH * 0.7); ctx.stroke(); }
      ctx.restore();
      const leftHasSouth = iW(mx - 1, my) && (!iW(mx - 1, my + 1) || !iW(mx - 2, my + 1));
      ctx.beginPath(); ctx.moveTo(sx - TW / 2 + (leftHasSouth ? 0 : 2), topY + (leftHasSouth ? 0 : 1)); ctx.lineTo(sx, topY + TH / 2);
      ctx.strokeStyle = `rgba(230,210,170,${Math.max(0.1, 0.45 - lightDist * 0.02)})`; ctx.lineWidth = 2.5; ctx.stroke();
    }

    const showEast = !iW(mx + 1, my) || !iW(mx + 1, my + 1);
    if (showEast) {
      ctx.beginPath(); ctx.moveTo(sx, topY + TH / 2); ctx.lineTo(sx + TW / 2, topY); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.closePath();
      const gE = ctx.createLinearGradient(sx + TW / 4, topY, sx + TW / 4, sy);
      gE.addColorStop(0, `rgb(${COL.wEast[0] + n * 6 | 0},${COL.wEast[1] + n * 5 | 0},${COL.wEast[2] + n * 3 | 0})`);
      gE.addColorStop(0.5, `rgb(${(COL.wEast[0] + COL.wEastD[0]) / 2 | 0},${(COL.wEast[1] + COL.wEastD[1]) / 2 | 0},${(COL.wEast[2] + COL.wEastD[2]) / 2 | 0})`);
      gE.addColorStop(1, `rgb(${COL.wEastD[0]},${COL.wEastD[1]},${COL.wEastD[2]})`);
      ctx.fillStyle = gE; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(sx, topY + TH / 2); ctx.lineTo(sx + TW / 2, topY); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.closePath(); ctx.clip();
      for (let by = 0; by <= WH; by += 16) { const rowI = Math.floor(by / 16); const stag = (rowI % 2) * (TW / 4); if (by > 0 && by < WH) { ctx.fillStyle = 'rgba(20,16,10,0.3)'; ctx.fillRect(sx, topY + by - 0.5, TW / 2, 2); } for (let bx = -TW; bx <= TW; bx += TW / 2) { const lx = bx + stag; if (lx > 0 && lx < TW / 2) { ctx.fillStyle = 'rgba(16,12,8,0.25)'; ctx.fillRect(sx + lx - 0.5, topY + Math.max(0, by - 16), 2, 17); } } }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(sx, topY + TH / 2); ctx.lineTo(sx + TW / 2, topY);
      ctx.strokeStyle = `rgba(190,170,135,${Math.max(0.08, 0.3 - lightDist * 0.02)})`; ctx.lineWidth = 2; ctx.stroke();
    }

    // Top face
    ctx.beginPath(); ctx.moveTo(sx, topY - TH / 2); ctx.lineTo(sx + TW / 2, topY); ctx.lineTo(sx, topY + TH / 2); ctx.lineTo(sx - TW / 2, topY); ctx.closePath();
    ctx.fillStyle = rgb(COL.wTop, n, 12); ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); if (!wallW) { ctx.moveTo(sx - TW / 2 + 1, topY); ctx.lineTo(sx, topY - TH / 2 + 1); } if (!wallN) { ctx.moveTo(sx, topY - TH / 2 + 1); ctx.lineTo(sx + TW / 2 - 1, topY); }
    ctx.strokeStyle = `rgba(${COL.wTopHi[0]},${COL.wTopHi[1]},${COL.wTopHi[2]},0.5)`; ctx.stroke();
    ctx.beginPath(); if (!wallE) { ctx.moveTo(sx + TW / 2 - 1, topY); ctx.lineTo(sx, topY + TH / 2 - 1); } if (!wallS) { ctx.moveTo(sx, topY + TH / 2 - 1); ctx.lineTo(sx - TW / 2 + 1, topY); }
    ctx.strokeStyle = 'rgba(80,65,48,0.35)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,48,35,0.12)'; ctx.lineWidth = 0.6; ctx.beginPath();
    ctx.moveTo(sx - TW / 4, topY - TH / 4); ctx.lineTo(sx + TW / 4, topY + TH / 4);
    ctx.moveTo(sx + TW / 4, topY - TH / 4); ctx.lineTo(sx - TW / 4, topY + TH / 4); ctx.stroke();

    // Ground shadow
    if (showSouth || showEast) {
      ctx.save(); ctx.globalAlpha = ditherMode ? alpha * 0.2 : alpha;
      const shadowG = ctx.createLinearGradient(sx, sy, sx, sy + 8);
      shadowG.addColorStop(0, 'rgba(0,0,0,0.45)'); shadowG.addColorStop(0.5, 'rgba(0,0,0,0.15)'); shadowG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadowG; ctx.beginPath();
      if (showSouth) { ctx.moveTo(sx - TW / 2 - 2, sy); ctx.lineTo(sx, sy + TH / 2 + 1); }
      if (showEast) { ctx.lineTo(sx + TW / 2 + 2, sy); }
      ctx.lineTo(sx + TW / 2 + 2, sy + 8); ctx.lineTo(sx - TW / 2 - 2, sy + 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Dither overlay for wall transparency
    if (ditherMode) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.55;
      const dPat = ctx.createPattern(getDither(), 'repeat');
      if (dPat) {
        ctx.fillStyle = dPat;
        ctx.beginPath();
        ctx.moveTo(sx, topY - TH / 2); ctx.lineTo(sx + TW / 2, topY); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2);
        ctx.lineTo(sx - TW / 2, sy); ctx.lineTo(sx - TW / 2, topY); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [iW]);

  // ================================================================
  //  DRAW ENTITY
  // ================================================================
  const drawEntitySprite = useCallback((
    ctx: CanvasRenderingContext2D, sprite: Parameters<typeof drawSprite>[1],
    sx: number, sy: number, alpha: number,
    now: number, hitTime: number, tint?: string, breathPhase?: number,
    flipX?: boolean, scaleOverride?: number
  ) => {
    const breath = breathPhase !== undefined ? Math.sin(breathPhase) * 0.015 : 0;
    const scale = (scaleOverride ?? 1) + breath;
    const ey = sy - SP + TH / 3;
    const ex = sx - SP / 2;
    ctx.save();
    if (flipX) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    if (scale !== 1) {
      ctx.translate(sx, sy - SP / 2 + TH / 3); ctx.scale(scale, scale); ctx.translate(-sx, -(sy - SP / 2 + TH / 3));
    }
    drawSprite(ctx, sprite, ex, ey, SP, alpha, tint);
    const hitElapsed = now - hitTime;
    if (hitElapsed < HIT_DUR && hitElapsed >= 0) {
      const hitAlpha = (1 - hitElapsed / HIT_DUR) * 0.6;
      ctx.globalAlpha = hitAlpha;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = hitElapsed < 40 ? '#ffffff' : '#ff2020';
      ctx.fillRect(ex - 2, ey - 2, SP + 4, SP + 4);
    }
    ctx.restore();
  }, []);

  // ================================================================
  //  MAIN RENDER
  // ================================================================
  const render = useCallback(() => {
    const canvas = cRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== CW) canvas.width = CW;
    if (canvas.height !== CH) canvas.height = CH;

    const rawNow = performance.now();
    const timeScale = deathSlowmo ? 0.35 : 1;
    const now = deathSlowmo ? (rawNow * timeScale + rawNow * (1 - timeScale)) : rawNow;
    const inHitStop = rawNow < hitStopUntil.current;

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Interpolate player (Lerp movement)
    const pmElapsed = inHitStop ? 0 : Math.min(1, (now - pMoveT.current) / MOVE_DUR);
    const pmEase = easeOut(pmElapsed);
    const plX = pFrom.current.x + (player.pos.x - pFrom.current.x) * pmEase;
    const plY = pFrom.current.y + (player.pos.y - pFrom.current.y) * pmEase;
    // Bounce walk: sine wave for ground contact
    const plBounce = pmElapsed < 1 ? Math.sin(pmElapsed * Math.PI) * 4.5 : 0;
    const plMoving = pmElapsed < 1;

    // Attack lunge (踏み込み突き)
    const atkElapsed = inHitStop ? 0 : Math.min(1, (now - atkT.current) / ATK_DUR);
    let atkOffX = 0, atkOffY = 0;
    if (atkElapsed < 1) {
      const atkEase = atkElapsed < 0.25 ? easeOut(atkElapsed / 0.25) : 1 - easeOut((atkElapsed - 0.25) / 0.75);
      const { dx: adx, dy: ady } = atkDir.current;
      atkOffX = (adx - ady) * (TW / 2) * atkEase * 0.35;
      atkOffY = (adx + ady) * (TH / 2) * atkEase * 0.35;
    }

    const camXf = plX, camYf = plY;
    ctx.fillStyle = `rgb(${COL.bg[0]},${COL.bg[1]},${COL.bg[2]})`; ctx.fillRect(-8, -8, CW + 16, CH + 16);
    const [plSx, plSy] = toScr(plX, plY, camXf, camYf);

    // Perlin noise torch flicker (multi-octave)
    const nt = now * 0.002;
    const flk = 0.94
      + perlin1(nt * 1.3) * 0.035
      + perlin1(nt * 2.7 + 100) * 0.018
      + perlin1(nt * 5.1 + 200) * 0.008;
    const lR = 420 * flk;

    function lA(mx: number, my: number): number {
      const vis = !!floor.visible[my]?.[mx], expl = !!floor.explored[my]?.[mx];
      if (!vis && !expl) return 0;
      if (!vis) return 0.22;
      const dx = mx - player.pos.x, dy = my - player.pos.y;
      return Math.max(0.4, 1.0 - Math.sqrt(dx * dx + dy * dy) * 0.035);
    }

    function isPlayerBehindWall(mx: number, my: number): boolean {
      const wallDepth = mx + my;
      const playerDepth = player.pos.x + player.pos.y;
      return wallDepth > playerDepth && Math.abs(mx - player.pos.x) <= 2 && Math.abs(my - player.pos.y) <= 2;
    }

    // ==============================================================
    //  Entity collection
    // ==============================================================
    type EntityDraw = { depth: number; draw: () => void };
    const entityDraws: EntityDraw[] = [];

    // Items
    for (const item of floor.items) {
      if (!item.floorPos) continue;
      const { x: imx, y: imy } = item.floorPos;
      if (!floor.visible[imy]?.[imx]) continue;
      const spr = ITEM_SPRITES[item.category];
      if (!spr) continue;
      const capturedItem = item;
      entityDraws.push({
        depth: imx + imy,
        draw: () => {
          const [isx, isy] = toScr(imx, imy, camXf, camYf);
          // Dynamic shadow
          ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(isx, isy + 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          // Item float anim (上下にゆっくり浮かせる)
          const bob = Math.sin(now * 0.003 + imx * 0.7 + imy * 0.9) * 2.5;
          drawEntitySprite(ctx, spr, isx, isy + bob, 1.0, now, 0, undefined, now * 0.003 + imx);

          // Sparkle effect
          const sparklePhase = (now * 0.001 + imx * 1.3 + imy * 0.7) % 2;
          if (sparklePhase < 0.4) {
            const sa = Math.sin(sparklePhase / 0.4 * Math.PI) * 0.6;
            ctx.save(); ctx.globalAlpha = sa; ctx.strokeStyle = '#FFFDE0'; ctx.shadowColor = '#FFE880'; ctx.shadowBlur = 12; ctx.lineWidth = 1.5;
            const spX = isx + (H(imx * 3, imy * 7) - 0.5) * SP * 0.6;
            const spY = isy - SP * 0.3 + bob + (H(imx * 7, imy * 3) - 0.5) * SP * 0.3;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + sparklePhase * Math.PI; ctx.moveTo(spX, spY); ctx.lineTo(spX + Math.cos(a) * 4, spY + Math.sin(a) * 4); }
            ctx.stroke(); ctx.restore();
          }

          // Unidentified "?" float
          if (!capturedItem.identified && capturedItem.category !== ItemCategory.Gold) {
            const qY = isy - SP * 0.8 + bob + Math.sin(now * 0.004 + imx) * 3;
            ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(now * 0.003) * 0.15;
            ctx.font = 'bold 14px var(--font-display,serif)'; ctx.textAlign = 'center';
            ctx.fillStyle = '#000'; ctx.fillText('?', isx + 1, qY + 1);
            ctx.fillStyle = '#FFD060'; ctx.shadowColor = '#FFD060'; ctx.shadowBlur = 6;
            ctx.fillText('?', isx, qY); ctx.restore();
          }

          if (capturedItem.blessed) drawGlow(ctx, isx - SP / 2, isy - SP + TH / 3, SP, '#c9a84c', now);
          if (capturedItem.cursed) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#5a0a3a'; ctx.fillRect(isx - SP / 2, isy - SP, SP, SP); ctx.restore(); }
        },
      });
    }

    // Monsters
    for (const mon of floor.monsters) {
      if (!floor.visible[mon.pos.y]?.[mon.pos.x]) continue;
      const spr = MONSTER_SPRITES[mon.templateId]; if (!spr) continue;
      const monRef = mon;
      entityDraws.push({
        depth: mon.pos.x + mon.pos.y,
        draw: () => {
          const mf = mFrom.current.get(monRef.id);
          const mt = mMoveT.current.get(monRef.id) ?? 0;
          const mElapsed = inHitStop ? 0 : Math.min(1, (now - mt) / MOVE_DUR);
          const mEase = easeOut(mElapsed);
          const mmx = mf ? mf.x + (monRef.pos.x - mf.x) * mEase : monRef.pos.x;
          const mmy = mf ? mf.y + (monRef.pos.y - mf.y) * mEase : monRef.pos.y;
          // Monster bounce walk
          const mBounce = mElapsed < 1 ? Math.sin(mElapsed * Math.PI) * 3 : 0;
          let [msx, msy] = toScr(mmx, mmy, camXf, camYf);

          // Knockback vibration
          const hitTime = mHitT.current.get(monRef.id) ?? 0;
          const hitEl = now - hitTime;
          let knockX = 0, knockY = 0;
          if (hitEl < 200 && hitEl >= 0) {
            const knockT = hitEl / 200;
            const knockEase = knockT < 0.2 ? knockT / 0.2 : 1 - (knockT - 0.2) / 0.8;
            const kdx = monRef.pos.x - player.pos.x, kdy = monRef.pos.y - player.pos.y;
            const kd = Math.sqrt(kdx * kdx + kdy * kdy) || 1;
            knockX = (kdx / kd) * 7 * knockEase;
            knockY = (kdy / kd) * 3.5 * knockEase;
          }

          // Dodge anim (回避: 横にサッと避ける)
          const dodge = _dodgeAnims.find(d => d.id === monRef.id);
          let dodgeOff = 0;
          if (dodge) {
            const dEl = (now - dodge.t0) / DODGE_DUR;
            if (dEl < 1) {
              const dEase = dEl < 0.3 ? easeOut(dEl / 0.3) : 1 - easeOut((dEl - 0.3) / 0.7);
              dodgeOff = dodge.dir * 12 * dEase;
            }
          }

          // Monster attack animation (grow 1.2x + lunge)
          let monScale = 1;
          const monAtk = _monsterAtks.find(a => a.id === monRef.id);
          if (monAtk) {
            const atkEl = (now - monAtk.t0) / MON_ATK_DUR;
            if (atkEl < 1) {
              if (atkEl < 0.2) { monScale = 1 + 0.2 * easeOut(atkEl / 0.2); }
              else if (atkEl < 0.5) {
                const lungeT = easeOut((atkEl - 0.2) / 0.3);
                const ldx = (monAtk.tx - monAtk.x) * 0.25 * lungeT;
                const ldy = (monAtk.ty - monAtk.y) * 0.25 * lungeT;
                msx += ldx; msy += ldy; monScale = 1.2;
              } else {
                const retT = easeOut((atkEl - 0.5) / 0.5);
                monScale = 1.2 - 0.2 * retT;
              }
            }
          }

          // Bat/ghost floating
          let floatY = 0;
          if (monRef.templateId === 'bat' || monRef.templateId === 'ghost') {
            floatY = Math.sin(now * 0.004 + monRef.pos.x * 0.5) * 4;
          }

          // Dynamic foot shadow (scales with entity)
          ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(msx + dodgeOff, msy + 4, 12 * monScale, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

          drawEntitySprite(ctx, spr, msx + knockX + dodgeOff, msy - mBounce + knockY - floatY, 1.0, now, hitTime,
            monRef.sleeping ? '#000022' : undefined, now * 0.0025 + monRef.pos.x * 0.3, false, monScale);

          // HP bar
          if (monRef.hp < monRef.maxHp) {
            const bw = SP - 2, hr = Math.max(0, monRef.hp / monRef.maxHp); const by = msy - 1;
            ctx.fillStyle = 'rgba(15,8,8,0.85)'; ctx.fillRect(msx - bw / 2, by, bw, 5);
            ctx.strokeStyle = 'rgba(120,100,70,0.4)'; ctx.lineWidth = 0.5; ctx.strokeRect(msx - bw / 2, by, bw, 5);
            ctx.fillStyle = hr > 0.5 ? '#40A050' : hr > 0.25 ? '#A0902A' : '#CC3030';
            ctx.fillRect(msx - bw / 2 + 0.5, by + 0.5, (bw - 1) * hr, 4);
          }

          // Sleep zzZ
          if (monRef.sleeping) {
            ctx.save(); ctx.font = '700 10px var(--font-display,serif)'; const zp = (now * 0.002) % 3; ctx.globalAlpha = 0.7; ctx.fillStyle = '#8090c0';
            ctx.fillText('z', msx + SP / 2, msy - SP + 16 + Math.sin(now * 0.004) * 2);
            if (zp > 1) ctx.fillText('z', msx + SP / 2 + 5, msy - SP + 12);
            if (zp > 2) { ctx.font = '700 12px var(--font-display,serif)'; ctx.fillText('Z', msx + SP / 2 + 8, msy - SP + 7); }
            ctx.restore();
          }

          // Status effect dots
          if (monRef.statuses.length > 0) {
            const sc: Record<string, string> = { poison: '#8a3aaa', confusion: '#aa8a2a', sleep: '#3a5aaa', paralysis: '#aa6a2a', sealed: '#aa2a2a' };
            monRef.statuses.forEach((s, i) => { ctx.fillStyle = sc[s.type] ?? '#666'; ctx.beginPath(); ctx.arc(msx - SP / 2 + 5 + i * 6, msy - SP + 10, 2.5, 0, Math.PI * 2); ctx.fill(); });
          }
        },
      });
    }

    // Player
    entityDraws.push({
      depth: player.pos.x + player.pos.y,
      draw: () => {
        const [psx, psy] = toScr(plX, plY, camXf, camYf);
        const hw = player.equippedWeapon !== null;
        const dir = player.facing;
        const isUp = dir === Direction.Up || dir === Direction.UpLeft || dir === Direction.UpRight;
        const isLeft = dir === Direction.Left || dir === Direction.UpLeft || dir === Direction.DownLeft;
        let ps = isUp ? SPRITE_PLAYER_UP : SPRITE_PLAYER_DOWN;
        if (hw && !isUp) ps = SPRITE_PLAYER_ARMED;
        const drawX = psx + atkOffX, drawY = psy + atkOffY - plBounce;

        // Dynamic foot shadow
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
        const shadowScaleX = 13 + (plBounce > 2 ? -2 : plBounce > 0 ? 1 : 0);
        ctx.beginPath(); ctx.ellipse(psx, psy + 4, shadowScaleX, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

        drawEntitySprite(ctx, ps, drawX, drawY, 1.0, now, pHitT.current, undefined, plMoving ? undefined : now * 0.004, isLeft);

        // Shield
        const shieldItem = player.inventory.find(i => i.id === player.equippedShield);
        if (shieldItem?.category === ItemCategory.Shield) {
          const shield = shieldItem as ShieldItem;
          const shX = isLeft ? drawX + SP * 0.25 : drawX - SP * 0.35;
          const shY = drawY - SP * 0.3;
          ctx.save();
          ctx.fillStyle = shield.enhancement >= 5 ? '#5090E0' : '#3060B0';
          ctx.strokeStyle = shield.enhancement >= 3 ? '#D4A840' : '#8B6830'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(shX, shY - 6); ctx.lineTo(shX + 5, shY - 3); ctx.lineTo(shX + 5, shY + 4);
          ctx.lineTo(shX, shY + 7); ctx.lineTo(shX - 5, shY + 4); ctx.lineTo(shX - 5, shY - 3); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#D4A840'; ctx.fillRect(shX - 1, shY - 1, 2, 2);
          if (shield.enhancement >= 3) { ctx.globalAlpha = 0.15 + Math.sin(now * 0.003) * 0.05; ctx.shadowColor = '#80C0FF'; ctx.shadowBlur = 8; ctx.fill(); }
          ctx.restore();
        }

        // Weapon
        const wpn = player.inventory.find(i => i.id === player.equippedWeapon);
        if (wpn?.category === ItemCategory.Weapon) {
          const w = wpn as WeaponItem; const enh = w.enhancement;
          const wpnSide = isLeft ? -1 : 1;
          const wpnX = drawX + SP * 0.3 * wpnSide, wpnY = drawY - SP * 0.6;
          ctx.save();
          ctx.strokeStyle = enh >= 5 ? '#A0D0FF' : enh >= 3 ? '#D0D8E8' : '#B0B8C8'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(wpnX, wpnY + 8); ctx.lineTo(wpnX + 3 * wpnSide, wpnY - 8); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(wpnX + 0.5 * wpnSide, wpnY + 6); ctx.lineTo(wpnX + 2.5 * wpnSide, wpnY - 6); ctx.stroke();
          ctx.strokeStyle = '#D4A840'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(wpnX - 3 * wpnSide, wpnY + 8); ctx.lineTo(wpnX + 5 * wpnSide, wpnY + 6); ctx.stroke();
          ctx.restore();

          // Weapon afterimage during attack
          if (atkElapsed < 0.6 && atkElapsed > 0) {
            for (let gi = 1; gi <= 3; gi++) {
              const ghostT = Math.max(0, atkElapsed - gi * 0.04);
              const ghostEase = ghostT < 0.25 ? easeOut(ghostT / 0.25) : 1 - easeOut((ghostT - 0.25) / 0.75);
              const gox = (atkDir.current.dx - atkDir.current.dy) * (TW / 2) * ghostEase * 0.35 * (1 - gi * 0.2);
              const goy = (atkDir.current.dx + atkDir.current.dy) * (TH / 2) * ghostEase * 0.35 * (1 - gi * 0.2);
              ctx.save(); ctx.globalAlpha = 0.15 - gi * 0.04;
              ctx.strokeStyle = '#FFFDE0'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(psx + gox + SP * 0.3 * wpnSide, psy + goy - plBounce - SP * 0.6 + 8);
              ctx.lineTo(psx + gox + SP * 0.3 * wpnSide + 3 * wpnSide, psy + goy - plBounce - SP * 0.6 - 8);
              ctx.stroke(); ctx.restore();
            }
          }

          // Weapon aura
          if (enh >= 2) {
            const aI = Math.min(0.25, 0.05 + enh * 0.02);
            const aC = enh >= 8 ? '#FFD060' : enh >= 5 ? '#80C0FF' : '#6090c0';
            ctx.save(); ctx.globalAlpha = aI + Math.sin(now * 0.004) * 0.05;
            ctx.shadowColor = aC; ctx.shadowBlur = 16 + enh * 2; ctx.fillStyle = aC;
            ctx.beginPath(); ctx.ellipse(drawX, drawY - SP * 0.4, SP * 0.4, SP * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            if (enh >= 5) {
              for (let i = 0; i < Math.min(enh - 3, 6); i++) {
                const ang = (now * 0.003 + i * Math.PI * 2 / Math.min(enh - 3, 6)) % (Math.PI * 2);
                ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(now * 0.005 + i) * 0.2;
                ctx.fillStyle = aC; ctx.shadowColor = aC; ctx.shadowBlur = 6;
                ctx.fillRect(drawX + Math.cos(ang) * 14 - 1, drawY - SP * 0.4 + Math.sin(ang) * 8 - 1, 2.5, 2.5);
                ctx.restore();
              }
            }
          }
          if (w.seals.includes(SealType.DragonSlayer)) {
            ctx.save(); ctx.globalAlpha = 0.1 + Math.sin(now * 0.005 + 2) * 0.05;
            ctx.shadowColor = '#FF4444'; ctx.shadowBlur = 16; ctx.fillStyle = '#FF4444';
            ctx.beginPath(); ctx.ellipse(drawX, drawY - SP * 0.3, SP * 0.35, SP * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
        }
      },
    });

    entityDraws.sort((a, b) => a.depth - b.depth);
    let entityIdx = 0;

    // ==============================================================
    //  DEPTH-SORTED RENDERING
    // ==============================================================
    for (let depth = -2 * RANGE; depth <= 2 * RANGE; depth++) {
      for (let dx = -RANGE; dx <= RANGE; dx++) {
        const dy = depth - dx;
        if (dy < -RANGE || dy > RANGE) continue;
        const mx = Math.round(camXf) + dx, my = Math.round(camYf) + dy;
        if (mx < 0 || mx >= floor.width || my < 0 || my >= floor.height) continue;
        const alpha = lA(mx, my); if (alpha <= 0) continue;
        const [sx, sy] = toScr(mx, my, camXf, camYf);
        if (sx < -TW * 2 || sx > CW + TW * 2 || sy < -WH * 2 || sy > CH + TH * 2) continue;
        const tile = floor.tiles[my]?.[mx];
        const isExploredOnly = !!floor.explored[my]?.[mx] && !floor.visible[my]?.[mx];

        if (tile === TileType.Wall) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const dither = isPlayerBehindWall(mx, my);
          drawWallBlock(ctx, sx, sy, mx, my, alpha, dist, dither);
          if (isExploredOnly) {
            ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(12,10,18,0.6)';
            ctx.beginPath(); ctx.moveTo(sx, sy - WH - TH / 2); ctx.lineTo(sx + TW / 2, sy - WH);
            ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.lineTo(sx - TW / 2, sy - WH);
            ctx.closePath(); ctx.fill(); ctx.restore();
          }
        } else {
          drawFloorTile(ctx, sx, sy, mx, my, alpha, tile === TileType.Corridor);
          if (isExploredOnly) {
            ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = 'rgba(12,10,18,0.5)';
            ctx.beginPath(); ctx.moveTo(sx, sy - TH / 2); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.closePath();
            ctx.fill(); ctx.restore();
          }
          if (floor.visible[my]?.[mx]) {
            ctx.save(); ctx.globalAlpha = alpha * 0.35;
            if (iW(mx, my - 1)) {
              const ag = ctx.createLinearGradient(sx, sy - TH / 2, sx, sy + 4);
              ag.addColorStop(0, 'rgba(0,0,0,0.5)'); ag.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ag;
              ctx.beginPath(); ctx.moveTo(sx - TW / 4, sy - TH / 4); ctx.lineTo(sx + TW / 4, sy - TH / 4 + 3); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy - TH / 2); ctx.closePath(); ctx.fill();
            }
            if (iW(mx - 1, my)) {
              const ag = ctx.createLinearGradient(sx - TW / 2, sy, sx - TW / 4, sy);
              ag.addColorStop(0, 'rgba(0,0,0,0.4)'); ag.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ag;
              ctx.beginPath(); ctx.moveTo(sx - TW / 2, sy); ctx.lineTo(sx, sy - TH / 2); ctx.lineTo(sx - TW / 4, sy + TH / 4); ctx.closePath(); ctx.fill();
            }
            if (iW(mx, my - 1) && iW(mx - 1, my)) {
              ctx.globalAlpha = alpha * 0.5;
              const ag = ctx.createRadialGradient(sx - TW / 4, sy - TH / 4, 0, sx - TW / 4, sy - TH / 4, 16);
              ag.addColorStop(0, 'rgba(0,0,0,0.6)'); ag.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ag;
              ctx.fillRect(sx - TW / 2, sy - TH / 2, TW / 2, TH / 2);
            }
            ctx.restore();
          }
          if (tile === TileType.StairsDown) {
            drawEntitySprite(ctx, SPRITE_STAIRS, sx, sy, alpha, now, 0);
            // Spotlight on stairs
            if (floor.visible[my]?.[mx]) {
              ctx.save(); ctx.globalAlpha = 0.22 + Math.sin(now * 0.002) * 0.1;
              ctx.fillStyle = '#D4A840'; ctx.shadowColor = '#F0D060'; ctx.shadowBlur = 35;
              ctx.beginPath(); ctx.ellipse(sx, sy - 5, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
              // Spotlight beam from above
              ctx.globalAlpha = 0.06 + Math.sin(now * 0.003) * 0.03;
              ctx.fillStyle = '#F0D060';
              ctx.beginPath(); ctx.moveTo(sx - 3, sy - 80); ctx.lineTo(sx + 3, sy - 80);
              ctx.lineTo(sx + 16, sy + 5); ctx.lineTo(sx - 16, sy + 5); ctx.closePath(); ctx.fill();
              ctx.restore();
            }
          }
          if (tile === TileType.Trap) {
            const trap = floor.traps.find(t => t.pos.x === mx && t.pos.y === my);
            if (trap?.visible && floor.visible[my]?.[mx]) { drawEntitySprite(ctx, SPRITE_TRAP, sx, sy, alpha, now, 0); }
          }
        }
      }
      while (entityIdx < entityDraws.length && entityDraws[entityIdx].depth <= depth) { entityDraws[entityIdx].draw(); entityIdx++; }
    }
    while (entityIdx < entityDraws.length) { entityDraws[entityIdx].draw(); entityIdx++; }

    // ==============================================================
    //  POST-PROCESSING
    // ==============================================================
    // Torch light (Perlin-driven)
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const lCx = plSx, lCy = plSy - WH / 3;
    const vig = ctx.createRadialGradient(lCx, lCy, lR * 0.18, lCx, lCy, lR);
    vig.addColorStop(0, 'rgba(255,255,255,1)'); vig.addColorStop(0.3, 'rgba(252,245,225,1)');
    vig.addColorStop(0.55, 'rgba(210,170,100,1)'); vig.addColorStop(0.78, 'rgba(90,60,30,1)');
    vig.addColorStop(1, 'rgba(22,18,12,1)');
    ctx.fillStyle = vig; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();

    // Warm screen tint
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const wm = ctx.createRadialGradient(lCx, lCy, 0, lCx, lCy, lR * 0.4);
    wm.addColorStop(0, 'rgba(255,200,100,0.07)'); wm.addColorStop(0.5, 'rgba(230,160,60,0.025)'); wm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wm; ctx.fillRect(0, 0, CW, CH); ctx.restore();

    // Bloom pass
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.04;
    ctx.filter = 'blur(8px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none'; ctx.restore();

    // PS2 color grading
    ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = 0.02;
    ctx.fillStyle = '#B0A080'; ctx.fillRect(0, 0, CW, CH); ctx.restore();

    // Vignette (画面端を暗くし閉塞感を強調)
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.07;
    const cv = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.28, CW / 2, CH / 2, CW * 0.62);
    cv.addColorStop(0, 'rgba(255,255,255,1)'); cv.addColorStop(1, 'rgba(170,175,190,1)');
    ctx.fillStyle = cv; ctx.fillRect(0, 0, CW, CH); ctx.restore();

    // Film grain
    { const gc = getGrain(); ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.03;
      const ox = (now * 0.07) % 128, oy = (now * 0.05 + 40) % 128;
      for (let gx = -128; gx < CW + 128; gx += 128) for (let gy = -128; gy < CH + 128; gy += 128) ctx.drawImage(gc, gx + ox, gy + oy);
      ctx.restore(); }

    // Scanlines (ブラウン管フィルター)
    { const sl = getScanlines(); ctx.save(); ctx.globalCompositeOperation = 'multiply';
      const pat = ctx.createPattern(sl, 'repeat');
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, CW, CH); }
      ctx.restore(); }

    // Ambient dust particles
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const s = i * 7919, per = 5500 + (s % 3000);
      const ph = ((now + s * 100) % per) / per;
      const dx = (s * 3) % CW + Math.sin(now * 0.0007 + i) * 22;
      const dy = (s * 7) % CH - ph * 130;
      const da = ph < 0.15 ? ph / 0.15 : ph > 0.8 ? (1 - ph) / 0.2 : 1;
      const dd = Math.sqrt((dx - plSx) ** 2 + (dy - plSy) ** 2);
      if (dd > 350) continue;
      ctx.globalAlpha = da * 0.22 * Math.max(0, 1 - dd / 350);
      ctx.fillStyle = '#D8C890'; ctx.fillRect(dx, dy, 1.5, 1.5);
    }
    ctx.restore();

    // ==============================================================
    //  VFX OVERLAYS
    // ==============================================================

    // Slash arcs
    _slashArcs = _slashArcs.filter(sa => {
      const el = now - sa.t0;
      if (el > SLASH_DUR) return false;
      const t = el / SLASH_DUR;
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.7;
      ctx.strokeStyle = sa.color; ctx.lineWidth = 3 * (1 - t);
      ctx.shadowColor = sa.color; ctx.shadowBlur = 12;
      ctx.beginPath();
      const startA = sa.angle - Math.PI * 0.6;
      const sweepA = Math.PI * 1.2 * easeOut(t);
      const r = 18 + t * 12;
      ctx.arc(sa.x, sa.y, r, startA, startA + sweepA * sa.dir);
      ctx.stroke();
      ctx.globalAlpha = (1 - t) * 0.4; ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(sa.x, sa.y, r - 2, startA, startA + sweepA * sa.dir * 0.8); ctx.stroke();
      ctx.restore();
      return true;
    });

    // Death dissolution
    _deathFxList = _deathFxList.filter(df => {
      const el = now - df.t0;
      if (el > DEATH_FX_DUR) return false;
      const t = el / DEATH_FX_DUR;
      for (const p of df.particles) {
        const px = df.x + p.ox + p.vx * el * 0.008;
        const py = df.y + p.oy + p.vy * el * 0.008;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 3;
        ctx.fillRect(px - 1, py - 1, 2 + (1 - t) * 1.5, 2 + (1 - t) * 1.5);
        ctx.restore();
      }
      return true;
    });

    // EXP orb absorption (blue lights fly to player)
    const EXP_ORB_DUR = 600;
    _expOrbs = _expOrbs.filter(orb => {
      const el = now - orb.t0 - orb.delay;
      if (el < 0) {
        // Waiting, but draw static glow
        ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(now * 0.01 + orb.delay) * 0.1;
        ctx.fillStyle = orb.color; ctx.shadowColor = orb.color; ctx.shadowBlur = 6;
        ctx.fillRect(orb.x - 1.5, orb.y - 1.5, 3, 3); ctx.restore();
        return true;
      }
      if (el > EXP_ORB_DUR) return false;
      const t = el / EXP_ORB_DUR;
      const et = easeInOut(t);
      const ox = orb.x + (orb.tx - orb.x) * et;
      const oy = orb.y + (orb.ty - orb.y) * et - Math.sin(t * Math.PI) * 25;
      ctx.save();
      ctx.globalAlpha = (1 - t * 0.6) * 0.8;
      ctx.fillStyle = orb.color; ctx.shadowColor = orb.color; ctx.shadowBlur = 8;
      const sz = 2.5 * (1 - t * 0.5);
      ctx.beginPath(); ctx.arc(ox, oy, sz, 0, Math.PI * 2); ctx.fill();
      // Trail
      ctx.globalAlpha = (1 - t) * 0.3;
      ctx.beginPath(); ctx.arc(ox - (orb.tx - orb.x) * et * 0.05, oy + 2, sz * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return true;
    });

    // Dust puffs
    const DUST_DUR = 350;
    _dustPuffs = _dustPuffs.filter(dp => {
      const el = now - dp.t0;
      if (el > DUST_DUR) return false;
      const t = el / DUST_DUR;
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.25;
      ctx.fillStyle = 'rgba(160,140,100,0.5)';
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 6 + Math.sin(el * 0.01 + i) * 3;
        const oy = -t * 8;
        const r = 2 + t * 5;
        ctx.beginPath(); ctx.ellipse(dp.x + ox, dp.y + oy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return true;
    });

    // Lightning bolts
    const LTN_DUR = 250;
    _lightningBolts = _lightningBolts.filter(lb => {
      const el = now - lb.t0;
      if (el > LTN_DUR) return false;
      const t = el / LTN_DUR;
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = '#FFE8FF'; ctx.lineWidth = 2; ctx.shadowColor = '#A060FF'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y - 60);
      let ly = lb.y - 60;
      for (let s = 0; s < 5; s++) {
        ly += 12;
        ctx.lineTo(lb.x + (Math.random() - 0.5) * 16, ly);
      }
      ctx.lineTo(lb.x, lb.y); ctx.stroke();
      if (t < 0.15) { ctx.globalAlpha = (1 - t / 0.15) * 0.3; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, CW, CH); }
      ctx.restore();
      return true;
    });

    // Dodge anims cleanup
    _dodgeAnims = _dodgeAnims.filter(d => now - d.t0 < DODGE_DUR);

    // Monster attack cleanup
    _monsterAtks = _monsterAtks.filter(a => now - a.t0 < MON_ATK_DUR);

    // Impact particles
    _impactParticles = _impactParticles.filter(p => {
      p.life -= 16; if (p.life <= 0) return false;
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.96;
      ctx.save(); ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 4;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.restore();
      return true;
    });

    // Shockwaves
    const SW_DUR = 300;
    _shockwaves = _shockwaves.filter(sw => {
      const el = now - sw.t0; if (el > SW_DUR) return false;
      const t = el / SW_DUR; const r = sw.maxR * easeOut(t);
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = sw.color; ctx.lineWidth = 2.5 * (1 - t);
      ctx.beginPath(); ctx.ellipse(sw.x, sw.y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      return true;
    });

    // Trap sparks
    _trapSparks = _trapSparks.filter(ts => {
      const el = now - ts.t0; if (el > 400) return false;
      const [tsx, tsy] = toScr(ts.x, ts.y, camXf, camYf); const t = el / 400;
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.fillStyle = 'rgba(180,160,120,0.3)';
      ctx.beginPath(); ctx.ellipse(tsx, tsy - 5 - t * 15, 8 + t * 12, 6 + t * 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return true;
    });

    // ==============================================================
    //  DAMAGE POPUPS (放物線重力落下)
    // ==============================================================
    const POP_LIFE = 1200, GRAV = 0.085;
    popRef.current = popRef.current.filter(p => now - p.t0 < POP_LIFE);
    for (const p of popRef.current) {
      const el = now - p.t0, t = el / POP_LIFE, f = el / 16;
      const ppx = p.x + p.vx * f, ppy = p.y + p.vy * f + 0.5 * GRAV * f * f;
      let sc: number;
      if (t < 0.06) sc = easeOutBack(t / 0.06) * 1.4;
      else if (t < 0.15) sc = 1.4 - (t - 0.06) / 0.09 * 0.4;
      else if (t > 0.7) sc = 1 - (t - 0.7) / 0.3;
      else sc = 1;
      ctx.save(); ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      ctx.translate(ppx, ppy); ctx.scale(sc, sc);
      const isExp = p.text.includes('Exp');
      const fontSize = p.size ?? (isExp ? 13 : 17);
      ctx.font = `bold ${fontSize}px var(--font-display,serif)`;
      ctx.textAlign = 'center';
      // Thick outline
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      for (let ox = -1.5; ox <= 1.5; ox += 1.5) for (let oy = -1.5; oy <= 1.5; oy += 1.5) {
        if (ox === 0 && oy === 0) continue;
        ctx.fillText(p.text, ox, oy);
      }
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = isExp ? 8 : 14;
      ctx.fillText(p.text, 0, 0); ctx.restore();
    }

    // Screen overlays
    if (damageFlash > 0) {
      ctx.save(); ctx.globalAlpha = damageFlash * 0.22; ctx.fillStyle = '#CC2020'; ctx.fillRect(-8, -8, CW + 16, CH + 16);
      const bg = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.6);
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, `rgba(160,20,20,${damageFlash * 0.3})`);
      ctx.fillStyle = bg; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
    }
    if (criticalFlash > 0) {
      ctx.save(); ctx.globalAlpha = criticalFlash * 0.55;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
    }

    // Hunger warning (満腹度警告 - 画面縁が赤く脈動)
    const hungerRatio = player.satiation / player.maxSatiation;
    if (hungerRatio < 0.2) {
      const pulse = Math.sin(now * 0.004) * 0.5 + 0.5;
      const intensity = (1 - hungerRatio / 0.2) * pulse;
      ctx.save(); ctx.globalAlpha = intensity * 0.35;
      // Red pulsing border vignette
      const hg = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.3, CW / 2, CH / 2, CW * 0.58);
      hg.addColorStop(0, 'rgba(0,0,0,0)');
      hg.addColorStop(0.7, 'rgba(120,15,15,0.3)');
      hg.addColorStop(1, `rgba(180,20,20,${0.6 + pulse * 0.3})`);
      ctx.fillStyle = hg; ctx.fillRect(-8, -8, CW + 16, CH + 16);
      ctx.restore();
    }

    // Level up effects
    if (levelUpEffect > 0) {
      ctx.save(); ctx.globalAlpha = levelUpEffect * 0.18;
      const rg = ctx.createRadialGradient(plSx, plSy, 0, plSx, plSy, 220);
      rg.addColorStop(0, '#F0D060'); rg.addColorStop(0.5, '#D4A840'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, CW, CH);
      // Magic circle (回転ルーン)
      ctx.save(); ctx.translate(plSx, plSy); ctx.rotate(now * 0.002);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = levelUpEffect * 0.35;
      ctx.strokeStyle = '#F0D060'; ctx.lineWidth = 1.5;
      for (let r = 25; r <= 55; r += 30) {
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 25, Math.sin(a) * 12.5);
        ctx.lineTo(Math.cos(a) * 55, Math.sin(a) * 27.5); ctx.stroke();
      }
      ctx.restore();

      // Rising gold particles
      for (let i = 0; i < 28; i++) {
        const ang = (now * 0.003 + i * 0.224) % (Math.PI * 2);
        const r = 35 + i * 4 + Math.sin(now * 0.005 + i) * 16;
        ctx.globalAlpha = levelUpEffect * (0.5 + Math.sin(now * 0.01 + i) * 0.2);
        ctx.fillStyle = i % 3 === 0 ? '#F0D060' : '#D4A840';
        ctx.fillRect(plSx + Math.cos(ang) * r - 1, plSy + Math.sin(ang) * r - (now * 0.02 + i * 3) % 50 - 1, 2.5, 2.5);
      }
      ctx.restore();
    }

    // Level-up radial golden lines (放射状金色ライン)
    if (_levelUpLines.length > 0) {
      const rlEl = now - _levelUpT0;
      if (rlEl < 800) {
        const rlT = rlEl / 800;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const line of _levelUpLines) {
          const lineT = easeOut(Math.min(1, rlT * 2));
          const fadeT = rlT > 0.5 ? 1 - (rlT - 0.5) / 0.5 : 1;
          const dist = line.speed * rlEl * 0.15;
          ctx.globalAlpha = fadeT * 0.5;
          ctx.strokeStyle = line.color; ctx.lineWidth = 2;
          ctx.shadowColor = line.color; ctx.shadowBlur = 8;
          ctx.beginPath();
          const sx2 = plSx + Math.cos(line.angle) * dist;
          const sy2 = plSy + Math.sin(line.angle) * dist * 0.5;
          const ex2 = plSx + Math.cos(line.angle) * (dist + line.len * lineT);
          const ey2 = plSy + Math.sin(line.angle) * (dist + line.len * lineT) * 0.5;
          ctx.moveTo(sx2, sy2); ctx.lineTo(ex2, ey2); ctx.stroke();
        }
        ctx.restore();
      } else {
        _levelUpLines = [];
      }
    }

    if (stairsFade > 0) {
      ctx.save(); ctx.globalAlpha = stairsFade; ctx.fillStyle = '#000'; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
    }

    ctx.restore();
    aRef.current = requestAnimationFrame(render);
  }, [player, floor, screenShake, damageFlash, levelUpEffect, criticalFlash, stairsFade, deathSlowmo,
    iW, drawFloorTile, drawWallBlock, drawEntitySprite]);

  useEffect(() => {
    aRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(aRef.current);
  }, [render]);

  return (
    <canvas ref={cRef} className="torch-flicker"
      style={{
        width: CW, height: CH, imageRendering: 'pixelated',
        border: '2px solid #4A3828', borderRadius: '4px',
        boxShadow: '0 0 60px rgba(0,0,0,0.85), inset 0 0 25px rgba(0,0,0,0.3), 0 0 4px rgba(180,150,90,0.06)',
      }}
    />
  );
}
