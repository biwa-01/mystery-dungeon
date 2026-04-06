'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameState, GamePhase } from '@/types/game';
import { DEATH_QUOTES, VICTORY_LINES } from '@/engine/data/atmosphere';

interface Props {
  state: GameState;
}

export default function GameOverScreen({ state }: Props) {
  const isVictory = state.phase === GamePhase.Victory;
  const [fadeIn, setFadeIn] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [victoryLine, setVictoryLine] = useState(0);
  const [victoryChar, setVictoryChar] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    setFadeIn(true);
    const t1 = setTimeout(() => setShowStats(true), isVictory ? 2500 : 1800);
    const t2 = setTimeout(() => setShowPrompt(true), isVictory ? 5000 : 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isVictory]);

  // Victory typewriter
  useEffect(() => {
    if (!isVictory) return;
    if (victoryLine >= VICTORY_LINES.length) return;
    const line = VICTORY_LINES[victoryLine];
    if (line === '') {
      const t = setTimeout(() => { setVictoryLine(l => l + 1); setVictoryChar(0); }, 600);
      return () => clearTimeout(t);
    }
    if (victoryChar < line.length) {
      const t = setTimeout(() => setVictoryChar(c => c + 1), 45);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setVictoryLine(l => l + 1); setVictoryChar(0); }, 1100);
    return () => clearTimeout(t);
  }, [isVictory, victoryLine, victoryChar]);

  // Background particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; s: number; vy: number; a: number }[] = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        s: Math.random() * 2 + 0.5,
        vy: isVictory ? -(Math.random() * 0.5 + 0.2) : Math.random() * 0.2 + 0.05,
        a: Math.random() * Math.PI * 2,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = 'rgba(5, 5, 8, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.y += p.vy;
        p.a += 0.01;
        if (isVictory && p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (!isVictory && p.y > canvas.height + 5) { p.y = -5; p.x = Math.random() * canvas.width; }
        const alpha = (Math.sin(p.a) * 0.3 + 0.5) * 0.4;
        ctx.fillStyle = isVictory ? `rgba(201, 168, 76, ${alpha})` : `rgba(140, 30, 30, ${alpha * 0.6})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      animRef.current = requestAnimationFrame(animate);
    }
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isVictory]);

  const quote = DEATH_QUOTES[state.player.turnCount % DEATH_QUOTES.length];

  // 死因推測: ログを逆順に走査して最後のcritical/damageログを取得
  const deathCause = (() => {
    if (isVictory) return null;
    for (let i = state.logs.length - 1; i >= 0; i--) {
      const log = state.logs[i];
      if (log.type === 'critical' || log.type === 'damage') {
        return log.message;
      }
    }
    return '不明な原因';
  })();

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: '#050508' }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5,5,8,0.7) 100%)' }} />

      <div className={`relative z-10 flex flex-col items-center justify-center h-full transition-opacity duration-[2500ms] ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        {!isVictory ? (
          <>
            <div className="w-32 gold-line mb-6 opacity-30" />
            <h1
              className="mb-3 tracking-[0.4em] text-glow-red"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 900,
                color: '#8b2020',
              }}
            >
              力尽きた
            </h1>
            <div style={{ color: '#4a3530', fontSize: '12px', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontWeight: 300 }}>
              {quote}
            </div>
            <div className="w-32 gold-line mt-6 opacity-30" />
          </>
        ) : (
          <div className="max-w-md px-8 mb-6">
            {VICTORY_LINES.slice(0, victoryLine + 1).map((line, i) => (
              <div key={i} style={{
                fontSize: '13px', lineHeight: '1.8', marginBottom: '2px',
                fontFamily: line.includes('黄金') || line.includes('ありがとう') ? 'var(--font-display)' : 'var(--font-body)',
                fontWeight: line.includes('黄金') ? 700 : 300,
                color: line === '' ? 'transparent' :
                  line.includes('黄金') ? '#c9a84c' :
                  line.includes('ありがとう') ? '#b0a070' :
                  '#6b6255',
                height: line === '' ? '14px' : 'auto',
                textShadow: line.includes('黄金') ? '0 0 15px rgba(201,168,76,0.25)' : 'none',
                letterSpacing: '0.02em',
              }}>
                {i === victoryLine && line !== '' ? line.substring(0, victoryChar) : line}
                {i === victoryLine && victoryChar < line.length && line !== '' && (
                  <span className="cursor-blink" style={{ color: '#c9a84c' }}>|</span>
                )}
              </div>
            ))}
          </div>
        )}

        {showStats && (
          <div
            className="panel-ornate p-5 mt-4 animate-fade-in-up"
            style={{ width: '280px' }}
          >
            <div className="text-center mb-3 pb-2" style={{
              fontFamily: 'var(--font-display)',
              color: isVictory ? '#c9a84c' : '#4a4035',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.15em',
              borderBottom: '1px solid #1a1520',
            }}>
              {isVictory ? '踏破の記録' : '冒険の記録'}
            </div>

            {/* #25 Death statistics — floor reached, monsters killed estimate, items collected */}
            {[
              { label: '到達階層', value: `${state.floorNumber}F`, color: '#c9a84c' },
              { label: 'レベル', value: `Lv.${state.player.level}`, color: '#7a9aaa' },
              { label: 'ターン数', value: `${state.player.turnCount}`, color: '#6b6255' },
              { label: '所持金', value: `${state.player.gold}G`, color: '#c9a84c' },
              { label: '討伐数(推定)', value: `${state.logs.filter(l => l.message.includes('倒した') || l.message.includes('やっつけた')).length}体`, color: '#aa5a4a' },
              { label: '収集アイテム', value: `${state.player.inventory.length}個`, color: '#80a040' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-1" style={{ fontSize: '12px' }}>
                <span style={{ color: '#3a3530', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>{row.label}</span>
                <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}

            {/* 死因表示 (GameOverのみ) */}
            {!isVictory && deathCause && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid #1a1520' }}>
                <div style={{
                  color: '#3a3530',
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                }}>
                  死因
                </div>
                <div style={{
                  color: '#8b2020',
                  fontSize: '11px',
                  fontWeight: 500,
                  lineHeight: '1.5',
                  fontFamily: 'var(--font-body)',
                }}>
                  {deathCause}
                </div>
              </div>
            )}
          </div>
        )}

        {showPrompt && (
          <div className="mt-10 animate-fade-in-up flex flex-col items-center">
            <div className="w-20 gold-line mx-auto mb-3" />
            {/* #28 Retry button that goes to title */}
            <button
              onClick={() => {
                // Trigger Enter key event to go back to title
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
              }}
              style={{
                fontFamily: 'var(--font-display)',
                color: isVictory ? '#c9a84c' : '#6b5a40',
                fontSize: '13px',
                letterSpacing: '0.15em',
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: '4px',
                padding: '8px 24px',
                cursor: 'pointer',
                marginBottom: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(201,168,76,0.12)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'rgba(201,168,76,0.06)'; }}
            >
              タイトルに戻る
            </button>
            <div style={{
              fontFamily: 'var(--font-display)',
              color: '#2a2520',
              fontSize: '10px',
              letterSpacing: '0.1em',
              animation: 'torchFlicker 2.5s ease-in-out infinite',
            }}>
              Enter / タップ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
