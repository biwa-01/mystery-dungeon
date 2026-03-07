'use client';

import React from 'react';
import { GameState, MenuMode } from '@/types/game';
import { posEqual } from '@/engine/utils';

interface Props {
  state: GameState;
}

export default function FloorMenu({ state }: Props) {
  if (state.menuMode !== MenuMode.FloorMenu) return null;

  const onStairs = posEqual(state.player.pos, state.floor.stairsPos);
  const floorItem = state.floor.items.find(i => i.floorPos && posEqual(i.floorPos, state.player.pos));

  const options = [
    { label: floorItem ? `拾う: ${floorItem.name}` : '足元に何もない', enabled: !!floorItem },
    { label: onStairs ? '階段を降りる' : '階段はない', enabled: onStairs },
    { label: '閉じる', enabled: true },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: 'rgba(3,3,6,0.85)', backdropFilter: 'blur(2px)' }}>
      <div className="panel-ornate p-4" style={{ width: '260px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', color: '#c9a84c',
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em',
          marginBottom: '8px', paddingBottom: '6px',
          borderBottom: '1px solid #1a1520',
        }}>
          足元
        </div>
        <div className="space-y-[2px]">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded transition-all ${i === state.selectedMenuItem ? 'selection-glow' : ''}`}
              style={{
                fontSize: '11px',
                color: i === state.selectedMenuItem ? '#c9a84c' : opt.enabled ? '#6b6255' : '#2a2520',
                fontWeight: i === state.selectedMenuItem ? 500 : 300,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
