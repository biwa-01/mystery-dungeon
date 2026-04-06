'use client';

import React, { useState } from 'react';
import {
  GameState, MenuMode, ItemCategory,
  WeaponItem, ShieldItem, StaffItem, PotItem, ArrowItem, RingItem, GameItem,
} from '@/types/game';
import { getItemActions } from '@/hooks/useGame';
import { getItemDisplayName } from '@/engine/gameReducer';
import { ITEM_TEMPLATES } from '@/engine/data/items';

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

// #11: Filter tab definitions
const FILTER_TABS: { label: string; value: ItemCategory | 'all' }[] = [
  { label: '全', value: 'all' },
  { label: '剣', value: ItemCategory.Weapon },
  { label: '盾', value: ItemCategory.Shield },
  { label: '草', value: ItemCategory.Herb },
  { label: '巻', value: ItemCategory.Scroll },
  { label: '杖', value: ItemCategory.Staff },
  { label: '食', value: ItemCategory.Food },
];

// Always-identified categories (no fake names needed)
const ALWAYS_IDENTIFIED: ItemCategory[] = [
  ItemCategory.Weapon, ItemCategory.Shield, ItemCategory.Food,
  ItemCategory.Arrow, ItemCategory.Gold, ItemCategory.Projectile,
];

function isItemIdentified(item: GameItem, state: GameState): boolean {
  if (ALWAYS_IDENTIFIED.includes(item.category)) return true;
  return item.identified || state.identifiedItems.has(item.templateId);
}

// #16: Get rarity from template
function getItemRarity(item: GameItem): number {
  const tmpl = ITEM_TEMPLATES.find(t => t.id === item.templateId);
  return tmpl?.rarity ?? 1;
}

function getRarityColor(rarity: number): string {
  if (rarity >= 9) return '#FFD700'; // legendary=gold
  if (rarity >= 6) return '#5588ff'; // rare=blue
  if (rarity >= 3) return '#55cc55'; // uncommon=green
  return '#7a7060';                   // common=white-ish
}

function getItemDisplay(item: GameItem, state: GameState): { name: string; detail: string; equipped: boolean; isUnidentified: boolean } {
  const identified = isItemIdentified(item, state);
  let name = identified ? item.name : getItemDisplayName(item, state);
  let detail = '';
  let equipped = false;

  if (item.category === ItemCategory.Weapon) {
    const w = item as WeaponItem;
    const enh = w.enhancement >= 0 ? `+${w.enhancement}` : `${w.enhancement}`;
    name = `${name}${enh}`;
    equipped = w.equipped;
    if (w.seals.length > 0) detail = `[${w.seals.length}印]`;
  } else if (item.category === ItemCategory.Shield) {
    const s = item as ShieldItem;
    const enh = s.enhancement >= 0 ? `+${s.enhancement}` : `${s.enhancement}`;
    name = `${name}${enh}`;
    equipped = s.equipped;
    if (s.seals.length > 0) detail = `[${s.seals.length}印]`;
  } else if (item.category === ItemCategory.Staff) {
    if (identified) {
      detail = `[${(item as StaffItem).charges}]`;
    }
  } else if (item.category === ItemCategory.Pot) {
    const p = item as PotItem;
    detail = `[${p.contents.length}/${p.capacity}]`;
  } else if (item.category === ItemCategory.Arrow) {
    detail = `x${(item as ArrowItem).count}`;
  }
  return { name, detail, equipped, isUnidentified: !identified };
}

/** Get color for item text based on cursed/blessed/selected state */
function getItemColor(item: GameItem, selected: boolean): string {
  if (item.cursed) return '#8a3050';   // Purple-red for cursed
  if (item.blessed) return '#d4a84c';  // Golden for blessed
  // #16: Use rarity color
  const rarity = getItemRarity(item);
  if (selected) return getRarityColor(rarity);
  return getRarityColor(rarity);
}

