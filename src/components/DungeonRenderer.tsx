'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GameState, TileType, Direction, ItemCategory, WeaponItem, ShieldItem, SealType, StatusEffect, Position, DIR_VECTORS } from '@/types/game';
import {
  drawSprite, drawGlow,
  SPRITE_STAIRS, SPRITE_TRAP,
  SPRITE_PLAYER_DOWN, SPRITE_PLAYER_UP, SPRITE_PLAYER_ARMED,
  MONSTER_SPRITES, ITEM_SPRITES,
} from '@/engine/sprites';

// ================================================================
//  TOP-DOWN DUNGEON ENGINE (PS2 Torneko 3 Style)
//  画像駆動タイル描画 + プロシージャルVFX
// ================================================================

const TW = 40;
const TH = 40;
const SP = 32;
const CW = 800;
const CH = 600;
const RANGE = 12;

// ================================================================
//  GLOBAL ASSET MANAGER (コンポーネント外部 — SSRクラッシュ防止)
//  new Image() は useEffect 内でのみ実行。ここはキャッシュ定義のみ。
// ================================================================
let _assetsReady = false;
let _assetsLoading = false;
const imageCache: Record<string, HTMLImageElement> = {};

// ================================================================
//  0x72 Dungeon Tileset II — Complete Asset Registry
// ================================================================
const F = '/assets/0x72_DungeonTilesetII_v1.7/frames/';
const ASSET_PATHS: Record<string, string> = {};

// Floor tiles (8 variations)
for (let i = 1; i <= 8; i++) ASSET_PATHS[`floor_${i}`] = `${F}floor_${i}.png`;
// Wall tiles
['wall_mid', 'wall_top_mid', 'wall_left', 'wall_right', 'wall_top_left', 'wall_top_right',
 'wall_banner_blue', 'wall_banner_red', 'wall_banner_green', 'wall_banner_yellow',
 'wall_hole_1', 'wall_hole_2', 'wall_goo', 'column',
].forEach(w => { ASSET_PATHS[w] = `${F}${w}.png`; });
// Stairs & traps
ASSET_PATHS['floor_stairs'] = `${F}floor_stairs.png`;
for (let i = 0; i < 4; i++) ASSET_PATHS[`spikes_${i}`] = `${F}floor_spikes_anim_f${i}.png`;
// Player (knight_m) — idle 4f, run 4f, hit 1f
for (let i = 0; i < 4; i++) {
  ASSET_PATHS[`player_idle_${i}`] = `${F}knight_m_idle_anim_f${i}.png`;
  ASSET_PATHS[`player_run_${i}`] = `${F}knight_m_run_anim_f${i}.png`;
}
ASSET_PATHS['player_hit'] = `${F}knight_m_hit_anim_f0.png`;
// Monster animation frames
function regMon(id: string, prefix: string, hasIdleRun: boolean) {
  const suf = hasIdleRun ? '_idle_anim' : '_anim';
  for (let i = 0; i < 4; i++) ASSET_PATHS[`mon_${id}_${i}`] = `${F}${prefix}${suf}_f${i}.png`;
}
regMon('slime', 'slug', false);
regMon('rat', 'tiny_slug', false);
regMon('ghost', 'necromancer', false);
regMon('bat', 'imp', true);
regMon('skeleton', 'skelet', true);
regMon('thief', 'goblin', true);
regMon('mushroom', 'swampy', false);
regMon('baby_satan', 'chort', true);
regMon('army_ant', 'tiny_zombie', true);
regMon('lilliput', 'elf_m', true);
regMon('droll_mage', 'orc_shaman', true);
regMon('split_slime', 'muddy', false);
regMon('dragon_pup', 'wogol', true);
regMon('drain', 'ice_zombie', false);
regMon('zombie', 'big_zombie', true);
regMon('dragon_child', 'wogol', true);
// rotting_corpse: zombie_anim starts at f1
ASSET_PATHS['mon_rotting_corpse_0'] = `${F}zombie_anim_f1.png`;
ASSET_PATHS['mon_rotting_corpse_1'] = `${F}zombie_anim_f2.png`;
ASSET_PATHS['mon_rotting_corpse_2'] = `${F}zombie_anim_f3.png`;
ASSET_PATHS['mon_rotting_corpse_3'] = `${F}zombie_anim_f1.png`;
regMon('shadow', 'necromancer', false);
regMon('lava_golem', 'ogre', true);
regMon('dancing_jewel', 'angel', true);
regMon('killer_machine', 'masked_orc', true);
regMon('iron_scorpion', 'orc_warrior', true);
regMon('mage_chimera', 'wizzard_f', true);
regMon('archmage', 'wizzard_m', true);
regMon('stone_man', 'ogre', true);
regMon('reaper', 'necromancer', false);
regMon('metal_slime', 'muddy', false);
regMon('dark_dream', 'big_demon', true);
regMon('minotaur', 'ogre', true);
regMon('golem', 'masked_orc', true);
regMon('warper', 'wizzard_f', true);
regMon('summoner', 'orc_shaman', true);
regMon('devil', 'big_demon', true);
regMon('king_dragon', 'big_demon', true);
regMon('skeleton_knight', 'skelet', true);
regMon('mimic', 'pumpkin_dude', true);
regMon('wizard', 'wizzard_m', true);
// Items
ASSET_PATHS['item_weapon'] = `${F}weapon_regular_sword.png`;
ASSET_PATHS['item_shield'] = `${F}weapon_knight_sword.png`;
ASSET_PATHS['item_scroll'] = `${F}flask_yellow.png`;
ASSET_PATHS['item_herb'] = `${F}flask_green.png`;
ASSET_PATHS['item_staff'] = `${F}weapon_green_magic_staff.png`;
ASSET_PATHS['item_pot'] = `${F}flask_big_blue.png`;
ASSET_PATHS['item_food'] = `${F}flask_big_red.png`;
ASSET_PATHS['item_arrow'] = `${F}weapon_arrow.png`;
ASSET_PATHS['item_ring'] = `${F}flask_red.png`;
for (let i = 0; i < 4; i++) ASSET_PATHS[`item_gold_${i}`] = `${F}coin_anim_f${i}.png`;
ASSET_PATHS['item_projectile'] = `${F}weapon_arrow.png`;

// Weapon-specific sprites
ASSET_PATHS['item_katana'] = `${F}weapon_katana.png`;
ASSET_PATHS['item_anime_sword'] = `${F}weapon_anime_sword.png`;
ASSET_PATHS['item_rusty_sword'] = `${F}weapon_rusty_sword.png`;
ASSET_PATHS['item_golden_sword'] = `${F}weapon_golden_sword.png`;
ASSET_PATHS['item_spear'] = `${F}weapon_spear.png`;
ASSET_PATHS['item_axe'] = `${F}weapon_axe.png`;
ASSET_PATHS['item_hammer'] = `${F}weapon_hammer.png`;
ASSET_PATHS['item_big_hammer'] = `${F}weapon_big_hammer.png`;
ASSET_PATHS['item_mace'] = `${F}weapon_mace.png`;
ASSET_PATHS['item_bow'] = `${F}weapon_bow.png`;
ASSET_PATHS['item_duel_sword'] = `${F}weapon_duel_sword.png`;
ASSET_PATHS['item_red_gem_sword'] = `${F}weapon_red_gem_sword.png`;
ASSET_PATHS['item_lavish_sword'] = `${F}weapon_lavish_sword.png`;
ASSET_PATHS['item_staff_red'] = `${F}weapon_red_magic_staff.png`;
ASSET_PATHS['item_shield_real'] = `${F}weapon_knight_sword.png`;
ASSET_PATHS['item_flask_big_green'] = `${F}flask_big_green.png`;
ASSET_PATHS['item_flask_big_yellow'] = `${F}flask_big_yellow.png`;

// Fountain animation frames
for (let i = 0; i < 3; i++) {
  ASSET_PATHS[`fountain_blue_top_${i}`] = `${F}wall_fountain_mid_blue_anim_f${i}.png`;
  ASSET_PATHS[`fountain_blue_basin_${i}`] = `${F}wall_fountain_basin_blue_anim_f${i}.png`;
}

// Helper: get animated monster frame
function getMonImg(templateId: string, now: number, offset: number = 0): HTMLImageElement | null {
  const fi = Math.floor(((now / 1000 * 6) + offset) % 4);
  const img = imageCache[`mon_${templateId}_${fi}`];
  return (img && img.naturalWidth > 0) ? img : null;
}
// Helper: get animated player frame
function getPlayerImg(isMoving: boolean, now: number): HTMLImageElement | null {
  const prefix = isMoving ? 'player_run' : 'player_idle';
  const fi = Math.floor((now / 1000 * 8) % 4);
  const img = imageCache[`${prefix}_${fi}`];
  return (img && img.naturalWidth > 0) ? img : null;
}
// Helper: get item image (with weapon-specific sprite support)
const _weaponSpriteMap: Record<string, string> = {
  'katana': 'item_katana',
  'steel_sword': 'item_anime_sword',
  'iron_sword': 'item_golden_sword',
  'wooden_sword': 'item_rusty_sword',
  'spear': 'item_spear',
  'battle_axe': 'item_axe',
  'war_hammer': 'item_hammer',
  'great_hammer': 'item_big_hammer',
  'mace': 'item_mace',
  'bow': 'item_bow',
  'dual_blade': 'item_duel_sword',
  'ruby_sword': 'item_red_gem_sword',
  'holy_sword': 'item_lavish_sword',
  'fire_staff': 'item_staff_red',
  'knight_shield': 'item_shield_real',
  'heal_pot': 'item_flask_big_green',
  'stamina_pot': 'item_flask_big_yellow',
};
function getItemImg(category: string, now: number, templateId?: string): HTMLImageElement | null {
  if (category === 'gold') {
    const fi = Math.floor((now / 1000 * 6) % 4);
    const img = imageCache[`item_gold_${fi}`];
    return (img && img.naturalWidth > 0) ? img : null;
  }
  // Check for specific weapon/item sprites
  if (templateId && _weaponSpriteMap[templateId]) {
    const img = imageCache[_weaponSpriteMap[templateId]];
    if (img && img.naturalWidth > 0) return img;
  }
  const img = imageCache[`item_${category}`];
  return (img && img.naturalWidth > 0) ? img : null;
}
// Helper: draw image-based entity with effects
function drawImgEntity(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  sx: number, sy: number, alpha: number, now: number, hitTime: number,
  tint?: string, flipX?: boolean, scale?: number,
) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const sc = scale ?? 1;
  const baseScale = w <= 16 ? SP / w : (SP * 1.5) / w;
  const drawW = w * baseScale * sc, drawH = h * baseScale * sc;
  const dx = sx - drawW / 2, dy = sy + SP / 3 - drawH;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  if (flipX) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
  ctx.drawImage(img, dx, dy, drawW, drawH);
  if (tint) {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = tint;
    ctx.fillRect(dx, dy, drawW, drawH);
  }
  const hitEl = now - hitTime;
  if (hitEl < HIT_DUR && hitEl >= 0) {
    ctx.globalAlpha = (1 - hitEl / HIT_DUR) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, dx, dy, drawW, drawH);
    if (hitEl >= 40) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = (1 - hitEl / HIT_DUR) * 0.3;
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(dx, dy, drawW, drawH);
    }
  }
  ctx.restore();
}

function loadLocalAssets(onReady: () => void) {
  if (_assetsReady) { onReady(); return; }
  if (_assetsLoading) return;
  _assetsLoading = true;
  const keys = Object.keys(ASSET_PATHS);
  let loaded = 0;
  const total = keys.length;
  for (const key of keys) {
    const img = new Image();
    img.onload = () => {
      imageCache[key] = img;
      loaded++;
      if (loaded >= total) { _assetsReady = true; _assetsLoading = false; onReady(); }
    };
    img.onerror = () => {
      imageCache[key] = img;
      loaded++;
      if (loaded >= total) { _assetsReady = true; _assetsLoading = false; onReady(); }
    };
    img.src = ASSET_PATHS[key];
  }
}

const MOVE_DUR = 120;
const ATK_DUR = 200;
const HIT_DUR = 250;
const HIT_STOP_DUR = 50;
const SLASH_DUR = 200;
const MON_ATK_DUR = 300;
const DEATH_FX_DUR = 600;
const DODGE_DUR = 280;

