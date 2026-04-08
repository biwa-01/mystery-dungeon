'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hasSave, loadGame, deleteSave } from '@/engine/saveLoad';
import { PROLOGUE_LINES } from '@/engine/data/atmosphere';
import { initAudio, startTitleBGM, sfxMenuSelect, sfxMenuMove } from '@/engine/audio';
import { GameAction, GameState } from '@/types/game';

type Phase = 'title' | 'prologue' | 'ready';

interface Props {
  dispatch: React.Dispatch<GameAction>;
}

export default function TitleScreen({ dispatch }: Props) {
  const [hasExistingSave, setHasExistingSave] = useState(false);
  const [phase, setPhase] = useState<Phase>('title');
  const [menuCursor, setMenuCursor] = useState(0);
  const [prologueLine, setPrologueLine] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [titleReady, setTitleReady] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const audioStartedRef = useRef(false);

  useEffect(() => {
    setHasExistingSave(hasSave());
    setTimeout(() => setTitleReady(true), 400);
    setTimeout(() => setSubtitleVisible(true), 1600);
    setTimeout(() => setMenuVisible(true), 2800);
  }, []);

  // Start audio on first interaction
  const ensureAudio = useCallback(() => {
    if (audioStartedRef.current) return;
    audioStartedRef.current = true;
    initAudio().then(() => startTitleBGM());
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', ensureAudio, { once: false });
    window.addEventListener('click', ensureAudio, { once: false });
    window.addEventListener('touchstart', ensureAudio, { once: false });
    return () => {
      window.removeEventListener('keydown', ensureAudio);
      window.removeEventListener('click', ensureAudio);
      window.removeEventListener('touchstart', ensureAudio);
    };
  }, [ensureAudio]);

  // #30 Menu options: New Game, Continue, Options
  const [showOptions, setShowOptions] = useState(false);

  const menuItems = hasExistingSave
    ? [
        { id: 'continue', label: 'つづきから' },
        { id: 'newgame', label: 'はじめから' },
        { id: 'options', label: '設定' },
      ]
    : [
        { id: 'newgame', label: 'はじめから' },
        { id: 'options', label: '設定' },
      ];

  // Handle menu selection
  const handleSelect = useCallback(() => {
    if (!menuVisible || phase !== 'title') return;
    ensureAudio();
    sfxMenuSelect();
    const selected = menuItems[menuCursor];
    if (selected.id === 'continue') {
      const saved = loadGame();
      if (saved) {
        dispatch({ type: 'LOAD_GAME', state: saved });
      } else {
        // Save corrupted, start new
        deleteSave();
        setPhase('prologue');
      }
    } else if (selected.id === 'options') {
      // #30 Options menu toggle
      setShowOptions(prev => !prev);
    } else {
      // New game - delete old save, show prologue
      deleteSave();
      setPhase('prologue');
    }
  }, [menuVisible, phase, menuCursor, menuItems, dispatch, ensureAudio]);

  // Handle prologue completion
  const handlePrologueComplete = useCallback(() => {
    sfxMenuSelect();
    dispatch({ type: 'NEW_GAME' });
  }, [dispatch]);

  // Keyboard input
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (phase === 'title') {
        if (!menuVisible) return;
        switch (e.key) {
          case 'ArrowUp':
          case 'k':
            e.preventDefault();
            setMenuCursor(c => {
              const next = Math.max(0, c - 1);
              if (next !== c) sfxMenuMove();
              return next;
            });
            break;
          case 'ArrowDown':
          case 'j':
            e.preventDefault();
            setMenuCursor(c => {
              const next = Math.min(menuItems.length - 1, c + 1);
              if (next !== c) sfxMenuMove();
              return next;
            });
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleSelect();
            break;
        }
      } else if (phase === 'prologue') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Skip to end
          setPrologueLine(PROLOGUE_LINES.length);
          setCharIndex(0);
        }
      } else if (phase === 'ready') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePrologueComplete();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, menuVisible, menuItems.length, handleSelect, handlePrologueComplete]);

  // Atmospheric background canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();

    const embers: { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; bright: number }[] = [];
    for (let i = 0; i < 80; i++) {
      embers.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 200,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.9 + 0.2),
        size: Math.random() * 2.5 + 0.5,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 300,
        bright: Math.random(),
      });
    }

    const dust: { x: number; y: number; vx: number; vy: number; size: number; phase: number }[] = [];
    for (let i = 0; i < 30; i++) {
      dust.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.05,
        size: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let fogOffset = 0;
    let frame = 0;

    function animate() {
      if (!c || !canvas) return;
      const W = canvas.width, H = canvas.height;
      frame++;
      fogOffset += 0.15;

      c.fillStyle = 'rgba(5, 5, 8, 0.07)';
      c.fillRect(0, 0, W, H);

      const bottomGrad = c.createRadialGradient(W * 0.5, H * 1.1, 0, W * 0.5, H * 1.1, H * 0.6);
      bottomGrad.addColorStop(0, 'rgba(80, 30, 10, 0.015)');
      bottomGrad.addColorStop(0.5, 'rgba(40, 15, 5, 0.008)');
      bottomGrad.addColorStop(1, 'transparent');
      c.fillStyle = bottomGrad;
      c.fillRect(0, 0, W, H);

      c.save();
      c.globalAlpha = 0.025;
      for (let i = 0; i < 4; i++) {
        const y = H * 0.45 + Math.sin(fogOffset * 0.008 + i * 1.8) * 60 + i * 35;
        const grad = c.createLinearGradient(0, y - 70, 0, y + 70);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, '#1a1520');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, y - 70, W, 140);
      }
      c.restore();

      for (const d of dust) {
        d.x += d.vx + Math.sin(frame * 0.003 + d.phase) * 0.03;
        d.y += d.vy + Math.cos(frame * 0.002 + d.phase) * 0.02;
        if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;
        const alpha = (Math.sin(frame * 0.01 + d.phase) * 0.5 + 0.5) * 0.15;
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = '#8a7a65';
        c.beginPath();
        c.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      for (const e of embers) {
        e.x += e.vx + Math.sin(e.life * 0.02) * 0.2;
        e.y += e.vy;
        e.life++;
        if (e.life > e.maxLife || e.y < -20) {
          e.x = Math.random() * W;
          e.y = H + 10;
          e.life = 0;
          e.maxLife = 200 + Math.random() * 300;
        }
        const lifeRatio = e.life / e.maxLife;
        const fade = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;
        const flicker = 0.6 + Math.sin(e.life * 0.1 + e.bright * 10) * 0.4;
        c.save();
        c.globalAlpha = fade * flicker * 0.55;
        c.shadowColor = e.bright > 0.5 ? '#c9a84c' : '#8b4513';
        c.shadowBlur = 6;
        c.fillStyle = e.bright > 0.5 ? '#f0d060' : '#c9804c';
        c.fillRect(e.x, e.y, e.size, e.size);
        c.restore();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    c.fillStyle = '#050508';
    c.fillRect(0, 0, canvas.width, canvas.height);
    // #29 Procedural pixel art dungeon grid overlay
    c.save();
    c.globalAlpha = 0.025;
    const gridSize = 24;
    for (let gx = 0; gx < canvas.width; gx += gridSize) {
      for (let gy = 0; gy < canvas.height; gy += gridSize) {
        const hash = ((gx * 374761393 + gy * 668265263) >>> 0) / 4294967296;
        if (hash > 0.6) {
          c.fillStyle = hash > 0.85 ? '#3a3530' : '#1a1815';
          c.fillRect(gx, gy, gridSize - 1, gridSize - 1);
        }
      }
    }
    c.restore();
    animRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Prologue typewriter
  useEffect(() => {
    if (phase !== 'prologue') return;
    if (prologueLine >= PROLOGUE_LINES.length) {
      setPhase('ready');
      return;
    }
    const line = PROLOGUE_LINES[prologueLine];
    if (line === '') {
      const t = setTimeout(() => { setPrologueLine(l => l + 1); setCharIndex(0); }, 500);
      return () => clearTimeout(t);
    }
    if (charIndex < line.length) {
      const t = setTimeout(() => setCharIndex(c => c + 1), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setPrologueLine(l => l + 1); setCharIndex(0); }, 900);
    return () => clearTimeout(t);
  }, [phase, prologueLine, charIndex]);

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none" style={{ background: '#050508' }}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(5,5,8,0.5) 60%, rgba(5,5,8,0.95) 100%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,8,0.9) 0%, transparent 100%)' }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        {/* ====== TITLE PHASE ====== */}
        {phase === 'title' && (
          <div className="flex flex-col items-center w-full max-w-lg">

            <div className={`transition-all duration-[1800ms] ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-xs tracking-[0.6em] uppercase mb-2"
                style={{ fontFamily: 'var(--font-display)', color: '#3d3528' }}>
                Roguelike Adventure
              </div>
            </div>

            <div className={`w-56 mb-6 gold-line transition-all duration-[2000ms] ${titleReady ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />

            <h1
              className={`text-glow-gold transition-all duration-[2500ms] text-center ${titleReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{
                fontFamily: 'var(--font-display)',
                color: '#c9a84c',
                letterSpacing: '0.22em',
                fontSize: 'clamp(1.8rem, 5vw, 3.8rem)',
                fontWeight: 900,
                textShadow: '0 0 40px rgba(201,168,76,0.25), 0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              不思議のダンジョン
            </h1>

            <div className={`mt-4 transition-all duration-[2000ms] ${subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div style={{
                fontFamily: 'var(--font-display)',
                color: '#a08850',
                fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)',
                letterSpacing: '0.3em',
                fontWeight: 700,
                textShadow: '0 0 20px rgba(201,168,76,0.15)',
              }}>
                黄金の腕輪と消えた父
              </div>
            </div>

            <div className={`mt-8 mb-8 transition-all duration-[1500ms] ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: '0.8s' }}>
              <span className="text-xs tracking-widest"
                style={{ fontFamily: 'var(--font-display)', color: '#5a4d38' }}>
                ― 黄金の腕輪と消えた父 ―
              </span>
            </div>

            <div className={`w-36 mb-8 gold-line transition-all duration-[2000ms] ${subtitleVisible ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />

            {/* Menu options */}
            <div className={`flex flex-col items-center gap-2 w-full max-w-xs transition-all duration-[1200ms] ${menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {menuItems.map((item, i) => (
                <button
                  key={item.id}
                  className="w-full px-6 py-3 border rounded transition-all duration-200 focus:outline-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: i === menuCursor ? '#c9a84c' : '#6b6255',
                    borderColor: i === menuCursor ? '#4a3d28' : '#2a2520',
                    background: i === menuCursor
                      ? 'rgba(201, 168, 76, 0.06)'
                      : 'rgba(201, 168, 76, 0.01)',
                    fontSize: '15px',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    textShadow: i === menuCursor ? '0 0 12px rgba(201,168,76,0.2)' : 'none',
                  }}
                  onClick={() => {
                    ensureAudio();
                    setMenuCursor(i);
                    setTimeout(() => handleSelect(), 50);
                  }}
                  onMouseEnter={() => {
                    if (i !== menuCursor) {
                      sfxMenuMove();
                      setMenuCursor(i);
                    }
                  }}
                >
                  {i === menuCursor && <span style={{ marginRight: '8px', opacity: 0.5 }}>&gt;</span>}
                  {item.label}
                </button>
              ))}
            </div>

            {/* Controls */}
            <div
              className={`mt-12 text-center leading-relaxed transition-all duration-1000 ${menuVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{ color: '#1e1b16', fontSize: '10px', fontFamily: 'var(--font-game)', transitionDelay: '0.5s' }}
            >
              <div className="w-40 gold-line mb-4 mx-auto opacity-20" />
              <div>移動 ― 矢印 / hjkl / タッチ操作</div>
              <div>足踏 Space / 拾う G / 階段 S / 持物 I</div>
            </div>
          </div>
        )}

        {/* ====== PROLOGUE PHASE ====== */}
        {(phase === 'prologue' || phase === 'ready') && (
          <div className="max-w-lg px-6 w-full"
            onClick={() => {
              if (phase === 'prologue') {
                setPrologueLine(PROLOGUE_LINES.length);
                setCharIndex(0);
              } else if (phase === 'ready') {
                handlePrologueComplete();
              }
            }}
          >
            <div className="space-y-1">
              {PROLOGUE_LINES.slice(0, prologueLine + 1).map((line, i) => (
                <div
                  key={i}
                  className="leading-relaxed"
                  style={{
                    fontFamily: line.includes('黄金の腕輪') || line.includes('不思議のダンジョン') ? 'var(--font-display)' : 'var(--font-body)',
                    fontSize: line.includes('黄金の腕輪') || line.includes('不思議のダンジョン') ? '16px' : '13px',
                    color: line === '' ? 'transparent' :
                      (line.includes('黄金の腕輪') || line.includes('不思議のダンジョン')) ? '#c9a84c' :
                      line.startsWith('「') ? '#b09860' :
                      '#8a7a65',
                    height: line === '' ? '12px' : 'auto',
                    textShadow: (line.includes('黄金の腕輪') || line.includes('不思議のダンジョン')) ? '0 0 20px rgba(201,168,76,0.3)' : 'none',
                    fontWeight: (line.includes('黄金の腕輪') || line.includes('不思議のダンジョン')) ? '700' : line.startsWith('「') ? '500' : '300',
                    letterSpacing: (line.includes('黄金の腕輪') || line.includes('不思議のダンジョン')) ? '0.15em' : '0.02em',
                  }}
                >
                  {i === prologueLine && line !== ''
                    ? line.substring(0, charIndex)
                    : line}
                  {i === prologueLine && charIndex < line.length && line !== '' && (
                    <span className="cursor-blink" style={{ color: '#c9a84c' }}>|</span>
                  )}
                </div>
              ))}
            </div>

            {phase === 'ready' && (
              <div className="mt-14 text-center">
                <div className="w-24 gold-line mx-auto mb-4" />
                <div
                  className="text-xs tracking-wider"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#6b5a40',
                    animation: 'torchFlicker 2s ease-in-out infinite',
                  }}
                >
                  タップ or Enter ― 村へ向かう
                </div>
              </div>
            )}

            {phase === 'prologue' && (
              <div className="mt-10 text-right" style={{ color: '#2a2520', fontSize: '10px' }}>
                タップ or Enter: スキップ
              </div>
            )}
          </div>
        )}
      </div>

      {/* #30 Options overlay */}
      {showOptions && phase === 'title' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(5,5,8,0.85)' }}
          onClick={() => setShowOptions(false)}
        >
          <div className="panel-ornate p-6" style={{ width: '280px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-display)', color: '#c9a84c', fontSize: '14px', letterSpacing: '0.1em', marginBottom: '12px', textAlign: 'center' }}>
              設定
            </div>
            <div style={{ fontSize: '12px', color: '#6b6255', lineHeight: '2' }}>
              <div>操作: 矢印キー / hjkl / タッチ</div>
              <div>BGM: ON</div>
              <div>SE: ON</div>
            </div>
            <button
              onClick={() => setShowOptions(false)}
              style={{ fontFamily: 'var(--font-display)', color: '#6b5a40', fontSize: '11px', marginTop: '12px', width: '100%', padding: '6px', border: '1px solid #2a2520', borderRadius: '3px', background: 'rgba(201,168,76,0.04)', cursor: 'pointer' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-5 z-10"
        style={{ color: '#1a1815', fontSize: '9px', fontFamily: 'var(--font-display)' }}>
        全30階層
      </div>

      {/* #31 Version number display */}
      <div className="absolute bottom-4 left-5 z-10"
        style={{ color: '#1a1815', fontSize: '9px', fontFamily: 'var(--font-game)' }}>
        v0.2.0
      </div>
    </div>
  );
}
