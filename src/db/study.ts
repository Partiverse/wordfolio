// 学习库读写：收藏（既有）+ FSRS 卡片状态（M-B）。均为设备端可写数据，与只读发布物分离。
// 备份导出/导入的归并纯逻辑见 ../study/merge-core.ts（E1）。
import * as SQLite from 'expo-sqlite';

import {
  parseBackup,
  planMerge,
  type DailyGoalRow,
  type FavoriteRow,
  type ReviewCardRow,
  type ReviewLogRow,
  type SettingRow,
} from '../study/merge-core';
import { BUNDLED_EDITION } from './release';

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

/** 自由练习累计次数（review_log 中 kind='practice' 的总条数，不动排期的练习/听音/拼写）。 */
export async function getPracticeTotal(): Promise<number> {
  const db = await openLearningDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM review_log WHERE kind = 'practice'`,
  );
  return row?.total ?? 0;
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

/* ---------- 学习数据备份：导出 / 导入（切片 E1） ---------- */

/** 导出五表全量（favorite / review_card / review_log / daily_goal / settings）为 JSON 字符串，
 *  顶层带 exportedAt 与 edition（取发布物 BUNDLED_EDITION）。 */
export async function exportLearningData(): Promise<string> {
  const db = await openLearningDb();
  const favorite = await db.getAllAsync<FavoriteRow>(
    'SELECT entry_id, created_at FROM favorite ORDER BY created_at, entry_id',
  );
  const review_card = await db.getAllAsync<ReviewCardRow>(
    `SELECT stable_id, due, stability, difficulty, elapsed_days, scheduled_days,
            learning_steps, reps, lapses, state, last_review, created_at
       FROM review_card ORDER BY stable_id`,
  );
  const review_log = await db.getAllAsync<ReviewLogRow>(
    'SELECT stable_id, rating, due_after, reviewed_at, kind FROM review_log ORDER BY id',
  );
  const daily_goal = await db.getAllAsync<DailyGoalRow>(
    'SELECT day, target_count, completed_count FROM daily_goal ORDER BY day',
  );
  const settings = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings ORDER BY key');

  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    edition: BUNDLED_EDITION,
    data: { favorite, review_card, review_log, daily_goal, settings },
  });
}

export interface ImportTableCount {
  imported: number;
  skipped: number;
}

export interface ImportResult {
  edition: string;
  exportedAt: string;
  counts: {
    favorite: ImportTableCount;
    review_card: ImportTableCount;
    review_log: ImportTableCount;
    daily_goal: ImportTableCount;
    settings: ImportTableCount;
  };
}

/** 导入备份 JSON：畸形/结构非法在解析层（parseBackup）抛出、由 UI 调用方捕获；
 *  四张有主键的表按「跳过已存在主键」合并（favorite=entry_id / review_card=stable_id /
 *  daily_goal=day / settings=key）；review_log 无业务主键（id 自增），全量追加不查重。 */
export async function importLearningData(json: string): Promise<ImportResult> {
  const payload = parseBackup(json);
  const db = await openLearningDb();

  const favIds = await db.getAllAsync<{ entry_id: number }>('SELECT entry_id FROM favorite');
  const cardIds = await db.getAllAsync<{ stable_id: string }>('SELECT stable_id FROM review_card');
  const goalDays = await db.getAllAsync<{ day: string }>('SELECT day FROM daily_goal');
  const settingKeys = await db.getAllAsync<{ key: string }>('SELECT key FROM settings');

  const favPlan = planMerge(payload.data.favorite, new Set(favIds.map((r) => r.entry_id)), (r) => r.entry_id);
  const cardPlan = planMerge(payload.data.review_card, new Set(cardIds.map((r) => r.stable_id)), (r) => r.stable_id);
  const goalPlan = planMerge(payload.data.daily_goal, new Set(goalDays.map((r) => r.day)), (r) => r.day);
  const settingPlan = planMerge(payload.data.settings, new Set(settingKeys.map((r) => r.key)), (r) => r.key);

  const logRows = payload.data.review_log;
  await db.withTransactionAsync(async () => {
    for (const row of favPlan.toWrite) {
      // planMerge 已排除主键冲突，用裸 INSERT：意外冲突直接报错而非静默覆盖
      await db.runAsync('INSERT INTO favorite (entry_id, created_at) VALUES (?, ?)', [
        row.entry_id,
        row.created_at,
      ]);
    }
    for (const row of cardPlan.toWrite) {
      await db.runAsync(
        `INSERT INTO review_card
           (stable_id, due, stability, difficulty, elapsed_days, scheduled_days,
            learning_steps, reps, lapses, state, last_review, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.stable_id,
          row.due,
          row.stability,
          row.difficulty,
          row.elapsed_days,
          row.scheduled_days,
          row.learning_steps,
          row.reps,
          row.lapses,
          row.state,
          row.last_review,
          row.created_at,
        ],
      );
    }
    for (const row of logRows) {
      await db.runAsync(
        'INSERT INTO review_log (stable_id, rating, due_after, reviewed_at, kind) VALUES (?, ?, ?, ?, ?)',
        [row.stable_id, row.rating, row.due_after, row.reviewed_at, row.kind],
      );
    }
    for (const row of goalPlan.toWrite) {
      await db.runAsync(
        'INSERT INTO daily_goal (day, target_count, completed_count) VALUES (?, ?, ?)',
        [row.day, row.target_count, row.completed_count],
      );
    }
    for (const row of settingPlan.toWrite) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [row.key, row.value]);
    }
  });

  return {
    edition: payload.edition,
    exportedAt: payload.exportedAt,
    counts: {
      favorite: { imported: favPlan.toWrite.length, skipped: favPlan.skipped },
      review_card: { imported: cardPlan.toWrite.length, skipped: cardPlan.skipped },
      review_log: { imported: logRows.length, skipped: 0 },
      daily_goal: { imported: goalPlan.toWrite.length, skipped: goalPlan.skipped },
      settings: { imported: settingPlan.toWrite.length, skipped: settingPlan.skipped },
    },
  };
}
