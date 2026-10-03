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

export function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