function toScr(mx: number, my: number, cx: number, cy: number): [number, number] {
  return [CW / 2 + (mx - cx) * TW, CH / 2 + (my - cy) * TH];
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

const COL = {
  floorBase: [85, 95, 110] as const,
  floorHi: [105, 118, 135] as const,
  floorSh: [60, 68, 80] as const,
  floorMortar: [45, 50, 60] as const,
  corridor: [75, 82, 95] as const,
  wallBase: [70, 78, 90] as const,
  wallHi: [90, 100, 115] as const,
  wallDark: [40, 46, 55] as const,
  wallEdge: [35, 40, 48] as const,
  bg: [8, 8, 12] as const,
};

// ============ Floor Theme (depth-based color palette) ============
function getFloorTheme(floor: number): { tint: string; ambientR: number; ambientG: number; ambientB: number; overlay: string } {
  if (floor <= 5) return { tint: 'none', ambientR: 0, ambientG: 0, ambientB: 0, overlay: 'rgba(0,0,0,0)' };
  if (floor <= 10) return { tint: 'moss', ambientR: -5, ambientG: 8, ambientB: -3, overlay: 'rgba(0,40,0,0.1)' };
  if (floor <= 15) return { tint: 'ice', ambientR: -8, ambientG: -2, ambientB: 12, overlay: 'rgba(0,0,40,0.12)' };
  if (floor <= 20) return { tint: 'lava', ambientR: 15, ambientG: -3, ambientB: -8, overlay: 'rgba(40,0,0,0.1)' };
  if (floor <= 25) return { tint: 'dark', ambientR: 5, ambientG: -5, ambientB: 10, overlay: 'rgba(20,0,30,0.12)' };
  return { tint: 'gold', ambientR: 10, ambientG: 8, ambientB: -5, overlay: 'rgba(30,25,0,0.1)' };
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

interface SlashArc { x: number; y: number; t0: number; angle: number; dir: number; color: string; }
let _slashArcs: SlashArc[] = [];
function spawnSlashArc(x: number, y: number, angle: number, dir: number, color: string = '#FFFDE0') {
  _slashArcs.push({ x, y, t0: performance.now(), angle, dir, color });
}

interface DeathFx { x: number; y: number; t0: number; templateId: string; particles: { ox: number; oy: number; vx: number; vy: number; c: string; size: number; delay: number; }[]; }
let _deathFxList: DeathFx[] = [];
const DEATH_FX_DUR_EXT = 1200; // Extended for ascension effect
function spawnDeathFx(x: number, y: number, templateId: string) {
  const particles: DeathFx['particles'] = [];
  // Core burst particles (fast, outward)
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({
      ox: (Math.random() - 0.5) * SP * 0.6, oy: (Math.random() - 0.5) * SP * 0.6,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.5 - 0.5,
      c: '#FFFFFF', size: 1.5 + Math.random() * 2, delay: 0,
    });
  }
  // Ascending soul particles (slow, upward — the main visual)
  for (let i = 0; i < 35; i++) {
    particles.push({
      ox: (Math.random() - 0.5) * SP * 0.8, oy: (Math.random() - 0.5) * SP * 0.5,
      vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random() * 2.8,
      c: ['#FFFDE0', '#FFE880', '#FFFFFF', '#C0E8FF', '#F0D060'][Math.floor(Math.random() * 5)],
      size: 1.5 + Math.random() * 3, delay: Math.random() * 150,
    });
  }
  // Trailing sparkles (delayed, float up slowly)
  for (let i = 0; i < 12; i++) {
    particles.push({
      ox: (Math.random() - 0.5) * SP * 1.2, oy: Math.random() * SP * 0.3,
      vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 1.5,
      c: ['#FFD040', '#FFFFFF', '#80C0FF'][Math.floor(Math.random() * 3)],
      size: 1 + Math.random() * 1.5, delay: 200 + Math.random() * 300,
    });
  }
  _deathFxList.push({ x, y, t0: performance.now(), templateId, particles });
}

interface DustPuff { x: number; y: number; t0: number; }
let _dustPuffs: DustPuff[] = [];
function spawnDust(x: number, y: number) { _dustPuffs.push({ x, y, t0: performance.now() }); }

interface LightningBolt { x: number; y: number; t0: number; }
let _lightningBolts: LightningBolt[] = [];

interface MonsterAtkAnim { id: string; x: number; y: number; tx: number; ty: number; t0: number; }
let _monsterAtks: MonsterAtkAnim[] = [];

interface TrapSpark { x: number; y: number; t0: number; }
let _trapSparks: TrapSpark[] = [];

interface DodgeAnim { id: string; x: number; y: number; dir: number; t0: number; }
let _dodgeAnims: DodgeAnim[] = [];
function spawnDodge(x: number, y: number, id: string) {
  _dodgeAnims.push({ id, x, y, dir: Math.random() > 0.5 ? 1 : -1, t0: performance.now() });
}

interface AlertMark { id: string; x: number; y: number; t0: number; }
let _alertMarks: AlertMark[] = [];
const ALERT_DUR = 600;

interface GroundFlash { x: number; y: number; t0: number; color: string; }
let _groundFlashes: GroundFlash[] = [];
function spawnGroundFlash(x: number, y: number, color: string = 'rgba(255,200,100,0.5)') {
  _groundFlashes.push({ x, y, t0: performance.now(), color });
}

interface SplitBurst { x: number; y: number; t0: number; }
let _splitBursts: SplitBurst[] = [];
function spawnSplitBurst(x: number, y: number) {
  _splitBursts.push({ x, y, t0: performance.now() });
  spawnImpact(x, y, 16, '#60E880');
}

// ============ Swing (素振り) Animation ============
interface SwingAnim { active: boolean; startTime: number; dir: Direction; }
let _swingAnim: SwingAnim = { active: false, startTime: 0, dir: Direction.Down };

function spawnSwing(dir: Direction) {
  _swingAnim = { active: true, startTime: performance.now(), dir };
}

// ============ Trap Activation FX ============
interface TrapFx { pos: Position; startTime: number; type: string; particles: { ox: number; oy: number; vx: number; vy: number; color: string; }[]; }
let _trapFxList: TrapFx[] = [];
function spawnTrapFx(pos: Position, type: string) {
  const particles: TrapFx['particles'] = [];
  const count = type === 'arrow' ? 6 : 14;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2.5;
    particles.push({
      ox: (Math.random() - 0.5) * 8, oy: (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
      color: type === 'arrow' ? '#C0C8D0' : ['#888', '#999', '#AAA', '#777'][Math.floor(Math.random() * 4)],
    });
  }
  _trapFxList.push({ pos, startTime: performance.now(), type, particles });
}

// ============ Staff Bullet Animation ============
interface StaffBullet { active: boolean; startTime: number; dir: Direction; startPos: Position; color: string; trail: { x: number; y: number; t: number }[]; }
let _staffBullet: StaffBullet | null = null;
function spawnStaffBullet(startPos: Position, dir: Direction, color: string = '#60A0FF') {
  _staffBullet = { active: true, startTime: performance.now(), dir, startPos, color, trail: [] };
}

// ============ Item Drop Parabolic Animation ============
interface ItemDropAnim { id: string; startTime: number; startPos: Position; endPos: Position; }
let _itemDropAnims: ItemDropAnim[] = [];
function spawnItemDrop(id: string, startPos: Position, endPos: Position) {
  _itemDropAnims.push({ id, startTime: performance.now(), startPos, endPos });
}

// ============ Level Up Particles ============
interface LevelUpParticle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; }
let _levelUpParticles: LevelUpParticle[] = [];
let _levelUpFreezeUntil = 0;
let _levelUpPulseT0 = 0;

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

interface RadialLine { angle: number; speed: number; len: number; color: string; }
let _levelUpLines: RadialLine[] = [];
let _levelUpT0 = 0;
function spawnLevelUpLines() {
  _levelUpLines = [];
  _levelUpT0 = performance.now();
  _levelUpFreezeUntil = performance.now() + 50;
  _levelUpPulseT0 = performance.now();
  for (let i = 0; i < 24; i++) {
    _levelUpLines.push({
      angle: (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.15,
      speed: 2 + Math.random() * 4, len: 40 + Math.random() * 80,
      color: i % 3 === 0 ? '#F0D060' : i % 3 === 1 ? '#D4A840' : '#FFE880',
    });
  }
  // Spawn ascending golden particles
  for (let i = 0; i < 20; i++) {
    _levelUpParticles.push({
      x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1.2, vy: -1.5 - Math.random() * 2.5,
      life: 600 + Math.random() * 400, maxLife: 600 + Math.random() * 400,
      size: 1.5 + Math.random() * 2,
    });
  }
}

let _gr: HTMLCanvasElement | null = null;
function getGrain(): HTMLCanvasElement {
  if (_gr) return _gr;
  _gr = document.createElement('canvas');
  _gr.width = 128; _gr.height = 128;
  const c = _gr.getContext('2d')!;
  const d = c.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 8; }
  c.putImageData(d, 0, 0);
  return _gr;
}

let _sl: HTMLCanvasElement | null = null;
function getScanlines(): HTMLCanvasElement {
  if (_sl) return _sl;
  _sl = document.createElement('canvas');
  _sl.width = 4; _sl.height = 4;
  const c = _sl.getContext('2d')!;
  c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, 4, 4);
  c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, 0, 4, 1);
  c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(0, 2, 4, 1);
  return _sl;
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
  hpPinch: boolean;
}

