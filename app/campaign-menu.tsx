'use client';
import { useState } from 'react';
import { MISSIONS, type MissionId } from '@/game/campaign';
import { MAPS } from '@/game/maps';
import { assetUrl } from '@/game/asset-url';
import type { Difficulty } from '@/game/economy';
import { DIFFICULTY_LABEL, DIFFICULTY_BONUS } from './difficulty-selector';
import styles from './campaign-menu.module.css';
export default function CampaignMenu({
  completed,
  difficulty,
  onStart,
}: {
  completed: MissionId[];
  difficulty: Difficulty;
  onStart: (id: MissionId) => void;
}) {
  const [selected, setSelected] = useState<MissionId>(
    () => MISSIONS.find((m) => !completed.includes(m.id))?.id ?? MISSIONS[0].id,
  );
  const index = MISSIONS.findIndex((m) => m.id === selected),
    mission = MISSIONS[index];
  const unlocked = index === 0 || completed.includes(MISSIONS[index - 1].id);
  return (
    <section className={styles.campaign} aria-labelledby="campaign-title">
      <header className={styles.heading}>
        <span>故事战役 · 六章</span>
        <h1 id="campaign-title">断线之地</h1>
        <p>
          从盐路、雨林到北线终站，接回失联的人与哨站。六章架空故事，沿途部署与任务各不相同。
        </p>
      </header>
      <div className={styles.dossier}>
        <nav className={styles.chapters} aria-label="战役章节">
          {MISSIONS.map((m, i) => (
            <button
              type="button"
              key={m.id}
              aria-current={selected === m.id ? 'step' : undefined}
              onClick={() => setSelected(m.id)}
              aria-label={`${m.chapter} ${m.title}，${completed.includes(m.id) ? '已完成' : i === 0 || completed.includes(MISSIONS[i - 1].id) ? '可出战' : '待解锁'}`}
            >
              <small>
                {m.chapter} ·{' '}
                {completed.includes(m.id)
                  ? '已完成'
                  : i === 0 || completed.includes(MISSIONS[i - 1].id)
                    ? '可出战'
                    : '待解锁'}
              </small>
              <strong>{m.title}</strong>
              <span>
                {m.objective === 'defend'
                  ? '坚守'
                  : m.objective === 'capture'
                    ? '夺取'
                    : '反击'}{' '}
                / {Math.round(m.duration / 60)} 分钟
              </span>
            </button>
          ))}
        </nav>
        <article className={styles.brief}>
          <div
            className={styles.landscape}
            style={{
              backgroundImage: `url('${assetUrl(MAPS[mission.mapId].backgroundAsset)}')`,
            }}
          >
            <div>
              <span>{mission.region}</span>
              <h2>{mission.title}</h2>
            </div>
          </div>
          <div className={styles.briefText}>
            <p className={styles.story}>{mission.briefing}</p>
            <dl>
              <div>
                <dt>任务</dt>
                <dd>{mission.goal}</dd>
              </div>
              <div>
                <dt>已知部署</dt>
                <dd>{mission.preparation}</dd>
              </div>
            </dl>
            <div className={styles.launchRow}>
              <span>
                {DIFFICULTY_LABEL[difficulty]} · {DIFFICULTY_BONUS[difficulty]}
                <small>使用当前20张编队 · 战役进度保存在本机</small>
                <small>进场先听无线电简报，阅读时战斗暂停。</small>
              </span>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onStart(mission.id)}
              >
                {unlocked ? '进入战役' : '完成上一章后解锁'}
                <span aria-hidden="true"> →</span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
