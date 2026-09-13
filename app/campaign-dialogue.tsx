'use client';
/* oxlint-disable next/no-img-element -- This pre-sized pixel portrait is served directly by static GitHub Pages without an image server. */

import { useEffect, useRef, useState } from 'react';
import { missionById, type MissionId } from '@/game/campaign';
import { assetUrl } from '@/game/asset-url';
import styles from './campaign-dialogue.module.css';

export interface CampaignDialogueProps {
  missionId: MissionId;
  open: boolean;
  onClose: () => void;
}

/** Battle owns simulation pause/resume; closing this panel never changes game state. */
export default function CampaignDialogue({
  missionId,
  open,
  onClose,
}: CampaignDialogueProps) {
  if (!open) return null;
  return <RadioBrief key={missionId} missionId={missionId} onClose={onClose} />;
}

function RadioBrief({
  missionId,
  onClose,
}: Omit<CampaignDialogueProps, 'open'>) {
  const mission = missionById(missionId);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const line = mission.openingDialogue[index];
  const last = index === mission.openingDialogue.length - 1;
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    next.current?.focus();
    return () => {
      if (element.open) element.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialogue}
      aria-labelledby="campaign-radio-title"
      aria-describedby="campaign-radio-text"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.copy}>
        <header>
          <span className={styles.channel}>无线电简报 · 战斗暂停</span>
          <h2 id="campaign-radio-title">
            {mission.chapter} · {mission.title}
          </h2>
        </header>
        <strong className={styles.speaker}>{line.speaker}</strong>
        <p
          id="campaign-radio-text"
          className={styles.message}
          aria-live="polite"
        >
          {line.text}
        </p>
        <div className={styles.controls}>
          <span
            aria-label={`第${index + 1}句，共${mission.openingDialogue.length}句`}
          >
            {index + 1} / {mission.openingDialogue.length}
          </span>
          <button className={styles.skip} type="button" onClick={onClose}>
            关闭简报
          </button>
          <button
            ref={next}
            className={styles.next}
            type="button"
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? '开始行动' : '下一句'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div className={styles.portrait} aria-hidden="true">
        <img src={assetUrl('/art/v22-story/liaison.webp')} alt="" />
        <span>前线联络 · 许岚</span>
      </div>
    </dialog>
  );
}
