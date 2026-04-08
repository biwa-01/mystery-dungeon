'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { GameAction, Direction, GamePhase, MenuMode } from '@/types/game';

interface Props {
  dispatch: React.Dispatch<GameAction>;
  phase: GamePhase;
  menuMode: MenuMode;
}

export default function TouchControls({ dispatch, phase, menuMode }: Props) {
  const [visible, setVisible] = useState(false);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const dpadBtn = (size: number = 44): React.CSSProperties => ({
    width: size, height: size,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.08)',
    border: '1.5px solid rgba(201,168,76,0.2)',
    color: '#c9a84c',
    fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  });

  const actionBtn = (primary = false): React.CSSProperties => ({
    minWidth: 52, minHeight: 44,
    borderRadius: 10,
    background: primary ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.04)',
    border: `1.5px solid rgba(201,168,76,${primary ? '0.3' : '0.15'})`,
    color: primary ? '#c9a84c' : '#8a7a60',
    fontSize: '11px',
    fontFamily: 'var(--font-game)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    padding: '4px 8px',
  });

  // Menu navigation mode
  if (isMenu) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '12px 0', touchAction: 'none',
      }}>
        <button style={dpadBtn(50)} onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_UP' }); }}>▲</button>
        <button style={actionBtn()} onTouchStart={e => { e.preventDefault(); dispatch({ type: 'CLOSE_MENU' }); }}>戻る</button>
        <button style={actionBtn(true)} onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_CONFIRM' }); }}>決定</button>
        <button style={dpadBtn(50)} onTouchStart={e => { e.preventDefault(); dispatch({ type: 'MENU_DOWN' }); }}>▼</button>
      </div>
    );
  }

  if (!showDpad) return null;

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '8px 10px 0', touchAction: 'none', maxHeight: 200,
    }}>
      {/* D-Pad (left side) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 46px)', gridTemplateRows: 'repeat(3, 46px)', gap: '1px' }}>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.UpLeft); }}>↖</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Up); }}>▲</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.UpRight); }}>↗</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Left); }}>◀</button>
        <button style={{...dpadBtn(), background: 'rgba(201,168,76,0.03)', fontSize: '8px'}}
          onTouchStart={e => { e.preventDefault(); dispatch({ type: 'WAIT' }); }}>
          待機
        </button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Right); }}>▶</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.DownLeft); }}>↙</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.Down); }}>▼</button>
        <button style={dpadBtn()} onTouchStart={e => { e.preventDefault(); handleDir(Direction.DownRight); }}>↘</button>
      </div>

      {/* Action buttons (right side) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {isDungeon ? (
          <>
            <button style={actionBtn(true)}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'ATTACK', direction: lastDirRef.current }); }}>
              攻撃
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={actionBtn()}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'PICK_UP' }); }}>
                拾う
              </button>
              <button style={actionBtn()}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'GO_STAIRS' }); }}>
                階段
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={actionBtn()}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_INVENTORY' }); }}>
                持物
              </button>
              <button style={actionBtn()}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_FLOOR_MENU' }); }}>
                足元
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{...actionBtn(), fontSize: '9px'}}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'TOGGLE_MINIMAP' }); }}>
                地図
              </button>
              <button style={{...actionBtn(), fontSize: '9px'}}
                onTouchStart={e => { e.preventDefault(); dispatch({ type: 'TOGGLE_LOG_HISTORY' }); }}>
                記録
              </button>
            </div>
          </>
        ) : isVillage ? (
          <>
            <button style={actionBtn(true)}
              onTouchStart={e => {
                e.preventDefault();
                // Trigger village interact (Enter key)
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
              }}>
              調べる
            </button>
            <button style={actionBtn()}
              onTouchStart={e => { e.preventDefault(); dispatch({ type: 'OPEN_INVENTORY' }); }}>
              持物
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
