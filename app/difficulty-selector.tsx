'use client';
import type { Difficulty } from '@/game/economy';
import styles from './campaign-menu.module.css';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  standard: '标准',
  veteran: '老练',
  elite: '精锐',
};
export const DIFFICULTY_BONUS: Record<Difficulty, string> = {
  standard: '双方同速回点',
  veteran: 'AI 回点速度 +15%',
  elite: 'AI 回点速度 +30%',
};
export default function DifficultySelector({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}) {
  return (
    <fieldset className={styles.difficulty}>
      <legend>对手难度</legend>
      <p>双方开局均为 2 点指挥点。资源优势只影响 AI 回点速度。</p>
      <div>
        {(['standard', 'veteran', 'elite'] as const).map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            <strong>{DIFFICULTY_LABEL[id]}</strong>
            <span>{DIFFICULTY_BONUS[id]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
