// 评分模式纯逻辑：三档自评（默认）与专家四档的键序 / 文案 / FSRS Grade 映射（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 持久化由统计页与学习屏经 db/study.ts 的 settings 表完成（key='ratingMode'，值为模式字符串本身），
// 风格与学习模式记忆（mode-core.ts，key='studyMode'）一致。

import { Rating, type Grade } from 'ts-fsrs';

export const RATING_MODE_KEY = 'ratingMode';

/** 主评分键（「认识」=Good）：三/四档共有的首键，学习屏评分按钮高亮锚点。 */
export const PRIMARY_GRADE: Grade = Rating.Good;

export const RATING_MODES = ['simple', 'expert'] as const;

export type RatingMode = (typeof RATING_MODES)[number];

/** 评分按钮文案（自评语义，区别于 fsrs-core 的 GRADE_LABELS 调度语义）。 */
export const RATING_LABELS: Record<Grade, string> = {
  [Rating.Again]: '忘记',
  [Rating.Hard]: '模糊',
  [Rating.Good]: '认识',
  [Rating.Easy]: '简单',
};

/** 三档自评：认识→Good、模糊→Hard、忘记→Again（默认模式）。 */
export const SIMPLE_GRADES: readonly Grade[] = [Rating.Good, Rating.Hard, Rating.Again];

/** 专家四档：三档基础上插入 简单→Easy；展示顺序 认识 / 简单 / 模糊 / 忘记。 */
export const EXPERT_GRADES: readonly Grade[] = [Rating.Good, Rating.Easy, Rating.Hard, Rating.Again];

/** 恢复评分模式：settings 读出的任意值 → 合法模式；缺失/无效（含大小写不符）回退 'simple'（三档自评）。 */
export function parseRatingMode(value: string | null | undefined): RatingMode {
  if (value && (RATING_MODES as readonly string[]).includes(value)) {
    return value as RatingMode;
  }
  return 'simple';
}

/** 当前模式下学习卡应展示的评分键（含 FSRS Grade 映射与展示顺序）。 */
export function gradesForMode(mode: RatingMode): readonly Grade[] {
  return mode === 'expert' ? EXPERT_GRADES : SIMPLE_GRADES;
}
