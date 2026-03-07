'use client';

import React, { useState, useEffect, useRef } from 'react';
import { hasSave } from '@/engine/saveLoad';
import { PROLOGUE_LINES } from '@/engine/data/atmosphere';

type Phase = 'title' | 'prologue' | 'ready';

export default function TitleScreen() {
  const [hasExistingSave, setHasExistingSave] = useState(false);
  const [phase, setPhase] = useState<Phase>('title');
  const [prologueLine, setPrologueLine] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [titleReady, setTitleReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    setHasExistingSave(hasSave());
    setTimeout(() => setTitleReady(true), 300);
  }, []);

  // Atmospheric background canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Ember particles
    const embers: { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; bright: number }[] = [];
    for (let i = 0; i < 80; i++) {
      embers.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 200,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.8 + 0.2),
        size: Math.random() * 2 + 0.5,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        bright: Math.random(),
      });
    }

    // Fog layers
    let fogOffset = 0;

    function animate() {
      if (!ctx || !canvas) return;
      fogOffset += 0.15;

      // Deep fade
      ctx.fillStyle = 'rgba(5, 5, 8, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Fog layer
      ctx.save();
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 3; i++) {
        const y = canvas.height * 0.5 + Math.sin(fogOffset * 0.01 + i * 2) * 50 + i * 40;
        const grad = ctx.createLinearGradient(0, y - 60, 0, y + 60);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, '#1a1520');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 60, canvas.width, 120);
      }
      ctx.restore();

      // Embers
      for (const e of embers) {
        e.x += e.vx + Math.sin(e.life * 0.02) * 0.15;
        e.y += e.vy;
        e.life++;

        if (e.life > e.maxLife || e.y < -20) {
          e.x = Math.random() * canvas.width;
          e.y = canvas.height + 10;
          e.life = 0;
          e.maxLife = 200 + Math.random() * 200;
        }

        const lifeRatio = e.life / e.maxLife;
        const fade = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;
        const flicker = 0.6 + Math.sin(e.life * 0.1 + e.bright * 10) * 0.4;

        ctx.save();
        ctx.globalAlpha = fade * flicker * 0.5;

        // Glow
        ctx.shadowColor = e.bright > 0.5 ? '#c9a84c' : '#8b4513';
        ctx.shadowBlur = 4;
        ctx.fillStyle = e.bright > 0.5 ? '#f0d060' : '#c9804c';
        ctx.fillRect(e.x, e.y, e.size, e.size);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    // Initial fill
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
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
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: '#050508' }}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5,5,8,0.6) 70%, rgba(5,5,8,0.95) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* ====== TITLE PHASE ====== */}
        {phase === 'title' && (
          <div className={`flex flex-col items-center transition-all duration-[2000ms] ${titleReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Ornamental line above */}
            <div className="w-48 mb-6 gold-line" />

            {/* Main title */}
            <h1
              className="text-5xl font-black tracking-[0.15em] text-glow-gold"
              style={{
                fontFamily: 'var(--font-display)',
                color: '#c9a84c',
                letterSpacing: '0.2em',
              }}
            >
              不思議のダンジョン
            </h1>

            {/* Subtitle */}
            <div
              className="mt-3 text-sm tracking-[0.5em] uppercase"
              style={{ fontFamily: 'var(--font-display)', color: '#5a5040' }}
            >
              Mystery Dungeon
            </div>

            {/* Story subtitle */}
            <div className="mt-6 mb-12" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-xs tracking-widest" style={{ color: '#6b5a40' }}>
                ― 黄金の腕輪と消えた父 ―
              </span>
            </div>

            {/* Ornamental line below */}
            <div className="w-32 mb-10 gold-line" />

            {/* Start prompt */}
            <div
              className={`transition-opacity duration-1000 ${titleReady ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: '1.5s' }}
            >
              {hasExistingSave ? (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="px-6 py-2 border rounded text-sm tracking-wider"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: '#c9a84c',
                      borderColor: '#4a3d28',
                      background: 'rgba(201, 168, 76, 0.04)',
                    }}
                  >
                    Enter ― 続きから冒険を再開
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm tracking-wider"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#6b5a40',
                  }}
                >
                  Enter &nbsp; ― &nbsp; 冒険を始める
                </div>
              )}
            </div>

            {/* Control hints */}
            <div
              className="mt-20 text-center leading-relaxed"
              style={{
                color: '#2a2520',
                fontSize: '10px',
                fontFamily: 'var(--font-game)',
                letterSpacing: '0.05em',
              }}
            >
              <div className="w-40 gold-line mb-4 mx-auto opacity-30" />
              <div>移動 ― 矢印 / hjkl / yubn</div>
              <div>ダッシュ ― Shift + 方向</div>
              <div>足踏 Space / 拾う G / 階段 S / 持物 I</div>
            </div>
          </div>
        )}

        {/* ====== PROLOGUE PHASE ====== */}
        {(phase === 'prologue' || phase === 'ready') && (
          <div className="max-w-lg px-10">
            <div className="space-y-1">
              {PROLOGUE_LINES.slice(0, prologueLine + 1).map((line, i) => (
                <div
                  key={i}
                  className="leading-relaxed"
                  style={{
                    fontFamily: line.includes('黄金の腕輪') ? 'var(--font-display)' : 'var(--font-body)',
                    fontSize: line.includes('黄金の腕輪') ? '16px' : '13px',
                    color: line === '' ? 'transparent' :
                      line.includes('黄金の腕輪') ? '#c9a84c' :
                      '#8a7a65',
                    height: line === '' ? '12px' : 'auto',
                    textShadow: line.includes('黄金の腕輪') ? '0 0 20px rgba(201,168,76,0.3)' : 'none',
                    fontWeight: line.includes('黄金の腕輪') ? '700' : '300',
                    letterSpacing: line.includes('黄金の腕輪') ? '0.15em' : '0.02em',
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
                  Enter ― 深淵へ踏み出す
                </div>
              </div>
            )}

            {phase === 'prologue' && (
              <div className="mt-10 text-right" style={{ color: '#2a2520', fontSize: '10px' }}>
                Enter: skip
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version watermark */}
      <div className="absolute bottom-4 right-5 z-10"
        style={{ color: '#1a1815', fontSize: '9px', fontFamily: 'var(--font-display)' }}>
        全25階層
      </div>
    </div>
  );
}
