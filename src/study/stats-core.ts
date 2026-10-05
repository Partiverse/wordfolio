// 统计纯逻辑：连续天数等派生计算（无 RN / SQLite 依赖，供 vitest 覆盖）。

/** 有学习记录的天序列（升序，YYYY-MM-DD）→ 从今天（或最近一次学习日）往回数的连续天数。 */
export function computeStreak(activeDays: readonly string[], today: string): number {
  if (activeDays.length === 0) return 0;
  const set = new Set(activeDays);
  // 允许「今天还没学」：从昨天开始算，连续不断
  let cursor = set.has(today) ? today : previousDay(today);
  if (!set.has(cursor)) return 0;

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 历史最长连续学习天数（全史纪录，区别于 computeStreak 的「当前连续」）。入参无需有序、可含重复。 */
export function bestStreak(activeDays: readonly string[]): number {
  const days = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && nextDay(prev) === day ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

export function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * SQLite datetime('now') 存的是 UTC「YYYY-MM-DD HH:MM:SS」，
 * 按本地时区渲染成「MM-DD HH:mm」（复习历史明细用）；解析失败原样返回。
 */
export function formatReviewTime(utc: string): string {
  const d = new Date(`${utc.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return utc;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 未来复习压力逐日桶（F3）。 */
export interface LoadDay {
  day: string; // YYYY-MM-DD（UTC，与 review_card.due 的 ISO 时间戳同轨）
  count: number;
}

export interface FutureLoadResult {
  /** 基准线：今日到期量（due ≤ 今天的全部排期卡，含历史逾期与未学新卡）。 */
  todayCount: number;
  /** 未来 7 天逐日到期量，含今日、升序；首日 = todayCount。 */
  daily7: LoadDay[];
  /** 未来 30 天逐日到期量，含今日、升序；首日 = todayCount。 */
  daily30: LoadDay[];
}

/**
 * 复习压力预测（F3）：输入 review_card.due（ISO 8601）集合与今天（YYYY-MM-DD），
 * 输出未来 7/30 天逐日到期量。逾期卡（due 在今天之前）与未学新卡（due=建卡时刻，
 * 已成过去）都压进今日桶——它们和今日到期一样占用今天的队列（同 isDue 语义）；
 * 超出 30 天的忽略；无法解析的时间戳跳过。日期一律按 UTC 切日，与 todayKey /
 * bucketHistory 的现有约定一致。
 */
export function futureLoad(dueTimes: readonly string[], today: string): FutureLoadResult {
  let overdue = 0;
  const buckets = new Map<string, number>();
  for (const due of dueTimes) {
    const ms = Date.parse(due);
    if (Number.isNaN(ms)) continue;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (day < today) overdue += 1;
    else buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  const base = new Date(`${today}T00:00:00.000Z`);
  const seq = (days: number): LoadDay[] => {
    const out: LoadDay[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        day: key,
        count: i === 0 ? overdue + (buckets.get(key) ?? 0) : (buckets.get(key) ?? 0),
      });
    }
    return out;
  };
  return {
    todayCount: overdue + (buckets.get(today) ?? 0),
    daily7: seq(7),
    daily30: seq(30),
  };
}

/* ---------- 学习热力图（F4） ---------- */

/** 热力图单日格：count=当日打卡次数（review + practice 两类都计），level=颜色五档 0–4（0 无色）。 */
export interface HeatmapDay {
  day: string; // YYYY-MM-DD（UTC，与 review_log 的 datetime('now') 切日同轨）
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapResult {
  /** 近 365 天逐日（升序，末日=今天），无记录的日子补 0。 */
  days: HeatmapDay[];
  /** 按周分列：每列固定 7 格（行序=周日→周六），窗口外的首尾位置补 null，供 GitHub 式网格直渲染。 */
  weeks: (HeatmapDay | null)[][];
}

/** 次数 → 五档色阶：0 无色；1–2 / 3–5 / 6–9 / ≥10 四档递深。 */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** 日历有效性：Date.parse 会把 2 月 30 日静默回卷到 3 月，先显式校验月/日再解析。 */
function isValidYmd(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12) return false;
  return d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/**
 * 学习热力图（F4）：输入 review_log 时间戳列表（SQLite「YYYY-MM-DD HH:MM:SS」UTC 或 ISO 8601，
 * kind 两类都算打卡，由调用方一并传入）与今天（YYYY-MM-DD），输出近 365 天（含今天）逐日计数
 * 与按周分列的渲染结构。日期一律按 UTC 切日（同 todayKey / bucketHistory / getReviewHistory 的
 * substr(reviewed_at,1,10) 约定）；无法解析的时间戳跳过；时间戳顺序任意、可重复。
 */
export function heatmapData(timestamps: readonly string[], today: string): HeatmapResult {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m || !isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]))) continue;
    let day = m[0];
    if (ts.includes('T')) {
      // ISO 8601 整串按 UTC 切日：带偏移的戳先归一到 UTC（无时区后缀视为 UTC），
      // 不能按字符串前缀切，否则 +08:00 的「本地次日」会错落一天
      const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`;
      const ms = Date.parse(normalized);
      if (Number.isNaN(ms)) continue;
      day = new Date(ms).toISOString().slice(0, 10);
    }
    // 无 T：SQLite datetime('now') 格式，日期部分即 UTC 日
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const base = new Date(`${today}T00:00:00.000Z`);
  const days: HeatmapDay[] = [];
  for (let i = 365 - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    days.push({ day: key, count, level: heatLevel(count) });
  }

  // 首格对齐星期：起始日是周几，就在第一列前面补几个 null（0=周日）
  const lead = new Date(`${days[0].day}T00:00:00.000Z`).getUTCDay();
  const weeks: (HeatmapDay | null)[][] = [];
  let column: (HeatmapDay | null)[] = new Array(lead).fill(null);
  for (const d of days) {
    column.push(d);
    if (column.length === 7) {
      weeks.push(column);
      column = [];
    }
  }
  if (column.length > 0) {
    while (column.length < 7) column.push(null);
    weeks.push(column);
  }
  return { days, weeks };
}

/**
 * 把稀疏的逐日计数补成连续 N 天序列（今天在最后）：缺记录的日子补 0，
 * 便于统计页画 7 日柱状图。
 */
export function bucketHistory(
  rows: readonly { day: string; count: number }[],
  days: number,
  today: string,
): { day: string; count: number }[] {
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  const base = new Date(`${today}T00:00:00.000Z`);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}
