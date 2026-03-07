'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, StatusEffect } from '@/types/game';
import DungeonRenderer from './DungeonRenderer';
import StatusPanel from './StatusPanel';
import CombatLogPanel from './CombatLogPanel';
import InventoryPanel from './InventoryPanel';
import FloorMenu from './FloorMenu';
import TitleScreen from './TitleScreen';
import GameOverScreen from './GameOverScreen';
import MiniMap from './MiniMap';
import { useGame } from '@/hooks/useGame';
import { TileType } from '@/types/game';
import {
  initAudio, startBGM, sfxFootstep, sfxSwordSwing, sfxHit,
  sfxCritical, sfxDamage, sfxPickup, sfxStairs, sfxLevelUp,
  sfxHeal, sfxDefeat, sfxTrap, sfxExpGain, sfxInventoryFull,
  sfxDeath, sfxSlashArc, sfxLightningZap, sfxDissolve,
  sfxMonsterAttack, sfxShieldBlock, sfxIdentify, sfxDodge,
  sfxExpAbsorb,
} from '@/engine/audio';

export default function GameScreen() {
  const { state } = useGame();

  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 });
  const [damageFlash, setDamageFlash] = useState(0);
  const [levelUpEffect, setLevelUpEffect] = useState(0);
  const [poisonPulse, setPoisonPulse] = useState(0);
  const [hungerPulse, setHungerPulse] = useState(0);
  const [criticalFlash, setCriticalFlash] = useState(0);
  const [stairsFade, setStairsFade] = useState(0);
  const [deathSlowmo, setDeathSlowmo] = useState(false);
  const prevHpRef = useRef(state.player.hp);
  const prevLevelRef = useRef(state.player.level);
  const prevLogsRef = useRef(state.logs.length);
  const prevPosRef = useRef({ x: state.player.pos.x, y: state.player.pos.y });
  const prevFloorRef = useRef(state.floorNumber);
  const prevItemCountRef = useRef(state.player.inventory.length);
  const prevMonsterCountRef = useRef(state.floor.monsters.length);
  const audioInitRef = useRef(false);

  // Init audio on first interaction
  useEffect(() => {
    function handleInteraction() {
      if (!audioInitRef.current) {
        audioInitRef.current = true;
        initAudio();
        if (state.phase === GamePhase.Dungeon) startBGM(state.floorNumber);
      }
    }
    window.addEventListener('keydown', handleInteraction, { once: false });
    window.addEventListener('click', handleInteraction, { once: false });
    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [state.phase, state.floorNumber]);

  // Start BGM when entering dungeon
  useEffect(() => {
    if (state.phase === GamePhase.Dungeon && audioInitRef.current) {
      startBGM(state.floorNumber);
    }
  }, [state.phase, state.floorNumber]);

  // Footstep sound on movement (environment-aware)
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    if (state.player.pos.x !== prevPosRef.current.x || state.player.pos.y !== prevPosRef.current.y) {
      const tile = state.floor.tiles[state.player.pos.y]?.[state.player.pos.x];
      const inCorridor = tile === TileType.Corridor;
      sfxFootstep(inCorridor);
      prevPosRef.current = { x: state.player.pos.x, y: state.player.pos.y };
    }
  }, [state.player.pos.x, state.player.pos.y, state.phase]);

  // Damage detection + audio
  useEffect(() => {
    if (state.phase !== GamePhase.Dungeon) return;
    const hpDiff = prevHpRef.current - state.player.hp;
    prevHpRef.current = state.player.hp;
    if (hpDiff > 0) {
      triggerShake(Math.min(8, 2 + hpDiff * 0.5));
      setDamageFlash(1);
      sfxDamage();
      // Death detection
      if (state.player.hp <= 0) {
        setDeathSlowmo(true);
        sfxDeath();
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

  // Level up + audio (BGM duck handled in sfxLevelUp)
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

  // Stairs descent: fade-out effect + audio + BGM key change
  useEffect(() => {
    if (state.floorNumber > prevFloorRef.current) {
      sfxStairs();
      // Trigger fade-out/in
      setStairsFade(1);
      // BGM will update key on next startBGM call (from phase effect)
      startBGM(state.floorNumber);
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
      sfxPickup();
    }
    prevItemCountRef.current = state.player.inventory.length;
  }, [state.player.inventory.length]);

  // Monster defeated audio + EXP sound
  useEffect(() => {
    if (state.floor.monsters.length < prevMonsterCountRef.current) {
      sfxDefeat();
      setTimeout(sfxExpGain, 150);
    }
    prevMonsterCountRef.current = state.floor.monsters.length;
  }, [state.floor.monsters.length]);

  // Log-based audio (critical hits, attacks, inventory full, traps)
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
      }
      if (log.message.includes('持ち物がいっぱい')) {
        sfxInventoryFull();
      }
      if (log.message.includes('ワナ')) {
        sfxTrap();
        sfxLightningZap();
      }
      if (log.message.includes('倒した')) {
        sfxDissolve();
      }
      if (log.message.includes('跳ね返した')) {
        sfxShieldBlock();
      }
      if (log.message.includes('識別') || log.message.includes('判明')) {
        sfxIdentify();
      }
      if (log.message.includes('かわした') || log.message.includes('外れた')) {
        sfxDodge();
      }
    }
  }, [state.logs.length, state.logs]);

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

  if (state.phase === GamePhase.Title) return <TitleScreen />;
  if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) return <GameOverScreen state={state} />;

  const footItem = state.floor.items.find(i => i.floorPos?.x === state.player.pos.x && i.floorPos?.y === state.player.pos.y);
  const onStairs = state.player.pos.x === state.floor.stairsPos.x && state.player.pos.y === state.floor.stairsPos.y;

  return (
    <div className="h-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: '#050508', fontFamily: 'var(--font-game)' }}>

      <div className="flex gap-3 items-start relative">
        {/* Left column: game + log */}
        <div className="flex flex-col gap-2 relative">
          <DungeonRenderer
            state={state}
            screenShake={screenShake}
            damageFlash={damageFlash}
            levelUpEffect={levelUpEffect}
            criticalFlash={criticalFlash}
            stairsFade={stairsFade}
            deathSlowmo={deathSlowmo}
          />

          {/* Poison screen filter */}
          {poisonPulse > 0 && (
            <div className="absolute inset-0 pointer-events-none rounded z-10"
              style={{
                background: `rgba(100,20,130,${poisonPulse * 0.12})`,
                mixBlendMode: 'multiply',
                boxShadow: `inset 0 0 80px rgba(100,20,130,${poisonPulse * 0.2})`,
              }} />
          )}

          {/* Hunger screen filter (pulsing dark vignette) */}
          {hungerPulse > 0 && (
            <div className="absolute inset-0 pointer-events-none rounded z-10"
              style={{
                background: `radial-gradient(ellipse at center, transparent 40%, rgba(20,8,5,${hungerPulse * 0.35}) 100%)`,
                animation: 'none',
              }} />
          )}

          {/* Foot notification */}
          {(footItem || onStairs) && (
            <div
              className="flex items-center gap-3 px-3 py-1.5 rounded torch-flicker"
              style={{
                background: 'rgba(12,12,20,0.9)',
                border: '1px solid #1a1520',
                fontSize: '11px',
              }}
            >
              {footItem && (
                <span style={{ color: '#b0a060' }}>
                  足元: {footItem.name}
                  <span style={{ color: '#3a3530', marginLeft: '6px' }}>G:拾う</span>
                </span>
              )}
              {onStairs && (
                <span style={{ color: '#c9a84c' }}>
                  階段がある
                  <span style={{ color: '#3a3530', marginLeft: '6px' }}>S:降りる</span>
                </span>
              )}
            </div>
          )}

          <CombatLogPanel logs={state.logs} />
        </div>

        {/* Right column: status + minimap */}
        <div className="flex flex-col gap-2">
          <StatusPanel state={state} />
          <MiniMap state={state} />
        </div>

        {/* Overlays */}
        <InventoryPanel state={state} />
        <FloorMenu state={state} />

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
      </div>

      <style jsx>{`
        @keyframes deathPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
