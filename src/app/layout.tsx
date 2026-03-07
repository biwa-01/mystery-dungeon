import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "不思議のダンジョン ― 黄金の腕輪",
  description: "Mystery Dungeon - Roguelike Adventure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="overflow-hidden" style={{ background: '#050508' }}>
        {children}
        <div className="crt-overlay" />
      </body>
    </html>
  );
}
