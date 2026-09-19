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
import type { Difficulty } from '@/game/economy';
import type { MissionId } from '@/game/campaign';
import CampaignMenu from './campaign-menu';
import DifficultySelector, {
  DIFFICULTY_LABEL,
  DIFFICULTY_BONUS,
} from './difficulty-selector';
import Shop from './shop';
import type { CollectionState } from '@/game/collection';

export type LobbyPage =
  | 'home'
  | 'builder'
  | 'shop'
  | 'settings'
  | 'guide'
  | 'campaign';
const navigation: { page: LobbyPage; label: string }[] = [
  { page: 'home', label: '首页' },
  { page: 'campaign', label: '故事战役' },
  { page: 'builder', label: '卡组' },
  { page: 'shop', label: '商店' },
  { page: 'settings', label: '设置' },
  { page: 'guide', label: '作战手册' },
];

function PixelIcon({ name }: { name: LobbyPage }) {
  const paths = {
    campaign: 'M1 2h6v2h3V2h5v12h-5v-2H7v2H1V2Zm2 2v8h2V4H3Zm6 2v4h3V6H9Z',
    home: 'M2 7h2V5h2V3h4v2h2v2h2v2h-2v6H4V9H2V7Zm4 2v4h1v-3h2v3h1V9H6Z',
    builder: 'M2 1h9v2H4v9H2V1Zm3 3h9v11H5V4Zm2 2v7h5V6H7Zm1 1h3v2H8V7Z',
    settings: 'M6 1h4v2h2v2h3v6h-3v2h-2v2H6v-2H4v-2H1V5h3V3h2V1Zm0 5v4h4V6H6Z',
    guide: 'M1 2h6v1h2V2h6v12H9v1H7v-1H1V2Zm2 2v8h4V4H3Zm6 0v8h4V4H9Z',
    shop: 'M1 2h14v3H1V2Zm0 4h14v9H1V6Zm5 2v5h4V8H6Z',
  };
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" fillRule="evenodd" d={paths[name]} />
    </svg>
  );
}

function Settings({
  difficulty,
  onDifficultyChange,
}: {
  difficulty: Difficulty;
  onDifficultyChange: (value: Difficulty) => void;
}) {
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
      <DifficultySelector value={difficulty} onChange={onDifficultyChange} />
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
        <p>
          双方开局 2 点，每 3.6 秒恢复 1
          点。后勤可加快回点，扩编可增加上限；难度设置会注明 AI 的额外回点速度。
        </p>
      </div>
      <div>
        <h2>查看战场</h2>
        <p>
          左右拖动画面移动视野。电脑也可使用 A/D、方向键或滚轮，数字键 1–6
          选牌、回车使用、R 抽牌、空格暂停。手机横屏游玩。
        </p>
      </div>
      <div>
        <h2>机步协同</h2>
        <p>
          步兵会自动伴随附近友军坦克，保持后方距离。点击小队可选择伴随、据守、撤退、进攻或警戒；手动进攻会解除伴随。缺少有效反甲或防空保护时，步兵会持续撤离重装火力范围。
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
  night,
  onNightChange,
  onNavigate,
  onStart,
  difficulty,
  onDifficultyChange,
  completed,
  onMissionStart,
  children,
  gold,
  collection,
  onCollectionChange,
}: {
  page: LobbyPage;
  ready: boolean;
  deckCount: number;
  mapId: MapId;
  onMapChange: (id: MapId) => void;
  night: boolean;
  onNightChange: (value: boolean) => void;
  onNavigate: (page: LobbyPage) => void;
  onStart: () => void;
  difficulty: Difficulty;
  onDifficultyChange: (value: Difficulty) => void;
  completed: MissionId[];
  onMissionStart: (id: MissionId) => void;
  children: ReactNode;
  gold: number;
  collection: CollectionState | null;
  onCollectionChange: (state: CollectionState) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stage.current?.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    const mixer = getBattleAudio();
    // 页面加载后立即预取音频，首次点击时音乐即刻播放，无需等待下载。
    mixer.prefetch();
    // 回到主菜单时立即恢复背景音乐（音频已解锁的情况下）。
    mixer.setActive(true);
    const unlock = () => {
      void mixer.unlock();
      mixer.setActive(true);
    };
    const onVisibility = () => {
      if (document.hidden) mixer.setActive(false);
      else mixer.setActive(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
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
          <small>GREYLINE · v141</small>
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
        {page !== 'campaign' && (
          <MapSelector value={mapId} onChange={onMapChange} disabled={!ready} />
        )}
        {page !== 'campaign' && (
          <button
            type="button"
            className={styles.difficultyLink}
            disabled={!ready}
            aria-pressed={night}
            onClick={() => onNightChange(!night)}
            title="夜间战场：视野大幅缩减，开火会暴露枪口焰"
          >
            时段 · {night ? '夜间' : '昼间'}
            <small>
              {night ? '黑暗中只有火光与照明弹能揭示敌人' : '切换到夜战'}
            </small>
          </button>
        )}
        <button
          type="button"
          className={styles.difficultyLink}
          onClick={() => onNavigate('settings')}
          title={DIFFICULTY_BONUS[difficulty]}
        >
          对手 · {DIFFICULTY_LABEL[difficulty]}
          <small>{DIFFICULTY_BONUS[difficulty]}</small>
        </button>
        <div className={styles.goldStatus}>
          <span>金币</span>
          <strong>{gold}</strong>
        </div>
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
        {page === 'shop' && collection && (
          <div className={styles.panelPage}>
            <Shop collection={collection} onChange={onCollectionChange} />
          </div>
        )}
        {page === 'settings' && (
          <div className={styles.panelPage}>
            <Settings
              difficulty={difficulty}
              onDifficultyChange={onDifficultyChange}
            />
          </div>
        )}
        {page === 'guide' && (
          <div className={styles.panelPage}>
            <Guide />
          </div>
        )}
        {page === 'campaign' && (
          <CampaignMenu
            completed={completed}
            difficulty={difficulty}
            onStart={onMissionStart}
          />
        )}
      </div>
    </main>
  );
}
