// FSRS 调度纯逻辑：持久化与 UI 都通过这里进出 ts-fsrs（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 卡片以 sense.stable_id 为主键（义项级，M-B 决策），与只读发布物通过 stable_id 关联。

import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: '重来',
  [Rating.Hard]: '困难',
  [Rating.Good]: '一般',
  [Rating.Easy]: '简单',
};

/** 长期学习的目标记忆率（M-B 起步值，M-D 统计后按实测调整）。 */
export const TARGET_RETENTION = 0.9;

export interface StoredCard {
  stableId: string;
  due: string; // ISO 8601
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number; // State 枚举值
  lastReview: string | null; // ISO 8601
}

const scheduler = fsrs({
  request_retention: TARGET_RETENTION,
  enable_fuzz: false, // 固定参数：便于内测期复现与对照
  enable_short_term: true,
});

export function newCard(stableId: string, now: Date): StoredCard {
  return toStored(stableId, createEmptyCard(now));
}

export function toStored(stableId: string, card: Card): StoredCard {
  return {
    stableId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function fromStored(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsedDays,
    scheduled_days: stored.scheduledDays,
    learning_steps: stored.learningSteps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state,
    last_review: stored.lastReview ? new Date(stored.lastReview) : undefined,
  };
}

/** 对某张卡评分，返回调度后的新卡（不落库，由调用方决定写入时机）。 */
export function gradeCard(stored: StoredCard, grade: Grade, now: Date): StoredCard {
  const { card } = scheduler.next(fromStored(stored), now, grade);
  return toStored(stored.stableId, card);
}

/** 今日到期判断：新卡立即可学，其余按 due 判定。 */
export function isDue(stored: StoredCard, now: Date): boolean {
  if (stored.state === State.New) return true;
  return new Date(stored.due).getTime() <= now.getTime();
}

/** 排序：到期复习卡优先（越早到期越前），新卡排后；同级按 stable_id 稳定排序。 */
export function sortForQueue(cards: readonly StoredCard[]): StoredCard[] {
  return [...cards].sort((a, b) => {
    const aNew = a.state === State.New ? 1 : 0;
    const bNew = b.state === State.New ? 1 : 0;
    if (aNew !== bNew) return aNew - bNew;
    const dueDiff = new Date(a.due).getTime() - new Date(b.due).getTime();
    if (dueDiff !== 0) return dueDiff;
    return a.stableId.localeCompare(b.stableId);
  });
}

/**
 * 今日学习队列（F5 双目标）：到期卡按类别分两个上限截断——
 * 复习段（到期非新卡）截 reviewLimit，新学段（新卡）截 newLimit；
 * 队列顺序保持复习在前、新学在后（两段各自经 sortForQueue 排序）。
 */
export function buildTodayQueue(
  cards: readonly StoredCard[],
  reviewLimit: number,
  newLimit: number,
  now: Date,
): StoredCard[] {
  if (reviewLimit <= 0 && newLimit <= 0) return [];
  const due = cards.filter((c) => isDue(c, now));
  const review = sortForQueue(due.filter((c) => c.state !== State.New)).slice(
    0,
    Math.max(0, reviewLimit),
  );
  const fresh = sortForQueue(due.filter((c) => c.state === State.New)).slice(
    0,
    Math.max(0, newLimit),
  );
  return [...review, ...fresh];
}

/** 队列完成度（0–1），用于进度条。 */
export function queueProgress(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}
