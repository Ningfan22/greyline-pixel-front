import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '灰线 GREYLINE · 像素战术卡牌',
  description:
    '在可破坏的像素战场上部署班组、坦克与直升机，用战术卡牌推进战线。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
