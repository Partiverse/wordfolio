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
