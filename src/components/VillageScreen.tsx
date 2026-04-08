'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameAction, GameItem, ItemCategory, Direction, DIR_VECTORS, WeaponItem, ShieldItem } from '@/types/game';
import { saveGame } from '@/engine/saveLoad';
import { sfxMenuSelect, sfxMenuMove, sfxFootstep, sfxPickup } from '@/engine/audio';
import { VTile, TILE_COLORS, getAllVillageMaps, isVillageWalkable, VillageNPC, SecretSpot, BuildingEntry, getSeasonalFlowerColors, generateShopInventory, getWeaponShopPool, getItemShopPool, getTrainingCost, getBlacksmithCost, getFortuneTellerHint, getMuseumStats, DynamicShopItem } from '@/engine/village';
import { ITEM_TEMPLATES } from '@/engine/data/items';
import TouchControls from './TouchControls';
import { GamePhase, MenuMode } from '@/types/game';

// Responsive scaling hook for mobile — zoom into center for bigger game view
function useVillageScale(baseW: number, baseH: number) {
  const [info, setInfo] = useState({ scale: 1, isMobile: false, gameH: baseH, vw: baseW });
  useEffect(() => {
    function calc() {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const isMobile = vw <= 840 || ('ontouchstart' in window);
      if (!isMobile) {
        setInfo({ scale: Math.min(vw / baseW, vh / baseH, 1), isMobile: false, gameH: baseH, vw });
      } else {
        const targetH = vh * 0.58;
        const s = targetH / baseH;
        setInfo({ scale: s, isMobile: true, gameH: Math.floor(targetH), vw });
      }
    }
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    window.visualViewport?.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('orientationchange', calc);
      window.visualViewport?.removeEventListener('resize', calc);
    };
  }, [baseW, baseH]);
  return info;
}

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

// ================================================================
//  Constants
// ================================================================
const TW = 24;
const TH = 24;
const CW = 800;
const CH = 600;
const F = '/assets/0x72_DungeonTilesetII_v1.7/frames/';

// ================================================================
//  Shop Data
// ================================================================
interface ShopItem {
  templateId: string;
  name: string;
  price: number;
  description: string;
}

// #13: Dynamic shop inventory - generated from village.ts pools
// Static fallbacks removed; now generated per-visit via seed

function getItemSellPrice(item: GameItem): number {
  const basePrices: Record<string, number> = {
    'wooden_sword': 250, 'bronze_sword': 750, 'iron_sword': 1500,
    'katana': 3000, 'steel_sword': 2000,
    'wooden_shield': 200, 'bronze_shield': 400, 'iron_shield': 600,
    'steel_shield': 1000,
    'heal_herb': 50, 'big_heal_herb': 100, 'life_herb': 300,
    'strength_herb': 200, 'antidote_herb': 75,
    'riceball': 50, 'big_riceball': 100, 'special_riceball': 250,
    'identify_scroll': 150, 'powerup_scroll': 200,
    'knockback_staff': 150, 'slow_staff': 200, 'paralysis_staff': 300,
  };
  return basePrices[item.templateId] || 50;
}

// ================================================================
//  Sprite loading
// ================================================================
const _villageImgCache: Record<string, HTMLImageElement> = {};
let _villageAssetsLoaded = false;

function loadVillageAssets(cb: () => void) {
  if (_villageAssetsLoaded) { cb(); return; }
  // Character sprites - idle_anim (humanoid) vs _anim (non-humanoid)
  const idleSprites = [
    'knight_m', 'knight_f', 'elf_m', 'elf_f', 'dwarf_m', 'dwarf_f',
    'wizzard_m', 'wizzard_f', 'lizard_m', 'lizard_f',
    'orc_warrior', 'masked_orc', 'ogre', 'doc', 'angel',
  ];
  const animSprites = ['tiny_zombie'];
  const paths: Record<string, string> = {};
  for (const s of idleSprites) {
    for (let i = 0; i < 4; i++) {
      paths[`${s}_${i}`] = `${F}${s}_idle_anim_f${i}.png`;
    }
  }
  for (const s of animSprites) {
    for (let i = 0; i < 4; i++) {
      paths[`${s}_${i}`] = `${F}${s}_anim_f${i}.png`;
    }
  }

  // Tile images
  const tileAssets: Record<string, string> = {
    'tile_floor_1': `${F}floor_1.png`,
    'tile_floor_2': `${F}floor_2.png`,
    'tile_floor_3': `${F}floor_3.png`,
    'tile_floor_4': `${F}floor_4.png`,
    'tile_wall_mid': `${F}wall_mid.png`,
    'tile_wall_top': `${F}wall_top_mid.png`,
    'tile_wall_left': `${F}wall_left.png`,
    'tile_wall_right': `${F}wall_right.png`,
    'tile_door_closed': `${F}doors_leaf_closed.png`,
    'tile_door_open': `${F}doors_leaf_open.png`,
    'tile_door_frame_left': `${F}doors_frame_left.png`,
    'tile_door_frame_right': `${F}doors_frame_right.png`,
    'tile_door_frame_top': `${F}doors_frame_top.png`,
    'tile_column': `${F}column.png`,
    'tile_crate': `${F}crate.png`,
    'tile_chest_full': `${F}chest_full_open_anim_f0.png`,
    'tile_chest_empty': `${F}chest_empty_open_anim_f0.png`,
    'tile_skull': `${F}skull.png`,
    'tile_stairs': `${F}floor_stairs.png`,
    'tile_wall_banner_blue': `${F}wall_banner_blue.png`,
    'tile_wall_banner_red': `${F}wall_banner_red.png`,
    'tile_wall_hole': `${F}wall_hole_1.png`,
    'tile_wall_fountain_top': `${F}wall_fountain_top_1.png`,
    'tile_weapon_sword': `${F}weapon_regular_sword.png`,
    'tile_weapon_shield': `${F}weapon_knight_sword.png`,
    'tile_flask_green': `${F}flask_green.png`,
    'tile_flask_blue': `${F}flask_blue.png`,
    'tile_flask_red': `${F}flask_red.png`,
    'tile_coin': `${F}coin_anim_f0.png`,
  };
  for (const [key, src] of Object.entries(tileAssets)) {
    paths[key] = src;
  }

  const keys = Object.keys(paths);
  let loaded = 0;
  for (const key of keys) {
    const img = new Image();
    img.onload = img.onerror = () => {
      _villageImgCache[key] = img;
      loaded++;
      if (loaded >= keys.length) { _villageAssetsLoaded = true; cb(); }
    };
    img.src = paths[key];
  }
}

function getSpriteFrame(baseName: string, now: number): HTMLImageElement | null {
  const fi = Math.floor((now / 200) % 4);
  const img = _villageImgCache[`${baseName}_${fi}`];
  return img && img.naturalWidth > 0 ? img : null;
}

function getTileImg(key: string): HTMLImageElement | null {
  const img = _villageImgCache[key];
  return img && img.naturalWidth > 0 ? img : null;
}

function drawCat(ctx: CanvasRenderingContext2D, sx: number, sy: number, now: number) {
  const bounce = Math.sin(now / 500) * 1.5;
  const tailWag = Math.sin(now / 300) * 0.3;

  // Body (orange oval)
  ctx.fillStyle = '#E8913C';
  ctx.beginPath();
  ctx.ellipse(sx + TW/2, sy + TH - 6 + bounce, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head (orange circle)
  ctx.beginPath();
  ctx.arc(sx + TW/2 + 2, sy + TH - 13 + bounce, 5, 0, Math.PI * 2);
  ctx.fill();

  // Ears (triangles)
  ctx.fillStyle = '#E8913C';
  ctx.beginPath();
  ctx.moveTo(sx + TW/2 - 2, sy + TH - 18 + bounce);
  ctx.lineTo(sx + TW/2 - 5, sy + TH - 13 + bounce);
  ctx.lineTo(sx + TW/2 + 1, sy + TH - 14 + bounce);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + TW/2 + 6, sy + TH - 18 + bounce);
  ctx.lineTo(sx + TW/2 + 3, sy + TH - 14 + bounce);
  ctx.lineTo(sx + TW/2 + 9, sy + TH - 13 + bounce);
  ctx.fill();

  // Inner ears (pink)
  ctx.fillStyle = '#FFB0B0';
  ctx.beginPath();
  ctx.moveTo(sx + TW/2 - 2, sy + TH - 17 + bounce);
  ctx.lineTo(sx + TW/2 - 4, sy + TH - 14 + bounce);
  ctx.lineTo(sx + TW/2, sy + TH - 14 + bounce);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + TW/2 + 6, sy + TH - 17 + bounce);
  ctx.lineTo(sx + TW/2 + 4, sy + TH - 14 + bounce);
  ctx.lineTo(sx + TW/2 + 8, sy + TH - 14 + bounce);
  ctx.fill();

  // Eyes (green dots)
  ctx.fillStyle = '#44DD44';
  ctx.beginPath();
  ctx.arc(sx + TW/2, sy + TH - 14 + bounce, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + TW/2 + 4, sy + TH - 14 + bounce, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Nose (tiny pink)
  ctx.fillStyle = '#FF8888';
  ctx.beginPath();
  ctx.arc(sx + TW/2 + 2, sy + TH - 12 + bounce, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Tail (curved line)
  ctx.strokeStyle = '#E8913C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx + TW/2 - 5, sy + TH - 5 + bounce);
  ctx.quadraticCurveTo(
    sx + TW/2 - 12 + Math.sin(tailWag) * 4,
    sy + TH - 14 + bounce,
    sx + TW/2 - 8 + Math.sin(tailWag) * 3,
    sy + TH - 18 + bounce
  );
  ctx.stroke();

  // Stripes on body
  ctx.strokeStyle = '#C07030';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const stripX = sx + TW/2 - 3 + i * 3;
    ctx.beginPath();
    ctx.moveTo(stripX, sy + TH - 9 + bounce);
    ctx.lineTo(stripX + 1, sy + TH - 4 + bounce);
    ctx.stroke();
  }
}

