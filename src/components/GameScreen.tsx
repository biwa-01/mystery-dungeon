'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, StatusEffect, ItemCategory } from '@/types/game';
import DungeonRenderer from './DungeonRenderer';
import StatusBar from './StatusPanel';
import CombatLogPanel from './CombatLogPanel';
import InventoryPanel from './InventoryPanel';
import FloorMenu from './FloorMenu';
import TitleScreen from './TitleScreen';
import GameOverScreen from './GameOverScreen';
import VillageScreen from './VillageScreen';
import MiniMap from './MiniMap';
import TouchControls from './TouchControls';
import { useGame } from '@/hooks/useGame';
import { TileType } from '@/types/game';
import {
  initAudio, startBGM, stopBGM, startTitleBGM, stopTitleBGM,
  startVillageBGM, stopVillageBGM,
  sfxFootstep, sfxSwordSwing, sfxHit,
  sfxCritical, sfxDamage, sfxPickup, sfxStairs, sfxLevelUp,
  sfxHeal, sfxDefeat, sfxTrap, sfxExpGain, sfxInventoryFull,
  sfxDeath, sfxSlashArc, sfxLightningZap, sfxDissolve,
  sfxMonsterAttack, sfxShieldBlock, sfxIdentify, sfxDodge,
  sfxExpAbsorb, sfxDrop, sfxWhiff, sfxHeartbeat, sfxAutoPickup,
  sfxSplit, sfxStomachGrowl, sfxHitMeat,
  sfxSwing, sfxMiss2, sfxEatFood, sfxDrinkPotion, sfxReadScroll,
  sfxEquip, sfxCurseReveal, sfxMonsterSpawn, sfxTrapBurst, sfxGameOver,
  sfxStaffWave, sfxItemPickupMaterial, modulateBGMTension,
} from '@/engine/audio';

