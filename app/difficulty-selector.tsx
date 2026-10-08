'use client';
import type { Difficulty } from '@/game/economy';
import styles from './campaign-menu.module.css';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  standard: '标准',
  veteran: '老练',
  elite: '精锐',
};
export const DIFFICULTY_BONUS: Record<Difficulty, string> = {
  standard: '25张 · 双方同速回点',
  veteran: '30张 · AI 回点速度 +15%',
  elite: '35张 · AI 回点速度 +30%',
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
      <p>双方开局均为 0 点指挥点。我方携带25张牌，对手按难度携带25、30或35张。</p>
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
