'use client';
/* oxlint-disable next/no-img-element -- Preserve native pixel art on the static GitHub Pages build, without an image server. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_AUDIO,
  getBattleAudio,
  type AudioSettings,
} from '@/game/audio';
import { assetUrl } from '@/game/asset-url';
import styles from './home-menu.module.css';
import MapSelector from './map-selector';
import type { MapId } from '@/game/maps';

export type LobbyPage = 'home' | 'builder' | 'settings' | 'guide';
const navigation: { page: LobbyPage; label: string }[] = [
  { page: 'home', label: '首页' },
  { page: 'builder', label: '卡组' },
  { page: 'settings', label: '设置' },
  { page: 'guide', label: '作战手册' },
];

function PixelIcon({ name }: { name: LobbyPage }) {
  const paths = {
    home: 'M2 7h2V5h2V3h4v2h2v2h2v2h-2v6H4V9H2V7Zm4 2v4h1v-3h2v3h1V9H6Z',
    builder: 'M2 1h9v2H4v9H2V1Zm3 3h9v11H5V4Zm2 2v7h5V6H7Zm1 1h3v2H8V7Z',
    settings: 'M6 1h4v2h2v2h3v6h-3v2h-2v2H6v-2H4v-2H1V5h3V3h2V1Zm0 5v4h4V6H6Z',
    guide: 'M1 2h6v1h2V2h6v12H9v1H7v-1H1V2Zm2 2v8h4V4H3Zm6 0v8h4V4H9Z',
  };
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" fillRule="evenodd" d={paths[name]} />
    </svg>
  );
}

function Settings() {
  const [audio, setAudio] = useState<AudioSettings>({ ...DEFAULT_AUDIO });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setAudio({ ...getBattleAudio().settings });
    });
    return () => {
      active = false;
    };
  }, []);
  const change = (patch: Partial<AudioSettings>) => {
    const mixer = getBattleAudio();
    mixer.configure(patch);
    setAudio({ ...mixer.settings });
  };
  return (
    <section className={styles.panel} aria-labelledby="home-settings-title">
      <h1 id="home-settings-title">设置</h1>
      <div className={styles.soundSwitch}>
        <span>游戏声音</span>
        <button
          type="button"
          role="switch"
          aria-label="游戏声音"
          aria-checked={audio.enabled}
          onClick={() => change({ enabled: !audio.enabled })}
        >
          {audio.enabled ? '开启' : '关闭'}
        </button>
      </div>
      <label className={styles.volume}>
        <span>
          音乐音量 <output>{Math.round(audio.music * 100)}%</output>
        </span>
        <input
          type="range"
          aria-label="音乐音量"
          min="0"
          max="100"
          value={Math.round(audio.music * 100)}
          onChange={(e) => change({ music: Number(e.target.value) / 100 })}
        />
      </label>
      <label className={styles.volume}>
        <span>
          音效音量 <output>{Math.round(audio.effects * 100)}%</output>
        </span>
        <input
          type="range"
          aria-label="音效音量"
          min="0"
          max="100"
          value={Math.round(audio.effects * 100)}
          onChange={(e) => change({ effects: Number(e.target.value) / 100 })}
        />
      </label>
      <p className={styles.settingNote}>自动保存，进入战场后同样生效。</p>
      <a
        className={styles.credits}
        href={assetUrl('/audio/credits.html')}
        target="_blank"
        rel="noreferrer"
      >
        音乐与音效署名 ↗
      </a>
    </section>
  );
}

function Guide() {
  return (
    <section
      className={`${styles.panel} ${styles.guide}`}
      aria-labelledby="home-guide-title"
    >
      <h1 id="home-guide-title">作战手册</h1>
      <div>
        <h2>胜利条件</h2>
        <p>摧毁敌方指挥部。十分钟后仍未分出胜负，则比较双方基地剩余生命。</p>
      </div>
      <div>
        <h2>出牌与抽牌</h2>
        <p>
          把卡牌拖出底部扇形区域后松手，即可使用；拖回则取消。长按查看详情。单位从己方基地出发，烟幕、地雷和机降落点使用松手位置。机降直升机会飞抵落点后放下步兵，途中可被防空击落。
        </p>
        <p>点击牌堆，消耗 2 点指挥点抽牌，冷却 9 秒。手牌最多 6 张。</p>
      </div>
      <div>
        <h2>查看战场</h2>
        <p>
          左右拖动画面移动视野。电脑也可使用 A/D、方向键或滚轮，数字键 1–6
          选牌、回车使用、R 抽牌、空格暂停。手机横屏游玩。
        </p>
      </div>
      <div>
        <h2>组建编队</h2>
        <p>
          在卡组中选择 20 张牌，每种卡各有数量上限。带上反坦克与防空兵种；AI
          使用自己的卡组，双方各抽各的。
        </p>
      </div>
    </section>
  );
}

export default function HomeMenu({
  page,
  ready,
  deckCount,
  mapId,
  onMapChange,
  onNavigate,
  onStart,
  children,
}: {
  page: LobbyPage;
  ready: boolean;
  deckCount: number;
  mapId: MapId;
  onMapChange: (id: MapId) => void;
  onNavigate: (page: LobbyPage) => void;
  onStart: () => void;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stage.current?.scrollTo(0, 0);
  }, [page]);
  return (
    <main className={styles.menu} aria-label="灰线主菜单">
      <style>{`@font-face{font-family:'Greyline Menu Pixel';src:url('${assetUrl('/fonts/fusion-pixel-12px-monospaced-zh_hans.otf.woff2')}') format('woff2');font-weight:400;font-style:normal;font-display:swap;}`}</style>
      <img
        className={styles.backdrop}
        src={assetUrl('/art/home-camp-v14.png')}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
      />
      <aside className={styles.sidebar}>
        <div className={styles.brand} aria-label="灰线 GREYLINE">
          <span>灰线</span>
          <small>GREYLINE</small>
        </div>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.page}
              aria-current={page === item.page ? 'page' : undefined}
              disabled={!ready}
              onClick={() => onNavigate(item.page)}
            >
              <PixelIcon name={item.page} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <MapSelector value={mapId} onChange={onMapChange} disabled={!ready} />
        <div className={styles.deckStatus}>
          <span>当前编队</span>
          <strong>
            {deckCount}
            <small> / 20</small>
          </strong>
        </div>
      </aside>
      {page === 'home' && (
        <section className={styles.launch} aria-label="开始游戏">
          <button className={styles.start} disabled={!ready} onClick={onStart}>
            <svg
              viewBox="0 0 12 16"
              aria-hidden="true"
              shapeRendering="crispEdges"
            >
              <path
                fill="currentColor"
                d="M0 0h3v2h3v2h3v2h3v4H9v2H6v2H3v2H0Z"
              />
            </svg>
            开始游戏
          </button>
        </section>
      )}
      <div className={styles.stage} ref={stage}>
        <div className={styles.builderPage} hidden={page !== 'builder'}>
          {children}
        </div>
        {page === 'settings' && (
          <div className={styles.panelPage}>
            <Settings />
          </div>
        )}
        {page === 'guide' && (
          <div className={styles.panelPage}>
            <Guide />
          </div>
        )}
      </div>
    </main>
  );
}