function drawKingCrown(ctx: CanvasRenderingContext2D, cx: number, topY: number) {
  // Small golden crown above the sprite
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(cx - 6, topY + 4);
  ctx.lineTo(cx - 7, topY - 2);
  ctx.lineTo(cx - 4, topY + 1);
  ctx.lineTo(cx - 1, topY - 4);
  ctx.lineTo(cx + 2, topY + 1);
  ctx.lineTo(cx + 5, topY - 2);
  ctx.lineTo(cx + 6, topY + 4);
  ctx.closePath();
  ctx.fill();
  // Crown band
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(cx - 6, topY + 2, 12, 3);
  // Gems
  ctx.fillStyle = '#FF2020';
  ctx.beginPath();
  ctx.arc(cx, topY + 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2020FF';
  ctx.beginPath();
  ctx.arc(cx - 4, topY + 3, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 4, topY + 3, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

// ================================================================
//  Tile detail chars for rendering
// ================================================================
const TILE_CHARS: Partial<Record<number, string>> = {
  [VTile.Tree]: '♣',
  [VTile.Flower]: '✿',
  [VTile.Fence]: '═',
  [VTile.Well]: '◎',
  [VTile.Sign]: '☐',
  [VTile.Chest]: '□',
  [VTile.Bookshelf]: '▦',
  [VTile.Bed]: '▬',
  [VTile.Table]: '▫',
  [VTile.Chair]: '◇',
  [VTile.Throne]: '♛',
  [VTile.Barrel]: '◌',
  [VTile.Torch]: '☀',
  [VTile.Pot]: '◐',
  [VTile.Counter]: '▬',
  [VTile.DungeonEntry]: '▼',
  [VTile.Door]: '⊞',
  [VTile.Water]: '~',
  [VTile.Bridge]: '═',
  [VTile.Fountain]: '⛲',
  [VTile.Dummy]: '⊕',
};

// ================================================================
//  Overlay types
// ================================================================
type OverlayMode =
  | 'none'
  | 'dialogue'
  | 'shop_menu'
  | 'shop_buy'
  | 'shop_sell'
  | 'storage_menu'
  | 'storage_deposit'
  | 'storage_withdraw'
  | 'church'
  | 'confirm_dungeon'
  | 'save'
  | 'training'
  | 'blacksmith'
  | 'fortune'
  | 'museum'
  | 'well';

// ================================================================
//  Component
// ================================================================
export default function VillageScreen({ state, dispatch }: Props) {
  const { scale: villageScale, isMobile: villageMobile, gameH: villageGameH, vw: villageVw } = useVillageScale(CW, CH);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [assetsReady, setAssetsReady] = useState(_villageAssetsLoaded);
  const [overlay, setOverlay] = useState<OverlayMode>('none');
  const [dialogueLines, setDialogueLines] = useState<string[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueSpeaker, setDialogueSpeaker] = useState('');
  const [overlayCursor, setOverlayCursor] = useState(0);
  const [currentShopType, setCurrentShopType] = useState<string>('');
  const [message, setMessage] = useState('');
  const [messageTimer, setMessageTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [dialogueSpeakerNpc, setDialogueSpeakerNpc] = useState<VillageNPC | null>(null);
  const portraitCanvasRef = useRef<HTMLCanvasElement>(null);
  // NPC wander state (local — not in game state)
  const npcPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastWanderRef = useRef(0);

  // Load assets
  useEffect(() => {
    loadVillageAssets(() => setAssetsReady(true));
  }, []);

  // Draw NPC portrait on dialogue open
  useEffect(() => {
    const pCanvas = portraitCanvasRef.current;
    if (!pCanvas || !dialogueSpeakerNpc || overlay !== 'dialogue') return;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;
    pCanvas.width = 64;
    pCanvas.height = 64;
    pCtx.clearRect(0, 0, 64, 64);
    pCtx.imageSmoothingEnabled = false;

    // Background
    pCtx.fillStyle = 'rgba(20,18,25,0.8)';
    pCtx.fillRect(0, 0, 64, 64);
    pCtx.strokeStyle = 'rgba(201,168,76,0.4)';
    pCtx.lineWidth = 1;
    pCtx.strokeRect(0, 0, 64, 64);

    const npc = dialogueSpeakerNpc;
    const isCat = npc.sprite === 'cat_custom' || npc.visualType === 'cat';
    const isKing = npc.visualType === 'king' || npc.id === 'king';

    if (isCat) {
      // Draw cat scaled up into the portrait
      pCtx.save();
      pCtx.translate(8, 8);
      pCtx.scale(2, 2);
      drawCat(pCtx, 0, 0, performance.now());
      pCtx.restore();
    } else {
      const sprImg = getSpriteFrame(npc.sprite, performance.now());
      if (sprImg && sprImg.naturalWidth > 0) {
        // Scale to fit 64x64 with crisp pixels (4x scale for 16px sprites)
        const scale = Math.min(56 / sprImg.naturalWidth, 56 / sprImg.naturalHeight);
        const dw = sprImg.naturalWidth * scale;
        const dh = sprImg.naturalHeight * scale;
        pCtx.drawImage(sprImg, 32 - dw / 2, 60 - dh, dw, dh);
      }
      if (isKing) {
        drawKingCrown(pCtx, 32, 6);
      }
    }
  }, [dialogueSpeakerNpc, overlay]);

  // Get village map
  const vmap = getAllVillageMaps().get('village_main')!;

  // Init NPC positions from map data
  useEffect(() => {
    if (!vmap) return;
    for (const npc of vmap.npcs) {
      if (!npcPosRef.current.has(npc.id)) {
        npcPosRef.current.set(npc.id, { x: npc.pos.x, y: npc.pos.y });
      }
    }
  }, [vmap]);

  // Show toast message
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    if (messageTimer) clearTimeout(messageTimer);
    setMessageTimer(setTimeout(() => setMessage(''), 3000));
  }, [messageTimer]);

  // Find adjacent NPC
  const findAdjacentNPC = useCallback((): VillageNPC | null => {
    const px = state.villagePos.x;
    const py = state.villagePos.y;
    for (const npc of vmap.npcs) {
      const pos = npcPosRef.current.get(npc.id) || npc.pos;
      const dx = Math.abs(pos.x - px);
      const dy = Math.abs(pos.y - py);
      if (dx <= 1 && dy <= 1 && (dx + dy) <= 1) return npc;
    }
    return null;
  }, [state.villagePos, vmap]);

  // Find adjacent entry
  const findAdjacentEntry = useCallback((): BuildingEntry | null => {
    const px = state.villagePos.x;
    const py = state.villagePos.y;
    for (const entry of vmap.entries) {
      if (entry.pos.x === px && entry.pos.y === py) return entry;
    }
    return null;
  }, [state.villagePos, vmap]);

  // Find secret at position
  const findSecretAt = useCallback((x: number, y: number): SecretSpot | null => {
    for (const s of vmap.secrets) {
      if (s.pos.x === x && s.pos.y === y && !state.discoveredSecrets.has(s.id)) return s;
    }
    return null;
  }, [vmap, state.discoveredSecrets]);

  // Interact action
  const doInteract = useCallback(() => {
    const px = state.villagePos.x;
    const py = state.villagePos.y;

    // Check standing on entry
    const entry = findAdjacentEntry();
    if (entry) {
      if (entry.targetMap === '__dungeon__') {
        setOverlay('confirm_dungeon');
        setOverlayCursor(0);
        sfxMenuSelect();
        return;
      }
    }

    // Check secrets at player position or adjacent
    const dirs = [[0,0],[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
      const sx = px + dx, sy = py + dy;
      const secret = findSecretAt(sx, sy);
      if (secret) {
        dispatch({ type: 'DISCOVER_SECRET', secretId: secret.id, goldReward: secret.reward?.type === 'gold' ? secret.reward.amount : undefined });
        showMessage(secret.message);
        sfxPickup();
        return;
      }
    }

    // Check adjacent NPC
    const npc = findAdjacentNPC();
    if (npc) {
      sfxMenuSelect();
      // #18: Blacksmith NPC
      if (npc.id === 'blacksmith') {
        setCurrentShopType('blacksmith');
        setOverlay('blacksmith');
        setOverlayCursor(0);
        if (npc.dialogue.length > 0) showMessage(npc.dialogue[0]);
        return;
      }
      // #15: Fortune teller NPC
      if (npc.id === 'fortune_teller') {
        const hint = getFortuneTellerHint(state.floorNumber || 1, state.seed);
        setDialogueLines([hint, ...npc.dialogue]);
        setDialogueIndex(0);
        setDialogueSpeaker(npc.name);
        setDialogueSpeakerNpc(npc);
        setOverlay('dialogue');
        return;
      }
      // #20: Museum NPC
      if (npc.id === 'museum') {
        const stats = getMuseumStats(state.discoveredItemTemplates, ITEM_TEMPLATES.length);
        const museumLines = [
          `博物館員「あなたのアイテムコレクション: ${stats.discovered}/${stats.total} (${stats.percentage}%)」`,
          ...npc.dialogue,
        ];
        setDialogueLines(museumLines);
        setDialogueIndex(0);
        setDialogueSpeaker(npc.name);
        setDialogueSpeakerNpc(npc);
        setOverlay('dialogue');
        return;
      }
      if (npc.shopType) {
        setCurrentShopType(npc.shopType);
        if (npc.shopType === 'weapon' || npc.shopType === 'item') {
          setOverlay('shop_menu');
          setOverlayCursor(0);
        } else if (npc.shopType === 'storage') {
          setOverlay('storage_menu');
          setOverlayCursor(0);
        } else if (npc.shopType === 'church') {
          setOverlay('church');
          setOverlayCursor(0);
        } else {
          // Show dialogue for magic or unknown types
          setDialogueLines(npc.dialogue);
          setDialogueIndex(0);
          setDialogueSpeaker(npc.name);
          setDialogueSpeakerNpc(npc);
          setOverlay('dialogue');
        }
        // Show first dialogue line before shop
        if (npc.dialogue.length > 0) {
          showMessage(npc.dialogue[0]);
        }
        return;
      }
      // Regular NPC dialogue
      setDialogueLines(npc.dialogue);
      setDialogueIndex(0);
      setDialogueSpeaker(npc.name);
      setDialogueSpeakerNpc(npc);
      setOverlay('dialogue');
      return;
    }

    // Check tile interactions (signs, bookshelves, etc.)
    for (const [dx, dy] of dirs) {
      const tx = px + dx, ty = py + dy;
      if (ty >= 0 && ty < vmap.height && tx >= 0 && tx < vmap.width) {
        const tile = vmap.tiles[ty][tx];
        if (tile === VTile.Sign) {
          const signSecret = vmap.secrets.find(s => s.pos.x === tx && s.pos.y === ty);
          if (signSecret && !state.discoveredSecrets.has(signSecret.id)) {
            dispatch({ type: 'DISCOVER_SECRET', secretId: signSecret.id });
            showMessage(signSecret.message);
          } else if (signSecret) {
            showMessage(signSecret.message);
          }
          return;
        }
        if (tile === VTile.Bed) {
          // Save at home
          setOverlay('save');
          setOverlayCursor(0);
          sfxMenuSelect();
          return;
        }
        if (tile === VTile.Dummy) {
          // #14: Training ground - pay gold to gain 1 level
          const trainCost = getTrainingCost(state.player.level);
          if (state.player.gold >= trainCost) {
            dispatch({ type: 'TRAIN', cost: trainCost });
            showMessage(`訓練でレベルアップ！ Lv${state.player.level + 1} (${trainCost}G)`);
          } else {
            showMessage(`訓練費用: ${trainCost}G (お金が足りない)`);
          }
          sfxPickup();
          return;
        }
        if (tile === VTile.Fountain) {
          showMessage('噴水の水が心地よい音を立てている。少し気分が落ち着いた。');
          sfxPickup();
          return;
        }
        // #19: Well interaction - restore HP to full
        if (tile === VTile.Well) {
          if (state.player.hp < state.player.maxHp) {
            dispatch({ type: 'WELL_HEAL' });
            showMessage('井戸の水を飲んだ。HPが全回復した！');
          } else {
            showMessage('井戸の水を飲んだ。...特に変わらない。');
          }
          sfxPickup();
          return;
        }
      }
    }

    showMessage('何もない...');
  }, [state.villagePos, state.discoveredSecrets, findAdjacentNPC, findAdjacentEntry, findSecretAt, dispatch, showMessage, vmap]);

  // Track held keys for diagonal movement
  const heldKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function handleKeyUp(e: KeyboardEvent) {
      heldKeysRef.current.delete(e.key);
    }
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, []);

  // Key handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      heldKeysRef.current.add(e.key);

      if (overlay === 'none') {
        // Movement - with diagonal support via simultaneous arrow keys
        const held = heldKeysRef.current;
        const up = held.has('ArrowUp') || held.has('w');
        const down = held.has('ArrowDown') || held.has('s');
        const left = held.has('ArrowLeft') || held.has('a');
        const right = held.has('ArrowRight') || held.has('d');

        // Diagonal via simultaneous arrow/WASD keys
        let dir: Direction | undefined;
        if (up && left) dir = Direction.UpLeft;
        else if (up && right) dir = Direction.UpRight;
        else if (down && left) dir = Direction.DownLeft;
        else if (down && right) dir = Direction.DownRight;
        else {
          // Single key mapping (including vi-keys y/u/b/n and numpad)
          const dirMap: Record<string, Direction> = {
            ArrowUp: Direction.Up, ArrowDown: Direction.Down,
            ArrowLeft: Direction.Left, ArrowRight: Direction.Right,
            w: Direction.Up, s: Direction.Down, a: Direction.Left, d: Direction.Right,
            y: Direction.UpLeft, u: Direction.UpRight,
            b: Direction.DownLeft, n: Direction.DownRight,
            '7': Direction.UpLeft, '9': Direction.UpRight,
            '1': Direction.DownLeft, '3': Direction.DownRight,
          };
          dir = dirMap[e.key];
        }
        if (dir !== undefined) {
          e.preventDefault();
          dispatch({ type: 'VILLAGE_MOVE', direction: dir });
          sfxFootstep(false);
          return;
        }
        // Interact
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          doInteract();
          return;
        }
        // Open inventory/menu
        if (e.key === 'i' || e.key === 'e') {
          e.preventDefault();
          // TODO: Could add a village inventory overlay here
          return;
        }
        return;
      }

      // Overlay key handling
      if (overlay === 'dialogue') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (dialogueIndex < dialogueLines.length - 1) {
            setDialogueIndex(i => i + 1);
            sfxMenuMove();
          } else {
            setOverlay('none');
            sfxMenuSelect();
          }
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'confirm_dungeon') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOverlayCursor(c => (c + 1) % 2);
          sfxMenuMove();
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor === 0) {
            dispatch({ type: 'ENTER_DUNGEON' });
          }
          setOverlay('none');
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'save') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOverlayCursor(c => (c + 1) % 2);
          sfxMenuMove();
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor === 0) {
            // Rest at home: full HP recovery + save
            if (state.player.hp < state.player.maxHp) {
              dispatch({ type: 'CHURCH_HEAL', cost: 0 });
            }
            saveGame(state);
            showMessage('ベッドで休んだ。HPが全回復した！セーブしました。');
          }
          setOverlay('none');
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'shop_menu') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOverlayCursor(c => (c + 1) % 3);
          sfxMenuMove();
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor === 0) { setOverlay('shop_buy'); setOverlayCursor(0); }
          else if (overlayCursor === 1) { setOverlay('shop_sell'); setOverlayCursor(0); }
          else { setOverlay('none'); }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'shop_buy') {
        // #13: Dynamic shop inventory based on villageShopSeed
        const pool = currentShopType === 'weapon' ? getWeaponShopPool() : getItemShopPool();
        const items = generateShopInventory(state.villageShopSeed, pool, currentShopType === 'weapon' ? 7 : 9);
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(items.length, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < items.length) {
            const item = items[overlayCursor];
            if (state.player.gold >= item.price && state.player.inventory.length < 20) {
              dispatch({ type: 'BUY_ITEM', templateId: item.templateId, price: item.price });
              showMessage(`${item.name}を購入した！`);
            } else if (state.player.gold < item.price) {
              showMessage('お金が足りない...');
            } else {
              showMessage('持ち物がいっぱいだ！');
            }
          } else {
            setOverlay('shop_menu');
            setOverlayCursor(0);
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('shop_menu');
          setOverlayCursor(0);
        }
        return;
      }

      if (overlay === 'shop_sell') {
        const sellable = state.player.inventory.filter(i =>
          i.id !== state.player.equippedWeapon &&
          i.id !== state.player.equippedShield &&
          i.id !== state.player.equippedRing
        );
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(sellable.length, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < sellable.length) {
            const item = sellable[overlayCursor];
            const price = getItemSellPrice(item);
            dispatch({ type: 'SELL_ITEM', itemId: item.id, price });
            showMessage(`${item.name}を${price}Gで売った！`);
            setOverlayCursor(c => Math.max(0, c - 1));
          } else {
            setOverlay('shop_menu');
            setOverlayCursor(0);
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('shop_menu');
          setOverlayCursor(0);
        }
        return;
      }

      if (overlay === 'storage_menu') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOverlayCursor(c => {
            const nc = e.key === 'ArrowUp' ? c - 1 : c + 1;
            return ((nc % 4) + 4) % 4;
          });
          sfxMenuMove();
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor === 0) { setOverlay('storage_deposit'); setOverlayCursor(0); }
          else if (overlayCursor === 1) { setOverlay('storage_withdraw'); setOverlayCursor(0); }
          else if (overlayCursor === 2) {
            // #16: Upgrade storage capacity
            const upgradeCost = 1000;
            if (state.player.gold >= upgradeCost) {
              dispatch({ type: 'UPGRADE_STORAGE', cost: upgradeCost });
              showMessage(`倉庫を拡張した！ 容量: ${state.storageCapacity + 10}`);
            } else {
              showMessage('お金が足りない... (1000G必要)');
            }
          }
          else { setOverlay('none'); }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'storage_deposit') {
        const depositable = state.player.inventory.filter(i =>
          i.id !== state.player.equippedWeapon &&
          i.id !== state.player.equippedShield &&
          i.id !== state.player.equippedRing
        );
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(depositable.length, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < depositable.length) {
            const item = depositable[overlayCursor];
            dispatch({ type: 'STORE_ITEM', itemId: item.id });
            showMessage(`${item.name}を預けた！`);
            setOverlayCursor(c => Math.max(0, c - 1));
          } else {
            setOverlay('storage_menu');
            setOverlayCursor(0);
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('storage_menu');
          setOverlayCursor(0);
        }
        return;
      }

      if (overlay === 'storage_withdraw') {
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(state.storage.length, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < state.storage.length) {
            if (state.player.inventory.length < 20) {
              dispatch({ type: 'WITHDRAW_ITEM', index: overlayCursor });
              showMessage('引き出した！');
              setOverlayCursor(c => Math.max(0, c - 1));
            } else {
              showMessage('持ち物がいっぱいだ！');
            }
          } else {
            setOverlay('storage_menu');
            setOverlayCursor(0);
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('storage_menu');
          setOverlayCursor(0);
        }
        return;
      }

      // #18: Blacksmith overlay
      if (overlay === 'blacksmith') {
        const enhanceableItems = state.player.inventory.filter(i =>
          i.category === ItemCategory.Weapon || i.category === ItemCategory.Shield
        );
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(enhanceableItems.length, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < enhanceableItems.length) {
            const bsItem = enhanceableItems[overlayCursor];
            const currentEnh = (bsItem as WeaponItem | ShieldItem).enhancement || 0;
            const cost = getBlacksmithCost(currentEnh);
            if (state.player.gold >= cost) {
              dispatch({ type: 'BLACKSMITH_ENHANCE', itemId: bsItem.id, cost });
              showMessage(`${bsItem.name}を+${currentEnh + 1}に強化した！ (${cost}G)`);
            } else {
              showMessage(`お金が足りない... (${cost}G必要)`);
            }
          } else {
            setOverlay('none');
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }

      if (overlay === 'church') {
        const cursedItems = state.player.inventory.filter(i => i.cursed);
        const canHeal = state.player.hp < state.player.maxHp;
        const healCost = Math.max(50, Math.floor((state.player.maxHp - state.player.hp) * 2));
        const optCount = (canHeal ? 1 : 0) + cursedItems.length;
        if (e.key === 'ArrowUp') { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOverlayCursor(c => Math.min(optCount, c + 1)); sfxMenuMove(); }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          e.preventDefault();
          if (overlayCursor < optCount) {
            if (canHeal && overlayCursor === 0) {
              if (state.player.gold >= healCost) {
                dispatch({ type: 'CHURCH_HEAL', cost: healCost });
                showMessage('神父の祈りでHPが全回復した！');
              } else { showMessage('お金が足りない...'); }
            } else {
              const curseIdx = overlayCursor - (canHeal ? 1 : 0);
              if (curseIdx >= 0 && curseIdx < cursedItems.length) {
                const item = cursedItems[curseIdx];
                if (state.player.gold >= 500) {
                  dispatch({ type: 'REMOVE_CURSE', itemId: item.id });
                  showMessage(`${item.name}の呪いを解いた！`);
                } else { showMessage('お金が足りない...'); }
              }
            }
          } else {
            setOverlay('none');
          }
          sfxMenuSelect();
        }
        if (e.key === 'Escape' || e.key === 'x') {
          e.preventDefault();
          setOverlay('none');
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [overlay, overlayCursor, dialogueIndex, dialogueLines, state, dispatch, doInteract, currentShopType, showMessage, vmap]);

  // NPC wandering AI
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastWanderRef.current < 800) return;
      lastWanderRef.current = now;

      for (const npc of vmap.npcs) {
        if (!npc.wander) continue;
        const pos = npcPosRef.current.get(npc.id);
        if (!pos) continue;

        if (Math.random() > 0.4) continue; // 40% chance to move

        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
        const nx = pos.x + dx;
        const ny = pos.y + dy;

        // Check bounds
        if (nx < npc.wander.x1 || nx > npc.wander.x2 || ny < npc.wander.y1 || ny > npc.wander.y2) continue;
        if (ny < 0 || ny >= vmap.height || nx < 0 || nx >= vmap.width) continue;
        if (!isVillageWalkable(vmap.tiles[ny][nx])) continue;

        // Don't walk onto player
        if (nx === state.villagePos.x && ny === state.villagePos.y) continue;

        // Don't walk onto other NPCs
        let blocked = false;
        for (const [otherId, otherPos] of npcPosRef.current) {
          if (otherId !== npc.id && otherPos.x === nx && otherPos.y === ny) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        npcPosRef.current.set(npc.id, { x: nx, y: ny });
        // Update NPC facing based on movement direction
        if (dx > 0) npc.facing = 3; // right
        else if (dx < 0) npc.facing = 2; // left
        else if (dy > 0) npc.facing = 0; // down
        else if (dy < 0) npc.facing = 1; // up
      }
    }, 400);
    return () => clearInterval(interval);
  }, [vmap, state.villagePos]);

  // ================================================================
  //  Canvas rendering
  // ================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CW;
    canvas.height = CH;

    // Procedural hash for consistent per-tile randomness
    const tileHash = (x: number, y: number) => {
      const h = (x * 374761 + y * 668265) & 0xFFFF;
      return h / 65535;
    };

    // Particles: fireflies
    const fireflies: { x: number; y: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < 40; i++) {
      fireflies.push({
        x: Math.random() * vmap.width * TW,
        y: Math.random() * vmap.height * TH,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
      });
    }

    // Particles: leaves near trees
    const leaves: { x: number; y: number; phase: number; speed: number; rot: number }[] = [];
    for (let i = 0; i < 30; i++) {
      leaves.push({
        x: Math.random() * vmap.width * TW,
        y: Math.random() * vmap.height * TH,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.4,
        rot: Math.random() * Math.PI * 2,
      });
    }

    // Particles: dust motes for indoor areas
    const dustMotes: { x: number; y: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < 20; i++) {
      dustMotes.push({
        x: Math.random() * vmap.width * TW,
        y: Math.random() * vmap.height * TH,
        phase: Math.random() * Math.PI * 2,
        speed: 0.1 + Math.random() * 0.2,
      });
    }

    // Water sparkles
    const waterSparkles: { x: number; y: number; phase: number }[] = [];
    for (let i = 0; i < 15; i++) {
      waterSparkles.push({
        x: Math.random() * vmap.width * TW,
        y: Math.random() * vmap.height * TH,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Smoke particles from chimneys (WallTop tiles with Floor below)
    const smokeParticles: { x: number; y: number; life: number; maxLife: number; vx: number; vy: number; size: number }[] = [];
    const chimneyPositions: { x: number; y: number }[] = [];
    for (let ty = 0; ty < vmap.height - 1; ty++) {
      for (let tx = 0; tx < vmap.width; tx++) {
        if (vmap.tiles[ty][tx] === VTile.WallTop) {
          // Check if there's a Floor tile somewhere below (within 3 tiles)
          for (let dy2 = 1; dy2 <= 3; dy2++) {
            if (ty + dy2 < vmap.height && vmap.tiles[ty + dy2][tx] === VTile.Floor) {
              chimneyPositions.push({ x: tx, y: ty });
              break;
            }
          }
        }
      }
    }
    // Only keep a subset of chimney positions (one per ~4 tiles to avoid too many)
    const filteredChimneys = chimneyPositions.filter((_, i) => i % 4 === 0);

    // Bird silhouettes
    const birds: { x: number; y: number; speed: number; wingPhase: number; size: number }[] = [];
    for (let i = 0; i < 3; i++) {
      birds.push({
        x: Math.random() * CW,
        y: 30 + Math.random() * 80,
        speed: 0.4 + Math.random() * 0.6,
        wingPhase: Math.random() * Math.PI * 2,
        size: 3 + Math.random() * 2,
      });
    }

    // Butterflies near flowers
    const butterflies: { x: number; y: number; phase: number; speed: number; color: string }[] = [];
    const flowerTiles: { x: number; y: number }[] = [];
    for (let ty = 0; ty < vmap.height; ty++) {
      for (let tx = 0; tx < vmap.width; tx++) {
        if (vmap.tiles[ty][tx] === VTile.Flower) flowerTiles.push({ x: tx, y: ty });
      }
    }
    const butterflyColors = ['#e0a0d0', '#a0d0e0', '#e0e0a0', '#d0a0a0', '#a0e0a0'];
    for (let i = 0; i < Math.min(6, flowerTiles.length); i++) {
      const ft = flowerTiles[i % flowerTiles.length];
      butterflies.push({
        x: ft.x * TW + Math.random() * TW * 3,
        y: ft.y * TH + Math.random() * TH * 3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.25,
        color: butterflyColors[i % butterflyColors.length],
      });
    }

    // Rain system (toggled randomly per session)
    const isRaining = Math.random() < 0.25; // 25% chance of rain
    const rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
    if (isRaining) {
      for (let i = 0; i < 120; i++) {
        rainDrops.push({
          x: Math.random() * CW,
          y: Math.random() * CH,
          speed: 6 + Math.random() * 6,
          len: 4 + Math.random() * 6,
        });
      }
    }

    // Cloud shadows
    const cloudShadows: { x: number; y: number; w: number; h: number; speed: number }[] = [];
    for (let i = 0; i < 3; i++) {
      cloudShadows.push({
        x: Math.random() * vmap.width * TW,
        y: Math.random() * vmap.height * TH,
        w: 80 + Math.random() * 120,
        h: 40 + Math.random() * 60,
        speed: 0.2 + Math.random() * 0.3,
      });
    }

    // Footprint trail: last 5 player positions
    const footprints: { x: number; y: number; time: number }[] = [];
    let lastFootprintPos = { x: state.villagePos.x, y: state.villagePos.y };

    // NPC idle direction timers
    const npcIdleDirTimers = new Map<string, number>();
    for (const npc of vmap.npcs) {
      npcIdleDirTimers.set(npc.id, Math.random() * 5000);
    }

    // Seasonal flower palette
    const seasonalFlowers = getSeasonalFlowerColors(Math.random());

    // Pre-compute torch positions for efficiency
    const torchList: { x: number; y: number }[] = [];
    for (let ty = 0; ty < vmap.height; ty++) {
      for (let tx = 0; tx < vmap.width; tx++) {
        if (vmap.tiles[ty][tx] === VTile.Torch) torchList.push({ x: tx, y: ty });
      }
    }

    // Pre-compute tree positions for leaf spawning
    const treeList: { x: number; y: number }[] = [];
    for (let ty = 0; ty < vmap.height; ty++) {
      for (let tx = 0; tx < vmap.width; tx++) {
        if (vmap.tiles[ty][tx] === VTile.Tree) treeList.push({ x: tx, y: ty });
      }
    }

    // Helper: check if tile at (x,y) is a water edge (adjacent to non-water)
    function isWaterEdge(x: number, y: number): boolean {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dx2, dy2] of dirs) {
        const nx = x + dx2, ny = y + dy2;
        if (nx < 0 || nx >= vmap.width || ny < 0 || ny >= vmap.height) return true;
        if (vmap.tiles[ny][nx] !== VTile.Water) return true;
      }
      return false;
    }

    // Helper: draw procedural tree
    function drawTree(ctx: CanvasRenderingContext2D, sx: number, sy: number, hash01: number, alpha: number) {
      ctx.globalAlpha = alpha;
      // Shadow to SE
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx + TW * 0.6, sy + TH * 0.9, TW * 0.4, TH * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      const trunkW = 3 + hash01 * 2;
      const trunkH = 8 + hash01 * 4;
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(sx + TW / 2 - trunkW / 2, sy + TH - trunkH - 1, trunkW, trunkH);
      // Darker bark lines
      ctx.fillStyle = '#3a2018';
      ctx.fillRect(sx + TW / 2 - trunkW / 2 + 1, sy + TH - trunkH + 2, 1, trunkH - 4);
      // Canopy: overlapping circles in different greens
      const greens = ['#1a5a20', '#1e6e28', '#166618', '#2a7a30'];
      const canopyY = sy + TH - trunkH - 2;
      const r1 = 5 + hash01 * 3;
      const r2 = 4 + (1 - hash01) * 3;
      const cx = sx + TW / 2;
      // Bottom canopy layer (darker)
      ctx.fillStyle = greens[0];
      ctx.beginPath();
      ctx.arc(cx - 2, canopyY + 2, r1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = greens[1];
      ctx.beginPath();
      ctx.arc(cx + 3, canopyY + 1, r2, 0, Math.PI * 2);
      ctx.fill();
      // Top canopy layer (lighter)
      ctx.fillStyle = greens[2];
      ctx.beginPath();
      ctx.arc(cx, canopyY - 2, r1 * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = greens[3];
      ctx.beginPath();
      ctx.arc(cx + 1, canopyY - 1, r2 * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(100,200,80,0.15)';
      ctx.beginPath();
      ctx.arc(cx - 1, canopyY - 3, r1 * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Helper: draw cobblestone path tile
    function drawPath(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, alpha: number) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#3a3020';
      ctx.fillRect(sx, sy, TW, TH);
      // Draw individual cobblestones
      const h = tileHash(x, y);
      const h2 = tileHash(x + 100, y + 100);
      const stoneColors = ['#443828', '#3e3422', '#4a3e2e', '#36301c'];
      // 4-6 stones per tile
      const numStones = 4 + Math.floor(h * 3);
      for (let i = 0; i < numStones; i++) {
        const sh = tileHash(x * 13 + i * 7, y * 17 + i * 11);
        const sh2 = tileHash(x * 19 + i * 3, y * 23 + i * 5);
        const stoneX = sx + 1 + sh * (TW - 8);
        const stoneY = sy + 1 + sh2 * (TH - 8);
        const stoneW = 4 + sh * 6;
        const stoneH = 3 + sh2 * 5;
        ctx.fillStyle = stoneColors[i % stoneColors.length];
        ctx.beginPath();
        ctx.roundRect(stoneX, stoneY, stoneW, stoneH, 1.5);
        ctx.fill();
        // Stone highlight
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(stoneX + 1, stoneY, stoneW - 2, 1);
      }
      // Mortar lines (gaps between stones)
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      const gapY = sy + TH * (0.3 + h * 0.2);
      ctx.fillRect(sx, gapY, TW, 1);
      const gapX = sx + TW * (0.4 + h2 * 0.2);
      ctx.fillRect(gapX, sy, 1, TH);
    }

    // Helper: draw grass with variation + #15 ambient wind sway
    function drawGrass(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, alpha: number) {
      ctx.globalAlpha = alpha;
      const h = tileHash(x, y);
      const h2 = tileHash(x + 50, y + 50);
      // Base green with variation
      const gr = 26 + Math.floor(h * 10);
      const gg = 46 + Math.floor(h * 20);
      const gb = 21 + Math.floor(h * 8);
      ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
      ctx.fillRect(sx, sy, TW, TH);
      // Small grass blades with dynamic wind sway
      const bladeCount = 3 + Math.floor(h2 * 4);
      const windStr = Math.sin(performance.now() * 0.0012 + x * 0.3 + y * 0.2) * 1.5;
      const windGust = Math.sin(performance.now() * 0.004 + x * 1.1) * 0.8;
      for (let i = 0; i < bladeCount; i++) {
        const bh = tileHash(x * 7 + i * 31, y * 11 + i * 17);
        const bh2 = tileHash(x * 13 + i * 23, y * 7 + i * 29);
        const bx = sx + bh * TW;
        const by = sy + TH * 0.5 + bh2 * TH * 0.5;
        const bladeH = 2 + bh * 4;
        const bladeSway = (windStr + windGust) * (bladeH / 6);
        ctx.fillStyle = `rgba(${40 + Math.floor(bh * 30)},${60 + Math.floor(bh * 40)},${20 + Math.floor(bh * 15)},0.6)`;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bladeSway, by - bladeH);
        ctx.lineTo(bx + 1, by);
        ctx.fill();
      }
    }

    // Helper: draw wall with brick texture
    function drawWall(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, alpha: number) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#3a3a45';
      ctx.fillRect(sx, sy, TW, TH);
      // Brick rows
      const brickH = 5;
      const brickW = 8;
      for (let row = 0; row < Math.ceil(TH / brickH); row++) {
        const offset = (row % 2) * (brickW / 2);
        for (let col = -1; col < Math.ceil(TW / brickW) + 1; col++) {
          const bx = sx + col * brickW + offset;
          const by2 = sy + row * brickH;
          if (bx > sx + TW || by2 > sy + TH) continue;
          const bHash = tileHash(x * 7 + col * 3 + row * 13, y * 11 + row * 7);
          const shade = 50 + Math.floor(bHash * 20);
          ctx.fillStyle = `rgb(${shade},${shade},${shade + 8})`;
          ctx.fillRect(Math.max(sx, bx), Math.max(sy, by2),
            Math.min(brickW - 1, sx + TW - Math.max(sx, bx)),
            Math.min(brickH - 1, sy + TH - Math.max(sy, by2)));
        }
      }
      // Mortar highlight
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(sx, sy, TW, 1);
      // Shadow on right side
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(sx + TW - 1, sy, 1, TH);
      ctx.fillRect(sx, sy + TH - 1, TW, 1);
    }

    // Helper: draw WallTop with roof-like gradient
    function drawWallTop(ctx: CanvasRenderingContext2D, sx: number, sy: number, _x: number, _y: number, alpha: number) {
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(sx, sy, sx, sy + TH);
      grad.addColorStop(0, '#1a1a28');
      grad.addColorStop(0.4, '#2a2a38');
      grad.addColorStop(1, '#3a3a48');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, TW, TH);
      // Roof tile lines
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(sx, sy + 2, TW, 1);
      ctx.fillRect(sx, sy + TH - 3, TW, 1);
      // Dark top edge
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx, sy, TW, 1);
    }

    // Helper: draw building shadow to SE
    function drawBuildingShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, alpha: number) {
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(sx + TW, sy + 2, 4, TH);
      ctx.fillRect(sx + 2, sy + TH, TW, 3);
    }

    // Helper: draw water with multi-tone animation + wave lines + sparkles + gradient
    function drawWater(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, now: number, alpha: number) {
      ctx.globalAlpha = alpha;
      // Gradient from dark to light blue
      const waterGrad = ctx.createLinearGradient(sx, sy, sx, sy + TH);
      waterGrad.addColorStop(0, '#0a1830');
      waterGrad.addColorStop(0.4, '#132848');
      waterGrad.addColorStop(0.7, '#1a3858');
      waterGrad.addColorStop(1, '#102038');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(sx, sy, TW, TH);

      // Animated wave lines (sinusoidal)
      ctx.strokeStyle = 'rgba(60,120,200,0.35)';
      ctx.lineWidth = 1;
      for (let row = 0; row < 5; row++) {
        const baseY = sy + 2 + row * 5;
        ctx.beginPath();
        for (let px2 = 0; px2 <= TW; px2 += 2) {
          const waveOff = Math.sin(now * 0.003 + (sx + px2) * 0.08 + x * 2 + y * 1.5 + row * 1.8) * 1.5;
          const wy = baseY + waveOff;
          if (px2 === 0) ctx.moveTo(sx + px2, wy);
          else ctx.lineTo(sx + px2, wy);
        }
        ctx.stroke();
      }

      // Lighter animated wave layers
      for (let row = 0; row < 3; row++) {
        const waveY = sy + row * 8 + 1;
        const offset = Math.sin(now * 0.002 + x * 1.5 + y * 0.7 + row * 1.2) * 3;
        const offset2 = Math.sin(now * 0.0015 + x * 0.8 + y * 1.3 + row * 0.9) * 2;
        ctx.fillStyle = row % 2 === 0 ? 'rgba(40,90,170,0.25)' : 'rgba(35,70,150,0.2)';
        ctx.fillRect(sx, waveY + offset, TW, 2);
        // Highlight crest
        ctx.fillStyle = 'rgba(80,140,220,0.2)';
        ctx.fillRect(sx + 4 + offset2, waveY + offset, TW * 0.35, 1);
      }

      // Sparkle dots that appear and disappear
      const sparkleCount = 2;
      for (let sp = 0; sp < sparkleCount; sp++) {
        const sparklePhase = now * 0.004 + x * 3.7 + y * 5.3 + sp * 2.1;
        const sparkleVis = Math.sin(sparklePhase) * 0.5 + 0.5;
        if (sparkleVis > 0.75) {
          const spx = sx + ((x * 7 + sp * 13 + Math.floor(now * 0.001)) % TW);
          const spy = sy + ((y * 11 + sp * 17 + Math.floor(now * 0.0008)) % TH);
          ctx.globalAlpha = alpha * (sparkleVis - 0.75) * 4;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(spx, spy, 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
      }

      // Foam at edges
      if (isWaterEdge(x, y)) {
        ctx.globalAlpha = alpha * 0.5;
        const foamPhase = Math.sin(now * 0.003 + x * 3 + y * 5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(180,200,230,${0.2 + foamPhase * 0.3})`;
        if (y > 0 && vmap.tiles[y-1][x] !== VTile.Water) {
          ctx.fillRect(sx, sy, TW, 2);
        }
        if (y < vmap.height - 1 && vmap.tiles[y+1][x] !== VTile.Water) {
          ctx.fillRect(sx, sy + TH - 2, TW, 2);
        }
        if (x > 0 && vmap.tiles[y][x-1] !== VTile.Water) {
          ctx.fillRect(sx, sy, 2, TH);
        }
        if (x < vmap.width - 1 && vmap.tiles[y][x+1] !== VTile.Water) {
          ctx.fillRect(sx + TW - 2, sy, 2, TH);
        }
      }
    }

    // Helper: draw dungeon entry vortex (enhanced)
    function drawDungeonEntry(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, now: number, alpha: number) {
      ctx.globalAlpha = alpha;
      // Dark stone base
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(sx, sy, TW, TH);
      // Stone border pattern
      ctx.fillStyle = '#1a1520';
      ctx.fillRect(sx, sy, TW, 2);
      ctx.fillRect(sx, sy + TH - 2, TW, 2);
      ctx.fillRect(sx, sy, 2, TH);
      ctx.fillRect(sx + TW - 2, sy, 2, TH);

      const cx = sx + TW / 2;
      const cy = sy + TH / 2;

      // Outer dark aura
      ctx.globalAlpha = alpha * 0.4;
      const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TW);
      auraGrad.addColorStop(0, 'transparent');
      auraGrad.addColorStop(0.5, 'rgba(60,20,100,0.2)');
      auraGrad.addColorStop(1, 'rgba(30,10,50,0.4)');
      ctx.fillStyle = auraGrad;
      ctx.fillRect(sx - TW, sy - TH, TW * 3, TH * 3);

      // Swirling vortex rings (more rings, better animation)
      for (let ring = 0; ring < 5; ring++) {
        const ringR = 2 + ring * 2.5;
        const angle = now * 0.003 * (ring % 2 === 0 ? 1 : -1) + ring * 1.2;
        const pulse = Math.sin(now * 0.004 + ring * 0.8) * 0.3 + 0.7;
        ctx.globalAlpha = alpha * pulse * (0.5 - ring * 0.08);
        const purples = ['#a040ff', '#8030d0', '#6020b0', '#a040e0', '#5018a0'];
        ctx.strokeStyle = purples[ring];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, angle, angle + Math.PI * 1.6);
        ctx.stroke();
      }
      // Center glow (pulsating)
      const centerPulse = Math.sin(now * 0.005) * 0.3 + 0.5;
      ctx.globalAlpha = alpha * centerPulse;
      const vortGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      vortGrad.addColorStop(0, '#c060ff');
      vortGrad.addColorStop(0.3, 'rgba(140,50,220,0.5)');
      vortGrad.addColorStop(0.7, 'rgba(80,20,150,0.2)');
      vortGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = vortGrad;
      ctx.fillRect(sx - 6, sy - 6, TW + 12, TH + 12);
      // Rising particles
      for (let p = 0; p < 5; p++) {
        const pLife = ((now * 0.001 + p * 1.7 + x * 0.3) % 2) / 2;
        const pa = p * 1.3 + x * 0.5;
        const pr = 2 + pLife * 8;
        const ppx = cx + Math.cos(pa + now * 0.002) * pr * 0.5;
        const ppy = cy - pLife * 12;
        ctx.globalAlpha = alpha * (1 - pLife) * 0.7;
        ctx.fillStyle = pLife < 0.5 ? '#c080ff' : '#8050c0';
        ctx.beginPath();
        ctx.arc(ppx, ppy, 1 + (1 - pLife) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Helper: draw flower with sway + seasonal palette (#8) + dynamic wind (#15)
    function drawFlower(ctx: CanvasRenderingContext2D, sx: number, sy: number, x: number, y: number, now: number, alpha: number) {
      ctx.globalAlpha = alpha;
      // Grass background
      drawGrass(ctx, sx, sy, x, y, alpha);
      ctx.globalAlpha = alpha;
      const h = tileHash(x, y);
      // Enhanced sway animation with wind effect (#15)
      const windBase = Math.sin(now * 0.0015 + x * 0.5) * 0.5 + 0.5;
      const sway = Math.sin(now * 0.002 + x * 2 + y * 3) * 1.5 + Math.sin(now * 0.004 + x * 1.3) * windBase * 2;
      const stemX = sx + TW / 2 + sway;
      // Stem
      ctx.fillStyle = '#2a6a20';
      ctx.fillRect(stemX - 0.5, sy + TH * 0.35, 1, TH * 0.55);
      // Flower head - use seasonal palette (#8)
      const color = seasonalFlowers[Math.floor(h * seasonalFlowers.length)];
      ctx.fillStyle = color;
      const fSize = 3 + h * 2;
      // Petals
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2 + now * 0.001;
        const ppx = stemX + Math.cos(pa) * fSize * 0.5;
        const ppy = sy + TH * 0.3 + Math.sin(pa) * fSize * 0.5;
        ctx.beginPath();
        ctx.arc(ppx, ppy, fSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.fillStyle = '#e0d040';
      ctx.beginPath();
      ctx.arc(stemX, sy + TH * 0.3, fSize * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    function render() {
      if (!ctx) return;
      const now = performance.now();
      const px = state.villagePos.x;
      const py = state.villagePos.y;
      const camX = px;
      const camY = py;

      // Clear
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, CW, CH);

      // Draw tiles
      const rangeX = Math.ceil(CW / TW / 2) + 2;
      const rangeY = Math.ceil(CH / TH / 2) + 2;

      // Collect building wall tiles for shadow pass
      const wallTiles: { sx: number; sy: number; alpha: number }[] = [];
      // Collect WallTop tiles for roof pass
      const roofTiles: { sx: number; sy: number; mx: number; my: number; alpha: number }[] = [];

      for (let dy = -rangeY; dy <= rangeY; dy++) {
        for (let dx = -rangeX; dx <= rangeX; dx++) {
          const mx = camX + dx;
          const my = camY + dy;
          if (mx < 0 || mx >= vmap.width || my < 0 || my >= vmap.height) continue;

          const sx = CW / 2 + (mx - camX) * TW;
          const sy = CH / 2 + (my - camY) * TH;
          const tile = vmap.tiles[my][mx];
          const color = TILE_COLORS[tile] || { bg: '#050508' };

          // Distance-based dimming (ambient night)
          const dist = Math.sqrt((mx - px) * (mx - px) + (my - py) * (my - py));
          const lightRadius = 8;
          const dimFactor = Math.max(0.25, 1.0 - Math.max(0, dist - 3) / lightRadius);

          // Torch glow contribution (use pre-computed list)
          let torchLight = 0;
          for (const torch of torchList) {
            const tdx = mx - torch.x;
            const tdy = my - torch.y;
            const td = Math.sqrt(tdx * tdx + tdy * tdy);
            if (td < 6) {
              const flicker = 0.85 + Math.sin(now * 0.003 + torch.x * 7 + torch.y * 13) * 0.15;
              torchLight += Math.max(0, (1 - td / 6)) * 0.6 * flicker;
            }
          }
          const finalBright = Math.min(1, dimFactor + torchLight);

          // === Tile-specific rendering ===
          if (tile === VTile.Grass) {
            drawGrass(ctx, sx, sy, mx, my, finalBright);
          } else if (tile === VTile.Path) {
            drawPath(ctx, sx, sy, mx, my, finalBright);
          } else if (tile === VTile.Wall) {
            const wallImg = getTileImg('tile_wall_mid');
            if (wallImg) {
              ctx.globalAlpha = finalBright;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(wallImg, sx, sy, TW, TH);
            } else {
              drawWall(ctx, sx, sy, mx, my, finalBright);
            }
            // Add window decoration on some wall tiles (based on hash)
            const wallH = tileHash(mx, my);
            // Only add windows to walls that have interior (Floor) on one side
            const hasFloorLeft = mx > 0 && vmap.tiles[my][mx - 1] === VTile.Floor;
            const hasFloorRight = mx < vmap.width - 1 && vmap.tiles[my][mx + 1] === VTile.Floor;
            if (wallH > 0.65 && !hasFloorLeft && !hasFloorRight) {
              // Window
              ctx.globalAlpha = finalBright * 0.9;
              ctx.fillStyle = '#1a2040';
              ctx.fillRect(sx + TW * 0.25, sy + TH * 0.2, TW * 0.5, TH * 0.45);
              // Window frame
              ctx.strokeStyle = '#5a5a60';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx + TW * 0.25, sy + TH * 0.2, TW * 0.5, TH * 0.45);
              // Cross pane
              ctx.fillStyle = '#5a5a60';
              ctx.fillRect(sx + TW * 0.48, sy + TH * 0.2, 1, TH * 0.45);
              ctx.fillRect(sx + TW * 0.25, sy + TH * 0.4, TW * 0.5, 1);
              // Warm interior glow
              ctx.fillStyle = 'rgba(255,180,60,0.15)';
              ctx.fillRect(sx + TW * 0.27, sy + TH * 0.22, TW * 0.21, TH * 0.18);
              ctx.fillStyle = 'rgba(255,180,60,0.1)';
              ctx.fillRect(sx + TW * 0.5, sy + TH * 0.22, TW * 0.23, TH * 0.18);
            }
            wallTiles.push({ sx, sy, alpha: finalBright });
          } else if (tile === VTile.WallTop) {
            const wtImg = getTileImg('tile_wall_top');
            if (wtImg) {
              ctx.globalAlpha = finalBright;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(wtImg, sx, sy, TW, TH);
            } else {
              drawWallTop(ctx, sx, sy, mx, my, finalBright);
            }
            roofTiles.push({ sx, sy, mx, my, alpha: finalBright });
            // #16 Castle flag/banner animation on castle WallTop tiles
            if (mx >= 13 && mx <= 26 && my <= 2) {
              const flagWave = Math.sin(now * 0.004 + mx * 2) * 2;
              const flagColors = ['#cc2020', '#2020cc'];
              const flagColor = flagColors[mx % 2];
              if ((mx === 15 || mx === 24) && my === 1) {
                ctx.globalAlpha = finalBright * 0.8;
                // Flag pole
                ctx.fillStyle = '#8a8a90';
                ctx.fillRect(sx + TW / 2 - 0.5, sy, 1, TH * 0.8);
                // Flag cloth
                ctx.fillStyle = flagColor;
                ctx.beginPath();
                ctx.moveTo(sx + TW / 2 + 1, sy + 2);
                ctx.lineTo(sx + TW / 2 + 8 + flagWave, sy + 4);
                ctx.lineTo(sx + TW / 2 + 7 + flagWave * 0.5, sy + 8);
                ctx.lineTo(sx + TW / 2 + 1, sy + 6);
                ctx.closePath();
                ctx.fill();
              }
            }
          } else if (tile === VTile.Tree) {
            // Draw grass underneath first
            drawGrass(ctx, sx, sy, mx, my, finalBright);
            drawTree(ctx, sx, sy, tileHash(mx, my), finalBright);
          } else if (tile === VTile.Water) {
            drawWater(ctx, sx, sy, mx, my, now, finalBright);
          } else if (tile === VTile.DungeonEntry) {
            drawDungeonEntry(ctx, sx, sy, mx, my, now, finalBright);
          } else if (tile === VTile.Flower) {
            drawFlower(ctx, sx, sy, mx, my, now, finalBright);
          } else if (tile === VTile.Fence) {
            drawGrass(ctx, sx, sy, mx, my, finalBright);
            ctx.globalAlpha = finalBright;
            // Fence posts
            ctx.fillStyle = '#5a4a28';
            ctx.fillRect(sx + 2, sy + TH * 0.3, 3, TH * 0.6);
            ctx.fillRect(sx + TW - 5, sy + TH * 0.3, 3, TH * 0.6);
            // Horizontal rails
            ctx.fillStyle = '#6a5a30';
            ctx.fillRect(sx, sy + TH * 0.35, TW, 2);
            ctx.fillRect(sx, sy + TH * 0.65, TW, 2);
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(sx, sy + TH * 0.35, TW, 1);
          } else if (tile === VTile.Bridge) {
            // Wooden bridge planks
            ctx.globalAlpha = finalBright;
            ctx.fillStyle = '#4a3a18';
            ctx.fillRect(sx, sy, TW, TH);
            // Plank lines
            for (let pl = 0; pl < 4; pl++) {
              const py2 = sy + pl * 6 + 1;
              ctx.fillStyle = '#5a4a28';
              ctx.fillRect(sx + 1, py2, TW - 2, 5);
              ctx.fillStyle = 'rgba(255,255,255,0.06)';
              ctx.fillRect(sx + 1, py2, TW - 2, 1);
              ctx.fillStyle = 'rgba(0,0,0,0.15)';
              ctx.fillRect(sx + 1, py2 + 4, TW - 2, 1);
            }
            // Side rails
            ctx.fillStyle = '#3a2a10';
            ctx.fillRect(sx, sy, 2, TH);
            ctx.fillRect(sx + TW - 2, sy, 2, TH);
          } else if (tile === VTile.Fountain) {
            // #9 Fountain rendering: blue water circle with spray particles
            drawGrass(ctx, sx, sy, mx, my, finalBright);
            ctx.globalAlpha = finalBright;
            const fcx = sx + TW / 2, fcy = sy + TH / 2;
            // Base stone circle
            ctx.fillStyle = '#5a5a60';
            ctx.beginPath(); ctx.ellipse(fcx, fcy + 2, TW * 0.42, TH * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            // Water pool
            ctx.fillStyle = '#1a3a68';
            ctx.beginPath(); ctx.ellipse(fcx, fcy + 2, TW * 0.32, TH * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            // Animated water surface
            const waterPulse = Math.sin(now * 0.004 + mx * 3) * 0.15 + 0.5;
            ctx.fillStyle = `rgba(60,120,200,${waterPulse})`;
            ctx.beginPath(); ctx.ellipse(fcx, fcy + 2, TW * 0.28, TH * 0.2, 0, 0, Math.PI * 2); ctx.fill();
            // Center spout
            ctx.fillStyle = '#6a6a70';
            ctx.fillRect(fcx - 1, fcy - TH * 0.25, 2, TH * 0.2);
            // Spray particles rising
            for (let sp = 0; sp < 6; sp++) {
              const spPhase = (now * 0.003 + sp * 1.1 + mx * 0.5) % 2;
              const spAlpha = spPhase < 1 ? Math.sin(spPhase * Math.PI) * 0.6 : 0;
              if (spAlpha > 0.05) {
                ctx.globalAlpha = finalBright * spAlpha;
                ctx.fillStyle = '#80c0ff';
                const spx = fcx + Math.sin(sp * 2.5 + now * 0.002) * 3;
                const spy = fcy - TH * 0.25 - spPhase * 8;
                ctx.beginPath(); ctx.arc(spx, spy, 1 + (1 - spPhase) * 0.5, 0, Math.PI * 2); ctx.fill();
              }
            }
            // Water highlight
            ctx.globalAlpha = finalBright * 0.3;
            ctx.fillStyle = '#80b0e0';
            ctx.beginPath(); ctx.arc(fcx - 2, fcy, TW * 0.1, 0, Math.PI * 2); ctx.fill();
          } else if (tile === VTile.Dummy) {
            // #4 Training dummy rendering
            drawGrass(ctx, sx, sy, mx, my, finalBright);
            ctx.globalAlpha = finalBright;
            const dcx = sx + TW / 2;
            // Wooden pole
            ctx.fillStyle = '#5a4020';
            ctx.fillRect(dcx - 1.5, sy + TH * 0.2, 3, TH * 0.75);
            // Cross arm
            ctx.fillRect(dcx - 6, sy + TH * 0.3, 12, 2);
            // Head (straw circle)
            ctx.fillStyle = '#a08040';
            ctx.beginPath(); ctx.arc(dcx, sy + TH * 0.18, 4, 0, Math.PI * 2); ctx.fill();
            // Body straw padding
            ctx.fillStyle = '#8a6a30';
            ctx.beginPath(); ctx.ellipse(dcx, sy + TH * 0.5, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
            // Slash marks
            ctx.strokeStyle = '#3a2010';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(dcx - 3, sy + TH * 0.4); ctx.lineTo(dcx + 2, sy + TH * 0.55); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(dcx + 3, sy + TH * 0.42); ctx.lineTo(dcx - 2, sy + TH * 0.58); ctx.stroke();
          } else {
            // Try tile images for known types
            let usedTileImg = false;
            if (tile === VTile.Floor) {
              const floorVariants = ['tile_floor_1', 'tile_floor_2', 'tile_floor_3', 'tile_floor_4'];
              const fIdx = Math.floor(tileHash(mx, my) * floorVariants.length);
              const floorImg = getTileImg(floorVariants[fIdx]);
              if (floorImg) {
                ctx.globalAlpha = finalBright;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(floorImg, sx, sy, TW, TH);
                usedTileImg = true;
              }
            } else if (tile === VTile.Door) {
              const doorImg = getTileImg('tile_door_open');
              if (doorImg) {
                // Draw floor behind door
                const floorBg = getTileImg('tile_floor_1');
                if (floorBg) {
                  ctx.globalAlpha = finalBright;
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(floorBg, sx, sy, TW, TH);
                }
                // Door frame (stone arch)
                ctx.globalAlpha = finalBright;
                ctx.fillStyle = '#4a4a55';
                ctx.fillRect(sx, sy, 3, TH); // left frame
                ctx.fillRect(sx + TW - 3, sy, 3, TH); // right frame
                ctx.fillRect(sx, sy, TW, 3); // top frame
                // Frame highlight
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(sx + 1, sy + 1, 1, TH - 2);
                ctx.fillRect(sx + 1, sy + 1, TW - 2, 1);
                // Door sprite
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(doorImg, sx + 2, sy + 2, TW - 4, TH - 2);
                // Welcome mat
                ctx.fillStyle = '#5a4020';
                ctx.fillRect(sx + 3, sy + TH - 3, TW - 6, 2);
                usedTileImg = true;
              }
            } else if (tile === VTile.Chest) {
              const chestImg = getTileImg('tile_chest_full');
              if (chestImg) {
                // Draw floor behind chest
                const floorBg = getTileImg('tile_floor_1');
                if (floorBg) {
                  ctx.globalAlpha = finalBright;
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(floorBg, sx, sy, TW, TH);
                }
                ctx.globalAlpha = finalBright;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(chestImg, sx, sy, TW, TH);
                usedTileImg = true;
              }
            } else if (tile === VTile.Stairs) {
              const stairsImg = getTileImg('tile_stairs');
              if (stairsImg) {
                ctx.globalAlpha = finalBright;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(stairsImg, sx, sy, TW, TH);
                usedTileImg = true;
              }
            } else if (tile === VTile.Barrel) {
              const crateImg = getTileImg('tile_crate');
              if (crateImg) {
                const floorBg = getTileImg('tile_floor_1');
                if (floorBg) {
                  ctx.globalAlpha = finalBright;
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(floorBg, sx, sy, TW, TH);
                }
                ctx.globalAlpha = finalBright;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(crateImg, sx, sy, TW, TH);
                usedTileImg = true;
              }
            } else if (tile === VTile.Counter) {
              // Wooden counter with items on display
              const floorBg = getTileImg('tile_floor_1');
              if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              ctx.globalAlpha = finalBright;
              // Counter body
              ctx.fillStyle = '#5a4a28';
              ctx.fillRect(sx + 1, sy + TH * 0.3, TW - 2, TH * 0.6);
              // Counter top surface (lighter)
              ctx.fillStyle = '#7a6a3a';
              ctx.fillRect(sx + 1, sy + TH * 0.3, TW - 2, 3);
              // Wood grain lines
              ctx.fillStyle = 'rgba(0,0,0,0.15)';
              ctx.fillRect(sx + 3, sy + TH * 0.5, TW - 6, 1);
              ctx.fillRect(sx + 3, sy + TH * 0.7, TW - 6, 1);
              // Items on counter (small colored dots)
              const counterH = tileHash(mx, my);
              if (counterH > 0.5) {
                ctx.fillStyle = '#c04040'; ctx.beginPath(); ctx.arc(sx + 6, sy + TH * 0.35, 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#40a040'; ctx.beginPath(); ctx.arc(sx + 14, sy + TH * 0.35, 2, 0, Math.PI * 2); ctx.fill();
              }
              usedTileImg = true;
            } else if (tile === VTile.Well) {
              // Stone circular well
              drawGrass(ctx, sx, sy, mx, my, finalBright);
              ctx.globalAlpha = finalBright;
              const wcx = sx + TW / 2, wcy = sy + TH / 2;
              // Shadow
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              ctx.beginPath(); ctx.ellipse(wcx + 1, wcy + 2, TW * 0.4, TH * 0.3, 0, 0, Math.PI * 2); ctx.fill();
              // Outer stone ring
              ctx.fillStyle = '#5a5a60';
              ctx.beginPath(); ctx.ellipse(wcx, wcy, TW * 0.4, TH * 0.35, 0, 0, Math.PI * 2); ctx.fill();
              // Dark water inside
              ctx.fillStyle = '#0a1530';
              ctx.beginPath(); ctx.ellipse(wcx, wcy, TW * 0.28, TH * 0.22, 0, 0, Math.PI * 2); ctx.fill();
              // Stone highlight
              ctx.fillStyle = 'rgba(255,255,255,0.1)';
              ctx.beginPath(); ctx.arc(wcx - 2, wcy - 2, TW * 0.15, 0, Math.PI * 2); ctx.fill();
              // Rope/bucket post
              ctx.fillStyle = '#4a3a20';
              ctx.fillRect(wcx - 1, wcy - TH * 0.4, 2, TH * 0.2);
              ctx.fillRect(wcx - 4, wcy - TH * 0.4, 8, 2);
              usedTileImg = true;
            } else if (tile === VTile.Sign) {
              // Wooden signpost
              drawGrass(ctx, sx, sy, mx, my, finalBright);
              ctx.globalAlpha = finalBright;
              const scx = sx + TW / 2;
              // Post
              ctx.fillStyle = '#4a3a20';
              ctx.fillRect(scx - 1, sy + TH * 0.25, 3, TH * 0.7);
              // Sign board
              ctx.fillStyle = '#6a5a30';
              ctx.fillRect(scx - 7, sy + TH * 0.15, 14, 10);
              // Border
              ctx.strokeStyle = '#3a2a10';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(scx - 7, sy + TH * 0.15, 14, 10);
              // Text lines
              ctx.fillStyle = '#1a1a10';
              ctx.fillRect(scx - 5, sy + TH * 0.22, 10, 1);
              ctx.fillRect(scx - 4, sy + TH * 0.35, 8, 1);
              usedTileImg = true;
            } else if (tile === VTile.Bookshelf) {
              // Bookshelf with colorful books
              const floorBg = getTileImg('tile_floor_1');
              if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              ctx.globalAlpha = finalBright;
              // Shelf frame
              ctx.fillStyle = '#3a2818';
              ctx.fillRect(sx + 1, sy + 1, TW - 2, TH - 2);
              // Shelves (3 rows)
              const bookColors = ['#8a2020','#204080','#206020','#806020','#602060','#206060','#804020','#402080'];
              for (let shelf = 0; shelf < 3; shelf++) {
                const shelfY = sy + 2 + shelf * 7;
                ctx.fillStyle = '#5a4020';
                ctx.fillRect(sx + 2, shelfY + 6, TW - 4, 1); // shelf board
                // Books
                for (let b = 0; b < 5; b++) {
                  const bh = tileHash(mx * 7 + b, my * 11 + shelf);
                  const bookW = 2 + bh;
                  const bookH = 4 + bh * 2;
                  ctx.fillStyle = bookColors[Math.floor(bh * bookColors.length) % bookColors.length];
                  ctx.fillRect(sx + 3 + b * 4, shelfY + 6 - bookH, bookW, bookH);
                }
              }
              usedTileImg = true;
            } else if (tile === VTile.Bed) {
              // Bed with pillow and blanket
              const floorBg = getTileImg('tile_floor_1');
              if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              ctx.globalAlpha = finalBright;
              // Bed frame
              ctx.fillStyle = '#4a3020';
              ctx.beginPath(); ctx.roundRect(sx + 2, sy + 3, TW - 4, TH - 5, 2); ctx.fill();
              // Mattress
              ctx.fillStyle = '#6a5040';
              ctx.fillRect(sx + 3, sy + 4, TW - 6, TH - 7);
              // Blanket (reddish)
              ctx.fillStyle = '#6a3030';
              ctx.fillRect(sx + 3, sy + TH * 0.45, TW - 6, TH * 0.4);
              // Pillow (white)
              ctx.fillStyle = '#d0c8b0';
              ctx.beginPath(); ctx.roundRect(sx + 5, sy + 5, TW - 10, 5, 2); ctx.fill();
              // Blanket fold line
              ctx.fillStyle = 'rgba(0,0,0,0.15)';
              ctx.fillRect(sx + 3, sy + TH * 0.45, TW - 6, 1);
              usedTileImg = true;
            } else if (tile === VTile.Table) {
              // Wooden table
              const floorBg = getTileImg('tile_floor_1');
              if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              ctx.globalAlpha = finalBright;
              // Table top
              ctx.fillStyle = '#5a4a28';
              ctx.beginPath(); ctx.roundRect(sx + 2, sy + TH * 0.2, TW - 4, TH * 0.35, 1); ctx.fill();
              // Surface highlight
              ctx.fillStyle = '#6a5a38';
              ctx.fillRect(sx + 3, sy + TH * 0.22, TW - 6, 2);
              // Legs
              ctx.fillStyle = '#4a3a18';
              ctx.fillRect(sx + 3, sy + TH * 0.55, 2, TH * 0.35);
              ctx.fillRect(sx + TW - 5, sy + TH * 0.55, 2, TH * 0.35);
              // Shadow under table
              ctx.fillStyle = 'rgba(0,0,0,0.15)';
              ctx.fillRect(sx + 4, sy + TH * 0.88, TW - 8, 2);
              usedTileImg = true;
            } else if (tile === VTile.Chair) {
              // Chair
              const isOutdoor = my > 0 && my < vmap.height - 1 &&
                vmap.tiles[my][mx] !== VTile.Floor;
              if (isOutdoor) {
                drawGrass(ctx, sx, sy, mx, my, finalBright);
              } else {
                const floorBg = getTileImg('tile_floor_1');
                if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              }
              ctx.globalAlpha = finalBright;
              // Chair back
              ctx.fillStyle = '#5a4020';
              ctx.fillRect(sx + TW * 0.25, sy + TH * 0.1, TW * 0.5, 3);
              // Chair back legs
              ctx.fillRect(sx + TW * 0.25, sy + TH * 0.1, 2, TH * 0.5);
              ctx.fillRect(sx + TW * 0.7, sy + TH * 0.1, 2, TH * 0.5);
              // Seat
              ctx.fillStyle = '#6a5030';
              ctx.fillRect(sx + TW * 0.2, sy + TH * 0.5, TW * 0.6, 3);
              // Front legs
              ctx.fillStyle = '#5a4020';
              ctx.fillRect(sx + TW * 0.2, sy + TH * 0.5, 2, TH * 0.4);
              ctx.fillRect(sx + TW * 0.75, sy + TH * 0.5, 2, TH * 0.4);
              usedTileImg = true;
            } else if (tile === VTile.Throne) {
              // Golden ornate throne
              const floorBg = getTileImg('tile_floor_1');
              if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              ctx.globalAlpha = finalBright;
              // Carpet underneath
              ctx.fillStyle = '#4a1a1a';
              ctx.fillRect(sx, sy, TW, TH);
              // Throne back (tall golden)
              ctx.fillStyle = '#c9a84c';
              ctx.beginPath();
              ctx.moveTo(sx + 3, sy + TH * 0.8);
              ctx.lineTo(sx + 3, sy + 2);
              ctx.lineTo(sx + TW / 2, sy);
              ctx.lineTo(sx + TW - 3, sy + 2);
              ctx.lineTo(sx + TW - 3, sy + TH * 0.8);
              ctx.closePath();
              ctx.fill();
              // Throne inner
              ctx.fillStyle = '#b09040';
              ctx.fillRect(sx + 5, sy + 4, TW - 10, TH * 0.6);
              // Seat cushion (red)
              ctx.fillStyle = '#8a2020';
              ctx.fillRect(sx + 5, sy + TH * 0.5, TW - 10, 5);
              // Armrests
              ctx.fillStyle = '#c9a84c';
              ctx.fillRect(sx + 2, sy + TH * 0.5, 4, 3);
              ctx.fillRect(sx + TW - 6, sy + TH * 0.5, 4, 3);
              // Gem at top
              ctx.fillStyle = '#FF2020';
              ctx.beginPath(); ctx.arc(sx + TW / 2, sy + 3, 2, 0, Math.PI * 2); ctx.fill();
              // Gold trim
              ctx.strokeStyle = '#DAA520';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(sx + 4, sy + 3, TW - 8, TH * 0.65);
              usedTileImg = true;
            } else if (tile === VTile.Pot) {
              // Clay pot
              const isFloorNearby = my > 0 && vmap.tiles[Math.max(0, my-1)][mx] === VTile.Wall;
              if (isFloorNearby) {
                const floorBg = getTileImg('tile_floor_1');
                if (floorBg) { ctx.globalAlpha = finalBright; ctx.imageSmoothingEnabled = false; ctx.drawImage(floorBg, sx, sy, TW, TH); }
              } else {
                drawGrass(ctx, sx, sy, mx, my, finalBright);
              }
              ctx.globalAlpha = finalBright;
              const pcx = sx + TW / 2;
              // Pot body
              ctx.fillStyle = '#8a6a40';
              ctx.beginPath();
              ctx.ellipse(pcx, sy + TH * 0.65, TW * 0.3, TH * 0.25, 0, 0, Math.PI * 2);
              ctx.fill();
              // Pot rim
              ctx.fillStyle = '#6a5030';
              ctx.fillRect(pcx - TW * 0.2, sy + TH * 0.35, TW * 0.4, 3);
              // Pot neck
              ctx.fillStyle = '#7a5a38';
              ctx.fillRect(pcx - TW * 0.15, sy + TH * 0.38, TW * 0.3, TH * 0.15);
              // Highlight
              ctx.fillStyle = 'rgba(255,255,255,0.1)';
              ctx.fillRect(pcx - TW * 0.1, sy + TH * 0.5, 2, TH * 0.15);
              // Shadow
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.beginPath(); ctx.ellipse(pcx + 1, sy + TH * 0.88, TW * 0.25, 2, 0, 0, Math.PI * 2); ctx.fill();
              usedTileImg = true;
            } else if (tile === VTile.Carpet) {
              // Rich red carpet with gold border
              ctx.globalAlpha = finalBright;
              ctx.fillStyle = '#4a1a1a';
              ctx.fillRect(sx, sy, TW, TH);
              // Pattern (diamond in center)
              ctx.fillStyle = '#5a2020';
              ctx.beginPath();
              ctx.moveTo(sx + TW / 2, sy + 2);
              ctx.lineTo(sx + TW - 3, sy + TH / 2);
              ctx.lineTo(sx + TW / 2, sy + TH - 2);
              ctx.lineTo(sx + 3, sy + TH / 2);
              ctx.closePath();
              ctx.fill();
              // Gold border
              ctx.fillStyle = 'rgba(201,168,76,0.2)';
              ctx.fillRect(sx, sy, TW, 1);
              ctx.fillRect(sx, sy + TH - 1, TW, 1);
              ctx.fillRect(sx, sy, 1, TH);
              ctx.fillRect(sx + TW - 1, sy, 1, TH);
              // Gold inner border
              ctx.fillStyle = 'rgba(201,168,76,0.12)';
              ctx.fillRect(sx + 2, sy + 2, TW - 4, 1);
              ctx.fillRect(sx + 2, sy + TH - 3, TW - 4, 1);
              ctx.fillRect(sx + 2, sy + 2, 1, TH - 4);
              ctx.fillRect(sx + TW - 3, sy + 2, 1, TH - 4);
              usedTileImg = true;
            }

            if (!usedTileImg) {
              // Default procedural tile rendering (fallback for any remaining tiles)
              ctx.fillStyle = color.bg;
              ctx.globalAlpha = finalBright;
              ctx.fillRect(sx, sy, TW, TH);
              if (color.fg) {
                ctx.fillStyle = color.fg;
                ctx.globalAlpha = finalBright * 0.8;
                const ch = TILE_CHARS[tile];
                if (ch) {
                  ctx.font = `${TW * 0.6}px monospace`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(ch, sx + TW / 2, sy + TH / 2);
                } else {
                  ctx.fillRect(sx + 2, sy + 2, TW - 4, TH - 4);
                }
              }
              if (tile === VTile.Floor) {
                const fh = tileHash(mx, my);
                ctx.fillStyle = `rgba(255,255,255,${0.02 + fh * 0.03})`;
                ctx.fillRect(sx, sy, TW, 1);
                ctx.fillStyle = `rgba(0,0,0,${0.05 + fh * 0.05})`;
                ctx.fillRect(sx, sy + TH - 1, TW, 1);
              }
            }
          }

          // #17 Warm light glow from building doors
          if (tile === VTile.Door) {
            ctx.globalAlpha = 0.2 + Math.sin(now * 0.003 + mx * 5) * 0.05;
            const doorGrad = ctx.createRadialGradient(
              sx + TW / 2, sy + TH, 0,
              sx + TW / 2, sy + TH, TW * 2.5
            );
            doorGrad.addColorStop(0, 'rgba(255,180,60,0.25)');
            doorGrad.addColorStop(0.3, 'rgba(255,140,40,0.1)');
            doorGrad.addColorStop(0.7, 'rgba(255,100,20,0.03)');
            doorGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = doorGrad;
            ctx.fillRect(sx - TW * 2, sy, TW * 5, TH * 3);
          }

          // #18 River current direction indicator
          if (tile === VTile.Water) {
            ctx.globalAlpha = finalBright * 0.2;
            ctx.strokeStyle = 'rgba(100,160,220,0.4)';
            ctx.lineWidth = 0.8;
            const arrowPhase = (now * 0.001 + my * 0.5) % 2;
            const arrowY2 = sy + arrowPhase * TH;
            const arrowX2 = sx + TW * 0.3 + Math.sin(my * 2.7) * TW * 0.2;
            ctx.beginPath();
            ctx.moveTo(arrowX2, arrowY2 - 2);
            ctx.lineTo(arrowX2, arrowY2 + 3);
            ctx.moveTo(arrowX2 - 1.5, arrowY2 + 1);
            ctx.lineTo(arrowX2, arrowY2 + 3);
            ctx.lineTo(arrowX2 + 1.5, arrowY2 + 1);
            ctx.stroke();
          }

          // Torch glow effect (warm orange radial)
          if (tile === VTile.Torch) {
            const flicker = 0.6 + Math.sin(now * 0.005 + mx * 7) * 0.4;
            ctx.globalAlpha = flicker * 0.3;
            const grad = ctx.createRadialGradient(sx + TW / 2, sy + TH / 2, 0, sx + TW / 2, sy + TH / 2, TW * 4);
            grad.addColorStop(0, '#ffa040');
            grad.addColorStop(0.3, 'rgba(255,140,40,0.4)');
            grad.addColorStop(0.6, 'rgba(255,100,20,0.1)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(sx - TW * 3, sy - TH * 3, TW * 7, TH * 7);
            // Flame on torch
            ctx.globalAlpha = finalBright;
            const flameH = 3 + Math.sin(now * 0.01 + mx * 5) * 1.5;
            ctx.fillStyle = '#ff9030';
            ctx.beginPath();
            ctx.ellipse(sx + TW / 2, sy + TH * 0.3, 2, flameH, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffe080';
            ctx.beginPath();
            ctx.ellipse(sx + TW / 2, sy + TH * 0.3 + 1, 1, flameH * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // === Building shadow pass: walls cast shadows to SE ===
      ctx.globalAlpha = 1;
      for (const wt of wallTiles) {
        drawBuildingShadow(ctx, wt.sx, wt.sy, wt.alpha);
      }

      // === Roof pass: draw peaked roofs over WallTop tiles ===
      // Different roof colors per building area
      function getRoofColor(screenX: number, camX2: number): [string, string] {
        const mapX = Math.round((screenX - CW / 2) / TW + camX2);
        // Castle (x=13..26)
        if (mapX >= 13 && mapX <= 26) return ['#2a2858', '#3a3868']; // royal blue
        // Weapon shop / Home (left side, x=5..11)
        if (mapX >= 5 && mapX <= 11) return ['#5a2018', '#6a2a20']; // red-brown
        // Tavern / Church (right side, x=27..34)
        if (mapX >= 27 && mapX <= 34) return ['#1a3a20', '#2a4a30']; // forest green
        // Storage (x=28..34)
        return ['#4a3a20', '#5a4a30']; // wood brown
      }

      if (roofTiles.length > 0) {
        const roofByY = new Map<number, { sx: number; sy: number; alpha: number }[]>();
        for (const rt of roofTiles) {
          const key = rt.sy;
          if (!roofByY.has(key)) roofByY.set(key, []);
          roofByY.get(key)!.push(rt);
        }
        for (const [_rowY, tiles] of roofByY) {
          tiles.sort((a, b) => a.sx - b.sx);
          let runStart = 0;
          for (let i = 0; i <= tiles.length; i++) {
            if (i === tiles.length || (i > runStart && tiles[i].sx - tiles[i - 1].sx > TW + 1)) {
              const leftSx = tiles[runStart].sx;
              const rightSx = tiles[i - 1].sx + TW;
              const roofY = tiles[runStart].sy;
              const roofW = rightSx - leftSx;
              const avgAlpha = tiles.slice(runStart, i).reduce((s, t) => s + t.alpha, 0) / (i - runStart);
              const [roofDark, roofLight] = getRoofColor(leftSx + roofW / 2, camX);

              ctx.globalAlpha = avgAlpha * 0.92;
              // Peaked roof triangle (dark side)
              ctx.fillStyle = roofDark;
              ctx.beginPath();
              ctx.moveTo(leftSx - 3, roofY + TH);
              ctx.lineTo(leftSx + roofW / 2, roofY - 6);
              ctx.lineTo(leftSx + roofW / 2, roofY + TH);
              ctx.closePath();
              ctx.fill();
              // Lighter front face
              ctx.fillStyle = roofLight;
              ctx.beginPath();
              ctx.moveTo(leftSx + roofW / 2, roofY - 6);
              ctx.lineTo(rightSx + 3, roofY + TH);
              ctx.lineTo(leftSx + roofW / 2, roofY + TH);
              ctx.closePath();
              ctx.fill();
              // Ridge cap
              ctx.fillStyle = 'rgba(255,255,255,0.08)';
              ctx.fillRect(leftSx + roofW / 2 - 1, roofY - 6, 2, TH + 6);
              // Horizontal tile lines on roof
              ctx.strokeStyle = 'rgba(0,0,0,0.15)';
              ctx.lineWidth = 0.5;
              for (let rl = 0; rl < 4; rl++) {
                const rly = roofY + 2 + rl * 5;
                if (rly < roofY + TH) {
                  const inset = (rly - roofY + 6) * roofW / (TH + 12) * 0.5;
                  ctx.beginPath();
                  ctx.moveTo(leftSx + inset - 2, rly);
                  ctx.lineTo(rightSx - inset + 2, rly);
                  ctx.stroke();
                }
              }
              // Eave shadow
              ctx.globalAlpha = avgAlpha * 0.3;
              ctx.fillStyle = '#000000';
              ctx.fillRect(leftSx - 3, roofY + TH - 1, roofW + 6, 3);

              runStart = i;
            }
          }
        }
      }

      ctx.globalAlpha = 1;

      // Draw NPCs
      for (const npc of vmap.npcs) {
        const pos = npcPosRef.current.get(npc.id) || npc.pos;
        const nsx = CW / 2 + (pos.x - camX) * TW;
        const nsy = CH / 2 + (pos.y - camY) * TH;

        // Check if on screen
        if (nsx < -TW * 2 || nsx > CW + TW * 2 || nsy < -TH * 2 || nsy > CH + TH * 2) continue;

        const dist = Math.sqrt((pos.x - px) * (pos.x - px) + (pos.y - py) * (pos.y - py));
        const dimFactor = Math.max(0.3, 1.0 - Math.max(0, dist - 3) / 8);

        const isKing = npc.visualType === 'king' || npc.id === 'king';
        const isCat = npc.sprite === 'cat_custom' || npc.visualType === 'cat';

        // #13 NPC idle animation variance: occasionally look different directions
        const idleTimer = npcIdleDirTimers.get(npc.id) || 0;
        if (now > idleTimer && !npc.wander) {
          const lookDirs = [0, 1, 2, 3]; // down, up, left, right
          const newDir = lookDirs[Math.floor(Math.random() * lookDirs.length)];
          npc.facing = newDir;
          npcIdleDirTimers.set(npc.id, now + 3000 + Math.random() * 5000);
        }

        // King golden glow
        if (isKing) {
          const glowPulse = 0.3 + Math.sin(now * 0.003) * 0.1;
          ctx.globalAlpha = dimFactor * glowPulse;
          const kingGrad = ctx.createRadialGradient(
            nsx + TW / 2, nsy + TH / 2, 0,
            nsx + TW / 2, nsy + TH / 2, TW * 2.5
          );
          kingGrad.addColorStop(0, '#FFD700');
          kingGrad.addColorStop(0.3, 'rgba(255,200,50,0.3)');
          kingGrad.addColorStop(0.7, 'rgba(255,180,30,0.1)');
          kingGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = kingGrad;
          ctx.fillRect(nsx - TW * 2, nsy - TH * 2, TW * 5, TH * 5);
        }

        // Elliptical ground shadow
        ctx.globalAlpha = dimFactor * 0.35;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(nsx + TW / 2, nsy + TH - 1, TW * 0.35, TH * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle bounce animation
        const bounce = Math.abs(Math.sin(now * 0.003 + pos.x * 5 + pos.y * 7)) * 1.5;
        const baseScale = isKing ? 1.3 : 1.1;

        if (isCat) {
          // Draw procedural cat
          ctx.globalAlpha = dimFactor;
          drawCat(ctx, nsx, nsy, now);
        } else {
          const sprImg = getSpriteFrame(npc.sprite, now);
          if (sprImg && sprImg.naturalWidth > 0) {
            const w = sprImg.naturalWidth;
            const h = sprImg.naturalHeight;
            const sprScale = TW * 0.9 * baseScale / w;
            const dw = w * sprScale;
            const dh = h * sprScale;
            ctx.globalAlpha = dimFactor;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprImg, nsx + TW / 2 - dw / 2, nsy + TH - dh - bounce, dw, dh);

            // Crown for king
            if (isKing) {
              drawKingCrown(ctx, nsx + TW / 2, nsy + TH - dh - bounce - 4);
            }
            // Guard: spear/weapon icon
            if (npc.visualType === 'guard') {
              ctx.globalAlpha = dimFactor * 0.7;
              ctx.fillStyle = '#8899AA';
              // Small spear beside guard
              const spearX = nsx + TW * 0.8;
              ctx.fillRect(spearX, nsy + TH * 0.1 - bounce, 1.5, TH * 0.7);
              // Spear tip
              ctx.fillStyle = '#AABBCC';
              ctx.beginPath();
              ctx.moveTo(spearX - 2, nsy + TH * 0.1 - bounce);
              ctx.lineTo(spearX + 0.75, nsy - 2 - bounce);
              ctx.lineTo(spearX + 3.5, nsy + TH * 0.1 - bounce);
              ctx.closePath();
              ctx.fill();
            }
            // Merchant: small bag/pouch
            if (npc.visualType === 'merchant') {
              ctx.globalAlpha = dimFactor * 0.6;
              ctx.fillStyle = '#8a6a30';
              ctx.beginPath();
              ctx.ellipse(nsx + TW * 0.8, nsy + TH * 0.75 - bounce, 3, 4, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#6a5020';
              ctx.fillRect(nsx + TW * 0.8 - 2, nsy + TH * 0.68 - bounce, 4, 2);
            }
            // Priest: subtle halo
            if (npc.visualType === 'priest') {
              ctx.globalAlpha = dimFactor * 0.25;
              ctx.strokeStyle = '#FFE8A0';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(nsx + TW / 2, nsy + TH - dh - bounce - 2, 6, 3, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            // Elder: subtle mystical particles
            if (npc.visualType === 'elder') {
              for (let ep = 0; ep < 2; ep++) {
                const epA = now * 0.002 + ep * 3.14;
                const epR = 6 + Math.sin(now * 0.003 + ep) * 3;
                ctx.globalAlpha = dimFactor * 0.3 * (Math.sin(now * 0.004 + ep * 2) * 0.5 + 0.5);
                ctx.fillStyle = '#C0A0FF';
                ctx.beginPath();
                ctx.arc(nsx + TW / 2 + Math.cos(epA) * epR, nsy + TH * 0.3 + Math.sin(epA) * epR * 0.6 - bounce, 1, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            // Bard: floating music notes
            if (npc.visualType === 'bard') {
              for (let mn = 0; mn < 3; mn++) {
                const notePhase = now * 0.002 + mn * 2.1;
                const noteLife = (notePhase % 4) / 4;
                if (noteLife < 0.8) {
                  const noteX = nsx + TW / 2 + Math.sin(notePhase * 1.5 + mn) * 8;
                  const noteY = nsy - 5 - noteLife * 15 - bounce;
                  ctx.globalAlpha = dimFactor * (0.8 - noteLife) * 0.6;
                  ctx.fillStyle = '#CC88FF';
                  ctx.font = '8px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText(mn % 2 === 0 ? '♪' : '♫', noteX, noteY);
                }
              }
            }
            // Adventurer: battle aura (red sparks)
            if (npc.visualType === 'adventurer') {
              for (let sp = 0; sp < 2; sp++) {
                const sparkA = now * 0.004 + sp * 3.14;
                const sparkR = 5 + Math.sin(now * 0.005 + sp) * 2;
                ctx.globalAlpha = dimFactor * 0.4 * (Math.sin(now * 0.006 + sp) * 0.5 + 0.5);
                ctx.fillStyle = '#FF4444';
                ctx.beginPath();
                ctx.arc(nsx + TW / 2 + Math.cos(sparkA) * sparkR, nsy + TH * 0.4 + Math.sin(sparkA) * sparkR * 0.5 - bounce, 1, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            // Mother: warm heart particles
            if (npc.visualType === 'mother') {
              const heartBeat = Math.sin(now * 0.003) * 0.3 + 0.7;
              ctx.globalAlpha = dimFactor * 0.3 * heartBeat;
              ctx.fillStyle = '#FF8888';
              ctx.font = '7px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('♥', nsx + TW * 0.8, nsy + TH * 0.2 - bounce);
            }
          } else {
            // Fallback
            ctx.globalAlpha = dimFactor;
            ctx.fillStyle = '#c0a060';
            ctx.fillRect(nsx + TW * 0.15, nsy + TH * 0.05 - bounce, TW * 0.7, TH * 0.85);
            if (isKing) {
              drawKingCrown(ctx, nsx + TW / 2, nsy + TH * 0.05 - bounce - 4);
            }
          }
        }

        // NPC name + title when close
        if (dist <= 3) {
          ctx.globalAlpha = Math.min(0.9, 1.0 - (dist - 1) * 0.2);
          ctx.font = '10px "Noto Sans JP", sans-serif';
          const nameText = npc.title ? `${npc.name} - ${npc.title}` : npc.name;
          const nameW = ctx.measureText(nameText).width;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          ctx.roundRect(nsx + TW / 2 - nameW / 2 - 4, nsy - 15, nameW + 8, 14, 3);
          ctx.fill();
          // Colored left accent bar
          ctx.fillStyle = npc.nameColor || '#d4c5a0';
          ctx.fillRect(nsx + TW / 2 - nameW / 2 - 4, nsy - 15, 2, 14);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(nameText, nsx + TW / 2, nsy - 3);
        }

        // Interaction indicator (! bubble) when adjacent
        if (dist <= 1.5) {
          const bubbleY = nsy - 20 + Math.sin(now * 0.005) * 2;
          ctx.globalAlpha = 0.9;
          // Bubble background
          ctx.fillStyle = npc.shopType ? '#FFD700' : '#FFFFFF';
          ctx.beginPath();
          ctx.arc(nsx + TW / 2, bubbleY, 6, 0, Math.PI * 2);
          ctx.fill();
          // Bubble pointer
          ctx.beginPath();
          ctx.moveTo(nsx + TW / 2 - 3, bubbleY + 5);
          ctx.lineTo(nsx + TW / 2, bubbleY + 10);
          ctx.lineTo(nsx + TW / 2 + 3, bubbleY + 5);
          ctx.fill();
          // Symbol
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(npc.shopType ? '$' : '!', nsx + TW / 2, bubbleY);
        }
      }

      ctx.globalAlpha = 1;

      // Draw building name labels above doors
      const buildingLabels: { doorX: number; doorY: number; name: string; color: string }[] = [
        { doorX: 8, doorY: 12, name: '武器屋', color: '#FF6644' },
        { doorX: 8, doorY: 20, name: '道具屋', color: '#66CC88' },
        { doorX: 31, doorY: 12, name: '酒場', color: '#CC8844' },
        { doorX: 31, doorY: 20, name: '教会', color: '#FFFFFF' },
        { doorX: 8, doorY: 26, name: '自宅', color: '#FFCC88' },
        { doorX: 31, doorY: 26, name: '倉庫', color: '#8899AA' },
        { doorX: 19, doorY: 5, name: '城', color: '#FFD700' },
      ];
      for (const bl of buildingLabels) {
        const bsx = CW / 2 + (bl.doorX - camX) * TW;
        const bsy = CW > 0 ? CH / 2 + (bl.doorY - 2 - camY) * TH : 0;
        if (bsx < -100 || bsx > CW + 100 || bsy < -100 || bsy > CH + 100) continue;
        const bDist = Math.sqrt((bl.doorX - px) * (bl.doorX - px) + (bl.doorY - py) * (bl.doorY - py));
        if (bDist > 10) continue;
        const bAlpha = Math.max(0.2, 1.0 - bDist / 10);
        ctx.globalAlpha = bAlpha * 0.85;
        ctx.font = 'bold 10px "Noto Sans JP", sans-serif';
        const labelW = ctx.measureText(bl.name).width;
        // Sign board background
        ctx.fillStyle = 'rgba(30,20,10,0.85)';
        ctx.beginPath();
        ctx.roundRect(bsx + TW / 2 - labelW / 2 - 6, bsy + 2, labelW + 12, 16, 3);
        ctx.fill();
        // Border
        ctx.strokeStyle = bl.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bsx + TW / 2 - labelW / 2 - 6, bsy + 2, labelW + 12, 16, 3);
        ctx.stroke();
        // Text
        ctx.fillStyle = bl.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bl.name, bsx + TW / 2, bsy + 10);
      }
      ctx.globalAlpha = 1;

      // Draw player (HERO - visually distinct from all NPCs)
      const psx = CW / 2;
      const psy = CH / 2;
      const pCenterX = psx + TW / 2;
      const pCenterY = psy + TH / 2;

      // Hero aura (blue-white radial glow, pulsating)
      const heroPulse = 0.3 + Math.sin(now * 0.003) * 0.12;
      ctx.globalAlpha = heroPulse;
      const heroAura = ctx.createRadialGradient(pCenterX, pCenterY, 0, pCenterX, pCenterY, TW * 2);
      heroAura.addColorStop(0, 'rgba(100,160,255,0.25)');
      heroAura.addColorStop(0.3, 'rgba(80,140,255,0.1)');
      heroAura.addColorStop(0.6, 'rgba(60,100,200,0.03)');
      heroAura.addColorStop(1, 'transparent');
      ctx.fillStyle = heroAura;
      ctx.fillRect(psx - TW * 2, psy - TH * 2, TW * 5, TH * 5);

      // Player elliptical ground shadow (larger, blue-tinted)
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#000020';
      ctx.beginPath();
      ctx.ellipse(pCenterX, psy + TH, TW * 0.45, TH * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      // Faint blue ring on ground
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#4080ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(pCenterX, psy + TH, TW * 0.5, TH * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const playerImg = getSpriteFrame('knight_m', now);
      const playerScale = 1.15; // Hero is slightly larger than NPCs
      if (playerImg && playerImg.naturalWidth > 0) {
        const w = playerImg.naturalWidth;
        const h = playerImg.naturalHeight;
        const scale = TW * 0.95 * playerScale / w;
        const dw = w * scale;
        const dh = h * scale;
        ctx.imageSmoothingEnabled = false;
        const facingLeft = state.player.facing === Direction.Left;

        // Blue glow outline (draw sprite shadow copies offset in each direction)
        ctx.globalAlpha = 0.35;
        ctx.shadowColor = '#4488ff';
        ctx.shadowBlur = 4;
        const outlineOffsets = [[-1.5,0],[1.5,0],[0,-1.5],[0,1.5]];
        for (const [ox, oy] of outlineOffsets) {
          if (facingLeft) {
            ctx.save();
            ctx.translate(pCenterX, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(playerImg, -dw / 2 + ox, psy + TH - dh + oy, dw, dh);
            ctx.restore();
          } else {
            ctx.drawImage(playerImg, pCenterX - dw / 2 + ox, psy + TH - dh + oy, dw, dh);
          }
        }
        ctx.shadowBlur = 0;

        // Draw actual player sprite on top (clean, bright)
        ctx.globalAlpha = 1;
        if (facingLeft) {
          ctx.save();
          ctx.translate(pCenterX, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(playerImg, -dw / 2, psy + TH - dh, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(playerImg, pCenterX - dw / 2, psy + TH - dh, dw, dh);
        }

        // Equipped weapon sprite overlay (small, beside the player)
        const weaponImgKey = state.player.equippedWeapon ? 'tile_weapon_sword' : null;
        if (weaponImgKey) {
          const wImg = getTileImg(weaponImgKey);
          if (wImg && wImg.naturalWidth > 0) {
            ctx.globalAlpha = 0.85;
            const wScale = 0.6;
            const ww = wImg.naturalWidth * wScale;
            const wh = wImg.naturalHeight * wScale;
            const weaponX = facingLeft ? pCenterX - dw / 2 - ww * 0.3 : pCenterX + dw / 2 - ww * 0.7;
            const weaponY = psy + TH - dh * 0.6;
            ctx.imageSmoothingEnabled = false;
            if (facingLeft) {
              ctx.save();
              ctx.translate(weaponX + ww / 2, weaponY + wh / 2);
              ctx.scale(-1, 1);
              ctx.drawImage(wImg, -ww / 2, -wh / 2, ww, wh);
              ctx.restore();
            } else {
              ctx.drawImage(wImg, weaponX, weaponY, ww, wh);
            }
          }
        }

        // Equipped shield overlay (on opposite side)
        if (state.player.equippedShield) {
          const sImg = getTileImg('tile_weapon_shield');
          if (sImg && sImg.naturalWidth > 0) {
            ctx.globalAlpha = 0.75;
            const ss = 0.5;
            const sw2 = sImg.naturalWidth * ss;
            const sh2 = sImg.naturalHeight * ss;
            const shieldX = facingLeft ? pCenterX + dw / 2 - sw2 * 0.3 : pCenterX - dw / 2 - sw2 * 0.7;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sImg, shieldX, psy + TH - dh * 0.5, sw2, sh2);
          }
        }
      } else {
        // Fallback (no sprite loaded)
        ctx.fillStyle = '#4080ff';
        ctx.fillRect(psx + TW * 0.1, psy + TH * 0.05, TW * 0.8, TH * 0.85);
      }

      // Hero indicator arrow (bouncing blue chevron above head)
      ctx.globalAlpha = 0.8;
      const arrowBounce = Math.sin(now * 0.005) * 3;
      const arrowY = psy - 8 + arrowBounce;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.moveTo(pCenterX - 5, arrowY);
      ctx.lineTo(pCenterX, arrowY + 5);
      ctx.lineTo(pCenterX + 5, arrowY);
      ctx.lineTo(pCenterX + 3, arrowY);
      ctx.lineTo(pCenterX, arrowY + 3);
      ctx.lineTo(pCenterX - 3, arrowY);
      ctx.closePath();
      ctx.fill();
      // Arrow glow
      ctx.globalAlpha = 0.3;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Player warm light circle
      ctx.globalAlpha = 0.12;
      const playerGrad = ctx.createRadialGradient(psx + TW / 2, psy + TH / 2, 0, psx + TW / 2, psy + TH / 2, TW * 7);
      playerGrad.addColorStop(0, '#ffe0a0');
      playerGrad.addColorStop(0.2, 'rgba(255,210,130,0.1)');
      playerGrad.addColorStop(0.5, 'rgba(255,180,100,0.03)');
      playerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = playerGrad;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;

      // Footstep dust particles at player position
      const dustPhase = now * 0.008;
      for (let d = 0; d < 3; d++) {
        const dp = dustPhase + d * 2.1;
        const dLife = (dp % 3) / 3;
        if (dLife < 0.8) {
          const dx2 = Math.sin(dp * 3.7 + d) * 4;
          const dy2 = -dLife * 8;
          ctx.globalAlpha = (0.8 - dLife) * 0.25;
          ctx.fillStyle = '#a09070';
          ctx.beginPath();
          ctx.arc(psx + TW / 2 + dx2, psy + TH + dy2, 1 + dLife, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Fireflies
      for (const ff of fireflies) {
        ff.x += Math.sin(now * 0.001 + ff.phase) * ff.speed;
        ff.y += Math.cos(now * 0.0008 + ff.phase * 2) * ff.speed * 0.5;
        // Wrap around
        if (ff.x < 0) ff.x += vmap.width * TW;
        if (ff.x > vmap.width * TW) ff.x -= vmap.width * TW;
        if (ff.y < 0) ff.y += vmap.height * TH;
        if (ff.y > vmap.height * TH) ff.y -= vmap.height * TH;

        const ffsx = CW / 2 + (ff.x / TW - camX) * TW;
        const ffsy = CH / 2 + (ff.y / TH - camY) * TH;
        if (ffsx < -20 || ffsx > CW + 20 || ffsy < -20 || ffsy > CH + 20) continue;
        const glow = (Math.sin(now * 0.003 + ff.phase) * 0.5 + 0.5);
        if (glow > 0.3) {
          ctx.globalAlpha = glow * 0.6;
          ctx.fillStyle = '#b0e040';
          ctx.shadowColor = '#a0d040';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(ffsx, ffsy, 1.5 + glow * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;

      // Leaf particles near trees
      for (const leaf of leaves) {
        leaf.x += Math.sin(now * 0.0006 + leaf.phase) * leaf.speed + 0.15;
        leaf.y += Math.cos(now * 0.0004 + leaf.phase) * leaf.speed * 0.3 + 0.1;
        leaf.rot += 0.01;
        // Check if near a tree
        const leafTx = Math.floor(leaf.x / TW);
        const leafTy = Math.floor(leaf.y / TH);
        let nearTree = false;
        for (let ddy = -2; ddy <= 2; ddy++) {
          for (let ddx = -2; ddx <= 2; ddx++) {
            const cx2 = leafTx + ddx, cy2 = leafTy + ddy;
            if (cx2 >= 0 && cx2 < vmap.width && cy2 >= 0 && cy2 < vmap.height) {
              if (vmap.tiles[cy2][cx2] === VTile.Tree) { nearTree = true; break; }
            }
          }
          if (nearTree) break;
        }
        if (!nearTree) {
          // Respawn near a random tree
          if (treeList.length > 0) {
            const t = treeList[Math.floor(Math.random() * treeList.length)];
            leaf.x = t.x * TW + Math.random() * TW * 3 - TW;
            leaf.y = t.y * TH + Math.random() * TH * 3 - TH;
          }
          continue;
        }
        const lsx = CW / 2 + (leaf.x / TW - camX) * TW;
        const lsy = CH / 2 + (leaf.y / TH - camY) * TH;
        if (lsx < -20 || lsx > CW + 20 || lsy < -20 || lsy > CH + 20) continue;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#4a8030';
        ctx.save();
        ctx.translate(lsx, lsy);
        ctx.rotate(leaf.rot);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
      }

      // Dust motes in indoor areas
      for (const dm of dustMotes) {
        dm.x += Math.sin(now * 0.0003 + dm.phase) * dm.speed;
        dm.y -= dm.speed * 0.3;
        if (dm.y < 0) dm.y = vmap.height * TH;
        const dmTx = Math.floor(dm.x / TW);
        const dmTy = Math.floor(dm.y / TH);
        if (dmTx >= 0 && dmTx < vmap.width && dmTy >= 0 && dmTy < vmap.height) {
          const t = vmap.tiles[dmTy][dmTx];
          if (t === VTile.Floor || t === VTile.Carpet || t === VTile.Counter) {
            const dsx = CW / 2 + (dm.x / TW - camX) * TW;
            const dsy = CH / 2 + (dm.y / TH - camY) * TH;
            if (dsx >= 0 && dsx <= CW && dsy >= 0 && dsy <= CH) {
              const dmGlow = Math.sin(now * 0.002 + dm.phase) * 0.3 + 0.4;
              ctx.globalAlpha = dmGlow * 0.4;
              ctx.fillStyle = '#c0b090';
              ctx.beginPath();
              ctx.arc(dsx, dsy, 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Water sparkles
      for (const ws of waterSparkles) {
        const wsTx = Math.floor(ws.x / TW);
        const wsTy = Math.floor(ws.y / TH);
        if (wsTx >= 0 && wsTx < vmap.width && wsTy >= 0 && wsTy < vmap.height) {
          if (vmap.tiles[wsTy][wsTx] === VTile.Water) {
            const sparkle = Math.sin(now * 0.005 + ws.phase) * 0.5 + 0.5;
            if (sparkle > 0.7) {
              const wsSx = CW / 2 + (ws.x / TW - camX) * TW;
              const wsSy = CH / 2 + (ws.y / TH - camY) * TH;
              if (wsSx >= 0 && wsSx <= CW && wsSy >= 0 && wsSy <= CH) {
                ctx.globalAlpha = (sparkle - 0.7) * 2;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(wsSx, wsSy, 1, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
        // Slowly drift
        ws.x += Math.sin(now * 0.0005 + ws.phase) * 0.1;
        ws.y += Math.cos(now * 0.0003 + ws.phase) * 0.05;
      }

      ctx.globalAlpha = 1;

      // Fish in the river (small silhouettes darting around)
      for (let fi = 0; fi < 4; fi++) {
        const fishPhase = now * 0.001 + fi * 37.7;
        const fishY = 5 + (fi * 7 + Math.floor(fishPhase * 0.3)) % (vmap.height - 5);
        const fishX = 37.2 + Math.sin(fishPhase * 0.5 + fi) * 0.4;
        const fishSx = CW / 2 + (fishX - camX) * TW;
        const fishSy = CH / 2 + (fishY - camY) * TH;
        if (fishSx < -30 || fishSx > CW + 30 || fishSy < -30 || fishSy > CH + 30) continue;
        const fishDir = Math.sin(fishPhase * 0.8 + fi * 2) > 0 ? 1 : -1;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#304860';
        ctx.beginPath();
        // Fish body
        ctx.ellipse(fishSx, fishSy, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fish tail
        ctx.beginPath();
        ctx.moveTo(fishSx - 4 * fishDir, fishSy);
        ctx.lineTo(fishSx - 7 * fishDir, fishSy - 2);
        ctx.lineTo(fishSx - 7 * fishDir, fishSy + 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Chimney smoke particles
      // Spawn new smoke from chimneys
      if (filteredChimneys.length > 0 && smokeParticles.length < 40) {
        for (const chimney of filteredChimneys) {
          if (Math.random() < 0.02) { // Low spawn rate per chimney per frame
            smokeParticles.push({
              x: chimney.x * TW + TW / 2 + (Math.random() - 0.5) * 4,
              y: chimney.y * TH,
              life: 0,
              maxLife: 120 + Math.random() * 80,
              vx: (Math.random() - 0.5) * 0.3,
              vy: -0.3 - Math.random() * 0.3,
              size: 2 + Math.random() * 2,
            });
          }
        }
      }
      // Update and draw smoke
      for (let si = smokeParticles.length - 1; si >= 0; si--) {
        const sp = smokeParticles[si];
        sp.life++;
        sp.x += sp.vx + Math.sin(now * 0.001 + si * 2) * 0.1;
        sp.y += sp.vy;
        sp.size += 0.02;
        if (sp.life >= sp.maxLife) {
          smokeParticles.splice(si, 1);
          continue;
        }
        const lifeRatio = sp.life / sp.maxLife;
        const alpha = (1 - lifeRatio) * 0.3;
        const spSx = CW / 2 + (sp.x / TW - camX) * TW;
        const spSy = CH / 2 + (sp.y / TH - camY) * TH;
        if (spSx < -20 || spSx > CW + 20 || spSy < -20 || spSy > CH + 20) continue;
        ctx.globalAlpha = alpha;
        const grayVal = 140 + Math.floor(lifeRatio * 60);
        ctx.fillStyle = `rgb(${grayVal},${grayVal},${grayVal + 10})`;
        ctx.beginPath();
        ctx.arc(spSx, spSy, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bird silhouettes flying across the sky
      ctx.globalAlpha = 1;
      for (const bird of birds) {
        bird.x += bird.speed;
        bird.y += Math.sin(now * 0.002 + bird.wingPhase) * 0.15;
        // Respawn when off screen
        if (bird.x > CW + 30) {
          bird.x = -20;
          bird.y = 20 + Math.random() * 60;
          bird.speed = 0.4 + Math.random() * 0.6;
        }
        const wingFlap = Math.sin(now * 0.008 + bird.wingPhase) * bird.size * 0.6;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Left wing
        ctx.moveTo(bird.x - bird.size, bird.y + wingFlap);
        ctx.lineTo(bird.x, bird.y);
        // Right wing
        ctx.lineTo(bird.x + bird.size, bird.y + wingFlap);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Butterflies near flowers
      for (const bf of butterflies) {
        bf.x += Math.sin(now * 0.001 + bf.phase) * bf.speed + 0.05;
        bf.y += Math.cos(now * 0.0008 + bf.phase * 1.5) * bf.speed * 0.6;
        // Keep near flowers
        const bfTx = Math.floor(bf.x / TW);
        const bfTy = Math.floor(bf.y / TH);
        let nearFlower = false;
        for (let ddy = -3; ddy <= 3; ddy++) {
          for (let ddx = -3; ddx <= 3; ddx++) {
            const cx2 = bfTx + ddx, cy2 = bfTy + ddy;
            if (cx2 >= 0 && cx2 < vmap.width && cy2 >= 0 && cy2 < vmap.height) {
              if (vmap.tiles[cy2][cx2] === VTile.Flower) { nearFlower = true; break; }
            }
          }
          if (nearFlower) break;
        }
        if (!nearFlower && flowerTiles.length > 0) {
          const ft = flowerTiles[Math.floor(Math.random() * flowerTiles.length)];
          bf.x = ft.x * TW + Math.random() * TW * 2;
          bf.y = ft.y * TH + Math.random() * TH * 2;
          continue;
        }
        const bfSx = CW / 2 + (bf.x / TW - camX) * TW;
        const bfSy = CH / 2 + (bf.y / TH - camY) * TH;
        if (bfSx < -20 || bfSx > CW + 20 || bfSy < -20 || bfSy > CH + 20) continue;
        const wingFlap = Math.sin(now * 0.012 + bf.phase) * 3;
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = bf.color;
        // Left wing
        ctx.beginPath();
        ctx.ellipse(bfSx - 2, bfSy, 2.5, 1.5 + wingFlap * 0.3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Right wing
        ctx.beginPath();
        ctx.ellipse(bfSx + 2, bfSy, 2.5, 1.5 - wingFlap * 0.3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#333';
        ctx.fillRect(bfSx - 0.3, bfSy - 1.5, 0.6, 3);
      }
      ctx.globalAlpha = 1;

      // Interaction prompt
      const adjNpc = (() => {
        for (const npc of vmap.npcs) {
          const pos = npcPosRef.current.get(npc.id) || npc.pos;
          const dx = Math.abs(pos.x - px);
          const dy = Math.abs(pos.y - py);
          if (dx <= 1 && dy <= 1 && (dx + dy) <= 1) return npc;
        }
        return null;
      })();
      const onEntry = vmap.entries.some(e => e.pos.x === px && e.pos.y === py);

      if (adjNpc || onEntry) {
        const promptText = adjNpc
          ? `${adjNpc.shopType ? '🏪 ' : '💬 '}${adjNpc.name}と話す [Enter]`
          : '⚔ ダンジョンに入る [Enter]';
        ctx.font = '11px "Noto Sans JP", sans-serif';
        const tw2 = ctx.measureText(promptText).width;
        const bx = CW / 2 - tw2 / 2 - 14;
        const by = CH / 2 - TH - 28;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(bx + 2, by + 2, tw2 + 28, 24, 5);
        ctx.fill();
        // Background
        ctx.fillStyle = onEntry && !adjNpc ? 'rgba(40,10,60,0.85)' : 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.roundRect(bx, by, tw2 + 28, 24, 5);
        ctx.fill();
        // Border
        ctx.strokeStyle = onEntry && !adjNpc ? 'rgba(160,80,255,0.4)' : 'rgba(201,168,76,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Text
        ctx.fillStyle = onEntry && !adjNpc ? '#c080ff' : '#d4c5a0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(promptText, CW / 2, by + 12);
      }

      // #10 Rain particle system
      if (isRaining) {
        ctx.strokeStyle = 'rgba(100,140,200,0.35)';
        ctx.lineWidth = 1;
        for (const drop of rainDrops) {
          drop.y += drop.speed;
          drop.x += 1.5; // slight wind
          if (drop.y > CH) { drop.y = -10; drop.x = Math.random() * CW; }
          if (drop.x > CW) drop.x = 0;
          ctx.globalAlpha = 0.3 + Math.random() * 0.2;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + 1.5, drop.y + drop.len);
          ctx.stroke();
        }
        // #11 Puddle rendering on paths when raining
        for (let dy2 = -rangeY; dy2 <= rangeY; dy2++) {
          for (let dx2 = -rangeX; dx2 <= rangeX; dx2++) {
            const pmx = camX + dx2, pmy = camY + dy2;
            if (pmx < 0 || pmx >= vmap.width || pmy < 0 || pmy >= vmap.height) continue;
            if (vmap.tiles[pmy][pmx] === VTile.Path) {
              const ph = tileHash(pmx * 3, pmy * 5);
              if (ph > 0.75) {
                const psx2 = CW / 2 + (pmx - camX) * TW;
                const psy2 = CH / 2 + (pmy - camY) * TH;
                ctx.globalAlpha = 0.12;
                ctx.fillStyle = '#4060a0';
                ctx.beginPath();
                ctx.ellipse(psx2 + TW * ph, psy2 + TH * (1 - ph), 3 + ph * 4, 1.5 + ph * 2, 0, 0, Math.PI * 2);
                ctx.fill();
                // Ripple
                const ripple = (now * 0.002 + pmx * 3 + pmy * 7) % 2;
                if (ripple < 1) {
                  ctx.globalAlpha = (1 - ripple) * 0.08;
                  ctx.strokeStyle = '#80a0d0';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.arc(psx2 + TW * ph, psy2 + TH * (1 - ph), ripple * 4, 0, Math.PI * 2);
                  ctx.stroke();
                }
              }
            }
          }
        }
      }

      // #12 Cloud shadow effect
      ctx.globalAlpha = 1;
      for (const cloud of cloudShadows) {
        cloud.x += cloud.speed;
        if (cloud.x > vmap.width * TW + cloud.w) cloud.x = -cloud.w;
        const csx = CW / 2 + (cloud.x / TW - camX) * TW;
        const csy = CH / 2 + (cloud.y / TH - camY) * TH;
        if (csx > -cloud.w && csx < CW + cloud.w && csy > -cloud.h && csy < CH + cloud.h) {
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(csx, csy, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // #14 Footprint trail
      if (lastFootprintPos.x !== state.villagePos.x || lastFootprintPos.y !== state.villagePos.y) {
        footprints.push({ x: lastFootprintPos.x, y: lastFootprintPos.y, time: now });
        lastFootprintPos = { x: state.villagePos.x, y: state.villagePos.y };
        while (footprints.length > 5) footprints.shift();
      }
      for (let fi = 0; fi < footprints.length; fi++) {
        const fp = footprints[fi];
        const age = (now - fp.time) / 3000;
        if (age > 1) continue;
        const fpsx = CW / 2 + (fp.x - camX) * TW + TW / 2;
        const fpsy = CH / 2 + (fp.y - camY) * TH + TH * 0.8;
        ctx.globalAlpha = (1 - age) * 0.15;
        ctx.fillStyle = '#605040';
        ctx.beginPath(); ctx.ellipse(fpsx - 2, fpsy, 1.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fpsx + 2, fpsy, 1.5, 2, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Warm ambient overlay (subtle golden tint in center)
      ctx.globalAlpha = 0.04;
      const warmGrad = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.4);
      warmGrad.addColorStop(0, '#ffe8a0');
      warmGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = warmGrad;
      ctx.fillRect(0, 0, CW, CH);

      // Vignette (warmer, deeper)
      ctx.globalAlpha = 1;
      const vig = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.15, CW / 2, CH / 2, CW * 0.62);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(0.5, 'rgba(5,5,8,0.1)');
      vig.addColorStop(0.7, 'rgba(5,5,8,0.25)');
      vig.addColorStop(0.85, 'rgba(5,5,8,0.5)');
      vig.addColorStop(1, 'rgba(5,5,8,0.75)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, CW, CH);

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [assetsReady, state.villagePos, state.player.facing, vmap]);

  // ================================================================
  //  Overlay rendering (HTML)
  // ================================================================
  const renderOverlay = () => {
    if (overlay === 'none') return null;

    const overlayBg: React.CSSProperties = {
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    };
    const panelStyle: React.CSSProperties = {
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-stone)',
      borderRadius: 6,
      padding: '16px 24px',
      minWidth: 280,
      maxWidth: 400,
      maxHeight: 450,
      overflow: 'auto',
      fontFamily: 'var(--font-game)',
      color: 'var(--text-parchment)',
      fontSize: 13,
      boxShadow: '0 4px 30px rgba(0,0,0,0.7)',
    };
    const cursorChar = '▶';

    if (overlay === 'dialogue') {
      const speakerColor = dialogueSpeakerNpc?.nameColor || '#c9a84c';
      const npcType = dialogueSpeakerNpc?.visualType;
      const typeIcon = npcType === 'king' ? '👑' : npcType === 'cat' ? '🐱' :
        npcType === 'guard' ? '⚔' : npcType === 'merchant' ? '💰' :
        npcType === 'priest' ? '✝' : npcType === 'bard' ? '♪' :
        npcType === 'adventurer' ? '🗡' : npcType === 'mother' ? '♥' : '';
      return (
        <div style={overlayBg} onClick={() => {
          if (dialogueIndex < dialogueLines.length - 1) setDialogueIndex(i => i + 1);
          else setOverlay('none');
        }}>
          <div style={{
            ...panelStyle,
            position: 'absolute', bottom: 40, left: 40, right: 40, minWidth: 'auto',
            display: 'flex', gap: 14, alignItems: 'flex-start',
            borderLeft: `3px solid ${speakerColor}`,
            background: 'linear-gradient(135deg, rgba(20,18,25,0.95) 0%, rgba(15,13,20,0.95) 100%)',
          }}>
            <div style={{ flexShrink: 0 }}>
              <canvas
                ref={portraitCanvasRef}
                width={64}
                height={64}
                style={{
                  width: 64, height: 64,
                  imageRendering: 'pixelated',
                  borderRadius: 6,
                  border: `2px solid ${speakerColor}40`,
                  boxShadow: `0 0 12px ${speakerColor}20`,
                }}
              />
              <div style={{ textAlign: 'center', color: speakerColor, fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>
                {typeIcon && <span style={{ marginRight: 2 }}>{typeIcon}</span>}
                {dialogueSpeaker}
              </div>
              {dialogueSpeakerNpc?.title && (
                <div style={{ textAlign: 'center', color: '#6b6255', fontSize: 9, marginTop: 1 }}>
                  {dialogueSpeakerNpc.title}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: speakerColor, marginBottom: 8, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                {dialogueSpeaker}
              </div>
              <div style={{ lineHeight: 1.6, fontSize: 13 }}>{dialogueLines[dialogueIndex]}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ color: '#4a4440', fontSize: 10 }}>
                  {dialogueIndex + 1}/{dialogueLines.length}
                </span>
                <span style={{
                  color: '#6b6255', fontSize: 10,
                  animation: dialogueIndex < dialogueLines.length - 1 ? 'none' : undefined,
                }}>
                  {dialogueIndex < dialogueLines.length - 1 ? '▼ 次へ [Enter]' : '× 閉じる [Enter]'}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'confirm_dungeon') {
      return (
        <div style={overlayBg}>
          <div style={{
            ...panelStyle,
            borderColor: 'rgba(160,80,255,0.3)',
            background: 'linear-gradient(135deg, rgba(20,10,30,0.95) 0%, rgba(15,8,25,0.95) 100%)',
          }}>
            <div style={{ marginBottom: 4, color: '#a060e0', fontWeight: 'bold', fontSize: 14 }}>
              ⚔ 不思議のダンジョン
            </div>
            <div style={{ marginBottom: 8, color: '#8a7a9a', fontSize: 11 }}>
              ダンジョンは毎回構造が変化する。倒れると持ち物を失う。
            </div>
            <div style={{ marginBottom: 12, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontSize: 10, color: '#8a7a9a' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span>Lv.<span style={{ color: '#c9a84c' }}>{state.player.level}</span></span>
                <span>HP <span style={{ color: state.player.hp < state.player.maxHp ? '#cc6644' : '#88cc88' }}>{state.player.hp}/{state.player.maxHp}</span></span>
                <span>ATK <span style={{ color: '#88aaee' }}>{state.player.attack}</span></span>
                <span>DEF <span style={{ color: '#88cc88' }}>{state.player.defense}</span></span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                <span>持物: <span style={{ color: '#c9a84c' }}>{state.player.inventory.length}/20</span></span>
                <span>所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span></span>
              </div>
              {state.player.hp < state.player.maxHp && (
                <div style={{ color: '#cc6644', marginTop: 4, fontSize: 9 }}>
                  ※ HPが万全ではない。自宅で休むか教会で回復を推奨。
                </div>
              )}
            </div>
            {['挑む', 'やめておく'].map((label, i) => (
              <div key={i} style={{
                padding: '8px 10px', cursor: 'pointer', borderRadius: 3,
                background: overlayCursor === i ? (i === 0 ? 'rgba(160,80,255,0.15)' : 'rgba(100,100,100,0.1)') : 'transparent',
                borderLeft: overlayCursor === i ? `2px solid ${i === 0 ? '#a060e0' : '#6b6255'}` : '2px solid transparent',
                color: i === 0 ? '#c080ff' : '#d4c5a0',
              }} onClick={() => {
                if (i === 0) dispatch({ type: 'ENTER_DUNGEON' });
                setOverlay('none');
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{label}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (overlay === 'save') {
      return (
        <div style={overlayBg}>
          <div style={{
            ...panelStyle,
            borderColor: 'rgba(255,200,100,0.2)',
            background: 'linear-gradient(135deg, rgba(20,18,12,0.95) 0%, rgba(15,13,8,0.95) 100%)',
          }}>
            <div style={{ marginBottom: 6, color: '#c9a84c', fontWeight: 'bold', fontSize: 14 }}>
              自宅 - 休息
            </div>
            <div style={{ marginBottom: 8, color: '#8a7a5a', fontSize: 11 }}>
              ベッドで休むとHPが全回復し、セーブされる。
            </div>
            <div style={{ marginBottom: 12, padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontSize: 10, color: '#8a7a5a' }}>
              HP: <span style={{ color: '#cc4444' }}>{state.player.hp}/{state.player.maxHp}</span>
              {state.player.hp < state.player.maxHp && <span style={{ color: '#88cc88', marginLeft: 8 }}>→ {state.player.maxHp} (全回復)</span>}
            </div>
            {['セーブする', 'やめる'].map((label, i) => (
              <div key={i} style={{
                padding: '6px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
              }} onClick={() => {
                if (i === 0) { saveGame(state); showMessage('セーブしました。'); }
                setOverlay('none');
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{label}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (overlay === 'shop_menu') {
      const shopName = currentShopType === 'weapon' ? '武器屋' : '道具屋';
      const shopIcon = currentShopType === 'weapon' ? '⚔' : '🧪';
      const shopColor = currentShopType === 'weapon' ? '#FF6644' : '#66CC88';
      return (
        <div style={overlayBg}>
          <div style={{ ...panelStyle, borderLeft: `3px solid ${shopColor}` }}>
            <div style={{ marginBottom: 4, color: shopColor, fontWeight: 'bold', fontSize: 14 }}>
              {shopIcon} {shopName}
            </div>
            <div style={{ marginBottom: 10, color: '#6b6255', fontSize: 11 }}>
              {currentShopType === 'weapon' ? '武器・盾を取り扱っている。' : '薬草・巻物・杖を取り扱っている。'}
            </div>
            {['買う', '売る', '戻る'].map((label, i) => (
              <div key={i} style={{
                padding: '7px 10px', cursor: 'pointer', borderRadius: 3,
                background: overlayCursor === i ? 'rgba(201,168,76,0.12)' : 'transparent',
                borderLeft: overlayCursor === i ? `2px solid ${shopColor}` : '2px solid transparent',
              }} onClick={() => {
                if (i === 0) { setOverlay('shop_buy'); setOverlayCursor(0); }
                else if (i === 1) { setOverlay('shop_sell'); setOverlayCursor(0); }
                else setOverlay('none');
                sfxMenuSelect();
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{label}
              </div>
            ))}
            <div style={{
              color: '#c9a84c', fontSize: 12, marginTop: 10,
              padding: '4px 8px',
              background: 'rgba(201,168,76,0.05)',
              borderRadius: 3,
            }}>
              所持金: {state.player.gold}G
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'shop_buy') {
      // #13: Dynamic shop inventory
      const shopPool = currentShopType === 'weapon' ? getWeaponShopPool() : getItemShopPool();
      const items = generateShopInventory(state.villageShopSeed, shopPool, currentShopType === 'weapon' ? 7 : 9);
      return (
        <div style={overlayBg}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 6, color: '#c9a84c', fontWeight: 'bold', fontSize: 14 }}>
              {currentShopType === 'weapon' ? '⚔ 武器屋' : '🧪 道具屋'} - 購入
            </div>
            <div style={{ marginBottom: 12, color: '#8a7a5a', fontSize: 11 }}>
              所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span>
              {' | '}持物: <span style={{ color: state.player.inventory.length >= 18 ? '#cc4444' : '#88aa88' }}>{state.player.inventory.length}/20</span>
            </div>
            {items.map((item, i) => (
              <div key={i} style={{
                padding: '4px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
                opacity: state.player.gold < item.price ? 0.4 : 1,
              }} onClick={() => {
                if (state.player.gold >= item.price && state.player.inventory.length < 20) {
                  dispatch({ type: 'BUY_ITEM', templateId: item.templateId, price: item.price });
                  showMessage(`${item.name}を購入した！`);
                }
                sfxMenuSelect();
              }}>
                <div>{overlayCursor === i ? cursorChar + ' ' : '  '}{item.name} - {item.price}G</div>
                {overlayCursor === i && <div style={{ color: '#6b6255', fontSize: 10, marginLeft: 16 }}>{item.description}</div>}
              </div>
            ))}
            <div style={{
              padding: '4px 8px', cursor: 'pointer',
              background: overlayCursor === items.length ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderLeft: overlayCursor === items.length ? '2px solid #c9a84c' : '2px solid transparent',
            }} onClick={() => { setOverlay('shop_menu'); setOverlayCursor(0); sfxMenuSelect(); }}>
              {overlayCursor === items.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'shop_sell') {
      const sellable = state.player.inventory.filter(i =>
        i.id !== state.player.equippedWeapon &&
        i.id !== state.player.equippedShield &&
        i.id !== state.player.equippedRing
      );
      return (
        <div style={overlayBg}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 6, color: '#c9a84c', fontWeight: 'bold', fontSize: 14 }}>売却</div>
            <div style={{ marginBottom: 12, color: '#8a7a5a', fontSize: 11 }}>
              所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span>
              {' | '}持物: <span style={{ color: '#88aa88' }}>{state.player.inventory.length}/20</span>
            </div>
            {sellable.length === 0 && <div style={{ color: '#6b6255' }}>売れるアイテムがない（装備中は売却不可）</div>}
            {sellable.map((item, i) => (
              <div key={item.id} style={{
                padding: '4px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
              }} onClick={() => {
                const price = getItemSellPrice(item);
                dispatch({ type: 'SELL_ITEM', itemId: item.id, price });
                showMessage(`${item.name}を${price}Gで売った！`);
                sfxMenuSelect();
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{item.name} → {getItemSellPrice(item)}G
              </div>
            ))}
            <div style={{
              padding: '4px 8px', cursor: 'pointer', marginTop: 4,
              background: overlayCursor === sellable.length ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderLeft: overlayCursor === sellable.length ? '2px solid #c9a84c' : '2px solid transparent',
            }} onClick={() => { setOverlay('shop_menu'); setOverlayCursor(0); sfxMenuSelect(); }}>
              {overlayCursor === sellable.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'storage_menu') {
      const storageOptions = ['預ける', '引き出す', `拡張する (1000G) [容量: ${state.storageCapacity}]`, '戻る'];
      return (
        <div style={overlayBg}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 6, color: '#8899AA', fontWeight: 'bold', fontSize: 14 }}>倉庫</div>
            <div style={{ marginBottom: 12, color: '#6b6b7b', fontSize: 11 }}>
              倉庫: <span style={{ color: '#88aacc' }}>{state.storage.length}/{state.storageCapacity}</span>個
              {' | '}持物: <span style={{ color: '#88aa88' }}>{state.player.inventory.length}/20</span>
              {' | '}所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span>
            </div>
            {storageOptions.map((label, i) => (
              <div key={i} style={{
                padding: '6px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
              }} onClick={() => {
                if (i === 0) { setOverlay('storage_deposit'); setOverlayCursor(0); }
                else if (i === 1) { setOverlay('storage_withdraw'); setOverlayCursor(0); }
                else if (i === 2) {
                  if (state.player.gold >= 1000) {
                    dispatch({ type: 'UPGRADE_STORAGE', cost: 1000 });
                    showMessage(`倉庫を拡張した！ 容量: ${state.storageCapacity + 10}`);
                  } else {
                    showMessage('お金が足りない... (1000G必要)');
                  }
                }
                else setOverlay('none');
                sfxMenuSelect();
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{label}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (overlay === 'storage_deposit') {
      const depositable = state.player.inventory.filter(i =>
        i.id !== state.player.equippedWeapon &&
        i.id !== state.player.equippedShield &&
        i.id !== state.player.equippedRing
      );
      return (
        <div style={overlayBg}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 12, color: '#c9a84c' }}>預ける</div>
            {depositable.length === 0 && <div style={{ color: '#6b6255' }}>預けるアイテムがない</div>}
            {depositable.map((item, i) => (
              <div key={item.id} style={{
                padding: '4px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
              }} onClick={() => {
                dispatch({ type: 'STORE_ITEM', itemId: item.id });
                showMessage(`${item.name}を預けた！`);
                sfxMenuSelect();
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{item.name}
              </div>
            ))}
            <div style={{
              padding: '4px 8px', cursor: 'pointer', marginTop: 4,
              background: overlayCursor === depositable.length ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderLeft: overlayCursor === depositable.length ? '2px solid #c9a84c' : '2px solid transparent',
            }} onClick={() => { setOverlay('storage_menu'); setOverlayCursor(0); sfxMenuSelect(); }}>
              {overlayCursor === depositable.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'storage_withdraw') {
      return (
        <div style={overlayBg}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 12, color: '#c9a84c' }}>引き出す</div>
            {state.storage.length === 0 && <div style={{ color: '#6b6255' }}>倉庫にアイテムがない</div>}
            {state.storage.map((item, i) => (
              <div key={i} style={{
                padding: '4px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #c9a84c' : '2px solid transparent',
              }} onClick={() => {
                if (state.player.inventory.length < 20) {
                  dispatch({ type: 'WITHDRAW_ITEM', index: i });
                  showMessage('引き出した！');
                } else {
                  showMessage('持ち物がいっぱいだ！');
                }
                sfxMenuSelect();
              }}>
                {overlayCursor === i ? cursorChar + ' ' : '  '}{item.name}
              </div>
            ))}
            <div style={{
              padding: '4px 8px', cursor: 'pointer', marginTop: 4,
              background: overlayCursor === state.storage.length ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderLeft: overlayCursor === state.storage.length ? '2px solid #c9a84c' : '2px solid transparent',
            }} onClick={() => { setOverlay('storage_menu'); setOverlayCursor(0); sfxMenuSelect(); }}>
              {overlayCursor === state.storage.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'blacksmith') {
      const enhanceableItems = state.player.inventory.filter(i =>
        i.category === ItemCategory.Weapon || i.category === ItemCategory.Shield
      );
      return (
        <div style={overlayBg}>
          <div style={{
            ...panelStyle,
            borderColor: 'rgba(255,120,50,0.2)',
            background: 'linear-gradient(135deg, rgba(20,12,8,0.95) 0%, rgba(15,10,5,0.95) 100%)',
          }}>
            <div style={{ marginBottom: 6, color: '#ff8844', fontWeight: 'bold', fontSize: 14 }}>
              鍛冶屋
            </div>
            <div style={{ marginBottom: 12, color: '#8a7a5a', fontSize: 11 }}>
              所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span>
            </div>
            {enhanceableItems.length === 0 && (
              <div style={{ color: '#6b6255', padding: '8px 0' }}>
                強化できる武器や盾を持っていない。
              </div>
            )}
            {enhanceableItems.map((item, i) => {
              const currentEnh = (item as WeaponItem | ShieldItem).enhancement || 0;
              const cost = getBlacksmithCost(currentEnh);
              const canAfford = state.player.gold >= cost;
              return (
                <div key={i} style={{
                  padding: '6px 8px', cursor: 'pointer',
                  background: overlayCursor === i ? 'rgba(255,120,50,0.1)' : 'transparent',
                  borderLeft: overlayCursor === i ? '2px solid #ff8844' : '2px solid transparent',
                  opacity: canAfford ? 1 : 0.4,
                }} onClick={() => {
                  if (canAfford) {
                    dispatch({ type: 'BLACKSMITH_ENHANCE', itemId: item.id, cost });
                    showMessage(`${item.name}を+${currentEnh + 1}に強化した！ (${cost}G)`);
                  } else {
                    showMessage(`お金が足りない... (${cost}G必要)`);
                  }
                  sfxMenuSelect();
                }}>
                  <div>{overlayCursor === i ? cursorChar + ' ' : '  '}{item.name} +{currentEnh} → +{currentEnh + 1}</div>
                  {overlayCursor === i && (
                    <div style={{ color: '#8a7a5a', fontSize: 10, marginLeft: 16 }}>
                      強化費用: {cost}G
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{
              padding: '6px 8px', cursor: 'pointer', marginTop: 4,
              background: overlayCursor === enhanceableItems.length ? 'rgba(255,120,50,0.1)' : 'transparent',
              borderLeft: overlayCursor === enhanceableItems.length ? '2px solid #ff8844' : '2px solid transparent',
            }} onClick={() => { setOverlay('none'); sfxMenuSelect(); }}>
              {overlayCursor === enhanceableItems.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    if (overlay === 'church') {
      const cursedItems = state.player.inventory.filter(i => i.cursed);
      const canHeal = state.player.hp < state.player.maxHp;
      const healCost = Math.max(50, Math.floor((state.player.maxHp - state.player.hp) * 2));
      const churchOptions: { label: string; desc: string; action: () => void; enabled: boolean }[] = [];
      if (canHeal) {
        churchOptions.push({
          label: `HP全回復 - ${healCost}G`,
          desc: `HP ${state.player.hp}→${state.player.maxHp}`,
          action: () => {
            if (state.player.gold >= healCost) {
              dispatch({ type: 'CHURCH_HEAL', cost: healCost });
              showMessage(`神父の祈りでHPが全回復した！`);
            } else { showMessage('お金が足りない...'); }
          },
          enabled: state.player.gold >= healCost,
        });
      }
      for (const item of cursedItems) {
        churchOptions.push({
          label: `${item.name}の呪いを解く - 500G`,
          desc: '装備を外せるようになる',
          action: () => {
            if (state.player.gold >= 500) {
              dispatch({ type: 'REMOVE_CURSE', itemId: item.id });
              showMessage(`${item.name}の呪いを解いた！`);
            } else { showMessage('お金が足りない...'); }
          },
          enabled: state.player.gold >= 500,
        });
      }
      return (
        <div style={overlayBg}>
          <div style={{
            ...panelStyle,
            borderColor: 'rgba(255,255,255,0.15)',
            background: 'linear-gradient(135deg, rgba(15,15,25,0.95) 0%, rgba(10,10,20,0.95) 100%)',
          }}>
            <div style={{ marginBottom: 6, color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>
              ✝ 教会
            </div>
            <div style={{ marginBottom: 12, color: '#8a8a9a', fontSize: 11 }}>
              HP: <span style={{ color: '#cc4444' }}>{state.player.hp}/{state.player.maxHp}</span>
              {' | '}所持金: <span style={{ color: '#FFD700' }}>{state.player.gold}G</span>
            </div>
            {churchOptions.length === 0 && (
              <div style={{ color: '#6b6b7b', padding: '8px 0' }}>
                {canHeal ? '' : 'HPは万全です。'}呪われたアイテムもありません。光の祝福あれ。
              </div>
            )}
            {churchOptions.map((opt, i) => (
              <div key={i} style={{
                padding: '6px 8px', cursor: 'pointer',
                background: overlayCursor === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderLeft: overlayCursor === i ? '2px solid #FFFFFF' : '2px solid transparent',
                opacity: opt.enabled ? 1 : 0.4,
              }} onClick={() => { opt.action(); sfxMenuSelect(); }}>
                <div>{overlayCursor === i ? cursorChar + ' ' : '  '}{opt.label}</div>
                {overlayCursor === i && <div style={{ color: '#6b6b7b', fontSize: 10, marginLeft: 16 }}>{opt.desc}</div>}
              </div>
            ))}
            <div style={{
              padding: '6px 8px', cursor: 'pointer', marginTop: 4,
              background: overlayCursor === churchOptions.length ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderLeft: overlayCursor === churchOptions.length ? '2px solid #FFFFFF' : '2px solid transparent',
            }} onClick={() => { setOverlay('none'); sfxMenuSelect(); }}>
              {overlayCursor === churchOptions.length ? cursorChar + ' ' : '  '}戻る
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="game-viewport flex flex-col select-none overflow-hidden"
      style={{
        background: '#050508',
        fontFamily: 'var(--font-game)',
        height: '100dvh',
        alignItems: villageMobile ? 'stretch' : 'center',
        justifyContent: villageMobile ? 'flex-start' : 'center',
      }}>
      {/* Wrapper: on mobile, clips wider canvas to screen width */}
      <div style={{
        width: villageMobile ? villageVw : Math.floor(CW * villageScale),
        height: villageMobile ? villageGameH : Math.floor(CH * villageScale),
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        ...(villageMobile ? {} : { alignSelf: 'center' }),
      }}>
      <div className="game-container" style={{
        width: CW, height: CH,
        transform: `scale(${villageScale})`,
        transformOrigin: 'top left',
        position: villageMobile ? 'absolute' : 'relative',
        left: villageMobile ? (villageVw - CW * villageScale) / 2 : undefined,
        top: villageMobile ? 0 : undefined,
      }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: CW, height: CH, imageRendering: 'pixelated' }}
        />

        {/* Top status bar - enhanced HUD */}
        <div className="absolute top-0 left-0 right-0 z-20" style={{
          background: 'linear-gradient(180deg, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.8) 100%)',
          padding: '5px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          borderBottom: '1px solid rgba(201,168,76,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#c9a84c', fontWeight: 'bold', fontSize: 13 }}>始まりの村</span>
            <span style={{ color: 'rgba(201,168,76,0.3)' }}>|</span>
            <span style={{ color: '#8a7a5a', fontSize: 10 }}>
              {(() => {
                const px2 = state.villagePos.x, py2 = state.villagePos.y;
                if (py2 <= 5 && px2 >= 13 && px2 <= 26) return '城内';
                if (py2 >= 8 && py2 <= 12 && px2 >= 5 && px2 <= 11) return '武器屋';
                if (py2 >= 16 && py2 <= 20 && px2 >= 5 && px2 <= 11) return '道具屋';
                if (py2 >= 8 && py2 <= 12 && px2 >= 27 && px2 <= 34) return '酒場';
                if (py2 >= 16 && py2 <= 20 && px2 >= 27 && px2 <= 34) return '教会';
                if (py2 >= 22 && py2 <= 26 && px2 >= 5 && px2 <= 11) return '自宅';
                if (py2 >= 22 && py2 <= 26 && px2 >= 28 && px2 <= 34) return '倉庫';
                if (py2 >= 27) return 'ダンジョン入口';
                if (px2 >= 37) return '川辺';
                return '村の中';
              })()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#cc4444', fontSize: 11 }}>
              HP
              <span style={{
                display: 'inline-block',
                width: 60,
                height: 6,
                background: 'rgba(80,20,20,0.6)',
                borderRadius: 3,
                marginLeft: 4,
                verticalAlign: 'middle',
                overflow: 'hidden',
              }}>
                <span style={{
                  display: 'block',
                  width: `${(state.player.hp / state.player.maxHp) * 100}%`,
                  height: '100%',
                  background: state.player.hp > state.player.maxHp * 0.3 ? '#cc4444' : '#ff2222',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </span>
              <span style={{ marginLeft: 4, color: '#d4c5a0', fontSize: 10 }}>
                {state.player.hp}/{state.player.maxHp}
              </span>
            </span>
            <span style={{ color: '#6688cc', fontSize: 10 }}>
              ATK<span style={{ color: '#88aaee', marginLeft: 2 }}>{state.player.attack}</span>
            </span>
            <span style={{ color: '#66aa66', fontSize: 10 }}>
              DEF<span style={{ color: '#88cc88', marginLeft: 2 }}>{state.player.defense}</span>
            </span>
            <span style={{ color: '#d4c5a0', fontSize: 11 }}>
              Lv.<span style={{ color: '#c9a84c' }}>{state.player.level}</span>
            </span>
            <span style={{ color: '#c9a84c', fontSize: 11 }}>
              {state.player.gold}G
            </span>
            {state.player.equippedWeapon && (
              <span style={{ color: '#8888cc', fontSize: 9 }}>
                {(() => {
                  const w = state.player.inventory.find(i => i.id === state.player.equippedWeapon);
                  return w ? w.name : '武器';
                })()}
              </span>
            )}
            {state.player.equippedShield && (
              <span style={{ color: '#88aa88', fontSize: 9 }}>
                {(() => {
                  const s = state.player.inventory.find(i => i.id === state.player.equippedShield);
                  return s ? s.name : '盾';
                })()}
              </span>
            )}
          </div>
        </div>

        {/* Village minimap */}
        <div className="absolute z-20" style={{
          top: 36, right: 8, width: 80, height: 60,
          background: 'rgba(5,5,8,0.85)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 4,
          overflow: 'hidden',
          imageRendering: 'pixelated',
        }}>
          <canvas
            ref={(el) => {
              if (!el) return;
              const mCtx = el.getContext('2d');
              if (!mCtx) return;
              el.width = 80;
              el.height = 60;
              mCtx.clearRect(0, 0, 80, 60);
              const scaleX = 80 / vmap.width;
              const scaleY = 60 / vmap.height;
              for (let ty = 0; ty < vmap.height; ty++) {
                for (let tx = 0; tx < vmap.width; tx++) {
                  const t = vmap.tiles[ty][tx];
                  const tc = TILE_COLORS[t];
                  mCtx.fillStyle = tc ? tc.bg : '#050508';
                  mCtx.fillRect(tx * scaleX, ty * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
                }
              }
              // NPC dots
              for (const npc of vmap.npcs) {
                const pos = npcPosRef.current.get(npc.id) || npc.pos;
                mCtx.fillStyle = npc.nameColor || '#c0a060';
                mCtx.fillRect(pos.x * scaleX, pos.y * scaleY, 2, 2);
              }
              // Player dot (bright blue, pulsing)
              mCtx.fillStyle = '#4488ff';
              mCtx.fillRect(state.villagePos.x * scaleX - 1, state.villagePos.y * scaleY - 1, 3, 3);
            }}
            style={{ width: 80, height: 60, imageRendering: 'pixelated' }}
          />
        </div>

        {/* Bottom hint bar — hidden on touch devices */}
        <div className="desktop-hints absolute bottom-0 left-0 right-0 z-20" style={{
          background: 'linear-gradient(0deg, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.8) 100%)',
          padding: '5px 14px',
          fontSize: 10,
          color: '#6b6255',
          borderTop: '1px solid rgba(201,168,76,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span><span style={{ color: '#8a7a5a' }}>WASD/矢印</span> 移動</span>
            <span><span style={{ color: '#8a7a5a' }}>Enter/Z</span> 調べる・話す</span>
            <span><span style={{ color: '#8a7a5a' }}>Esc/X</span> キャンセル</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span>発見: <span style={{ color: '#c9a84c' }}>{state.discoveredSecrets.size}</span>/{vmap.secrets.length}</span>
            <span>持物: <span style={{ color: state.player.inventory.length >= 18 ? '#cc4444' : '#c9a84c' }}>{state.player.inventory.length}</span>/20</span>
          </div>
        </div>

        {/* Toast message (enhanced with fade animation) */}
        {message && (
          <div className="absolute left-0 right-0 z-25 flex justify-center" style={{ bottom: 36, pointerEvents: 'none' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(10,8,15,0.92) 0%, rgba(5,5,10,0.88) 100%)',
              border: '1px solid rgba(201,168,76,0.25)',
              padding: '8px 20px',
              borderRadius: 6,
              fontSize: 13,
              color: '#d4c5a0',
              maxWidth: 600,
              textAlign: 'center',
              boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
              animation: 'fadeInUp 0.2s ease-out',
            }}>
              {message}
            </div>
          </div>
        )}

        {/* Overlay panels */}
        {renderOverlay()}

      </div>
      </div>{/* end wrapper */}

      {/* Mobile touch controls — below the game */}
      <TouchControls dispatch={dispatch} phase={GamePhase.Village} menuMode={MenuMode.None} />

      {/* Overlay touch controls for village menus (dialogue, shop, etc) */}
      {overlay !== 'none' && villageMobile && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: '12px 0', touchAction: 'none',
        }}>
          {overlay !== 'dialogue' && (
            <button
              style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
              onTouchStart={e => { e.preventDefault(); setOverlayCursor(c => Math.max(0, c - 1)); sfxMenuMove(); }}
            >▲</button>
          )}
          <button
            style={{ minWidth: 60, minHeight: 44, borderRadius: 10, background: 'rgba(201,168,76,0.04)', border: '1.5px solid rgba(201,168,76,0.15)', color: '#8a7a60', fontSize: 11, fontFamily: 'var(--font-game)', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            onTouchStart={e => { e.preventDefault(); setOverlay('none'); }}
          >戻る</button>
          <button
            style={{ minWidth: 60, minHeight: 44, borderRadius: 10, background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.3)', color: '#c9a84c', fontSize: 11, fontFamily: 'var(--font-game)', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            onTouchStart={e => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            }}
          >決定</button>
          {overlay !== 'dialogue' && (
            <button
              style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
              onTouchStart={e => { e.preventDefault(); setOverlayCursor(c => c + 1); sfxMenuMove(); }}
            >▼</button>
          )}
        </div>
      )}
    </div>
  );
}
