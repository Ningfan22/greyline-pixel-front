'use client';
import { useState } from 'react';
import {
  MISSIONS,
  campaignProgress,
  missionDeckName,
  missionUnlocked,
  type MissionId,
} from '@/game/campaign';
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
  const progress = campaignProgress(completed);
  const [selected, setSelected] = useState<MissionId>(
    () => progress.next ?? MISSIONS[MISSIONS.length - 1].id,
  );
  const mission = MISSIONS.find((m) => m.id === selected) ?? MISSIONS[0];
  const [act, setAct] = useState(() => mission.act);
  const acts = [1, 2, 3, 4] as const;
  const actMissions = MISSIONS.filter((m) => m.act === act);
  const unlocked = missionUnlocked(mission.id, completed);
  const cleared = completed.includes(mission.id);
  const next = MISSIONS.find((m) => m.id === progress.next);
  const ending = MISSIONS[MISSIONS.length - 1];

  return (
    <section className={styles.campaign} aria-labelledby="campaign-title">
      <header className={styles.heading}>
        <span>故事战役 · 四幕二十关</span>
        <h1 id="campaign-title">断线之地</h1>
        <p>
          跟随许岚，从盐路的第一声呼号开始，打通救援通道，追查仍在传播的旧命令。接回失联的人与哨站，让停火抵达整条战线。
        </p>
        <div className={styles.progressRow}>
          <div>
            <strong>
              {progress.finished
                ? '战役已通关'
                : `已完成 ${progress.completed} / ${progress.total} 关`}
            </strong>
            <progress
              className={styles.progressTrack}
              aria-label="战役完成进度"
              value={progress.completed}
              max={progress.total}
            />
          </div>
          {next && (
            <button type="button" onClick={() => onStart(next.id)}>
              {progress.completed ? '继续战役' : '开始战役'}{' '}
              <span aria-hidden="true">→</span>
              <small>
                {next.chapter} · {next.title}
              </small>
            </button>
          )}
        </div>
      </header>
      {progress.finished && (
        <section
          className={styles.ending}
          aria-label="战役结局"
          aria-live="polite"
        >
          <span>战役档案 · 全线接通</span>
          <h2>断线之地，终于有了回声。</h2>
          <p>{ending.victory}</p>
          <small>二十关全部完成。选择任一已完成任务，可以重新出战。</small>
        </section>
      )}
      <nav className={styles.acts} aria-label="战役四幕">
        {acts.map((value) => {
          const group = MISSIONS.filter((m) => m.act === value);
          const done = group.filter((m) => completed.includes(m.id)).length;
          const current = next?.act === value;
          return (
            <button
              type="button"
              key={value}
              aria-pressed={act === value}
              onClick={() => {
                setAct(value);
                setSelected(
                  group.find((m) => m.id === progress.next)?.id ??
                    group.find((m) => !completed.includes(m.id))?.id ??
                    group[0].id,
                );
              }}
            >
              <small>
                第{['一', '二', '三', '四'][value - 1]}幕 · {done} /{' '}
                {group.length}
                {current ? ' · 当前' : ''}
              </small>
              <strong>{group[0].actTitle}</strong>
            </button>
          );
        })}
      </nav>
      <div className={styles.dossier}>
        <nav
          className={styles.chapters}
          aria-label={`${actMissions[0].actTitle}任务`}
        >
          {actMissions.map((m) => {
            const done = completed.includes(m.id);
            const available = missionUnlocked(m.id, completed);
            const state = done
              ? '已完成'
              : m.id === progress.next
                ? '当前任务'
                : available
                  ? '可出战'
                  : '待解锁';
            return (
              <button
                type="button"
                key={m.id}
                aria-current={selected === m.id ? 'step' : undefined}
                onClick={() => setSelected(m.id)}
                aria-label={`${m.chapter} ${m.title}，${state}`}
              >
                <small>
                  {m.chapter} · {state}
                </small>
                <strong>{m.title}</strong>
                <span>
                  {m.objective === 'defend'
                    ? '坚守'
                    : m.objective === 'capture'
                      ? '夺取'
                      : '反击'}
                  {' / '}
                  {Math.round(m.duration / 60)} 分钟{m.night ? ' / 夜战' : ''}
                </span>
              </button>
            );
          })}
        </nav>
        <article className={styles.brief}>
          <div
            className={styles.landscape}
            style={{
              backgroundImage: `url('${assetUrl(MAPS[mission.mapId].backgroundAsset)}')`,
            }}
          >
            <div>
              <span>
                {mission.chapter} · {mission.region}
                {mission.night ? ' · 夜间行动' : ''}
              </span>
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
              <div>
                <dt>任务编队</dt>
                <dd>{missionDeckName(mission.id)} · 25 张借用卡</dd>
              </div>
            </dl>
            <div className={styles.launchRow}>
              <span>
                {DIFFICULTY_LABEL[difficulty]} · {DIFFICULTY_BONUS[difficulty]}
                <small>任务编队自动配发 · 战役进度保存在本机</small>
                <small>进场先听无线电简报，阅读时战斗暂停。</small>
              </span>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onStart(mission.id)}
              >
                {cleared
                  ? '重玩本关'
                  : unlocked
                    ? '进入任务'
                    : '完成上一关后解锁'}
                {unlocked && <span aria-hidden="true"> →</span>}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
