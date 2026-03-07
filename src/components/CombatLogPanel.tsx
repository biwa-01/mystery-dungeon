'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CombatLog } from '@/types/game';

interface Props {
  logs: CombatLog[];
}

const TYPE_COLORS: Record<CombatLog['type'], string> = {
  info: '#6b6255',
  damage: '#aa4040',
  heal: '#4a8a5a',
  item: '#b0a060',
  system: '#c9a84c',
  critical: '#cc3333',
};

export default function CombatLogPanel({ logs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [animatedCount, setAnimatedCount] = useState(logs.length);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Trigger slide-in for new logs
    if (logs.length > animatedCount) {
      setAnimatedCount(logs.length);
    }
  }, [logs.length, animatedCount]);

  const recentLogs = logs.slice(-40);

  return (
    <div
      className="panel-ornate overflow-hidden flex flex-col"
      style={{ height: '120px', fontFamily: 'var(--font-game)' }}
    >
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 px-3 py-2 space-y-[1px]"
      >
        {recentLogs.map((log, i) => {
          const globalIdx = logs.length - recentLogs.length + i;
          const isNew = globalIdx >= animatedCount - 3 && globalIdx >= logs.length - 3;
          const isRecent = i >= recentLogs.length - 3;
          const isMostRecent = i === recentLogs.length - 1;
          return (
            <div
              key={`${globalIdx}-${log.message}`}
              style={{
                color: TYPE_COLORS[log.type],
                fontSize: '11px',
                lineHeight: '1.6',
                opacity: isMostRecent ? 1 : isRecent ? 0.8 : 0.4,
                fontWeight: log.type === 'critical' || log.type === 'system' ? 700 : 300,
                textShadow: log.type === 'critical' ? '0 0 8px rgba(204,51,51,0.3)' : 'none',
                letterSpacing: '0.01em',
                animation: isNew ? 'logSlideIn 0.25s ease-out' : 'none',
                transform: 'translateY(0)',
              }}
            >
              {log.type === 'system' && <span style={{ color: '#4a3d28', marginRight: '4px' }}>&#9670;</span>}
              {log.message}
            </div>
          );
        })}
      </div>
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
  );
}