/** Format pot contents for tooltip display */
function getPotContentsDisplay(pot: PotItem, state: GameState): string[] {
  return pot.contents.map(item => {
    const displayName = getItemDisplayName(item, state);
    if (item.category === ItemCategory.Weapon) {
      const w = item as WeaponItem;
      const enh = w.enhancement >= 0 ? `+${w.enhancement}` : `${w.enhancement}`;
      return `${displayName}${enh}`;
    }
    if (item.category === ItemCategory.Shield) {
      const s = item as ShieldItem;
      const enh = s.enhancement >= 0 ? `+${s.enhancement}` : `${s.enhancement}`;
      return `${displayName}${enh}`;
    }
    return displayName;
  });
}

// #13: Quick-info panel for hovered items
function getItemQuickInfo(item: GameItem): string[] {
  const lines: string[] = [];
  if (item.category === ItemCategory.Weapon) {
    const w = item as WeaponItem;
    lines.push(`攻撃力: ${w.attack}`);
    lines.push(`強化: ${w.enhancement >= 0 ? '+' : ''}${w.enhancement}`);
    lines.push(`印: ${w.seals.length}/${w.maxSeals}`);
  } else if (item.category === ItemCategory.Shield) {
    const s = item as ShieldItem;
    lines.push(`防御力: ${s.defense}`);
    lines.push(`強化: ${s.enhancement >= 0 ? '+' : ''}${s.enhancement}`);
    lines.push(`印: ${s.seals.length}/${s.maxSeals}`);
  } else if (item.category === ItemCategory.Staff) {
    const st = item as StaffItem;
    lines.push(`残り回数: ${st.charges}/${st.maxCharges}`);
  } else if (item.category === ItemCategory.Pot) {
    const p = item as PotItem;
    lines.push(`容量: ${p.contents.length}/${p.capacity}`);
    lines.push(`種類: ${p.potType}`);
  } else if (item.category === ItemCategory.Arrow) {
    const a = item as ArrowItem;
    lines.push(`攻撃力: ${a.attack}`);
    lines.push(`本数: ${a.count}`);
  }
  if (item.cursed) lines.push('呪われている');
  if (item.blessed) lines.push('祝福されている');
  return lines;
}

