'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { GameAction, Direction, GamePhase, MenuMode } from '@/types/game';

interface Props {
  dispatch: React.Dispatch<GameAction>;
  phase: GamePhase;
  menuMode: MenuMode;
}

// 8-directional swipe detection
function getSwipeDirection(dx: number, dy: number): Direction | null {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const minSwipe = 20;
  if (absDx < minSwipe && absDy < minSwipe) return null;
  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (deg >= -22.5 && deg < 22.5) return Direction.Right;
  if (deg >= 22.5 && deg < 67.5) return Direction.DownRight;
  if (deg >= 67.5 && deg < 112.5) return Direction.Down;
  if (deg >= 112.5 && deg < 157.5) return Direction.DownLeft;
  if (deg >= 157.5 || deg < -157.5) return Direction.Left;
  if (deg >= -157.5 && deg < -112.5) return Direction.UpLeft;
  if (deg >= -112.5 && deg < -67.5) return Direction.Up;
  if (deg >= -67.5 && deg < -22.5) return Direction.UpRight;
  return null;
}

export default function TouchControls({ dispatch, phase, menuMode }: Props) {
  const [visible, setVisible] = useState(false);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastDirRef = useRef<Direction>(Direction.Down);

  useEffect(() => {
    const check = () => setVisible('ontouchstart' in window || navigator.maxTouchPoints > 0);
    check();
    window.addEventListener('touchstart', () => setVisible(true), { once: true });
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
  }, []);

  const handleDir = useCallback((dir: Direction) => {
    stopRepeat();
    lastDirRef.current = dir;
    if (phase === GamePhase.Dungeon && menuMode === MenuMode.None) {
      dispatch({ type: 'MOVE', direction: dir });
      repeatRef.current = setInterval(() => dispatch({ type: 'MOVE', direction: dir }), 150);
    } else if (phase === GamePhase.Village) {
      dispatch({ type: 'VILLAGE_MOVE', direction: dir });
      repeatRef.current = setInterval(() => dispatch({ type: 'VILLAGE_MOVE', direction: dir }), 150);
    }
  }, [dispatch, phase, menuMode, stopRepeat]);

  // Swipe gestures on game canvas
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (menuMode !== MenuMode.None) return;
      if (phase !== GamePhase.Dungeon && phase !== GamePhase.Village) return;
      const touch = e.touches[0];
      if (!touch) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      if (Math.abs(touch.clientX - centerX) < window.innerWidth * 0.3 && Math.abs(touch.clientY - centerY) < window.innerHeight * 0.25) {
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!swipeStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      if (Date.now() - swipeStartRef.current.time > 500) { swipeStartRef.current = null; return; }
      const dir = getSwipeDirection(touch.clientX - swipeStartRef.current.x, touch.clientY - swipeStartRef.current.y);
      if (dir !== null) {
        if (phase === GamePhase.Dungeon) dispatch({ type: 'MOVE', direction: dir });
        else if (phase === GamePhase.Village) dispatch({ type: 'VILLAGE_MOVE', direction: dir });
      }
      swipeStartRef.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [phase, menuMode, dispatch]);

  useEffect(() => {
    window.addEventListener('touchend', stopRepeat);
    window.addEventListener('touchcancel', stopRepeat);
    return () => {
      window.removeEventListener('touchend', stopRepeat);
      window.removeEventListener('touchcancel', stopRepeat);
      stopRepeat();
    };
  }, [stopRepeat]);

  if (!visible) return null;

  const isDungeon = phase === GamePhase.Dungeon && menuMode === MenuMode.None;
  const isVillage = phase === GamePhase.Village;
  const isMenu = menuMode === MenuMode.Inventory || menuMode === MenuMode.ItemAction || menuMode === MenuMode.FloorMenu;
  const showDpad = isDungeon || isVillage;

  const btnStyle = (size: number = 48): React.CSSProperties => ({
    width: size, height: size,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.1)',
    border: '1.5px solid rgba(201,168,76,0.25)',
    color: '#c9a84c',
    fontSize: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  });

  const actionBtn = (label: string, primary = false): React.CSSProperties => ({
    minWidth: 56, minHeight: 56,
    borderRadius: 12,
    background: primary ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.06)',
    border: `1.5px solid rgba(201,168,76,${primary ? '0.35' : '0.18'})`,
    color: primary ? '#c9a84c' : '#8a7a60',
    fontSize: '11px',
    fontFamily: 'var(--font-game)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    padding: '4px 8px',
  });

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" style={{ touchAction: 'none' }}>

      {/* ===== D-Pad (bottom-left) ===== */}
      {showDpad && (
        <div className="absolute pointer-events-auto" style={{ bottom: 20, left: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 50px)', gridTemplateRows: 'repeat(3, 50px)', gap: '2px' }}>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.UpLeft); }}>↖</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Up); }}>▲</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.UpRight); }}>↗</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Left); }}>◀</button>
            <button style={{...btnStyle(), background: 'rgba(201,168,76,0.03)', fontSize: '8px'}}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'WAIT' }); }}>
              待機
            </button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Right); }}>▶</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.DownLeft); }}>↙</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Down); }}>▼</button>
            <button style={btnStyle()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.DownRight); }}>↘</button>
          </div>
        </div>
      )}

      {/* ===== Dungeon action buttons (bottom-right) ===== */}
      {isDungeon && (
        <div className="absolute pointer-events-auto" style={{ bottom: 20, right: 10 }}>
          <div className="flex flex-col items-end gap-2">
            {/* Row 1 */}
            <div className="flex gap-2">
              <button style={actionBtn('攻撃', true)}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'ATTACK', direction: lastDirRef.current }); }}>
                攻撃
              </button>
            </div>
            {/* Row 2 */}
            <div className="flex gap-2">
              <button style={actionBtn('拾う')}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'PICK_UP' }); }}>
                拾う
              </button>
              <button style={actionBtn('階段')}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'GO_STAIRS' }); }}>
                階段
              </button>
            </div>
            {/* Row 3 */}
            <div className="flex gap-2">
              <button style={actionBtn('持物')}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_INVENTORY' }); }}>
                持物
              </button>
              <button style={actionBtn('足元')}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_FLOOR_MENU' }); }}>
                足元
              </button>
            </div>
            {/* Row 4: Map & Log */}
            <div className="flex gap-2">
              <button style={{...actionBtn('MAP'), fontSize: '9px'}}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'TOGGLE_MINIMAP' }); }}>
                地図
              </button>
              <button style={{...actionBtn('LOG'), fontSize: '9px'}}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'TOGGLE_LOG_HISTORY' }); }}>
                記録
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Village action buttons (bottom-right) ===== */}
      {isVillage && (
        <div className="absolute pointer-events-auto" style={{ bottom: 20, right: 10 }}>
          <div className="flex flex-col items-end gap-2">
            <button style={actionBtn('調べる', true)}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'VILLAGE_MOVE', direction: lastDirRef.current }); }}>
              調べる
            </button>
            <button style={actionBtn('持物')}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_INVENTORY' }); }}>
              持物
            </button>
          </div>
        </div>
      )}

      {/* ===== Menu navigation (center-bottom) ===== */}
      {isMenu && (
        <div className="absolute pointer-events-auto flex flex-col items-center gap-3"
          style={{ bottom: 30, left: '50%', transform: 'translateX(-50%)' }}>
          <button style={{...btnStyle(56), fontSize: '20px'}}
            onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_UP' }); }}>▲</button>
          <div className="flex gap-4">
            <button style={{...actionBtn('戻る'), minWidth: 64}}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'CLOSE_MENU' }); }}>戻る</button>
            <button style={{...actionBtn('決定', true), minWidth: 64}}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_CONFIRM' }); }}>決定</button>
          </div>
          <button style={{...btnStyle(56), fontSize: '20px'}}
            onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_DOWN' }); }}>▼</button>
        </div>
      )}
    </div>
  );
}
