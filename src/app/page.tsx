'use client';

import dynamic from 'next/dynamic';

const GameScreen = dynamic(() => import('@/components/GameScreen'), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 font-mono animate-pulse">Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <GameScreen />;
}