export default function InventoryPanel({ state }: Props) {
  if (state.menuMode !== MenuMode.Inventory && state.menuMode !== MenuMode.ItemAction) return null;

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ItemCategory | 'all'>(state.inventoryFilter);

  const { inventory } = state.player;

  // #11: Apply category filter
  const filtered = activeFilter === 'all'
    ? inventory
    : inventory.filter(i => i.category === activeFilter);

  // #15: Sort by category then by name
  const sorted = [...filtered].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  const indexMap = sorted.map(item => inventory.indexOf(item));
  // selectedItemIndex is a visual index (0, 1, 2, ...) — use sorted array directly
  const selectedItem = state.menuMode === MenuMode.ItemAction ? (sorted[state.selectedItemIndex] ?? null) : null;
  const actions = selectedItem ? getItemActions(selectedItem, state) : [];
  const hoveredItem = hoveredIdx !== null ? sorted[hoveredIdx] : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: 'rgba(3,3,6,0.88)', backdropFilter: 'blur(2px)' }}>

      <div
        className="panel-ornate flex overflow-hidden menu-shutter"
        style={{
          width: '580px', maxHeight: '520px',
          boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 2px rgba(139,115,64,0.08)',
        }}
      >
        {/* Item list */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          {/* #12: Title bar with item count */}
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1520' }}>
            <span style={{ fontFamily: 'var(--font-display)', color: '#c9a84c', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>
              持ち物 ({inventory.length}/20)
            </span>
          </div>

          {/* #11: Category filter tabs */}
          <div className="flex gap-1 px-3 py-1.5" style={{ borderBottom: '1px solid #12101a' }}>
            {FILTER_TABS.map(tab => (
              <button
                key={String(tab.value)}
                onClick={() => setActiveFilter(tab.value)}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: `1px solid ${activeFilter === tab.value ? '#c9a84c40' : '#1a152040'}`,
                  background: activeFilter === tab.value ? '#c9a84c15' : 'transparent',
                  color: activeFilter === tab.value ? '#c9a84c' : '#4a4035',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-game), monospace',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {sorted.length === 0 ? (
              <div style={{ color: '#2a2520', fontSize: '12px', textAlign: 'center', padding: '32px 0' }}>持ち物がない</div>
            ) : (
              <div className="space-y-[2px]">
                {sorted.map((item, vi) => {
                  const ri = indexMap[vi];
                  const selected = vi === state.selectedItemIndex;
                  const { name, detail, equipped, isUnidentified } = getItemDisplay(item, state);
                  const icon = CATEGORY_ICON[item.category];
                  const textColor = getItemColor(item, selected);

                  return (
                    <div
                      key={`${item.id}_${vi}`}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition-all ${selected ? 'selection-glow' : ''}`}
                      style={{
                        background: selected ? undefined : 'transparent',
                        border: selected ? undefined : '1px solid transparent',
                      }}
                      onMouseEnter={() => setHoveredIdx(vi)}
                      onMouseLeave={() => setHoveredIdx(null)}
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
                        color: textColor,
                        fontWeight: selected ? 500 : 300,
                        textShadow: item.blessed ? '0 0 6px rgba(212,168,76,0.4)' : undefined,
                      }}>
                        {/* #14: "E" marker for equipped items */}
                        {equipped && <span style={{ color: '#5a8a7a', marginRight: '4px', fontSize: '9px', fontFamily: 'var(--font-display)' }}>E</span>}
                        {name}
                        {item.cursed && <span style={{ color: '#6a2040', marginLeft: '4px', fontSize: '9px' }}>呪</span>}
                        {item.blessed && <span style={{ color: '#8a7a40', marginLeft: '4px', fontSize: '9px' }}>祝</span>}
                        {isUnidentified && <span style={{ color: '#5a4a30', marginLeft: '4px', fontSize: '9px' }}>未識別</span>}
                      </span>

                      {detail && <span style={{ color: '#3a3530', fontSize: '9px', flexShrink: 0 }}>{detail}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* #13: Quick-info panel on hover */}
        {hoveredItem && state.menuMode === MenuMode.Inventory && (
          <div className="flex flex-col" style={{ width: '130px', borderLeft: '1px solid #1a1520', padding: '8px' }}>
            <div style={{ fontSize: '10px', color: '#c9a84c', marginBottom: '6px', fontFamily: 'var(--font-display)' }}>
              詳細
            </div>
            {getItemQuickInfo(hoveredItem).map((line, i) => (
              <div key={i} style={{ fontSize: '9px', color: '#6a6050', lineHeight: '1.8' }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Action menu + pot contents */}
        {state.menuMode === MenuMode.ItemAction && selectedItem && (
          <div className="flex flex-col" style={{ width: '150px', borderLeft: '1px solid #1a1520' }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #12101a' }}>
              <div style={{ fontSize: '10px', color: '#4a4035' }} className="truncate">
                {getItemDisplayName(selectedItem, state)}
              </div>
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

            {/* Show pot contents when viewing a pot */}
            {selectedItem.category === ItemCategory.Pot && (selectedItem as PotItem).contents.length > 0 && (
              <div className="px-3 py-2" style={{ borderTop: '1px solid #12101a' }}>
                <div style={{ fontSize: '9px', color: '#4a4a3a', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>中身:</div>
                {getPotContentsDisplay(selectedItem as PotItem, state).map((contentName, ci) => (
                  <div key={ci} style={{ fontSize: '9px', color: '#6a6050', paddingLeft: '4px', lineHeight: '1.6' }}>
                    {contentName}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-6" style={{ color: '#2a2520', fontSize: '10px', fontFamily: 'var(--font-display)', letterSpacing: '0.15em' }}>
        ↑↓ 選択 &nbsp;&nbsp; Enter 決定 &nbsp;&nbsp; Esc 閉じる
      </div>
    </div>
  );
}
