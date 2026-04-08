'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CombatLog } from '@/types/game';

interface Props {
  logs: CombatLog[];
  showHistory?: boolean;
}

const TYPE_COLORS: Record<CombatLog['type'], string> = {
  info: '#9a9585',
  damage: '#dd5555',
  heal: '#5aaa6a',
  item: '#d0c070',
  system: '#e0c060',
  critical: '#ff4444',
};

// #7: Log type icons
const TYPE_ICONS: Record<CombatLog['type'], string> = {
  info: '',
  damage: '\u2694',    // crossed swords
  heal: '\u271A',      // heavy cross
  item: '\u25C6',      // diamond
  system: '\u25C7',    // diamond outline
  critical: '\uD83D\uDC80', // skull
};

const CHAR_INTERVAL = 18;

// #10: Highlight numbers in log messages with color
function ColoredLogText({ text, type }: { text: string; type: CombatLog['type'] }) {
  if (type !== 'damage' && type !== 'heal' && type !== 'critical') {
    return <>{text}</>;
  }
  const parts = text.split(/(\d+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\d+$/.test(part)) {
          const numColor = type === 'heal' ? '#5aee7a' : '#ff6666';
          return <span key={i} style={{ color: numColor, fontWeight: 700 }}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TypewriterText({ text, prefix, type }: { text: string; prefix?: React.ReactNode; type: CombatLog['type'] }) {
  const [charCount, setCharCount] = useState(0);
  useEffect(() => {
    setCharCount(0);
    if (text.length === 0) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setCharCount(i);
      if (i >= text.length) clearInterval(timer);
    }, CHAR_INTERVAL);
    return () => clearInterval(timer);
  }, [text]);
  const displayText = text.slice(0, charCount);
  return (
    <>
      {prefix}
      <ColoredLogText text={displayText} type={type} />
      <span style={{ opacity: charCount < text.length ? 1 : 0, transition: 'opacity 0.2s' }}>_</span>
    </>
  );
}

// #9: Compress repeated logs
interface CompressedLog {
  log: CombatLog;
  count: number;
  globalIdx: number;
}

function compressLogs(logs: CombatLog[], maxShow: number): CompressedLog[] {
  const recent = logs.slice(-20); // look at recent window
  const compressed: CompressedLog[] = [];

  for (let i = 0; i < recent.length; i++) {
    const globalIdx = logs.length - recent.length + i;
    if (compressed.length > 0 && compressed[compressed.length - 1].log.message === recent[i].message) {
      compressed[compressed.length - 1].count++;
    } else {
      compressed.push({ log: recent[i], count: 1, globalIdx });
    }
  }

  return compressed.slice(-maxShow);
}

// #21 Color-coded monster names in log messages
const MONSTER_NAME_COLORS: Record<string, string> = {
  'スライム': '#6aaa6a', 'おおなめくじ': '#6aaa6a', 'ゴースト': '#8080cc',
  'コウモリ': '#9a7a5a', 'がいこつ': '#c0c0c0', 'ドロボウ': '#8a6a4a',
  'キノコ': '#aa6a8a', 'ドラゴン': '#cc4444', 'ゾンビ': '#5a8a5a',
};

function ColorMonsterNames({ text, baseColor }: { text: string; baseColor: string }) {
  let result = text;
  const parts: { text: string; color: string }[] = [];
  let remaining = text;
  let found = true;
  while (found) {
    found = false;
    let earliestIdx = remaining.length;
    let matchName = '';
    let matchColor = '';
    for (const [name, color] of Object.entries(MONSTER_NAME_COLORS)) {
      const idx = remaining.indexOf(name);
      if (idx >= 0 && idx < earliestIdx) {
        earliestIdx = idx;
        matchName = name;
        matchColor = color;
        found = true;
      }
    }
    if (found) {
      if (earliestIdx > 0) parts.push({ text: remaining.slice(0, earliestIdx), color: baseColor });
      parts.push({ text: matchName, color: matchColor });
      remaining = remaining.slice(earliestIdx + matchName.length);
    }
  }
  if (remaining) parts.push({ text: remaining, color: baseColor });
  if (parts.length === 0) return <>{text}</>;
  return <>{parts.map((p, i) => <span key={i} style={{ color: p.color }}>{p.text}</span>)}</>;
}

export default function CombatLogPanel({ logs, showHistory }: Props) {
  const [animatedCount, setAnimatedCount] = useState(logs.length);
  const prevLenRef = useRef(logs.length);
  // #20 Clickable log entries — expanded entry index
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  // #18 Auto-scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  const isNewMessage = logs.length > prevLenRef.current;

  useEffect(() => {
    if (logs.length > animatedCount) {
      setAnimatedCount(logs.length);
    }
    prevLenRef.current = logs.length;
  }, [logs.length, animatedCount]);

  // #18 Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [logs.length, showHistory]);

  const handleLogClick = useCallback((idx: number) => {
    setExpandedIdx(prev => prev === idx ? null : idx);
  }, []);

  // #8: Increase visible log count from 4 to 5
  const recentCompressed = compressLogs(logs, 5);

  return (
    <div style={{ position: 'relative' }}>
      {/* #6: Log history overlay with #18 auto-scroll */}
      {showHistory && (
        <div
          ref={historyScrollRef}
          className="combat-log-history"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.92)',
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '8px 12px',
            fontFamily: 'var(--font-game), monospace',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            zIndex: 50,
          }}
        >
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>-- ログ履歴 --</div>
          {logs.slice(-20).map((log, i) => {
            const icon = TYPE_ICONS[log.type];
            return (
              <div key={i} style={{
                color: TYPE_COLORS[log.type],
                fontSize: '12px',
                lineHeight: '1.6',
                opacity: 0.8,
              }}>
                {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
                <ColorMonsterNames text={log.message} baseColor={TYPE_COLORS[log.type]} />
                <span style={{ color: '#333', fontSize: '9px', marginLeft: '8px' }}>T{log.turn}</span>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={scrollRef}
        className="combat-log-main"
        style={{
          background: 'rgba(0,0,0,0.65)',
          height: '96px',
          fontFamily: 'var(--font-game), monospace',
          padding: '6px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {recentCompressed.map((entry, i) => {
          const { log, count, globalIdx } = entry;
          const isNew = globalIdx >= animatedCount - 3 && globalIdx >= logs.length - 3;
          const isMostRecent = i === recentCompressed.length - 1;
          const isSecond = i === recentCompressed.length - 2;
          const icon = TYPE_ICONS[log.type];
          const prefix = icon ? <span style={{ color: TYPE_COLORS[log.type], marginRight: '4px', opacity: 0.7 }}>{icon}</span> : undefined;
          const displayMsg = count >= 3 ? `${log.message} x${count}` : log.message;
          const isExpanded = expandedIdx === globalIdx;
          return (
            <div
              key={`${globalIdx}-${log.message}`}
              // #20 Clickable log entries
              onClick={() => handleLogClick(globalIdx)}
              style={{
                color: TYPE_COLORS[log.type],
                fontSize: '13px',
                lineHeight: '1.5',
                opacity: isMostRecent ? 1 : isSecond ? 0.75 : 0.45,
                fontWeight: log.type === 'critical' || log.type === 'system' ? 700 : 400,
                textShadow: log.type === 'critical' ? '0 0 10px rgba(255,60,60,0.4)' : '0 1px 2px rgba(0,0,0,0.8)',
                letterSpacing: '0.02em',
                // #19 Fade-in animation for new messages
                animation: isNew ? 'logSlideIn 0.25s ease-out' : 'none',
                cursor: 'pointer',
              }}
            >
              {isMostRecent && isNewMessage ? (
                <TypewriterText text={displayMsg} prefix={prefix} type={log.type} />
              ) : (
                <>{prefix}<ColorMonsterNames text={displayMsg} baseColor={TYPE_COLORS[log.type]} /></>
              )}
              {/* #20 Expanded detail on click */}
              {isExpanded && (
                <div style={{
                  fontSize: '10px',
                  color: '#666',
                  marginTop: '2px',
                  paddingLeft: '16px',
                  animation: 'logExpand 0.2s ease-out forwards',
                  overflow: 'hidden',
                }}>
                  Turn {log.turn} | {log.type}{count > 1 ? ` (x${count})` : ''}
                </div>
              )}
            </div>
          );
        })}
        <style jsx>{`
          @keyframes logSlideIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