export default function DungeonRenderer({ state, screenShake, damageFlash, levelUpEffect, criticalFlash, stairsFade, deathSlowmo, hpPinch }: Props) {
  const [assetsLoaded, setAssetsLoaded] = useState(_assetsReady);
  const cRef = useRef<HTMLCanvasElement>(null);
  const aRef = useRef<number>(0);

  // 初回マウント時に一度だけアセットロード (useEffect内 = SSR安全)
  useEffect(() => {
    if (!_assetsReady) {
      loadLocalAssets(() => setAssetsLoaded(true));
    }
  }, []);
  const popRef = useRef<Popup[]>([]);
  const ppHP = useRef(state.player.hp);
  const ppSat = useRef(state.player.satiation);
  const pmHP = useRef<Map<string, number>>(new Map());
  const prevMonIds = useRef<Set<string>>(new Set());
  const prevLevelRef = useRef(state.player.level);
  const { player, floor } = state;

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
  const prevAwakened = useRef<Set<string>>(new Set());
  const prevMonCount = useRef(floor.monsters.length);
  const critZoom = useRef(0);
  const critZoomT = useRef(0);
  // #24 Room entry tracking
  const prevPlayerTile = useRef<TileType>(TileType.Floor);
  const roomEntryMsg = useRef<{ text: string; t0: number } | null>(null);
  // #30 Stairs discovery tracking
  const stairsDiscovered = useRef<Set<string>>(new Set());
  const stairsMsg = useRef<{ text: string; t0: number } | null>(null);

  useEffect(() => {
    if (player.pos.x !== pTo.current.x || player.pos.y !== pTo.current.y) {
      pFrom.current = { ...pTo.current };
      pTo.current = { x: player.pos.x, y: player.pos.y };
      pMoveT.current = performance.now();
      spawnDust(CW / 2, CH / 2 + TH / 2);
      // #24 Room entry notification
      const curTile = floor.tiles[player.pos.y]?.[player.pos.x];
      if (curTile === TileType.Floor && prevPlayerTile.current === TileType.Corridor) {
        roomEntryMsg.current = { text: '部屋に入った', t0: performance.now() };
      }
      prevPlayerTile.current = curTile ?? TileType.Floor;
      // #30 Stairs discovery check
      for (let dy = -RANGE; dy <= RANGE; dy++) {
        for (let dx = -RANGE; dx <= RANGE; dx++) {
          const sx = player.pos.x + dx, sy2 = player.pos.y + dy;
          if (sx >= 0 && sx < floor.width && sy2 >= 0 && sy2 < floor.height) {
            if (floor.tiles[sy2]?.[sx] === TileType.StairsDown && floor.visible[sy2]?.[sx]) {
              const key = `${sx},${sy2}`;
              if (!stairsDiscovered.current.has(key)) {
                stairsDiscovered.current.add(key);
                stairsMsg.current = { text: '階段を見つけた！', t0: performance.now() };
              }
            }
          }
        }
      }
    }
  }, [player.pos.x, player.pos.y, floor.tiles, floor.visible, floor.width, floor.height]);

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
    for (const oldId of prevMonIds.current) {
      if (!currentIds.has(oldId)) {
        const lastPos = mTo.current.get(oldId);
        if (lastPos) {
          const [sx, sy] = toScr(lastPos.x, lastPos.y, player.pos.x, player.pos.y);
          spawnDeathFx(sx, sy, oldId);
          spawnExpOrbs(sx, sy, CW / 2, CH / 2, 8);
          const expMsg = state.logs.slice(-5).find(l => l.message.includes('経験値'));
          const expMatch = expMsg?.message.match(/経験値(\d+)/);
          popRef.current.push({ id: _pid++, x: sx, y: sy - SP / 2, text: `+${expMatch ? expMatch[1] : '??'} Exp`, color: '#4488ff', t0: now, vx: 0, vy: -2 });
        }
      }
    }
    prevMonIds.current = currentIds;
  }, [floor.monsters, player.pos, state.logs]);

  useEffect(() => { if (player.level > prevLevelRef.current) spawnLevelUpLines(); prevLevelRef.current = player.level; }, [player.level]);

  useEffect(() => {
    for (const trap of floor.traps) {
      const key = `${trap.pos.x},${trap.pos.y}`;
      if (trap.visible && !prevTrapVis.current.get(key)) {
        const [sx, sy] = toScr(trap.pos.x, trap.pos.y, player.pos.x, player.pos.y);
        _trapSparks.push({ x: trap.pos.x, y: trap.pos.y, t0: performance.now() });
        _lightningBolts.push({ x: sx, y: sy, t0: performance.now() });
        spawnImpact(sx, sy, 12, '#FF8844');
        spawnTrapFx(trap.pos, trap.type);
      }
      prevTrapVis.current.set(key, trap.visible);
    }
  }, [floor.traps, player.pos]);

  useEffect(() => {
    const now = performance.now();
    for (const mon of floor.monsters) {
      if (mon.awakened && !mon.sleeping && !prevAwakened.current.has(mon.id) && floor.visible[mon.pos.y]?.[mon.pos.x]) {
        const [msx, msy] = toScr(mon.pos.x, mon.pos.y, player.pos.x, player.pos.y);
        _alertMarks.push({ id: mon.id, x: msx, y: msy - SP / 2 - 8, t0: now });
      }
    }
    const ns = new Set<string>(); for (const mon of floor.monsters) { if (mon.awakened && !mon.sleeping) ns.add(mon.id); } prevAwakened.current = ns;
  }, [floor.monsters, player.pos]);

  useEffect(() => {
    if (floor.monsters.length > prevMonCount.current) {
      const diff = floor.monsters.length - prevMonCount.current;
      if (diff > 0 && diff <= 3) for (const mon of floor.monsters.slice(-diff)) {
        if (floor.visible[mon.pos.y]?.[mon.pos.x]) { const [msx, msy] = toScr(mon.pos.x, mon.pos.y, player.pos.x, player.pos.y); spawnSplitBurst(msx, msy); }
      }
    }
    prevMonCount.current = floor.monsters.length;
  }, [floor.monsters.length, floor.monsters, player.pos]);

  useEffect(() => {
    const now = performance.now();
    const pd = ppHP.current - player.hp; ppHP.current = player.hp;
    if (pd > 0) {
      popRef.current.push({ id: _pid++, x: CW / 2, y: CH / 2 - SP / 2, text: `-${pd}`, color: '#ff4444', t0: now, vx: (Math.random() - 0.5) * 2, vy: -4.5, size: Math.min(22, 17 + pd * 0.3) });
      pHitT.current = now; hitStopUntil.current = now + HIT_STOP_DUR;
      spawnImpact(CW / 2, CH / 2, 6 + pd, '#FF6060');
      spawnShockwave(CW / 2, CH / 2, 'rgba(255,80,80,0.5)', 20 + pd * 2);
      spawnGroundFlash(CW / 2, CH / 2, 'rgba(255,100,80,0.4)');
      for (const m of floor.monsters) { if (Math.abs(m.pos.x - player.pos.x) <= 1 && Math.abs(m.pos.y - player.pos.y) <= 1) { const [msx, msy] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y); _monsterAtks.push({ id: m.id, x: msx, y: msy, tx: CW / 2, ty: CH / 2, t0: now }); break; } }
    } else if (pd < 0) {
      popRef.current.push({ id: _pid++, x: CW / 2, y: CH / 2 - SP / 2, text: `+${-pd}`, color: '#44ff66', t0: now, vx: (Math.random() - 0.5) * 1.5, vy: -3 });
    }
    // Satiation change popup
    const satDiff = player.satiation - ppSat.current; ppSat.current = player.satiation;
    if (satDiff > 0) {
      popRef.current.push({ id: _pid++, x: CW / 2 + 30, y: CH / 2 - SP * 0.3, text: `満腹+${satDiff}`, color: '#88cc44', t0: now, vx: 0.5, vy: -2.5, size: 13 });
    } else if (satDiff < -5) {
      popRef.current.push({ id: _pid++, x: CW / 2 + 20, y: CH / 2, text: `空腹`, color: '#cc6644', t0: now, vx: 0, vy: -2, size: 12 });
    }
    const recentLog = state.logs[state.logs.length - 1];
    if (recentLog?.message.includes('持ち物がいっぱい')) popRef.current.push({ id: _pid++, x: CW / 2, y: CH / 2 - SP, text: '?', color: '#ffcc44', t0: now, vx: 0, vy: -2.5 });
    const dodgeLog = state.logs.slice(-3).find(l => l.message.includes('かわした') || l.message.includes('外れた'));
    if (dodgeLog) for (const m of floor.monsters) { if (Math.abs(m.pos.x - player.pos.x) <= 1 && Math.abs(m.pos.y - player.pos.y) <= 1 && !_dodgeAnims.find(d => d.id === m.id && now - d.t0 < DODGE_DUR)) { const [msx, msy] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y); spawnDodge(msx, msy, m.id); popRef.current.push({ id: _pid++, x: msx, y: msy - SP / 2, text: 'MISS', color: '#8888aa', t0: now, vx: (Math.random() - 0.5) * 1.5, vy: -3, size: 14 }); break; } }
    const nm = new Map<string, number>();
    for (const m of floor.monsters) {
      const p = pmHP.current.get(m.id); nm.set(m.id, m.hp);
      if (p !== undefined && p > m.hp) {
        const dmg = p - m.hp;
        const [mx2, my2] = toScr(m.pos.x, m.pos.y, player.pos.x, player.pos.y);
        popRef.current.push({ id: _pid++, x: mx2, y: my2 - SP / 2, text: `${dmg}`, color: '#ffcc44', t0: now, vx: (Math.random() - 0.5) * 3, vy: -5, size: Math.min(24, 17 + dmg * 0.5) });
        mHitT.current.set(m.id, now); hitStopUntil.current = now + HIT_STOP_DUR;
        spawnImpact(mx2, my2, 8 + dmg, '#FFE080');
        spawnShockwave(mx2, my2, 'rgba(255,220,120,0.6)', 25 + dmg * 2);
        spawnGroundFlash(mx2, my2, 'rgba(255,220,100,0.4)');
        if (state.logs.slice(-3).find(l => l.message.includes('会心'))) {
          critZoom.current = 1; critZoomT.current = now;
          // Override last popup with critical styling: gold, larger, more velocity
          const lastPop = popRef.current[popRef.current.length - 1];
          if (lastPop) { lastPop.color = '#FFD040'; lastPop.vy = -7; lastPop.size = Math.min(30, 22 + dmg * 0.5); lastPop.text = `${dmg}!`; }
        }
        const ddx = m.pos.x - player.pos.x, ddy = m.pos.y - player.pos.y;
        if (Math.abs(ddx) <= 1 && Math.abs(ddy) <= 1) { atkDir.current = { dx: ddx, dy: ddy }; atkT.current = now; spawnSlashArc(mx2, my2, Math.atan2(ddy, ddx), 1, dmg > 10 ? '#FF8844' : '#FFFDE0'); }
      }
    }
    pmHP.current = nm;
    // Swing (素振り) detection: look in recent logs for swing keywords
    const recentSwingLogs = state.logs.slice(-5);
    const hasSwing = recentSwingLogs.some(l => l.message.includes('素振り'));
    const hasMonsterDmg = recentSwingLogs.some(l => l.type === 'damage' && !l.message.includes('ダメージを受けた'));
    if (hasSwing && !hasMonsterDmg && now - _swingAnim.startTime > ATK_DUR) {
      const dir = player.facing;
      const dv = DIR_VECTORS[dir];
      if (dv) {
        spawnSwing(dir);
        atkDir.current = { dx: dv.x, dy: dv.y };
        atkT.current = now;
        const [swx, swy] = toScr(player.pos.x + dv.x, player.pos.y + dv.y, player.pos.x, player.pos.y);
        spawnSlashArc(swx, swy, Math.atan2(dv.y, dv.x), 1, '#AAAACC');
      }
    }
    // Staff usage detection
    const staffLog = state.logs.slice(-3).find(l => l.message.includes('を振った'));
    if (staffLog && now - (_staffBullet?.startTime ?? 0) > 400) {
      spawnStaffBullet(player.pos, player.facing, '#60A0FF');
      atkDir.current = { dx: DIR_VECTORS[player.facing].x, dy: DIR_VECTORS[player.facing].y };
      atkT.current = now;
    }
  }, [player.hp, player.satiation, floor.monsters, player.pos, state.logs]);

  const iW = useCallback((x: number, y: number): boolean => {
    if (x < 0 || x >= floor.width || y < 0 || y >= floor.height) return true;
    return (floor.tiles[y]?.[x] ?? TileType.Wall) === TileType.Wall;
  }, [floor]);

  // ================================================================
  //  FLOOR TILE — 画像駆動 (テクスチャパターン + AO)
  // ================================================================
  const drawFloorTile = useCallback((ctx: CanvasRenderingContext2D, sx: number, sy: number, mx: number, my: number, alpha: number, isCorridor: boolean) => {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const x0 = sx - TW / 2, y0 = sy - TH / 2;
    const variant = (Math.floor(H(mx, my) * 8) % 8) + 1;
    const floorImg = imageCache[`floor_${variant}`];
    if (floorImg && floorImg.naturalWidth > 0) {
      ctx.drawImage(floorImg, x0, y0, TW, TH);
    } else {
      const n = H(mx, my);
      const base = isCorridor ? COL.corridor : COL.floorBase;
      const bv = (n - 0.5) * 14;
      ctx.fillStyle = `rgb(${base[0] + bv | 0},${base[1] + bv | 0},${base[2] + bv * 0.7 | 0})`;
      ctx.fillRect(x0, y0, TW, TH);
    }
    if (isCorridor) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x0, y0, TW, TH); }
    const n = H(mx, my);
    if (n > 0.7) { ctx.fillStyle = 'rgba(100,110,130,0.06)'; ctx.fillRect(x0, y0, TW, TH); }
    else if (n < 0.3) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(x0, y0, TW, TH); }
    // Wall Ambient Occlusion
    if (iW(mx, my - 1)) { const sg = ctx.createLinearGradient(sx, y0, sx, y0 + 12); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.2)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(x0, y0, TW, 12); }
    if (iW(mx - 1, my)) { const sg = ctx.createLinearGradient(x0, sy, x0 + 12, sy); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.15)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(x0, y0, 12, TH); }
    if (iW(mx + 1, my)) { const sg = ctx.createLinearGradient(x0 + TW, sy, x0 + TW - 10, sy); sg.addColorStop(0, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(x0 + TW - 10, y0, 10, TH); }
    if (iW(mx, my + 1)) { const sg = ctx.createLinearGradient(sx, y0 + TH, sx, y0 + TH - 8); sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(x0, y0 + TH - 8, TW, 8); }
    if (iW(mx, my - 1) && iW(mx - 1, my)) { const cg = ctx.createRadialGradient(x0, y0, 0, x0, y0, 16); cg.addColorStop(0, 'rgba(0,0,0,0.6)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x0, y0, 16, 16); }
    if (iW(mx, my - 1) && iW(mx + 1, my)) { const cg = ctx.createRadialGradient(x0 + TW, y0, 0, x0 + TW, y0, 14); cg.addColorStop(0, 'rgba(0,0,0,0.5)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x0 + TW - 14, y0, 14, 14); }
    if (iW(mx - 1, my) && iW(mx, my + 1)) { const cg = ctx.createRadialGradient(x0, y0 + TH, 0, x0, y0 + TH, 12); cg.addColorStop(0, 'rgba(0,0,0,0.4)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x0, y0 + TH - 12, 12, 12); }
    if (iW(mx + 1, my) && iW(mx, my + 1)) { const cg = ctx.createRadialGradient(x0 + TW, y0 + TH, 0, x0 + TW, y0 + TH, 12); cg.addColorStop(0, 'rgba(0,0,0,0.35)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x0, y0 + TH - 12, 12, 12); }
    // Floor details: moss spots, cracks, puddles
    const dm = H3(mx, my, 1);
    if (dm > 0.80) {
      // ~20% moss spot
      ctx.fillStyle = 'rgba(40,90,30,0.15)';
      const mox = x0 + H3(mx, my, 11) * TW * 0.6 + TW * 0.2;
      const moy = y0 + H3(mx, my, 12) * TH * 0.6 + TH * 0.2;
      ctx.beginPath(); ctx.arc(mox, moy, 2 + dm * 3, 0, Math.PI * 2); ctx.fill();
    }
    const dc = H3(mx, my, 2);
    if (dc > 0.90) {
      // ~10% crack line
      ctx.strokeStyle = 'rgba(30,28,25,0.18)';
      ctx.lineWidth = 0.8;
      const cx0 = x0 + H3(mx, my, 21) * TW * 0.4 + TW * 0.1;
      const cy0 = y0 + H3(mx, my, 22) * TH * 0.4 + TH * 0.1;
      const cx1 = cx0 + (H3(mx, my, 23) - 0.3) * TW * 0.6;
      const cy1 = cy0 + (H3(mx, my, 24) - 0.3) * TH * 0.6;
      ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke();
    }
    const dp = H3(mx, my, 3);
    if (dp > 0.95) {
      // #4 Water tile animation — animated blue wave pattern for water/puddle tiles
      const waterT = (performance.now() * 0.002 + mx * 0.7 + my * 0.5);
      const waveAlpha = 0.10 + Math.sin(waterT) * 0.04;
      ctx.fillStyle = `rgba(50,80,140,${waveAlpha})`;
      const px = x0 + H3(mx, my, 31) * TW * 0.5 + TW * 0.25;
      const py = y0 + H3(mx, my, 32) * TH * 0.5 + TH * 0.25;
      const waveOff = Math.sin(waterT * 1.3) * 1.5;
      ctx.beginPath(); ctx.ellipse(px + waveOff, py, 4 + dp * 5, 2.5 + dp * 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // Wave highlight ripple
      ctx.strokeStyle = `rgba(100,150,220,${waveAlpha * 0.6})`;
      ctx.lineWidth = 0.5;
      const rippleR = 2 + Math.sin(waterT * 0.8) * 2;
      ctx.beginPath(); ctx.arc(px + waveOff, py, rippleR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }, [iW]);

  // ================================================================
  //  WALL TILE — 画像駆動 (テクスチャ + 境界エッジ)
  // ================================================================
  const drawWallTile = useCallback((ctx: CanvasRenderingContext2D, sx: number, sy: number, mx: number, my: number, alpha: number, now?: number) => {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const x0 = sx - TW / 2, y0 = sy - TH / 2;
    const floorBelow = !iW(mx, my + 1);
    const wallKey = floorBelow ? 'wall_mid' : 'wall_top_mid';
    const wallImg = imageCache[wallKey];
    if (wallImg && wallImg.naturalWidth > 0) {
      ctx.drawImage(wallImg, x0, y0, TW, TH);
      // Decorative overlays on walls based on tile hash
      const dn = H(mx * 7 + 3, my * 13 + 7);
      // ~15% banners (on wall faces with floor below)
      if (floorBelow && dn > 0.85) {
        const banners = ['wall_banner_blue', 'wall_banner_red', 'wall_banner_green', 'wall_banner_yellow'];
        const banner = imageCache[banners[Math.floor(dn * 400) % 4]];
        if (banner && banner.naturalWidth > 0) ctx.drawImage(banner, x0, y0, TW, TH);
      }
      // ~10% holes (on non-face walls)
      else if (!floorBelow && dn > 0.75 && dn <= 0.85) {
        const holes = ['wall_hole_1', 'wall_hole_2'];
        const hole = imageCache[holes[Math.floor(dn * 100) % 2]];
        if (hole && hole.naturalWidth > 0) { ctx.globalAlpha = alpha * 0.6; ctx.drawImage(hole, x0, y0, TW, TH); ctx.globalAlpha = alpha; }
      }
      // ~5% goo
      const dn2 = H3(mx, my, 42);
      if (dn2 > 0.95) {
        const goo = imageCache['wall_goo'];
        if (goo && goo.naturalWidth > 0) { ctx.globalAlpha = alpha * 0.7; ctx.drawImage(goo, x0, y0, TW, TH); ctx.globalAlpha = alpha; }
      }
      // ~3% column (placed in front of wall)
      else if (dn2 > 0.92 && dn2 <= 0.95 && floorBelow) {
        const col = imageCache['column'];
        if (col && col.naturalWidth > 0) ctx.drawImage(col, x0, y0, TW, TH);
      }
      // #27 Wall torch flickering: dynamic torch light on walls with floor below
      if (floorBelow && dn > 0.6 && dn <= 0.65) {
        const torchFlk = 0.5 + Math.sin((now ?? performance.now()) * 0.008 + mx * 5 + my * 3) * 0.3 + Math.sin((now ?? performance.now()) * 0.015 + mx * 11) * 0.15;
        ctx.save();
        ctx.globalAlpha = alpha * torchFlk * 0.15;
        const tGrad = ctx.createRadialGradient(sx, sy + TH * 0.3, 0, sx, sy + TH * 0.3, TW * 2);
        tGrad.addColorStop(0, '#ffa040');
        tGrad.addColorStop(0.4, 'rgba(255,140,40,0.3)');
        tGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tGrad;
        ctx.fillRect(x0 - TW, y0 - TH, TW * 3, TH * 3);
        // Torch flame
        ctx.globalAlpha = alpha * 0.8;
        const flameH2 = 2 + Math.sin((now ?? performance.now()) * 0.012 + mx * 7) * 1;
        ctx.fillStyle = '#ff9030';
        ctx.beginPath(); ctx.ellipse(sx, sy + TH * 0.25, 1.5, flameH2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe080';
        ctx.beginPath(); ctx.ellipse(sx, sy + TH * 0.25 + 0.5, 0.8, flameH2 * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // ~2% fountain (animated, on walls in rooms — floorBelow implies room-adjacent)
      const dn3 = H3(mx, my, 99);
      if (dn3 > 0.98 && floorBelow) {
        const fi = Math.floor(((now ?? performance.now()) / 200) % 3);
        const ftop = imageCache[`fountain_blue_top_${fi}`];
        const fbasin = imageCache[`fountain_blue_basin_${fi}`];
        if (ftop && ftop.naturalWidth > 0) ctx.drawImage(ftop, x0, y0, TW, TH);
        if (fbasin && fbasin.naturalWidth > 0) ctx.drawImage(fbasin, x0, y0 + TH * 0.5, TW, TH * 0.5);
      }
    } else {
      const nw = H(mx * 3, my * 5);
      const bv = (nw - 0.5) * 8;
      ctx.fillStyle = `rgb(${COL.wallDark[0] + bv | 0},${COL.wallDark[1] + bv | 0},${COL.wallDark[2] + bv * 0.5 | 0})`;
      ctx.fillRect(x0, y0, TW, TH);
    }
    // Relief gradient
    const tg = ctx.createLinearGradient(sx, y0, sx, y0 + TH);
    tg.addColorStop(0, 'rgba(90,100,115,0.1)'); tg.addColorStop(0.4, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = tg; ctx.fillRect(x0, y0, TW, TH);
    // Wall boundary edges
    ctx.strokeStyle = 'rgba(35,40,48,0.9)'; ctx.lineWidth = 2;
    if (!iW(mx, my - 1)) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + TW, y0); ctx.stroke(); }
    if (!iW(mx, my + 1)) { ctx.beginPath(); ctx.moveTo(x0, y0 + TH); ctx.lineTo(x0 + TW, y0 + TH); ctx.stroke(); }
    if (!iW(mx - 1, my)) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + TH); ctx.stroke(); }
    if (!iW(mx + 1, my)) { ctx.beginPath(); ctx.moveTo(x0 + TW, y0); ctx.lineTo(x0 + TW, y0 + TH); ctx.stroke(); }
    // Inner highlight seam
    ctx.strokeStyle = 'rgba(90,100,115,0.12)'; ctx.lineWidth = 0.6;
    if (!iW(mx, my - 1)) { ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x0 + TW, y0 + 2); ctx.stroke(); }
    if (!iW(mx - 1, my)) { ctx.beginPath(); ctx.moveTo(x0 + 2, y0); ctx.lineTo(x0 + 2, y0 + TH); ctx.stroke(); }
    ctx.restore();
  }, [iW]);

  const drawEntitySprite = useCallback((ctx: CanvasRenderingContext2D, sprite: Parameters<typeof drawSprite>[1], sx: number, sy: number, alpha: number, now: number, hitTime: number, tint?: string, breathPhase?: number, flipX?: boolean, scaleOverride?: number) => {
    const breath = breathPhase !== undefined ? Math.sin(breathPhase) * 0.015 : 0;
    const scale = (scaleOverride ?? 1) + breath;
    const ey = sy - SP / 2, ex = sx - SP / 2;
    ctx.save();
    if (flipX) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    if (scale !== 1) { ctx.translate(sx, sy); ctx.scale(scale, scale); ctx.translate(-sx, -sy); }
    drawSprite(ctx, sprite, ex, ey, SP, alpha, tint);
    const hitElapsed = now - hitTime;
    if (hitElapsed < HIT_DUR && hitElapsed >= 0) { ctx.globalAlpha = (1 - hitElapsed / HIT_DUR) * 0.6; ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = hitElapsed < 40 ? '#ffffff' : '#ff2020'; ctx.fillRect(ex - 2, ey - 2, SP + 4, SP + 4); }
    ctx.restore();
  }, []);

  // ================================================================
  //  MAIN RENDER
  // ================================================================
  const render = useCallback(() => {
    const canvas = cRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (canvas.width !== CW) canvas.width = CW;
    if (canvas.height !== CH) canvas.height = CH;
    const rawNow = performance.now();
    const inLevelUpFreeze = rawNow < _levelUpFreezeUntil;
    const now = deathSlowmo ? rawNow * 0.35 + rawNow * 0.65 : rawNow;
    const inHitStop = rawNow < hitStopUntil.current || inLevelUpFreeze;
    ctx.save();
    if (hpPinch) { const hs = 1 + Math.sin(now * 0.008) * 0.006; ctx.translate(CW / 2, CH / 2); ctx.scale(hs, hs); ctx.translate(-CW / 2, -CH / 2); }
    ctx.translate(screenShake.x, screenShake.y);
    if (critZoom.current > 0) {
      const ze = (rawNow - critZoomT.current) / 350;
      if (ze > 1) critZoom.current = 0;
      else { const zs = ze < 0.15 ? 1 + 0.1 * easeOut(ze / 0.15) : 1 + 0.1 * (1 - easeOut((ze - 0.15) / 0.85)); ctx.translate(CW / 2, CH / 2); ctx.scale(zs, zs); ctx.translate(-CW / 2, -CH / 2); }
    }
    const pmEl = inHitStop ? 0 : Math.min(1, (now - pMoveT.current) / MOVE_DUR);
    const pmE = easeOut(pmEl);
    const plX = pFrom.current.x + (player.pos.x - pFrom.current.x) * pmE;
    const plY = pFrom.current.y + (player.pos.y - pFrom.current.y) * pmE;
    const plMoving = pmEl < 1;
    const atkEl = inHitStop ? 0 : Math.min(1, (now - atkT.current) / ATK_DUR);
    let atkOffX = 0, atkOffY = 0;
    if (atkEl < 1) {
      const { dx: adx, dy: ady } = atkDir.current;
      // Phase 1: Wind-up / charge (pull back slightly, 0-25%)
      if (atkEl < 0.25) {
        const ct = easeOut(atkEl / 0.25);
        atkOffX = -adx * 4 * ct;
        atkOffY = -ady * 4 * ct;
      }
      // Phase 2: Sharp lunge forward (explosive strike, 25-45%)
      else if (atkEl < 0.45) {
        const lt = (atkEl - 0.25) / 0.2;
        const le = easeOut(lt);
        atkOffX = -adx * 4 * (1 - le) + adx * TW * 0.42 * le;
        atkOffY = -ady * 4 * (1 - le) + ady * TH * 0.42 * le;
      }
      // Phase 3: Recoil / recovery (pull back to center, 45-100%)
      else {
        const rt = (atkEl - 0.45) / 0.55;
        const re = easeOut(rt);
        atkOffX = adx * TW * 0.42 * (1 - re);
        atkOffY = ady * TH * 0.42 * (1 - re);
      }
    }
    const camXf = plX, camYf = plY;
    ctx.fillStyle = `rgb(${COL.bg[0]},${COL.bg[1]},${COL.bg[2]})`; ctx.fillRect(-8, -8, CW + 16, CH + 16);
    const nt = now * 0.002;
    const flk = 0.94 + perlin1(nt * 1.3) * 0.035 + perlin1(nt * 2.7 + 100) * 0.018 + perlin1(nt * 5.1 + 200) * 0.008;
    const lR = 350 * flk;
    // #5 Fog of war gradient — softer transition at FOV edges
    function lA(mx: number, my: number): number {
      const vis = !!floor.visible[my]?.[mx], expl = !!floor.explored[my]?.[mx];
      if (!vis && !expl) return 0; if (!vis) return 0.18;
      const dx = mx - player.pos.x, dy = my - player.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Smooth cubic falloff for softer FOV edge transition
      const raw = Math.max(0, 1.0 - dist * 0.055);
      const soft = raw * raw * (3 - 2 * raw); // smoothstep
      return Math.max(0.3, soft);
    }

    type EntityDraw = { depth: number; draw: () => void };
    const entityDraws: EntityDraw[] = [];

    // Items
    for (const item of floor.items) {
      if (!item.floorPos) continue;
      const { x: imx, y: imy } = item.floorPos;
      if (!floor.visible[imy]?.[imx]) continue;
      const ci = item;
      const itemImg = getItemImg(item.category, now, (item as any).templateId);
      const spr = !itemImg ? ITEM_SPRITES[item.category] : null;
      if (!itemImg && !spr) continue;
      entityDraws.push({ depth: imy, draw: () => {
        const [isx, isy] = toScr(imx, imy, camXf, camYf);
        // #26 Item glow on ground
        ctx.save(); ctx.globalAlpha = 0.12 + Math.sin(now * 0.003 + imx * 1.3) * 0.05; ctx.fillStyle = '#FFE880'; ctx.shadowColor = '#FFE880'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(isx, isy, 14, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(isx, isy + 4, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.ellipse(isx, isy + 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        const bob = Math.sin(now * 0.003 + imx * 0.7 + imy * 0.9) * 2;
        // #3 Item spin animation — items on ground rotate slowly via horizontal scale oscillation
        const itemSpin = Math.cos(now * 0.002 + imx * 1.1 + imy * 0.5);
        ctx.save();
        ctx.translate(isx, isy + bob);
        ctx.scale(itemSpin > 0 ? 0.7 + itemSpin * 0.3 : 0.7 - itemSpin * 0.3, 1);
        ctx.translate(-isx, -(isy + bob));
        if (itemImg) { drawImgEntity(ctx, itemImg, isx, isy + bob, 1.0, now, 0); }
        else if (spr) { drawEntitySprite(ctx, spr, isx, isy + bob, 1.0, now, 0, undefined, now * 0.003 + imx); }
        ctx.restore();
        const sp = (now * 0.001 + imx * 1.3 + imy * 0.7) % 2;
        if (sp < 0.4) { const sa = Math.sin(sp / 0.4 * Math.PI) * 0.6; ctx.save(); ctx.globalAlpha = sa; ctx.strokeStyle = '#FFFDE0'; ctx.shadowColor = '#FFE880'; ctx.shadowBlur = 12; ctx.lineWidth = 1.5; const spX = isx + (H(imx * 3, imy * 7) - 0.5) * SP * 0.5, spY = isy + bob + (H(imx * 7, imy * 3) - 0.5) * SP * 0.3; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + sp * Math.PI; ctx.moveTo(spX, spY); ctx.lineTo(spX + Math.cos(a) * 4, spY + Math.sin(a) * 4); } ctx.stroke(); ctx.restore(); }
        if (!ci.identified && ci.category !== ItemCategory.Gold) { ctx.save(); ctx.globalAlpha = 0.6; ctx.font = 'bold 12px var(--font-display,serif)'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFD060'; ctx.shadowColor = '#FFD060'; ctx.shadowBlur = 6; ctx.fillText('?', isx, isy - SP * 0.4 + bob); ctx.restore(); }
        if (ci.blessed) drawGlow(ctx, isx - SP / 2, isy - SP / 2, SP, '#c9a84c', now);
        if (ci.cursed) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#5a0a3a'; ctx.fillRect(isx - SP / 2, isy - SP / 2, SP, SP); ctx.restore(); }
      }});
    }

    // Monsters
    for (const mon of floor.monsters) {
      if (!floor.visible[mon.pos.y]?.[mon.pos.x]) continue;
      const mr = mon;
      const monImg = getMonImg(mr.templateId, now, mr.pos.x * 0.7 + mr.pos.y * 0.3);
      const spr = !monImg ? MONSTER_SPRITES[mr.templateId] : null;
      if (!monImg && !spr) continue;
      entityDraws.push({ depth: mon.pos.y, draw: () => {
        const mf = mFrom.current.get(mr.id), mt = mMoveT.current.get(mr.id) ?? 0;
        const me = inHitStop ? 0 : Math.min(1, (now - mt) / MOVE_DUR);
        const mEase = easeOut(me);
        const mmx = mf ? mf.x + (mr.pos.x - mf.x) * mEase : mr.pos.x;
        const mmy = mf ? mf.y + (mr.pos.y - mf.y) * mEase : mr.pos.y;
        let [msx, msy] = toScr(mmx, mmy, camXf, camYf);
        const hitTime = mHitT.current.get(mr.id) ?? 0;
        const hitEl2 = now - hitTime;
        let kx = 0, ky = 0;
        if (hitEl2 < 200 && hitEl2 >= 0) { const kt = hitEl2 / 200; const ke = kt < 0.2 ? kt / 0.2 : 1 - (kt - 0.2) / 0.8; const kdx = mr.pos.x - player.pos.x, kdy = mr.pos.y - player.pos.y; const kd = Math.sqrt(kdx * kdx + kdy * kdy) || 1; kx = (kdx / kd) * 5 * ke; ky = (kdy / kd) * 5 * ke; }
        const dodge = _dodgeAnims.find(d => d.id === mr.id);
        let dOff = 0; if (dodge) { const dEl = (now - dodge.t0) / DODGE_DUR; if (dEl < 1) dOff = dodge.dir * 10 * (dEl < 0.3 ? easeOut(dEl / 0.3) : 1 - easeOut((dEl - 0.3) / 0.7)); }
        let ms = 1;
        const ma = _monsterAtks.find(a => a.id === mr.id);
        if (ma) { const ae2 = (now - ma.t0) / MON_ATK_DUR; if (ae2 < 1) { if (ae2 < 0.2) ms = 1 + 0.2 * easeOut(ae2 / 0.2); else if (ae2 < 0.5) { msx += (ma.tx - ma.x) * 0.2 * easeOut((ae2 - 0.2) / 0.3); msy += (ma.ty - ma.y) * 0.2 * easeOut((ae2 - 0.2) / 0.3); ms = 1.2; } else ms = 1.2 - 0.2 * easeOut((ae2 - 0.5) / 0.5); } }
        const isConf = mr.statuses.some(s => s.type === StatusEffect.Confusion);
        if (isConf) { const ct = now * 0.015; msx += Math.sin(ct + mr.pos.x * 2.1) * 4; msy += Math.sin(ct * 1.3 + mr.pos.y * 1.7) * 2; }
        let ssx = 1;
        if (mr.templateId === 'slime' || mr.templateId === 'split_slime') { const wt = now * 0.005 + mr.pos.x * 0.3; ssx = 1 + Math.sin(wt) * 0.06; ms *= 1 - Math.sin(wt) * 0.06; }
        let fy = 0, fx = 0;
        if (mr.templateId === 'bat') { fy = Math.sin(now * 0.004 + mr.pos.x * 0.5) * 4; fx = Math.sin(now * 0.002 + mr.pos.x * 0.5) * 3; }
        else if (mr.templateId === 'ghost') { fy = Math.sin(now * 0.003 + mr.pos.x * 0.5) * 3; fx = Math.cos(now * 0.002 + mr.pos.y * 0.3) * 2; }
        const isF = mr.templateId === 'bat' || mr.templateId === 'ghost';
        // #2 Monster idle bobbing animation — slight vertical oscillation for all living monsters
        const idleBob = mr.sleeping ? 0 : Math.sin(now * 0.003 + mr.pos.x * 1.1 + mr.pos.y * 0.7) * 1.5;
        msy += idleBob;
        ctx.save(); ctx.globalAlpha = isF ? 0.3 : 0.5; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(msx + dOff + fx, msy + SP / 3 + 1 - idleBob, 11 * ms * (isF ? 0.8 : 1), 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = (isF ? 0.1 : 0.18); ctx.beginPath(); ctx.ellipse(msx + dOff + fx, msy + SP / 3 + 1 - idleBob, 14 * ms, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (ssx !== 1) { ctx.save(); ctx.translate(msx + kx + dOff + fx, msy - fy); ctx.scale(ssx, 1); ctx.translate(-(msx + kx + dOff + fx), -(msy - fy)); }
        if (monImg) {
          const monFlip = mr.pos.x > player.pos.x;
          drawImgEntity(ctx, monImg, msx + kx + dOff + fx, msy + ky - fy, 1.0, now, hitTime, mr.sleeping ? '#000022' : undefined, monFlip, ms);
        } else if (spr) {
          drawEntitySprite(ctx, spr, msx + kx + dOff + fx, msy + ky - fy, 1.0, now, hitTime, mr.sleeping ? '#000022' : undefined, now * 0.0025 + mr.pos.x * 0.3, false, ms);
        }
        if (ssx !== 1) ctx.restore();
        if (mr.hp < mr.maxHp) { const bw = SP - 2, hr = Math.max(0, mr.hp / mr.maxHp), by = msy + SP / 3 + 2; /* #22 Monster name above health bar */ ctx.save(); ctx.globalAlpha = 0.7; ctx.font = '8px var(--font-display,serif)'; ctx.textAlign = 'center'; ctx.fillStyle = '#c0b090'; ctx.fillText(mr.name.length > 6 ? mr.name.slice(0, 6) : mr.name, msx, by - 1); ctx.restore(); ctx.fillStyle = 'rgba(15,8,8,0.85)'; ctx.fillRect(msx - bw / 2, by, bw, 4); ctx.fillStyle = hr > 0.5 ? '#40A050' : hr > 0.25 ? '#A0902A' : '#CC3030'; ctx.fillRect(msx - bw / 2 + 0.5, by + 0.5, (bw - 1) * hr, 3); }
        if (mr.sleeping) { ctx.save(); const bt = (now * 0.002) % 2; const br = 3 + Math.sin(bt * Math.PI) * 2.5; ctx.globalAlpha = bt < 1.8 ? 0.5 : (2 - bt) / 0.2 * 0.5; ctx.strokeStyle = 'rgba(140,180,220,0.6)'; ctx.fillStyle = 'rgba(180,210,240,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(msx + SP / 3, msy - SP / 3, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.font = '700 10px var(--font-display,serif)'; ctx.fillStyle = '#8090c0'; const zp = (now * 0.002) % 3; ctx.fillText('z', msx + SP / 2, msy - SP / 2 + Math.sin(now * 0.004) * 2); if (zp > 1) ctx.fillText('z', msx + SP / 2 + 5, msy - SP / 2 - 5); if (zp > 2) { ctx.font = '700 12px var(--font-display,serif)'; ctx.fillText('Z', msx + SP / 2 + 8, msy - SP / 2 - 12); } ctx.restore(); }
        if (mr.statuses.length > 0) { const sc: Record<string, string> = { poison: '#8a3aaa', confusion: '#aa8a2a', sleep: '#3a5aaa', paralysis: '#aa6a2a', sealed: '#aa2a2a' }; mr.statuses.forEach((s, i) => { ctx.fillStyle = sc[s.type] ?? '#666'; ctx.beginPath(); ctx.arc(msx - SP / 3 + i * 5, msy - SP / 2 - 2, 2, 0, Math.PI * 2); ctx.fill(); }); }
        if (mr.statuses.some(s => s.type === StatusEffect.Poison)) { ctx.save(); for (let pi = 0; pi < 3; pi++) { const pt = (now * 0.002 + pi * 1.3 + mr.pos.x * 0.5) % 2; const pa = pt < 0.3 ? pt / 0.3 : pt < 1.5 ? 1 : (2 - pt) / 0.5; ctx.globalAlpha = pa * 0.25; ctx.fillStyle = '#8040AA'; ctx.beginPath(); ctx.ellipse(msx + Math.sin(now * 0.003 + pi * 2) * 5, msy - SP * 0.2 - pt * 12, 4 + pt * 2, 3 + pt, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
        if (isConf) { ctx.save(); for (let si = 0; si < 3; si++) { const sa = now * 0.006 + si * Math.PI * 2 / 3; ctx.globalAlpha = 0.7; ctx.fillStyle = si % 2 === 0 ? '#FFE060' : '#FFFFFF'; ctx.font = '8px serif'; ctx.fillText('*', msx + dOff + Math.cos(sa) * 10, msy - SP / 2 - 2 + Math.sin(sa * 0.7) * 4); } ctx.restore(); }
      }});
    }

    // Player
    entityDraws.push({ depth: player.pos.y, draw: () => {
      const [psx, psy] = toScr(plX, plY, camXf, camYf);
      const hw = player.equippedWeapon !== null;
      const dir = player.facing;
      const isUp = dir === Direction.Up || dir === Direction.UpLeft || dir === Direction.UpRight;
      const isLeft = dir === Direction.Left || dir === Direction.UpLeft || dir === Direction.DownLeft;
      const playerImg = getPlayerImg(plMoving, now);
      let ps = isUp ? SPRITE_PLAYER_UP : SPRITE_PLAYER_DOWN;
      if (hw && !isUp) ps = SPRITE_PLAYER_ARMED;
      const hr2 = player.satiation / player.maxSatiation;
      const hw2 = hr2 < 0.15 ? Math.sin(now * 0.008) * 3 * (1 - hr2 / 0.15) : 0;
      // Confusion wobble (千鳥足)
      const plConf = player.statuses?.some(s => s.type === StatusEffect.Confusion) ?? false;
      const confWobbleX = plConf ? Math.sin(now * 0.008) * 2 : 0;
      const confWobbleY = plConf ? Math.sin(now * 0.011) * 1 : 0;
      const dx2 = psx + atkOffX + hw2 + confWobbleX, dy2 = psy + atkOffY + confWobbleY;
      ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(psx, psy + SP / 3 + 1, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.ellipse(psx, psy + SP / 3 + 1, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (state.dashActive && plMoving || stairsFade > 0.3) { ctx.save(); ctx.translate(dx2, dy2); if (stairsFade > 0.3) { ctx.rotate(stairsFade * Math.PI * 2); ctx.scale(1 - stairsFade * 0.5, 1 - stairsFade * 0.5); } ctx.translate(-dx2, -dy2); }
      if (playerImg) {
        drawImgEntity(ctx, playerImg, dx2, dy2, 1.0, now, pHitT.current, hpPinch && Math.sin(now * 0.008) > 0.3 ? '#ff2020' : undefined, isLeft);
      } else {
        drawEntitySprite(ctx, ps, dx2, dy2, 1.0, now, pHitT.current, hpPinch && Math.sin(now * 0.008) > 0.3 ? '#ff2020' : undefined, plMoving ? undefined : now * 0.004, isLeft);
      }
      if (state.dashActive && plMoving || stairsFade > 0.3) ctx.restore();
      // Player confusion stars
      if (plConf) { ctx.save(); for (let si2 = 0; si2 < 3; si2++) { const sa2 = now * 0.006 + si2 * Math.PI * 2 / 3; ctx.globalAlpha = 0.7; ctx.fillStyle = si2 % 2 === 0 ? '#FFE060' : '#FFFFFF'; ctx.font = '8px serif'; ctx.fillText('*', dx2 + Math.cos(sa2) * 10, dy2 - SP / 2 - 2 + Math.sin(sa2 * 0.7) * 4); } ctx.restore(); }
      // Shield
      const si = player.inventory.find(i => i.id === player.equippedShield);
      if (si?.category === ItemCategory.Shield) { const sh = si as ShieldItem; const shX = isLeft ? dx2 + SP * 0.2 : dx2 - SP * 0.3, shY = dy2 + 2; ctx.save(); ctx.fillStyle = sh.enhancement >= 5 ? '#5090E0' : '#3060B0'; ctx.strokeStyle = sh.enhancement >= 3 ? '#D4A840' : '#8B6830'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(shX, shY - 5); ctx.lineTo(shX + 4, shY - 2); ctx.lineTo(shX + 4, shY + 3); ctx.lineTo(shX, shY + 6); ctx.lineTo(shX - 4, shY + 3); ctx.lineTo(shX - 4, shY - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#D4A840'; ctx.fillRect(shX - 1, shY - 1, 2, 2); ctx.restore(); }
      // Weapon
      const wpn = player.inventory.find(i => i.id === player.equippedWeapon);
      if (wpn?.category === ItemCategory.Weapon) {
        const w = wpn as WeaponItem, enh = w.enhancement, ws = isLeft ? -1 : 1;
        const wx = dx2 + SP * 0.25 * ws, wy = dy2 - SP * 0.15;
        ctx.save();
        if (atkEl < 0.6 && atkEl > 0) { let sa: number; if (atkEl < 0.25) { sa = -easeOut(atkEl / 0.25) * Math.PI * 0.15; } else if (atkEl < 0.45) { sa = easeOut((atkEl - 0.25) / 0.2) * Math.PI * 0.75 - Math.PI * 0.15; } else { sa = (Math.PI * 0.6) * (1 - easeOut((atkEl - 0.45) / 0.15)); } sa *= ws; ctx.translate(wx, wy + 6); ctx.rotate(sa); ctx.translate(-wx, -(wy + 6)); }
        ctx.strokeStyle = enh >= 8 ? '#FFD060' : enh >= 5 ? '#A0D0FF' : enh >= 3 ? '#D0D8E8' : '#B0B8C8'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(wx, wy + 6); ctx.lineTo(wx + 2 * ws, wy - 8); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(wx + 0.5 * ws, wy + 4); ctx.lineTo(wx + 1.5 * ws, wy - 6); ctx.stroke();
        ctx.strokeStyle = '#D4A840'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(wx - 3 * ws, wy + 6); ctx.lineTo(wx + 4 * ws, wy + 5); ctx.stroke();
        ctx.restore();
        // Afterimage
        if (atkEl < 0.6 && atkEl > 0) { for (let gi = 1; gi <= 3; gi++) { const gt = Math.max(0, atkEl - gi * 0.04); const { dx: adx, dy: ady } = atkDir.current; let gox: number, goy: number; if (gt < 0.12) { const gp = easeOut(gt / 0.12); gox = -adx * 3 * gp * (1 - gi * 0.2); goy = -ady * 3 * gp * (1 - gi * 0.2); } else { const gl = (gt - 0.12) / 0.88; const ge = gl < 0.2 ? easeOut(gl / 0.2) : 1 - easeOut((gl - 0.2) / 0.8); gox = adx * TW * ge * 0.35 * (1 - gi * 0.2); goy = ady * TH * ge * 0.35 * (1 - gi * 0.2); } ctx.save(); ctx.globalAlpha = 0.15 - gi * 0.04; ctx.strokeStyle = '#FFFDE0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(psx + gox + SP * 0.25 * ws, psy + goy - SP * 0.15 + 6); ctx.lineTo(psx + gox + SP * 0.25 * ws + 2 * ws, psy + goy - SP * 0.15 - 8); ctx.stroke(); ctx.restore(); } }
        // Aura
        if (enh >= 2) { const ai = Math.min(0.25, 0.05 + enh * 0.02); const ac = enh >= 8 ? '#FFD060' : enh >= 5 ? '#80C0FF' : '#6090c0'; ctx.save(); ctx.globalAlpha = ai + Math.sin(now * 0.004) * 0.05; ctx.shadowColor = ac; ctx.shadowBlur = 12 + enh * 2; ctx.fillStyle = ac; ctx.beginPath(); ctx.ellipse(dx2, dy2, SP * 0.35, SP * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        if (w.seals.includes(SealType.DragonSlayer)) { ctx.save(); ctx.globalAlpha = 0.1 + Math.sin(now * 0.005) * 0.05; ctx.shadowColor = '#FF4444'; ctx.shadowBlur = 14; ctx.fillStyle = '#FF4444'; ctx.beginPath(); ctx.ellipse(dx2, dy2, SP * 0.3, SP * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }
    }});

    // ============ TILE RENDERING (top-down, row by row) ============
    entityDraws.sort((a, b) => a.depth - b.depth);
    let entityIdx = 0;

    for (let dy = -RANGE; dy <= RANGE; dy++) {
      for (let dx2 = -RANGE; dx2 <= RANGE; dx2++) {
        const mx = Math.round(camXf) + dx2, my = Math.round(camYf) + dy;
        if (mx < 0 || mx >= floor.width || my < 0 || my >= floor.height) continue;
        const alpha = lA(mx, my); if (alpha <= 0) continue;
        const [sx, sy] = toScr(mx, my, camXf, camYf);
        if (sx < -TW * 2 || sx > CW + TW * 2 || sy < -TH * 2 || sy > CH + TH * 2) continue;
        const tile = floor.tiles[my]?.[mx];
        const expOnly = !!floor.explored[my]?.[mx] && !floor.visible[my]?.[mx];
        if (tile === TileType.Wall) {
          drawWallTile(ctx, sx, sy, mx, my, alpha, now);
          if (expOnly) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(sx - TW / 2, sy - TH / 2, TW, TH); ctx.restore(); }
        } else {
          drawFloorTile(ctx, sx, sy, mx, my, alpha, tile === TileType.Corridor);
          if (expOnly) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(sx - TW / 2, sy - TH / 2, TW, TH); ctx.restore(); }
          if (tile === TileType.StairsDown) {
            const stairsImg = imageCache['floor_stairs'];
            if (stairsImg && stairsImg.naturalWidth > 0) {
              ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
              ctx.drawImage(stairsImg, sx - TW / 2, sy - TH / 2, TW, TH); ctx.restore();
            } else { drawEntitySprite(ctx, SPRITE_STAIRS, sx, sy, alpha, now, 0); }
            if (floor.visible[my]?.[mx]) { ctx.save(); ctx.globalAlpha = 0.2 + Math.sin(now * 0.002) * 0.08; ctx.fillStyle = '#D4A840'; ctx.shadowColor = '#F0D060'; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
          }
          if (tile === TileType.Trap) {
            const trap = floor.traps.find(t => t.pos.x === mx && t.pos.y === my);
            if (trap?.visible && floor.visible[my]?.[mx]) {
              // #9 Trap reveal animation — pulsing glow when trap becomes visible
              const trapGlowPhase = Math.sin(now * 0.005 + mx * 2.1 + my * 1.3) * 0.5 + 0.5;
              ctx.save();
              ctx.globalAlpha = 0.15 + trapGlowPhase * 0.12;
              ctx.fillStyle = '#FF8844';
              ctx.shadowColor = '#FF8844';
              ctx.shadowBlur = 10 + trapGlowPhase * 8;
              ctx.beginPath(); ctx.arc(sx, sy, 12 + trapGlowPhase * 4, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
              const sfi = Math.floor((now / 1000 * 4) % 4);
              const spikeImg = imageCache[`spikes_${sfi}`];
              if (spikeImg && spikeImg.naturalWidth > 0) {
                ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
                ctx.drawImage(spikeImg, sx - TW / 2, sy - TH / 2, TW, TH); ctx.restore();
              } else { drawEntitySprite(ctx, SPRITE_TRAP, sx, sy, alpha, now, 0); }
            }
          }
        }
      }
      while (entityIdx < entityDraws.length && entityDraws[entityIdx].depth <= Math.round(camYf) + dy) { entityDraws[entityIdx].draw(); entityIdx++; }
    }
    while (entityIdx < entityDraws.length) { entityDraws[entityIdx].draw(); entityIdx++; }

    // ============ FLOOR THEME OVERLAY (depth-based color tint) ============
    const floorTheme = getFloorTheme(state.floorNumber);
    if (floorTheme.tint !== 'none') {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = floorTheme.overlay;
      ctx.fillRect(-8, -8, CW + 16, CH + 16);
      ctx.restore();
    }

    // ============ CORRIDOR ATMOSPHERE (claustrophobic vignette) ============
    // #28 Corridor darkness gradient: corridors get darker further from player
    const playerTile = floor.tiles[player.pos.y]?.[player.pos.x];
    if (playerTile === TileType.Corridor) {
      ctx.save();
      const corrVig = ctx.createRadialGradient(CW / 2, CH / 2, lR * 0.03, CW / 2, CH / 2, lR * 0.35);
      corrVig.addColorStop(0, 'rgba(0,0,0,0)');
      corrVig.addColorStop(0.3, 'rgba(0,0,0,0.1)');
      corrVig.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      corrVig.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = corrVig;
      ctx.fillRect(-8, -8, CW + 16, CH + 16);
      ctx.restore();
    }

    // ============ POST-PROCESSING (PS2 CRT PIPELINE) ============
    const plSx = CW / 2, plSy = CH / 2;
    // 1. Primary torch vignette (multiply) — 30% heavier than before
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const vig = ctx.createRadialGradient(plSx, plSy, lR * 0.08, plSx, plSy, lR * 0.85);
    vig.addColorStop(0, 'rgba(255,255,255,1)'); vig.addColorStop(0.15, 'rgba(245,235,210,1)'); vig.addColorStop(0.35, 'rgba(180,140,80,1)'); vig.addColorStop(0.55, 'rgba(80,50,22,1)'); vig.addColorStop(0.75, 'rgba(25,16,8,1)'); vig.addColorStop(1, 'rgba(4,3,2,1)');
    ctx.fillStyle = vig; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
    // 2. Warm center glow (screen blend)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const wm = ctx.createRadialGradient(plSx, plSy, 0, plSx, plSy, lR * 0.3); wm.addColorStop(0, 'rgba(255,190,90,0.07)'); wm.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = wm; ctx.fillRect(0, 0, CW, CH); ctx.restore();
    // 3. Bloom pass (soft glow from bright areas)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.04; ctx.filter = 'blur(10px)'; ctx.drawImage(canvas, 0, 0); ctx.filter = 'none'; ctx.restore();
    // 4. Color grade — cool blue-grey push (Torneko 3 stone palette)
    ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = 0.02; ctx.fillStyle = '#708090'; ctx.fillRect(0, 0, CW, CH); ctx.restore();
    // 5. Secondary vignette (crush blacks at edges)
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.3;
    const cv = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.18, CW / 2, CH / 2, CW * 0.52);
    cv.addColorStop(0, 'rgba(255,255,255,1)'); cv.addColorStop(0.5, 'rgba(200,195,185,1)'); cv.addColorStop(1, 'rgba(60,50,40,1)');
    ctx.fillStyle = cv; ctx.fillRect(0, 0, CW, CH); ctx.restore();
    // 6. Film grain (animated)
    { const gc = getGrain(); ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.04; const ox = (now * 0.07) % 128, oy = (now * 0.05 + 40) % 128; for (let gx = -128; gx < CW + 128; gx += 128) for (let gy = -128; gy < CH + 128; gy += 128) ctx.drawImage(gc, gx + ox, gy + oy); ctx.restore(); }
    // 7. Scanlines (CRT horizontal bands — more visible)
    { const sl = getScanlines(); ctx.save(); ctx.globalCompositeOperation = 'multiply'; const pat = ctx.createPattern(sl, 'repeat'); if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, CW, CH); } ctx.restore(); }
    // 8. Chromatic aberration (RGB channel split — stronger offset)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.025; ctx.drawImage(canvas, -2.5, 0.3, CW, CH); // red channel shift left
    ctx.globalAlpha = 0.018; ctx.drawImage(canvas, 2.5, -0.3, CW, CH); // blue channel shift right
    ctx.restore();
    // 9. Dust motes (floating particles in torch light)
    ctx.save(); for (let i = 0; i < 30; i++) { const s = i * 7919, per = 5500 + (s % 3000); const ph = ((now + s * 100) % per) / per; const ddx = (s * 3) % CW + Math.sin(now * 0.0007 + i) * 22, ddy = (s * 7) % CH - ph * 120; const da = ph < 0.15 ? ph / 0.15 : ph > 0.8 ? (1 - ph) / 0.2 : 1; const dd = Math.sqrt((ddx - plSx) ** 2 + (ddy - plSy) ** 2); if (dd > 250) continue; ctx.globalAlpha = da * 0.25 * Math.max(0, 1 - dd / 250); ctx.fillStyle = '#C8B880'; ctx.fillRect(ddx, ddy, 1.5, 1.5); } ctx.restore();

    // ============ VFX OVERLAYS ============
    _slashArcs = _slashArcs.filter(sa => { const el = now - sa.t0; if (el > SLASH_DUR) return false; const t = el / SLASH_DUR; ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = sa.color; ctx.lineWidth = 3.5 * (1 - t); ctx.shadowColor = sa.color; ctx.shadowBlur = 15; ctx.beginPath(); const sA = sa.angle - Math.PI * 0.7; ctx.arc(sa.x, sa.y, 16 + t * 14, sA, sA + Math.PI * 1.4 * easeOut(t) * sa.dir); ctx.stroke(); ctx.globalAlpha = (1 - t) * 0.5; ctx.lineWidth = 1.5; ctx.strokeStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sa.x, sa.y, 14 + t * 14, sA, sA + Math.PI * 1.2 * easeOut(t) * sa.dir); ctx.stroke(); ctx.restore(); return true; });
    _deathFxList = _deathFxList.filter(df => {
      const el = now - df.t0; if (el > DEATH_FX_DUR_EXT) return false;
      const t = el / DEATH_FX_DUR_EXT;
      // Initial white flash at death point
      if (t < 0.08) {
        ctx.save(); ctx.globalAlpha = (1 - t / 0.08) * 0.5;
        ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(df.x, df.y, 18 + t * 40, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Ascending light pillar (faint)
      if (t > 0.05 && t < 0.7) {
        const pt = (t - 0.05) / 0.65;
        ctx.save(); ctx.globalAlpha = (1 - pt) * 0.12;
        const pg = ctx.createLinearGradient(df.x, df.y - 120 * pt, df.x, df.y + 10);
        pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(0.4, 'rgba(255,240,200,0.5)');
        pg.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = pg; ctx.fillRect(df.x - 6, df.y - 120 * pt, 12, 120 * pt + 10);
        ctx.restore();
      }
      // Particles
      for (const p of df.particles) {
        const pe = el - p.delay; if (pe < 0) continue;
        const pt2 = pe / (DEATH_FX_DUR_EXT - p.delay);
        if (pt2 > 1) continue;
        const fadeIn = Math.min(1, pe / 80);
        const fadeOut = pt2 > 0.6 ? 1 - (pt2 - 0.6) / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut * 0.85;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 6;
        const px2 = df.x + p.ox + p.vx * pe * 0.012 + Math.sin(pe * 0.008 + p.ox) * 3;
        const py2 = df.y + p.oy + p.vy * pe * 0.014;
        const sz = p.size * (1 - pt2 * 0.5) * fadeIn;
        ctx.beginPath(); ctx.arc(px2, py2, sz, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      return true;
    });
    const EXP_ORB_DUR = 600;
    _expOrbs = _expOrbs.filter(orb => { const el = now - orb.t0 - orb.delay; if (el < 0) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = orb.color; ctx.shadowColor = orb.color; ctx.shadowBlur = 6; ctx.fillRect(orb.x - 1.5, orb.y - 1.5, 3, 3); ctx.restore(); return true; } if (el > EXP_ORB_DUR) return false; const t = el / EXP_ORB_DUR; const et = easeInOut(t); const ox2 = orb.x + (orb.tx - orb.x) * et, oy2 = orb.y + (orb.ty - orb.y) * et - Math.sin(t * Math.PI) * 20; ctx.save(); ctx.globalAlpha = (1 - t * 0.6) * 0.8; ctx.fillStyle = orb.color; ctx.shadowColor = orb.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(ox2, oy2, 2.5 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill(); ctx.restore(); return true; });
    _dustPuffs = _dustPuffs.filter(dp => { const el = now - dp.t0; if (el > 350) return false; const t = el / 350; ctx.save(); ctx.globalAlpha = (1 - t) * 0.2; ctx.fillStyle = 'rgba(160,140,100,0.5)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(dp.x + (i - 1) * 5 + Math.sin(el * 0.01 + i) * 3, dp.y - t * 6, 2 + t * 4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); return true; });
    _lightningBolts = _lightningBolts.filter(lb => { const el = now - lb.t0; if (el > 250) return false; const t = el / 250; ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = '#FFE8FF'; ctx.lineWidth = 2; ctx.shadowColor = '#A060FF'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.moveTo(lb.x, lb.y - 50); let ly = lb.y - 50; for (let s = 0; s < 5; s++) { ly += 10; ctx.lineTo(lb.x + (Math.random() - 0.5) * 16, ly); } ctx.lineTo(lb.x, lb.y); ctx.stroke(); if (t < 0.15) { ctx.globalAlpha = (1 - t / 0.15) * 0.3; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, CW, CH); } ctx.restore(); return true; });
    _alertMarks = _alertMarks.filter(am => { const el = now - am.t0; if (el > ALERT_DUR) return false; const t = el / ALERT_DUR; const scT = t < 0.15 ? easeOutBack(t / 0.15) : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; ctx.save(); ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1; ctx.translate(am.x, am.y + (t < 0.15 ? (1 - t / 0.15) * -8 : 0)); ctx.scale(scT, scT); ctx.font = 'bold 16px var(--font-display,serif)'; ctx.textAlign = 'center'; ctx.fillStyle = '#FF4444'; ctx.shadowColor = '#FF4444'; ctx.shadowBlur = 10; ctx.fillText('!', 0, 0); ctx.restore(); return true; });
    _groundFlashes = _groundFlashes.filter(gf => { const el = now - gf.t0; if (el > 200) return false; const t = el / 200; ctx.save(); ctx.globalAlpha = (1 - t) * 0.35; ctx.fillStyle = gf.color; ctx.beginPath(); ctx.arc(gf.x, gf.y, 15 + t * 10, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return true; });
    _splitBursts = _splitBursts.filter(sb => { const el = now - sb.t0; if (el > 500) return false; const t = el / 500; ctx.save(); ctx.globalAlpha = (1 - t) * 0.5; ctx.strokeStyle = 'rgba(100,230,130,0.6)'; ctx.lineWidth = 3 * (1 - t); ctx.beginPath(); ctx.arc(sb.x, sb.y, 12 + t * 25, 0, Math.PI * 2); ctx.stroke(); if (t < 0.2) { ctx.globalAlpha = (1 - t / 0.2) * 0.4; ctx.fillStyle = '#AAFFAA'; ctx.beginPath(); ctx.arc(sb.x, sb.y, 10, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); return true; });
    _dodgeAnims = _dodgeAnims.filter(d => now - d.t0 < DODGE_DUR);
    _monsterAtks = _monsterAtks.filter(a => now - a.t0 < MON_ATK_DUR);
    _impactParticles = _impactParticles.filter(p => { p.life -= 16; if (p.life <= 0) return false; p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.96; ctx.save(); ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 4; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.restore(); return true; });
    _shockwaves = _shockwaves.filter(sw => { const el = now - sw.t0; if (el > 300) return false; const t = el / 300; ctx.save(); ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = sw.color; ctx.lineWidth = 2.5 * (1 - t); ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.maxR * easeOut(t), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); return true; });
    _trapSparks = _trapSparks.filter(ts => { const el = now - ts.t0; if (el > 400) return false; const [tsx, tsy] = toScr(ts.x, ts.y, camXf, camYf); const t = el / 400; ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.fillStyle = 'rgba(180,160,120,0.3)'; ctx.beginPath(); ctx.arc(tsx, tsy - t * 12, 6 + t * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return true; });

    // ============ TRAP ACTIVATION FX ============
    const TRAP_FX_DUR = 500;
    _trapFxList = _trapFxList.filter(tf => {
      const el = now - tf.startTime; if (el > TRAP_FX_DUR) return false;
      const t = el / TRAP_FX_DUR;
      const [tfx, tfy] = toScr(tf.pos.x, tf.pos.y, camXf, camYf);
      // Smoke particles (gray, rising)
      for (const p of tf.particles) {
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(tfx + p.ox + p.vx * el * 0.01, tfy + p.oy + p.vy * el * 0.01 - t * 15, 2 + t * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Explosion flash at start
      if (t < 0.15) {
        ctx.save(); ctx.globalAlpha = (1 - t / 0.15) * 0.5;
        ctx.fillStyle = tf.type === 'landmine' ? '#FFAA40' : '#FFDD80';
        ctx.shadowColor = '#FFAA40'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(tfx, tfy, 14 + t * 20, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      return true;
    });

    // ============ STAFF BULLET FX ============
    if (_staffBullet && _staffBullet.active) {
      const sbEl = now - _staffBullet.startTime;
      const STAFF_BULLET_DUR = 500;
      if (sbEl > STAFF_BULLET_DUR) { _staffBullet.active = false; _staffBullet = null; }
      else {
        const sbt = sbEl / STAFF_BULLET_DUR;
        const dv = DIR_VECTORS[_staffBullet.dir];
        const bx = _staffBullet.startPos.x + dv.x * sbt * 6;
        const by = _staffBullet.startPos.y + dv.y * sbt * 6;
        const [sbsx, sbsy] = toScr(bx, by, camXf, camYf);
        // Magic bullet orb
        ctx.save();
        ctx.globalAlpha = (1 - sbt * 0.5) * 0.9;
        ctx.fillStyle = _staffBullet.color;
        ctx.shadowColor = _staffBullet.color;
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(sbsx, sbsy, 4 + Math.sin(now * 0.02) * 1, 0, Math.PI * 2); ctx.fill();
        // Inner bright core
        ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = (1 - sbt) * 0.6;
        ctx.beginPath(); ctx.arc(sbsx, sbsy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Trail particles
        _staffBullet.trail.push({ x: sbsx, y: sbsy, t: now });
        _staffBullet.trail = _staffBullet.trail.filter(tp => {
          const te = now - tp.t; if (te > 200) return false;
          ctx.save(); ctx.globalAlpha = (1 - te / 200) * 0.4;
          ctx.fillStyle = _staffBullet!.color;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 2 * (1 - te / 200), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          return true;
        });
      }
    }

    // ============ ITEM DROP ANIM ============
    const ITEM_DROP_DUR = 300;
    _itemDropAnims = _itemDropAnims.filter(ida => {
      const el = now - ida.startTime; if (el > ITEM_DROP_DUR) return false;
      const t = el / ITEM_DROP_DUR;
      const et2 = easeOut(t);
      const ix = ida.startPos.x + (ida.endPos.x - ida.startPos.x) * et2;
      const iy = ida.startPos.y + (ida.endPos.y - ida.startPos.y) * et2;
      const arcH = -Math.sin(t * Math.PI) * 1.5; // parabolic arc in tile units
      const [isx2, isy2] = toScr(ix, iy + arcH, camXf, camYf);
      // Draw shadow at ground level
      const [_, gsy] = toScr(ix, iy, camXf, camYf);
      ctx.save(); ctx.globalAlpha = 0.2 * (1 - Math.abs(arcH));
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(isx2, gsy + 4, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Draw item dot at arc position
      ctx.save(); ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#FFE880'; ctx.shadowColor = '#FFE880'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(isx2, isy2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return true;
    });

    // ============ LEVEL UP PARTICLES ============
    _levelUpParticles = _levelUpParticles.filter(lp => {
      lp.life -= 16; if (lp.life <= 0) return false;
      lp.x += lp.vx; lp.y += lp.vy;
      ctx.save(); ctx.globalAlpha = (lp.life / lp.maxLife) * 0.7;
      ctx.fillStyle = '#F0D060'; ctx.shadowColor = '#FFE880'; ctx.shadowBlur = 6;
      ctx.fillRect(plSx + lp.x - lp.size / 2, plSy + lp.y - lp.size / 2, lp.size, lp.size);
      ctx.restore();
      return true;
    });

    // ============ POPUPS ============
    const POP_LIFE = 1200, GRAV = 0.085;
    popRef.current = popRef.current.filter(p => now - p.t0 < POP_LIFE);
    for (const p of popRef.current) {
      const el = now - p.t0, t = el / POP_LIFE, f = el / 16;
      const ppx = p.x + p.vx * f, ppy = p.y + p.vy * f + 0.5 * GRAV * f * f;
      let sc: number; if (t < 0.06) sc = easeOutBack(t / 0.06) * 1.4; else if (t < 0.15) sc = 1.4 - (t - 0.06) / 0.09 * 0.4; else if (t > 0.7) sc = 1 - (t - 0.7) / 0.3; else sc = 1;
      ctx.save(); ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1; ctx.translate(ppx, ppy); ctx.scale(sc, sc);
      const isExp = p.text.includes('Exp'); const fs = p.size ?? (isExp ? 13 : 17);
      ctx.font = `bold ${fs}px var(--font-display,serif)`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.9)'; for (let ox = -1.5; ox <= 1.5; ox += 1.5) for (let oy = -1.5; oy <= 1.5; oy += 1.5) { if (ox === 0 && oy === 0) continue; ctx.fillText(p.text, ox, oy); }
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = isExp ? 8 : 14; ctx.fillText(p.text, 0, 0); ctx.restore();
    }

    // ============ SCREEN OVERLAYS ============
    if (damageFlash > 0) { ctx.save(); ctx.globalAlpha = damageFlash * 0.22; ctx.fillStyle = '#CC2020'; ctx.fillRect(-8, -8, CW + 16, CH + 16); const bg = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.6); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, `rgba(160,20,20,${damageFlash * 0.3})`); ctx.fillStyle = bg; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore(); }
    if (criticalFlash > 0) { ctx.save(); ctx.globalAlpha = criticalFlash * 0.55; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore(); }
    const hr = player.satiation / player.maxSatiation;
    if (hr < 0.2) { const pulse = Math.sin(now * 0.004) * 0.5 + 0.5; ctx.save(); ctx.globalAlpha = (1 - hr / 0.2) * pulse * 0.35; const hg = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.3, CW / 2, CH / 2, CW * 0.55); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, `rgba(180,20,20,${0.6 + pulse * 0.3})`); ctx.fillStyle = hg; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore(); }
    if (hpPinch) { const pp = Math.sin(now * 0.006) * 0.5 + 0.5; ctx.save(); ctx.globalAlpha = pp * 0.25; const pg = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.2, CW / 2, CH / 2, CW * 0.52); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(0.6, 'rgba(180,20,20,0.15)'); pg.addColorStop(1, `rgba(200,10,10,${0.5 + pp * 0.4})`); ctx.fillStyle = pg; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore(); if (Math.sin(now * 0.008) > 0.95) { ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#CC2020'; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore(); } }
    if (levelUpEffect > 0) { ctx.save(); ctx.globalAlpha = levelUpEffect * 0.18; const rg = ctx.createRadialGradient(plSx, plSy, 0, plSx, plSy, 200); rg.addColorStop(0, '#F0D060'); rg.addColorStop(0.5, '#D4A840'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, CW, CH); ctx.save(); ctx.translate(plSx, plSy); ctx.rotate(now * 0.002); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = levelUpEffect * 0.35; ctx.strokeStyle = '#F0D060'; ctx.lineWidth = 1.5; for (let r = 20; r <= 50; r += 30) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); } for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.stroke(); } ctx.restore(); for (let i = 0; i < 28; i++) { const ang = (now * 0.003 + i * 0.224) % (Math.PI * 2); const r = 30 + i * 3 + Math.sin(now * 0.005 + i) * 14; ctx.globalAlpha = levelUpEffect * (0.5 + Math.sin(now * 0.01 + i) * 0.2); ctx.fillStyle = i % 3 === 0 ? '#F0D060' : '#D4A840'; ctx.fillRect(plSx + Math.cos(ang) * r - 1, plSy + Math.sin(ang) * r - (now * 0.02 + i * 3) % 40 - 1, 2.5, 2.5); } ctx.restore(); }
    if (_levelUpLines.length > 0) { const rlEl = now - _levelUpT0; if (rlEl < 800) { const rlT = rlEl / 800; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const line of _levelUpLines) { const lt = easeOut(Math.min(1, rlT * 2)); const ft = rlT > 0.5 ? 1 - (rlT - 0.5) / 0.5 : 1; const dist = line.speed * rlEl * 0.15; ctx.globalAlpha = ft * 0.5; ctx.strokeStyle = line.color; ctx.lineWidth = 2; ctx.shadowColor = line.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(plSx + Math.cos(line.angle) * dist, plSy + Math.sin(line.angle) * dist); ctx.lineTo(plSx + Math.cos(line.angle) * (dist + line.len * lt), plSy + Math.sin(line.angle) * (dist + line.len * lt)); ctx.stroke(); } ctx.restore();
      // Pulsing light pillar (3 pulses)
      const pulsePhase = (rlEl / 800) * 3; // 3 pulses over duration
      const pulseAlpha = Math.sin(pulsePhase * Math.PI) * 0.5 + 0.2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulseAlpha * (1 - rlT);
      const pillarGrad = ctx.createLinearGradient(plSx, plSy - 200, plSx, plSy + 20);
      pillarGrad.addColorStop(0, 'rgba(240,208,96,0)'); pillarGrad.addColorStop(0.3, 'rgba(240,208,96,0.4)');
      pillarGrad.addColorStop(0.7, 'rgba(255,232,128,0.6)'); pillarGrad.addColorStop(1, 'rgba(240,208,96,0)');
      ctx.fillStyle = pillarGrad;
      ctx.fillRect(plSx - 8, plSy - 200, 16, 220);
      // Outer glow
      ctx.globalAlpha = pulseAlpha * (1 - rlT) * 0.4;
      ctx.fillRect(plSx - 16, plSy - 180, 32, 200);
      ctx.restore();
    } else _levelUpLines = []; }
    if (deathSlowmo) {
      // Gradual desaturation over 1 second
      const deathEl = Math.min(1, (rawNow - (hitStopUntil.current - HIT_STOP_DUR)) / 1000);
      const deathSat = 0.3 + deathEl * 0.5;
      ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = deathSat; ctx.fillStyle = '#808080'; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
      // Dark vignette intensifies
      ctx.save(); ctx.globalAlpha = deathEl * 0.3;
      const dvg = ctx.createRadialGradient(CW / 2, CH / 2, 50, CW / 2, CH / 2, CW * 0.5);
      dvg.addColorStop(0, 'rgba(0,0,0,0)'); dvg.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = dvg; ctx.fillRect(-8, -8, CW + 16, CH + 16); ctx.restore();
    }
    if (stairsFade > 0) { ctx.save(); ctx.fillStyle = '#000'; const maxR = Math.sqrt(CW * CW + CH * CH) / 2; const r = stairsFade > 0.5 ? maxR * (1 - (stairsFade - 0.5) / 0.5) : maxR * (1 - stairsFade / 0.5); ctx.beginPath(); ctx.rect(-8, -8, CW + 16, CH + 16); ctx.arc(CW / 2, CH / 2, Math.max(0, r), 0, Math.PI * 2, true); ctx.fill(); ctx.restore(); }

    // #8 Experience bar on screen — thin yellow bar at bottom of dungeon view
    {
      const expPct = player.expToNext > 0 ? Math.min(1, player.exp / player.expToNext) : 0;
      const barY = CH - 4;
      const barW = CW * expPct;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#1a1a10';
      ctx.fillRect(0, barY, CW, 4);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#D4A840';
      ctx.fillRect(0, barY, barW, 3);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#FFE880';
      ctx.fillRect(0, barY, barW, 1);
      ctx.restore();
    }

    // #19 Floor number display (large semi-transparent in corner)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.font = 'bold 28px var(--font-display,serif)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c0b890';
    ctx.fillText(`B${state.floorNumber}F`, CW - 16, 12);
    ctx.globalAlpha = 0.08;
    ctx.font = 'bold 32px var(--font-display,serif)';
    ctx.fillText(`B${state.floorNumber}F`, CW - 15, 11);
    ctx.restore();

    // #24 Room entry notification
    if (roomEntryMsg.current) {
      const rmEl = rawNow - roomEntryMsg.current.t0;
      if (rmEl < 1500) {
        const rmT = rmEl / 1500;
        const rmAlpha = rmT < 0.1 ? rmT / 0.1 : rmT > 0.7 ? 1 - (rmT - 0.7) / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = rmAlpha * 0.7;
        ctx.font = '13px var(--font-display,serif)';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c0b890';
        ctx.fillText(roomEntryMsg.current.text, CW / 2, CH * 0.15);
        ctx.restore();
      } else {
        roomEntryMsg.current = null;
      }
    }

    // #30 Stairs discovery message
    if (stairsMsg.current) {
      const smEl = rawNow - stairsMsg.current.t0;
      if (smEl < 2000) {
        const smT = smEl / 2000;
        const smAlpha = smT < 0.1 ? smT / 0.1 : smT > 0.7 ? 1 - (smT - 0.7) / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = smAlpha * 0.85;
        ctx.font = 'bold 15px var(--font-display,serif)';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F0D060';
        ctx.shadowColor = '#F0D060';
        ctx.shadowBlur = 10;
        ctx.fillText(stairsMsg.current.text, CW / 2, CH * 0.12);
        ctx.restore();
      } else {
        stairsMsg.current = null;
      }
    }

    // #29 Death animation: player sprite fades with red particles
    if (deathSlowmo) {
      const deathParticleT = Math.min(1, (rawNow - (hitStopUntil.current - HIT_STOP_DUR)) / 2000);
      if (deathParticleT > 0.2) {
        ctx.save();
        for (let dp = 0; dp < 8; dp++) {
          const dpPhase = deathParticleT * 3 + dp * 0.7;
          const dpLife = (dpPhase % 2) / 2;
          if (dpLife < 0.9) {
            const dpx = CW / 2 + Math.sin(dp * 2.7 + rawNow * 0.002) * 15 * dpLife;
            const dpy = CH / 2 - dpLife * 30 + Math.sin(dp * 1.3) * 5;
            ctx.globalAlpha = (0.9 - dpLife) * 0.5;
            ctx.fillStyle = dp % 3 === 0 ? '#ff2020' : dp % 3 === 1 ? '#cc1010' : '#ff6040';
            ctx.beginPath(); ctx.arc(dpx, dpy, 2 + (1 - dpLife) * 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    ctx.restore();
    aRef.current = requestAnimationFrame(render);
  }, [player, floor, screenShake, damageFlash, levelUpEffect, criticalFlash, stairsFade, deathSlowmo, iW, drawFloorTile, drawWallTile, drawEntitySprite, hpPinch, state.dashActive]);

  // アセットロード完了まで描画ループを起動しない
  useEffect(() => {
    if (!assetsLoaded) return;
    aRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(aRef.current);
  }, [render, assetsLoaded]);

  if (!assetsLoaded) {
    return (
      <div style={{ width: CW, height: CH, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0e', color: '#8090a0', fontFamily: 'serif', fontSize: 18 }}>
        Loading...
      </div>
    );
  }

  return (
    <canvas ref={cRef} className="torch-flicker"
      style={{ width: CW, height: CH, imageRendering: 'pixelated', borderRadius: '2px',
        boxShadow: '0 0 40px rgba(0,0,0,0.7)' }}
    />
  );
}
