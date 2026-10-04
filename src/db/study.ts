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
    CREATE TABLE IF NOT EXISTS audio_cache (
      word      TEXT PRIMARY KEY,
      url       TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS review_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      stable_id  TEXT NOT NULL,
      rating     INTEGER NOT NULL,   -- 1=Again 2=Hard 3=Good 4=Easy
      due_after  TEXT NOT NULL,      -- 本次评分后的到期时间
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      kind       TEXT NOT NULL DEFAULT 'review'  -- review=正式学习（动排期）/ practice=自由练习（不动排期）
    );
    CREATE INDEX IF NOT EXISTS idx_review_log_card ON review_log (stable_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_review_log_time ON review_log (reviewed_at DESC);
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_goal (
      day            TEXT PRIMARY KEY,
      target_count   INTEGER NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  // 旧库迁移：review_log 建表时无 kind 列（beta.15 及之前），补列；已存在则忽略
  await db
    .execAsync('ALTER TABLE review_log ADD COLUMN kind TEXT NOT NULL DEFAULT \'review\'')
    .catch(() => {});
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

/* ---------- 发音缓存（真人语音 URL，见 utils/pronunciation.ts） ---------- */

export async function getAudioUrl(word: string): Promise<string | null> {
  const db = await openLearningDb();
  const row = await db.getFirstAsync<{ url: string }>(
    'SELECT url FROM audio_cache WHERE word = ?',
    [word],
  );
  return row?.url ?? null;
}

export async function putAudioUrl(word: string, url: string): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO audio_cache (word, url) VALUES (?, ?)',
    [word, url],
  );
}

/* ---------- 复习日志与错题本 ---------- */

/** 每次评分留痕（错题本与复习曲线的数据源；review_card 只存最新状态）。
 *  kind='review' 正式学习（卡片模式，动 FSRS 排期）；'practice' 自由练习（不动排期）。 */
export async function logReview(
  stableId: string,
  rating: number,
  dueAfter: string,
  kind: 'review' | 'practice' = 'review',
): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    'INSERT INTO review_log (stable_id, rating, due_after, kind) VALUES (?, ?, ?, ?)',
    [stableId, rating, dueAfter, kind],
  );
}

export interface WrongBookItem {
  stableId: string;
  lastAgainAt: string;
  reps: number;
  lapses: number;
  state: number;
}

/**
 * 错题本：最近一次评分是「重来(1)」的义项（错题已订正即移出），
 * 排除已稳固（Review 且 scheduled_days ≥ 21）。按最近出错时间倒序。
 */
export async function getWrongBook(limit = 50): Promise<WrongBookItem[]> {
  const db = await openLearningDb();
  const rows = await db.getAllAsync<{
    stableId: string;
    lastAgainAt: string;
    reps: number;
    lapses: number;
    state: number;
  }>(
    `WITH latest AS (
       SELECT stable_id, rating, reviewed_at,
              ROW_NUMBER() OVER (PARTITION BY stable_id ORDER BY id DESC) AS rn
         FROM review_log
     )
     SELECT l.stable_id AS stableId,
            l.reviewed_at AS lastAgainAt,
            rc.reps AS reps,
            rc.lapses AS lapses,
            rc.state AS state
       FROM latest l
       JOIN review_card rc ON rc.stable_id = l.stable_id
      WHERE l.rn = 1
        AND l.rating = 1
        AND NOT (rc.state = 2 AND rc.scheduled_days >= 21)
      ORDER BY l.reviewed_at DESC
      LIMIT ?`,
    [limit],
  );
  return rows;
}

/** 逐日复习次数（近 days 天，含无记录的日期由调用方补零）。 */
export async function getReviewHistory(days: number): Promise<{ day: string; count: number }[]> {
  const db = await openLearningDb();
  const rows = await db.getAllAsync<{ day: string; n: number }>(
    `SELECT substr(reviewed_at, 1, 10) AS day, COUNT(*) AS n
       FROM review_log
      WHERE reviewed_at >= date('now', ?)
      GROUP BY day
      ORDER BY day`,
    [`-${days} days`],
  );
  return rows.map((r) => ({ day: r.day, count: r.n }));
}

/* ---------- 通用设置（key/value） ---------- */

export async function getSetting(key: string): Promise<string | null> {
  const db = await openLearningDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
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