// Responsive scaling hook — calculates CSS scale to fit 800x600 in viewport
function useResponsiveScale(baseW: number, baseH: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function calc() {
      const isMobile = window.innerWidth <= 840 || ('ontouchstart' in window);
      if (!isMobile) { setScale(1); return; }
      // On mobile, leave space for touch controls (bottom ~200px)
      const availH = window.innerHeight - (window.innerWidth <= 600 ? 180 : 0);
      const sx = window.innerWidth / baseW;
      const sy = availH / baseH;
      setScale(Math.min(sx, sy, 1));
    }
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('orientationchange', calc);
    };
  }, [baseW, baseH]);
  return scale;
}

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const gameScale = useResponsiveScale(800, 600);

  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 });
  const [damageFlash, setDamageFlash] = useState(0);
  const [levelUpEffect, setLevelUpEffect] = useState(0);
  const [poisonPulse, setPoisonPulse] = useState(0);
  const [hungerPulse, setHungerPulse] = useState(0);
  const [criticalFlash, setCriticalFlash] = useState(0);
  const [stairsFade, setStairsFade] = useState(0);
  const [deathSlowmo, setDeathSlowmo] = useState(false);
  const [hpPinch, setHpPinch] = useState(false);
  const [activeAttack, setActiveAttack] = useState(false);
  // #24: Floor transition banner
  const [floorBanner, setFloorBanner] = useState<string | null>(null);
  // #25: Low HP screen pulse
  const [lowHpPulse, setLowHpPulse] = useState(0);
  // #23: Screen transition fade
  const [screenFade, setScreenFade] = useState(0);

  const prevHpRef = useRef(state.player.hp);
  const prevLevelRef = useRef(state.player.level);
  const prevLogsRef = useRef(state.logs.length);
  const prevPosRef = useRef({ x: state.player.pos.x, y: state.player.pos.y });
  const prevFloorRef = useRef(state.floorNumber);
  const prevItemCountRef = useRef(state.player.inventory.length);
  const prevMonsterCountRef = useRef(state.floor.monsters.length);
  const audioInitRef = useRef(false);
  // #22: Key repeat throttle
  const lastSfxTimeRef = useRef(0);

  // Init audio on first interaction
  const phaseRef = useRef(state.phase);
  const floorRef = useRef(state.floorNumber);
  phaseRef.current = state.phase;
  floorRef.current = state.floorNumber;

  useEffect(() => {
    function handleInteraction() {
      if (!audioInitRef.current) {
        audioInitRef.current = true;
        initAudio().then(() => {
          // Use refs to get current phase (avoid stale closure)
          const p = phaseRef.current;
          const f = floorRef.current;
          if (p === GamePhase.Dungeon) startBGM(f);
          else if (p === GamePhase.Village) startVillageBGM();
          else if (p === GamePhase.Title) startTitleBGM();
        });
      }
    }
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Phase-aware BGM management
  useEffect(() => {
    if (!audioInitRef.current) return;
    if (state.phase === GamePhase.Dungeon) {
      startBGM(state.floorNumber);
    } else if (state.phase === GamePhase.Village) {
      startVillageBGM();
    } else if (state.phase === GamePhase.Title) {
      startTitleBGM();
    } else if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) {
      stopBGM();
    }
  }, [state.phase, state.floorNumber]);

  const prevMonPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // #22: Throttled SFX helper
  const throttledSfx = (fn: () => void) => {
    const now = Date.now();
    if (now - lastSfxTimeRef.current >= 50) {
      lastSfxTimeRef.current = now;
      fn();
    }
  };

  // Footstep sound on movement (environment-aware)
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    if (state.player.pos.x !== prevPosRef.current.x || state.player.pos.y !== prevPosRef.current.y) {
      const tile = state.floor.tiles[state.player.pos.y]?.[state.player.pos.x];
      const inCorridor = tile === TileType.Corridor;
      throttledSfx(() => sfxFootstep(inCorridor));
      prevPosRef.current = { x: state.player.pos.x, y: state.player.pos.y };
    }
  }, [state.player.pos.x, state.player.pos.y, state.phase]);

  // Heavy monster footstep shake
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    const HEAVY = new Set(['golem', 'minotaur', 'devil', 'dragon_pup']);
    for (const mon of state.floor.monsters) {
      const prev = prevMonPosRef.current.get(mon.id);
      if (prev && (prev.x !== mon.pos.x || prev.y !== mon.pos.y)) {
        if (HEAVY.has(mon.templateId) && state.floor.visible[mon.pos.y]?.[mon.pos.x]) {
          const dx = Math.abs(mon.pos.x - state.player.pos.x);
          const dy = Math.abs(mon.pos.y - state.player.pos.y);
          if (dx <= 6 && dy <= 6) {
            const intensity = Math.max(0.5, 2.5 - Math.sqrt(dx * dx + dy * dy) * 0.3);
            triggerShake(intensity);
          }
        }
      }
      prevMonPosRef.current.set(mon.id, { x: mon.pos.x, y: mon.pos.y });
    }
  }, [state.floor.monsters, state.phase]);

  // Damage detection + audio
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    const hpDiff = prevHpRef.current - state.player.hp;
    prevHpRef.current = state.player.hp;
    if (hpDiff > 0) {
      triggerShake(Math.min(8, 2 + hpDiff * 0.5));
      setDamageFlash(1);
      sfxDamage();
      if (state.player.hp <= 0) {
        setDeathSlowmo(true);
        sfxDeath();
        setTimeout(() => sfxGameOver(), 500);
      }
    } else if (hpDiff < 0) {
      sfxHeal();
    }
  }, [state.player.hp, state.phase]);

  useEffect(() => {
    if (damageFlash <= 0) return;
    const t = setInterval(() => setDamageFlash(p => Math.max(0, p - 0.06)), 16);
    return () => clearInterval(t);
  }, [damageFlash]);

  // Critical flash decay
  useEffect(() => {
    if (criticalFlash <= 0) return;
    const t = setInterval(() => setCriticalFlash(p => Math.max(0, p - 0.08)), 16);
    return () => clearInterval(t);
  }, [criticalFlash]);

  // Level up + audio
  useEffect(() => {
    if (state.player.level > prevLevelRef.current) {
      setLevelUpEffect(1);
      sfxLevelUp();
    }
    prevLevelRef.current = state.player.level;
  }, [state.player.level]);

  useEffect(() => {
    if (levelUpEffect <= 0) return;
    const t = setInterval(() => setLevelUpEffect(p => Math.max(0, p - 0.012)), 16);
    return () => clearInterval(t);
  }, [levelUpEffect]);

  // #23 + #24: Stairs descent with fade + floor banner
  useEffect(() => {
    if (state.floorNumber > prevFloorRef.current) {
      sfxStairs();
      setStairsFade(1);
      setScreenFade(1);
      startBGM(state.floorNumber);
      // Floor banner
      setFloorBanner(`地下 ${state.floorNumber} F`);
      setTimeout(() => setFloorBanner(null), 2000);
      // Fade out
      setTimeout(() => setScreenFade(0), 500);
    }
    prevFloorRef.current = state.floorNumber;
  }, [state.floorNumber]);

  useEffect(() => {
    if (stairsFade <= 0) return;
    const t = setInterval(() => setStairsFade(p => Math.max(0, p - 0.025)), 16);
    return () => clearInterval(t);
  }, [stairsFade]);

  // Item pickup audio
  useEffect(() => {
    if (state.player.inventory.length > prevItemCountRef.current) {
      const newItems = state.player.inventory.slice(prevItemCountRef.current);
      if (newItems.length > 0) {
        const newest = newItems[newItems.length - 1];
        sfxItemPickupMaterial(newest.category);
      } else {
        sfxPickup();
      }
    }
    prevItemCountRef.current = state.player.inventory.length;
  }, [state.player.inventory.length]);

  // Monster defeated audio + EXP sound + split detection
  useEffect(() => {
    if (state.floor.monsters.length < prevMonsterCountRef.current) {
      sfxDefeat();
      setTimeout(sfxExpGain, 150);
    } else if (state.floor.monsters.length > prevMonsterCountRef.current) {
      sfxSplit();
    }
    prevMonsterCountRef.current = state.floor.monsters.length;
  }, [state.floor.monsters.length]);

  // Log-based audio
  useEffect(() => {
    if (state.logs.length <= prevLogsRef.current) { prevLogsRef.current = state.logs.length; return; }
    const newLogs = state.logs.slice(prevLogsRef.current);
    prevLogsRef.current = state.logs.length;
    for (const log of newLogs) {
      if (log.type === 'critical') {
        if (log.message.includes('会心')) {
          triggerShake(6);
          sfxCritical();
          setCriticalFlash(1);
        } else if (log.message.includes('炎を吐いた')) {
          triggerShake(4);
          sfxLightningZap();
        } else {
          triggerShake(3);
          sfxMonsterAttack();
        }
      } else if (log.type === 'damage' && !log.message.includes('ダメージを受けた')) {
        sfxSlashArc();
        setTimeout(sfxHit, 60);
        const dmgMatch = log.message.match(/(\d+)のダメージ/);
        if (dmgMatch && parseInt(dmgMatch[1]) >= 10) {
          setTimeout(sfxHitMeat, 40);
        }
        setActiveAttack(true);
        setTimeout(() => setActiveAttack(false), 200);
      }
      if (log.message.includes('持ち物がいっぱい')) sfxInventoryFull();
      if (log.message.includes('ワナ')) { sfxTrap(); sfxLightningZap(); }
      if (log.message.includes('倒した')) sfxDissolve();
      if (log.message.includes('跳ね返した')) sfxShieldBlock();
      if (log.message.includes('識別') || log.message.includes('判明')) sfxIdentify();
      if (log.message.includes('かわした') || log.message.includes('外れた')) { sfxDodge(); sfxWhiff(); }
      if (log.message.includes('を置いた') || log.message.includes('落ちた')) sfxDrop();
      if (log.message.includes('を拾った')) sfxAutoPickup();
      if (log.message.includes('を振った')) sfxStaffWave();
      if (log.message.includes('を食べた')) sfxEatFood();
      if (log.message.includes('を飲んだ')) sfxDrinkPotion();
      if (log.message.includes('巻物を読んだ') || log.message.includes('を読んだ')) sfxReadScroll();
      if (log.message.includes('を装備した')) sfxEquip();
      if (log.message.includes('呪われ')) sfxCurseReveal();
      if (log.message.includes('地雷') || log.message.includes('落とし穴')) sfxTrapBurst();
      if (log.message.includes('モンスターが現れた') || log.message.includes('呼び寄せた')) sfxMonsterSpawn();
      if (log.message.includes('ミス') || log.message.includes('外れた') || log.message.includes('かわした')) sfxMiss2();
      if (log.message.includes('素振りをした') || log.message.includes('何もいない')) sfxSwing();
    }
  }, [state.logs.length, state.logs]);

  // HP Pinch detection
  useEffect(() => {
    const isPinch = state.player.hp > 0 && state.player.hp <= state.player.maxHp * 0.25;
    setHpPinch(isPinch);
    if (isPinch) {
      const heartTimer = setInterval(() => sfxHeartbeat(), 1200);
      return () => clearInterval(heartTimer);
    }
  }, [state.player.hp, state.player.maxHp]);

  // #25: Low HP screen pulse animation
  useEffect(() => {
    const isPinch = state.player.hp > 0 && state.player.hp <= state.player.maxHp * 0.25;
    if (isPinch) {
      const t = setInterval(() => {
        const now = performance.now();
        setLowHpPulse(Math.sin(now * 0.003) * 0.5 + 0.5);
      }, 32);
      return () => { clearInterval(t); setLowHpPulse(0); };
    }
    setLowHpPulse(0);
  }, [state.player.hp, state.player.maxHp]);

  // HP-based BGM tension modulation
  const prevHpRatioRef = useRef(1);
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    if (state.player.maxHp <= 0) return;
    const ratio = state.player.hp / state.player.maxHp;
    const prevRatio = prevHpRatioRef.current;
    const crossed = (ratio < 0.25) !== (prevRatio < 0.25) ||
                    (ratio < 0.5) !== (prevRatio < 0.5);
    if (crossed) {
      modulateBGMTension(ratio);
    }
    prevHpRatioRef.current = ratio;
  }, [state.player.hp, state.player.maxHp, state.phase]);

  // Stomach growl
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    const isHungry = state.player.satiation < state.player.maxSatiation * 0.2;
    if (isHungry && state.player.satiation > 0) {
      const growlTimer = setInterval(() => sfxStomachGrowl(), 8000 + Math.random() * 5000);
      sfxStomachGrowl();
      return () => clearInterval(growlTimer);
    }
  }, [state.player.satiation < state.player.maxSatiation * 0.2, state.phase]);

  // Status effect screen pulses
  useEffect(() => {
    const hasPois = state.player.statuses.some(s => s.type === StatusEffect.Poison);
    const isHungry = state.player.satiation < state.player.maxSatiation * 0.2;
    if (hasPois || isHungry) {
      const t = setInterval(() => {
        const now = performance.now();
        if (hasPois) setPoisonPulse(Math.sin(now * 0.004) * 0.5 + 0.5);
        if (isHungry) setHungerPulse(Math.sin(now * 0.002) * 0.5 + 0.5);
      }, 32);
      return () => { clearInterval(t); setPoisonPulse(0); setHungerPulse(0); };
    }
    setPoisonPulse(0);
    setHungerPulse(0);
  }, [state.player.statuses, state.player.satiation, state.player.maxSatiation]);

  // Death slowmo reset on phase change
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) {
      setDeathSlowmo(false);
    }
  }, [state.phase]);

  function triggerShake(intensity: number) {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= 8) { setScreenShake({ x: 0, y: 0 }); clearInterval(interval); return; }
      const decay = 1 - count / 8;
      setScreenShake({
        x: (Math.random() * 2 - 1) * intensity * decay,
        y: (Math.random() * 2 - 1) * intensity * decay,
      });
    }, 22);
  }

  if (state.phase === GamePhase.Title) return <TitleScreen dispatch={dispatch} />;
  if (state.phase === GamePhase.Village) return <VillageScreen state={state} dispatch={dispatch} />;
  if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) return <GameOverScreen state={state} />;

  const footItem = state.floor.items.find(i => i.floorPos?.x === state.player.pos.x && i.floorPos?.y === state.player.pos.y);
  const onStairs = state.player.pos.x === state.floor.stairsPos.x && state.player.pos.y === state.floor.stairsPos.y;

  return (
    <div className="game-viewport h-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: '#050508', fontFamily: 'var(--font-game)' }}>

      {/* Main game container - scales to fit viewport */}
      <div className="game-container relative" style={{
        width: 800,
        height: 600,
        transform: gameScale < 1 ? `scale(${gameScale})` : undefined,
        transformOrigin: 'top center',
        // #25: Low HP red border pulse
        boxShadow: lowHpPulse > 0 ? `inset 0 0 ${20 + lowHpPulse * 30}px rgba(200,30,30,${lowHpPulse * 0.4})` : 'none',
        transition: 'box-shadow 0.1s',
      }}>
        {/* Dungeon canvas - fills the container */}
        <DungeonRenderer
          state={state}
          screenShake={screenShake}
          damageFlash={damageFlash}
          levelUpEffect={levelUpEffect}
          criticalFlash={criticalFlash}
          stairsFade={stairsFade}
          deathSlowmo={deathSlowmo}
          hpPinch={hpPinch}
        />

        {/* Top Status Bar - overlays canvas */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <StatusBar state={state} />
        </div>

        {/* #34: Mini Map - top right corner (toggleable) */}
        {state.showMinimap && (
          <div className="absolute top-9 right-2 z-20">
            <MiniMap state={state} />
          </div>
        )}

        {/* #24: Floor transition banner */}
        {floorBanner && (
          <div
            className="absolute left-0 right-0 z-40 flex justify-center"
            style={{
              top: '80px',
              animation: 'floorBannerSlide 2s ease-out forwards',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid #c9a84c40',
              padding: '8px 32px',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 900,
              color: '#c9a84c',
              letterSpacing: '0.2em',
              textShadow: '0 0 20px rgba(201,168,76,0.4)',
            }}>
              {floorBanner}
            </div>
          </div>
        )}

        {/* Foot notification - above combat log */}
        {(footItem || onStairs) && (
          <div
            className="absolute left-0 right-0 z-20 flex justify-center"
            style={{ bottom: '100px' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-1.5 rounded torch-flicker"
              style={{
                background: 'rgba(0,0,0,0.75)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '12px',
              }}
            >
              {footItem && (
                <span style={{ color: '#d0b870' }}>
                  足元: {footItem.name}
                  <span style={{ color: '#666', marginLeft: '6px' }}>G:拾う</span>
                </span>
              )}
              {onStairs && (
                <span style={{ color: '#e0c050' }}>
                  階段がある
                  <span style={{ color: '#666', marginLeft: '6px' }}>S:降りる</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Combat Log - bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <CombatLogPanel logs={state.logs} showHistory={state.showLogHistory} />
        </div>

        {/* Poison screen filter */}
        {poisonPulse > 0 && (
          <div className="absolute inset-0 pointer-events-none rounded z-10"
            style={{
              background: `rgba(100,20,130,${poisonPulse * 0.12})`,
              mixBlendMode: 'multiply',
              boxShadow: `inset 0 0 80px rgba(100,20,130,${poisonPulse * 0.2})`,
            }} />
        )}

        {/* Hunger screen filter */}
        {hungerPulse > 0 && (
          <div className="absolute inset-0 pointer-events-none rounded z-10"
            style={{
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(20,8,5,${hungerPulse * 0.35}) 100%)`,
            }} />
        )}

        {/* Overlays */}
        <InventoryPanel state={state} />
        <FloorMenu state={state} />

        {/* #35: Quest log overlay */}
        {state.showQuestLog && (
          <div className="absolute inset-0 flex items-center justify-center z-30"
            style={{ background: 'rgba(3,3,6,0.88)', backdropFilter: 'blur(2px)' }}>
            <div className="panel-ornate" style={{ width: '400px', maxHeight: '400px', padding: '16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', color: '#c9a84c', fontSize: '14px', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.1em' }}>
                冒険の記録
              </div>
              <div style={{ fontSize: '11px', color: '#7a7060', lineHeight: '2' }}>
                <div>現在の階層: 地下{state.floorNumber}F</div>
                <div>目標: 地下{state.maxFloors}Fの最深部を目指せ</div>
                <div>討伐数: {state.player.turnCount > 0 ? '記録中' : '---'}</div>
                <div>所持金: {state.player.gold}G</div>
                <div>プレイ時間: {Math.floor(state.playTimeSeconds / 60)}分</div>
              </div>
              <div style={{ color: '#333', fontSize: '9px', marginTop: '12px', fontFamily: 'var(--font-display)' }}>
                Q: 閉じる
              </div>
            </div>
          </div>
        )}

        {/* Level Up overlay */}
        {levelUpEffect > 0.3 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div
              className="tracking-[0.3em]"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 900,
                color: '#c9a84c',
                textShadow: '0 0 30px rgba(201,168,76,0.6), 0 0 60px rgba(201,168,76,0.2)',
                opacity: levelUpEffect,
                transform: `scale(${0.85 + levelUpEffect * 0.3})`,
              }}
            >
              LEVEL UP
            </div>
          </div>
        )}

        {/* #23: Screen transition fade overlay */}
        {screenFade > 0 && (
          <div className="absolute inset-0 pointer-events-none z-45"
            style={{
              background: '#000',
              opacity: screenFade,
              transition: 'opacity 0.5s ease-out',
            }} />
        )}

        {/* Stairs descent fade overlay */}
        {stairsFade > 0 && (
          <div className="absolute inset-0 pointer-events-none z-40"
            style={{
              background: '#000',
              opacity: stairsFade > 0.5 ? 1 : stairsFade * 2,
              transition: 'none',
            }} />
        )}

        {/* Death slowmo vignette */}
        {deathSlowmo && (
          <div className="absolute inset-0 pointer-events-none z-20"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 20%, rgba(80,0,0,0.4) 100%)',
              animation: 'deathPulse 1s ease-in-out infinite',
            }} />
        )}

        {/* Mobile touch controls */}
        <TouchControls dispatch={dispatch} phase={state.phase} menuMode={state.menuMode} />
      </div>

      <style jsx>{`
        @keyframes deathPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes floorBannerSlide {
          0% { transform: translateY(-40px); opacity: 0; }
          15% { transform: translateY(0); opacity: 1; }
          75% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
