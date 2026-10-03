// 学习库读写：收藏（既有）+ FSRS 卡片状态（M-B）。均为设备端可写数据，与只读发布物分离。
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'learning.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openLearningDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = bootstrap();
  return dbPromise;
}

async function bootstrap(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS favorite (
      entry_id   INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS review_card (
      stable_id       TEXT PRIMARY KEY,
      due             TEXT NOT NULL,
      stability       REAL NOT NULL,
      difficulty      REAL NOT NULL,
      elapsed_days    INTEGER NOT NULL,
      scheduled_days  INTEGER NOT NULL,
      learning_steps  INTEGER NOT NULL,
      reps            INTEGER NOT NULL,
      lapses          INTEGER NOT NULL,
      state           INTEGER NOT NULL,
      last_review     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_review_due ON review_card (due);
    CREATE TABLE IF NOT EXISTS daily_goal (
      day            TEXT PRIMARY KEY,
      target_count   INTEGER NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

/* ---------- 收藏 ---------- */

export async function getFavoriteEntryIds(): Promise<number[]> {
  const db = await openLearningDb();
  const rows = await db.getAllAsync<{ entry_id: number }>(
    'SELECT entry_id FROM favorite ORDER BY created_at DESC, entry_id DESC',
  );
  return rows.map((r) => r.entry_id);
}

export async function addFavoriteEntry(entryId: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync('INSERT OR IGNORE INTO favorite (entry_id) VALUES (?)', [entryId]);
}

export async function removeFavoriteEntry(entryId: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync('DELETE FROM favorite WHERE entry_id = ?', [entryId]);
}

/* ---------- FSRS 卡片 ---------- */

interface ReviewRow {
  stable_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export async function getReviewCards(): Promise<
  { stableId: string; due: string; stability: number; difficulty: number; elapsedDays: number; scheduledDays: number; learningSteps: number; reps: number; lapses: number; state: number; lastReview: string | null }[]
> {
  const db = await openLearningDb();
  const rows = await db.getAllAsync<ReviewRow>('SELECT * FROM review_card');
  return rows.map((r) => ({
    stableId: r.stable_id,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsedDays: r.elapsed_days,
    scheduledDays: r.scheduled_days,
    learningSteps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    lastReview: r.last_review,
  }));
}

export async function upsertReviewCard(card: {
  stableId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
}): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO review_card
       (stable_id, due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, state, last_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.stableId,
      card.due,
      card.stability,
      card.difficulty,
      card.elapsedDays,
      card.scheduledDays,
      card.learningSteps,
      card.reps,
      card.lapses,
      card.state,
      card.lastReview,
    ],
  );
}

export async function bulkUpsertReviewCards(
  cards: Parameters<typeof upsertReviewCard>[0][],
): Promise<void> {
  if (cards.length === 0) return;
  const db = await openLearningDb();
  await db.withTransactionAsync(async () => {
    for (const card of cards) {
      await db.runAsync(
        `INSERT OR REPLACE INTO review_card
           (stable_id, due, stability, difficulty, elapsed_days, scheduled_days,
            learning_steps, reps, lapses, state, last_review)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          card.stableId,
          card.due,
          card.stability,
          card.difficulty,
          card.elapsedDays,
          card.scheduledDays,
          card.learningSteps,
          card.reps,
          card.lapses,
          card.state,
          card.lastReview,
        ],
      );
    }
  });
}

/* ---------- 每日目标 ---------- */

export async function getDailyGoal(day: string): Promise<{ target: number; completed: number }> {
  const db = await openLearningDb();
  const row = await db.getFirstAsync<{ target_count: number; completed_count: number }>(
    'SELECT target_count, completed_count FROM daily_goal WHERE day = ?',
    [day],
  );
  return { target: row?.target_count ?? 20, completed: row?.completed_count ?? 0 };
}

export async function setDailyCompleted(day: string, completed: number, target: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    `INSERT INTO daily_goal (day, target_count, completed_count) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET completed_count = excluded.completed_count, target_count = excluded.target_count`,
    [day, target, completed],
  );
}

export async function setDailyTarget(day: string, target: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    `INSERT INTO daily_goal (day, target_count, completed_count) VALUES (?, ?, 0)
     ON CONFLICT(day) DO UPDATE SET target_count = excluded.target_count`,
    [day, target],
  );
}

export interface StudyStats {
  /** 有学习记录的天数（连续天数由调用方按日期序列计算） */
  activeDays: string[];
  totalReviews: number;
  /** state: 0=New 1=Learning 2=Review 3=Relearning（ts-fsrs State 枚举序） */
  stateCounts: { new: number; learning: number; review: number; relearning: number };
  /** 复习间隔 ≥ 21 天的卡视为「已稳固」 */
  solidCount: number;
}

/** 统计页数据：按 state 与到期情况汇总，不扫描逐卡明细给 UI。 */
export async function getStudyStats(): Promise<StudyStats> {
  const db = await openLearningDb();
  const days = await db.getAllAsync<{ day: string; completed: number }>(
    'SELECT day, completed_count AS completed FROM daily_goal WHERE completed_count > 0 ORDER BY day',
  );
  const states = await db.getAllAsync<{ state: number; n: number }>(
    'SELECT state, COUNT(*) AS n FROM review_card GROUP BY state',
  );
  const reviews = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(reps), 0) AS total FROM review_card',
  );
  const solid = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM review_card WHERE state = 2 AND scheduled_days >= 21',
  );

  const count = (state: number) => states.find((s) => s.state === state)?.n ?? 0;
  return {
    activeDays: days.map((d) => d.day),
    totalReviews: reviews?.total ?? 0,
    stateCounts: {
      new: count(0),
      learning: count(1),
      review: count(2),
      relearning: count(3),
    },
    solidCount: solid?.n ?? 0,
  };
}
