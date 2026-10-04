// 学习数据备份的归并纯逻辑（切片 E1）：备份 JSON 的解析校验 + 「跳过已存在主键」合并规划。
// 无 RN / SQLite 依赖，供 vitest 覆盖；被 src/db/study.ts 的 importLearningData 调用。
// 行结构与 learning.db 列名一一对应（建表语句唯一出处 src/db/study.ts）。

export interface FavoriteRow {
  entry_id: number;
  created_at: string;
}

export interface ReviewCardRow {
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
  created_at: string;
}

export interface ReviewLogRow {
  stable_id: string;
  rating: number;
  due_after: string;
  reviewed_at: string;
  kind: 'review' | 'practice';
}

export interface DailyGoalRow {
  day: string;
  target_count: number;
  completed_count: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

/** 备份文件顶层结构（exportLearningData 的产物；data 键 = learning.db 表名）。 */
export interface BackupPayload {
  exportedAt: string;
  edition: string;
  data: {
    favorite: FavoriteRow[];
    review_card: ReviewCardRow[];
    review_log: ReviewLogRow[];
    daily_goal: DailyGoalRow[];
    settings: SettingRow[];
  };
}

/** 解析备份字符串：畸形 JSON / 结构缺失 / 行字段非法都在解析层抛 Error，由调用方捕获。 */
export function parseBackup(json: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`备份文件不是有效的 JSON（${e instanceof Error ? e.message : String(e)}）`);
  }
  return validateBackup(raw);
}

/* ---------- 归并规划 ---------- */

export interface MergePlan<T> {
  /** 主键不存在于目标表的行，调用方负责写入 */
  toWrite: T[];
  /** 因主键已存在而被跳过的行数 */
  skipped: number;
}

/** 「跳过已存在主键」策略：按 key 集合过滤待写入项，不改动传入数组。 */
export function planMerge<T, K>(
  incoming: readonly T[],
  existingKeys: ReadonlySet<K>,
  keyOf: (item: T) => K,
): MergePlan<T> {
  const toWrite: T[] = [];
  let skipped = 0;
  for (const item of incoming) {
    if (existingKeys.has(keyOf(item))) {
      skipped += 1;
    } else {
      toWrite.push(item);
    }
  }
  return { toWrite, skipped };
}

/* ---------- 结构与行校验（内部） ---------- */

function validateBackup(raw: unknown): BackupPayload {
  if (!isPlainObject(raw)) throw new Error('备份根节点必须是对象');
  if (typeof raw.exportedAt !== 'string') throw new Error('备份缺少 exportedAt');
  if (typeof raw.edition !== 'string') throw new Error('备份缺少 edition');
  if (!isPlainObject(raw.data)) throw new Error('备份缺少 data 表集合');

  const data = raw.data;
  if (!Array.isArray(data.favorite)) throw new Error('data.favorite 必须是数组');
  if (!Array.isArray(data.review_card)) throw new Error('data.review_card 必须是数组');
  if (!Array.isArray(data.review_log)) throw new Error('data.review_log 必须是数组');
  if (!Array.isArray(data.daily_goal)) throw new Error('data.daily_goal 必须是数组');
  if (!Array.isArray(data.settings)) throw new Error('data.settings 必须是数组');

  return {
    exportedAt: raw.exportedAt,
    edition: raw.edition,
    data: {
      favorite: data.favorite.map((row, i) => validateFavoriteRow(row, i)),
      review_card: data.review_card.map((row, i) => validateReviewCardRow(row, i)),
      review_log: data.review_log.map((row, i) => validateReviewLogRow(row, i)),
      daily_goal: data.daily_goal.map((row, i) => validateDailyGoalRow(row, i)),
      settings: data.settings.map((row, i) => validateSettingRow(row, i)),
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function reqString(v: unknown, where: string): string {
  if (typeof v !== 'string') throw new Error(`${where} 必须是字符串`);
  return v;
}

function reqInt(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error(`${where} 必须是整数`);
  return v;
}

function reqNumber(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where} 必须是有限数字`);
  return v;
}

function reqNullableString(v: unknown, where: string): string | null {
  return v === null ? null : reqString(v, where);
}

function validateFavoriteRow(raw: unknown, i: number): FavoriteRow {
  const where = `data.favorite[${i}]`;
  if (!isPlainObject(raw)) throw new Error(`${where} 必须是对象`);
  return {
    entry_id: reqInt(raw.entry_id, `${where}.entry_id`),
    created_at: reqString(raw.created_at, `${where}.created_at`),
  };
}

function validateReviewCardRow(raw: unknown, i: number): ReviewCardRow {
  const where = `data.review_card[${i}]`;
  if (!isPlainObject(raw)) throw new Error(`${where} 必须是对象`);
  return {
    stable_id: reqString(raw.stable_id, `${where}.stable_id`),
    due: reqString(raw.due, `${where}.due`),
    stability: reqNumber(raw.stability, `${where}.stability`),
    difficulty: reqNumber(raw.difficulty, `${where}.difficulty`),
    elapsed_days: reqInt(raw.elapsed_days, `${where}.elapsed_days`),
    scheduled_days: reqInt(raw.scheduled_days, `${where}.scheduled_days`),
    learning_steps: reqInt(raw.learning_steps, `${where}.learning_steps`),
    reps: reqInt(raw.reps, `${where}.reps`),
    lapses: reqInt(raw.lapses, `${where}.lapses`),
    state: reqInt(raw.state, `${where}.state`),
    last_review: reqNullableString(raw.last_review, `${where}.last_review`),
    created_at: reqString(raw.created_at, `${where}.created_at`),
  };
}

function validateReviewLogRow(raw: unknown, i: number): ReviewLogRow {
  const where = `data.review_log[${i}]`;
  if (!isPlainObject(raw)) throw new Error(`${where} 必须是对象`);
  const kind = raw.kind === undefined ? 'review' : reqString(raw.kind, `${where}.kind`);
  if (kind !== 'review' && kind !== 'practice') {
    throw new Error(`${where}.kind 必须是 review 或 practice`);
  }
  return {
    stable_id: reqString(raw.stable_id, `${where}.stable_id`),
    rating: reqInt(raw.rating, `${where}.rating`),
    due_after: reqString(raw.due_after, `${where}.due_after`),
    reviewed_at: reqString(raw.reviewed_at, `${where}.reviewed_at`),
    kind,
  };
}

function validateDailyGoalRow(raw: unknown, i: number): DailyGoalRow {
  const where = `data.daily_goal[${i}]`;
  if (!isPlainObject(raw)) throw new Error(`${where} 必须是对象`);
  return {
    day: reqString(raw.day, `${where}.day`),
    target_count: reqInt(raw.target_count, `${where}.target_count`),
    completed_count: reqInt(raw.completed_count, `${where}.completed_count`),
  };
}

function validateSettingRow(raw: unknown, i: number): SettingRow {
  const where = `data.settings[${i}]`;
  if (!isPlainObject(raw)) throw new Error(`${where} 必须是对象`);
  return {
    key: reqString(raw.key, `${where}.key`),
    value: reqString(raw.value, `${where}.value`),
  };
}
