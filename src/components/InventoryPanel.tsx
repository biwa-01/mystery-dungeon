'use client';

import React from 'react';
import {
  GameState, MenuMode, ItemCategory,
  WeaponItem, ShieldItem, StaffItem, PotItem, ArrowItem,
} from '@/types/game';
import { getItemActions } from '@/hooks/useGame';

interface Props {
  state: GameState;
}

const CATEGORY_ORDER: ItemCategory[] = [
  ItemCategory.Weapon, ItemCategory.Shield, ItemCategory.Ring,
  ItemCategory.Arrow, ItemCategory.Staff, ItemCategory.Scroll,
  ItemCategory.Herb, ItemCategory.Pot, ItemCategory.Food,
];

const CATEGORY_ICON: Record<ItemCategory, { ch: string; color: string }> = {
  [ItemCategory.Weapon]: { ch: '/', color: '#6a8aaa' },
  [ItemCategory.Shield]: { ch: ']', color: '#5a8a6a' },
  [ItemCategory.Arrow]: { ch: ')', color: '#7a7aaa' },
  [ItemCategory.Staff]: { ch: '|', color: '#8a6aaa' },
  [ItemCategory.Scroll]: { ch: '?', color: '#aa9a5a' },
  [ItemCategory.Herb]: { ch: '!', color: '#5a9a5a' },
  [ItemCategory.Pot]: { ch: '{', color: '#aa7a4a' },
  [ItemCategory.Ring]: { ch: '=', color: '#c9a84c' },
  [ItemCategory.Food]: { ch: '%', color: '#aa8a3a' },
  [ItemCategory.Gold]: { ch: '$', color: '#c9a84c' },
  [ItemCategory.Projectile]: { ch: '*', color: '#6a6a6a' },
};

function getItemDisplay(item: GameState['player']['inventory'][0]): { name: string; detail: string; equipped: boolean } {
  let name = item.name;
  let detail = '';
  let equipped = false;
  if (item.category === ItemCategory.Weapon) {
    const w = item as WeaponItem;
    const enh = w.enhancement >= 0 ? `+${w.enhancement}` : `${w.enhancement}`;
    name = `${w.name}${enh}`;
    equipped = w.equipped;
    if (w.seals.length > 0) detail = `[${w.seals.length}印]`;
  } else if (item.category === ItemCategory.Shield) {
    const s = item as ShieldItem;
    const enh = s.enhancement >= 0 ? `+${s.enhancement}` : `${s.enhancement}`;
    name = `${s.name}${enh}`;
    equipped = s.equipped;
    if (s.seals.length > 0) detail = `[${s.seals.length}印]`;
  } else if (item.category === ItemCategory.Staff) {
    detail = `[${(item as StaffItem).charges}]`;
  } else if (item.category === ItemCategory.Pot) {
    const p = item as PotItem;
    detail = `[${p.contents.length}/${p.capacity}]`;
  } else if (item.category === ItemCategory.Arrow) {
    detail = `x${(item as ArrowItem).count}`;
  }
  return { name, detail, equipped };
}

export default function InventoryPanel({ state }: Props) {
  if (state.menuMode !== MenuMode.Inventory && state.menuMode !== MenuMode.ItemAction) return null;

  const { inventory } = state.player;
  const sorted = [...inventory].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const indexMap = sorted.map(item => inventory.indexOf(item));
  const selectedItem = state.menuMode === MenuMode.ItemAction ? inventory[state.selectedItemIndex] : null;
  const actions = selectedItem ? getItemActions(selectedItem, state) : [];

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: 'rgba(3,3,6,0.88)', backdropFilter: 'blur(2px)' }}>

      <div
        className="panel-ornate flex overflow-hidden"
        style={{
          width: '500px', maxHeight: '480px',
          boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 2px rgba(139,115,64,0.08)',
        }}
      >
        {/* Item list */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1520' }}>
            <span style={{ fontFamily: 'var(--font-display)', color: '#c9a84c', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>
              持ち物
            </span>
            <span style={{ color: '#2a2520', fontSize: '10px' }}>{inventory.length} / 20</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {sorted.length === 0 ? (
              <div style={{ color: '#2a2520', fontSize: '12px', textAlign: 'center', padding: '32px 0' }}>持ち物がない</div>
            ) : (
              <div className="space-y-[2px]">
                {sorted.map((item, vi) => {
                  const ri = indexMap[vi];
                  const selected = ri === state.selectedItemIndex;
                  const { name, detail, equipped } = getItemDisplay(item);
                  const icon = CATEGORY_ICON[item.category];

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition-all ${selected ? 'selection-glow' : ''}`}
                      style={{
                        background: selected ? undefined : 'transparent',
                        border: selected ? undefined : '1px solid transparent',
                      }}
                    >
                      {/* Icon */}
                      <span style={{
                        width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '3px', fontSize: '12px', fontWeight: 700,
                        color: icon.color,
                        background: `${icon.color}10`,
                        border: `1px solid ${icon.color}20`,
                        fontFamily: 'monospace',
                      }}>
                        {icon.ch}
                      </span>

                      {/* Name */}
                      <span className="flex-1 truncate" style={{
                        fontSize: '11px',
                        color: item.cursed ? '#8a3030' : item.blessed ? '#c9a84c' : selected ? '#d4c5a0' : '#7a7060',
                        fontWeight: selected ? 500 : 300,
                      }}>
                        {equipped && <span style={{ color: '#5a8a7a', marginRight: '4px', fontSize: '9px', fontFamily: 'var(--font-display)' }}>E</span>}
                        {name}
                        {item.cursed && <span style={{ color: '#6a2020', marginLeft: '4px', fontSize: '9px' }}>呪</span>}
                        {item.blessed && <span style={{ color: '#8a7a40', marginLeft: '4px', fontSize: '9px' }}>祝</span>}
                        {!item.identified && <span style={{ color: '#3a3530', marginLeft: '4px', fontSize: '9px' }}>?</span>}
                      </span>

                      {detail && <span style={{ color: '#3a3530', fontSize: '9px', flexShrink: 0 }}>{detail}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action menu */}
        {state.menuMode === MenuMode.ItemAction && selectedItem && (
          <div className="flex flex-col" style={{ width: '130px', borderLeft: '1px solid #1a1520' }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #12101a' }}>
              <div style={{ fontSize: '10px', color: '#4a4035' }} className="truncate">{selectedItem.name}</div>
            </div>
            <div className="p-1.5 space-y-[2px]">
              {actions.map((act, i) => (
                <div
                  key={act.action}
                  className={`px-2.5 py-1.5 rounded transition-all ${i === state.selectedMenuItem ? 'selection-glow' : ''}`}
                  style={{
                    fontSize: '11px',
                    color: i === state.selectedMenuItem ? '#c9a84c' : '#4a4035',
                    fontWeight: i === state.selectedMenuItem ? 500 : 300,
                  }}
                >
                  {act.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6" style={{ color: '#2a2520', fontSize: '10px', fontFamily: 'var(--font-display)', letterSpacing: '0.15em' }}>
        ↑↓ 選択 &nbsp;&nbsp; Enter 決定 &nbsp;&nbsp; Esc 閉じる
      </div>
    </div>
  );
}
