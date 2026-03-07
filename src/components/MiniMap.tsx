'use client';

import React, { useRef, useEffect } from 'react';
import { GameState, TileType } from '@/types/game';

interface Props {
  state: GameState;
}

const PIXEL = 3;

export default function MiniMap({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { floor, player } = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = floor.width * PIXEL;
    const h = floor.height * PIXEL;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#08080e';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (!floor.explored[y]?.[x]) continue;

        const tile = floor.tiles[y]?.[x];
        const visible = floor.visible[y]?.[x];
        const px = x * PIXEL;
        const py = y * PIXEL;

        if (tile === TileType.Wall) {
          ctx.fillStyle = visible ? '#1a1825' : '#0e0d14';
        } else if (tile === TileType.Floor || tile === TileType.Trap) {
          ctx.fillStyle = visible ? '#2a2535' : '#151318';
        } else if (tile === TileType.Corridor) {
          ctx.fillStyle = visible ? '#222030' : '#121116';
        } else if (tile === TileType.StairsDown) {
          ctx.fillStyle = '#4a3d28';
        } else {
          continue;
        }
        ctx.fillRect(px, py, PIXEL, PIXEL);
      }
    }

    // Items (small dots)
    for (const item of floor.items) {
      if (!item.floorPos) continue;
      if (!floor.explored[item.floorPos.y]?.[item.floorPos.x]) continue;
      ctx.fillStyle = '#5a5030';
      ctx.fillRect(item.floorPos.x * PIXEL, item.floorPos.y * PIXEL, PIXEL - 1, PIXEL - 1);
    }

    // Monsters (only visible)
    for (const m of floor.monsters) {
      if (!floor.visible[m.pos.y]?.[m.pos.x]) continue;
      ctx.fillStyle = '#7a2020';
      ctx.fillRect(m.pos.x * PIXEL, m.pos.y * PIXEL, PIXEL, PIXEL);
    }

    // Stairs
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(floor.stairsPos.x * PIXEL, floor.stairsPos.y * PIXEL, PIXEL, PIXEL);

    // Player (bright dot with glow)
    ctx.save();
    ctx.shadowColor = '#60c0a0';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#60c0a0';
    ctx.fillRect(player.pos.x * PIXEL - 1, player.pos.y * PIXEL - 1, PIXEL + 2, PIXEL + 2);
    ctx.restore();

  }, [floor, player.pos]);

  return (
    <div className="panel-ornate p-2">
      <div style={{
        color: '#2a2520',
        fontSize: '9px',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.1em',
        marginBottom: '4px',
        textAlign: 'center',
      }}>
        MAP
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: floor.width * PIXEL,
          height: floor.height * PIXEL,
          imageRendering: 'pixelated',
          borderRadius: '2px',
          border: '1px solid #12101a',
        }}
      />
    </div>
  );
}
