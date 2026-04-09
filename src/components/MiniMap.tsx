'use client';

import React, { useRef, useEffect, useState } from 'react';
import { GameState, TileType, ItemCategory } from '@/types/game';

interface Props {
  state: GameState;
}

const PIXEL = 3;

export default function MiniMap({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { floor, player } = state;
  const [pulsePhase, setPulsePhase] = useState(0);

  // #20: Stairs pulsing animation
  useEffect(() => {
    const timer = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = floor.width * PIXEL;
    const h = floor.height * PIXEL;
    canvas.width = w;
    canvas.height = h;

    // Dark background
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (!floor.explored[y]?.[x]) continue;

        const tile = floor.tiles[y]?.[x];
        const visible = floor.visible[y]?.[x];
        const px = x * PIXEL;
        const py = y * PIXEL;

        // #18: Explored area tracking - dimmer for visited but not visible
        if (tile === TileType.Wall) {
          ctx.fillStyle = visible ? '#2a2840' : '#14121e';
        } else if (tile === TileType.Floor || tile === TileType.Trap) {
          ctx.fillStyle = visible ? '#4a4560' : '#2a2838';
        } else if (tile === TileType.Corridor) {
          ctx.fillStyle = visible ? '#3a3550' : '#201e30';
        } else if (tile === TileType.StairsDown) {
          ctx.fillStyle = '#c9a84c';
        } else {
          continue;
        }
        ctx.fillRect(px, py, PIXEL, PIXEL);
      }
    }

    // #17: Player FOV circle visualization on minimap
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#40e0b0';
    const fovRadius = 7 * PIXEL;
    ctx.beginPath();
    ctx.arc(player.pos.x * PIXEL + PIXEL / 2, player.pos.y * PIXEL + PIXEL / 2, fovRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Monster House room highlight
    const mhRoom = floor.monsterHouseRoom;
    if (mhRoom) {
      const mhExplored = floor.explored[mhRoom.y]?.[mhRoom.x];
      if (mhExplored) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ff4040';
        ctx.fillRect(mhRoom.x * PIXEL, mhRoom.y * PIXEL, mhRoom.width * PIXEL, mhRoom.height * PIXEL);
        ctx.restore();
      }
    }

    // Items - #19: Gold dots for gold items
    for (const item of floor.items) {
      if (!item.floorPos) continue;
      if (!floor.explored[item.floorPos.y]?.[item.floorPos.x]) continue;
      if (item.category === ItemCategory.Gold) {
        ctx.fillStyle = floor.visible[item.floorPos.y]?.[item.floorPos.x] ? '#FFD060' : '#806830';
      } else {
        ctx.fillStyle = floor.visible[item.floorPos.y]?.[item.floorPos.x] ? '#80a040' : '#405020';
      }
      ctx.fillRect(item.floorPos.x * PIXEL, item.floorPos.y * PIXEL, PIXEL, PIXEL);
    }

    // #22 Monster dots on minimap — red for awake, gray for sleeping
    for (const m of floor.monsters) {
      if (!floor.visible[m.pos.y]?.[m.pos.x]) continue;
      if (m.sleeping) {
        ctx.fillStyle = '#606060';
      } else if (m.awakened) {
        ctx.fillStyle = '#e04040';
      } else {
        ctx.fillStyle = '#a06060';
      }
      ctx.fillRect(m.pos.x * PIXEL, m.pos.y * PIXEL, PIXEL, PIXEL);
    }

    // #23 Trap markers on minimap (only if revealed)
    for (const trap of floor.traps) {
      if (!trap.visible) continue;
      if (!floor.explored[trap.pos.y]?.[trap.pos.x]) continue;
      ctx.fillStyle = floor.visible[trap.pos.y]?.[trap.pos.x] ? '#FF8844' : '#804422';
      ctx.fillRect(trap.pos.x * PIXEL, trap.pos.y * PIXEL, PIXEL, PIXEL);
    }

    // #20: Stairs with pulsing animation
    if (floor.explored[floor.stairsPos.y]?.[floor.stairsPos.x]) {
      const pulse = 0.6 + Math.sin(pulsePhase * 0.105) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#FFD060';
      ctx.fillRect(floor.stairsPos.x * PIXEL - 1, floor.stairsPos.y * PIXEL - 1, PIXEL + 2, PIXEL + 2);
      ctx.restore();
    }

    // #24 Room numbers on minimap
    ctx.save();
    ctx.font = `bold ${Math.max(6, PIXEL * 3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let ri = 0; ri < floor.rooms.length; ri++) {
      const room = floor.rooms[ri];
      const rcx = (room.x + room.width / 2) * PIXEL;
      const rcy = (room.y + room.height / 2) * PIXEL;
      // Only show number if room is at least partially explored
      const explored = floor.explored[Math.floor(room.y + room.height / 2)]?.[Math.floor(room.x + room.width / 2)];
      if (explored) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#a0a0b0';
        ctx.fillText(`${ri + 1}`, rcx, rcy);
      }
    }
    ctx.restore();

    // Player
    ctx.save();
    ctx.shadowColor = '#40e0b0';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#40e0b0';
    ctx.fillRect(player.pos.x * PIXEL - 1, player.pos.y * PIXEL - 1, PIXEL + 2, PIXEL + 2);
    ctx.restore();

  }, [floor, player.pos, pulsePhase]);

  // #21: Increased minimap size from 130x130 to 140x140
  return (
    <div style={{
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '3px',
      maxWidth: '200px',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: floor.width * PIXEL,
          height: floor.height * PIXEL,
          imageRendering: 'pixelated',
          borderRadius: '2px',
          display: 'block',
        }}
      />
    </div>
  );
}
