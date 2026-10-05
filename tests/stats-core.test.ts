import { describe, expect, it } from 'vitest';

import {
  aggregateTrend,
  bestStreak,
  bucketHistory,
  computeStreak,
  formatReviewTime,
  futureLoad,
  heatLevel,
  heatmapData,
  todayKey,
} from '../src/study/stats-core';

describe('computeStreak', () => {
  it('returns 0 with no history', () => {
    expect(computeStreak([], '2026-09-29')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-09-27', '2026-09-28', '2026-09-29'], '2026-09-29')).toBe(3);
  });

  it('still counts when today has not been studied yet (starts from yesterday)', () => {
    expect(computeStreak(['2026-09-27', '2026-09-28'], '2026-09-29')).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak(['2026-09-20', '2026-09-28', '2026-09-29'], '2026-09-29')).toBe(2);
  });

  it('returns 0 when the last study is more than a day ago', () => {
    expect(computeStreak(['2026-09-20', '2026-09-21'], '2026-09-29')).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(computeStreak(['2026-08-30', '2026-08-31', '2026-09-01'], '2026-09-01')).toBe(3);
  });
});

describe('bestStreak', () => {
  it('returns 0 with empty history', () => {
    expect(bestStreak([])).toBe(0);
  });

  it('returns 1 for a single day', () => {
    expect(bestStreak(['2026-09-29'])).toBe(1);
  });

  it('counts the full consecutive run across multiple days', () => {
    expect(bestStreak(['2026-09-27', '2026-09-28', '2026-09-29'])).toBe(3);
  });

  it('keeps the longest run when a gap splits the history', () => {
    expect(bestStreak(['2026-09-01', '2026-09-02', '2026-09-10', '2026-09-11', '2026-09-12'])).toBe(3);
  });

  it('handles month boundaries', () => {
    expect(bestStreak(['2026-08-30', '2026-08-31', '2026-09-01'])).toBe(3);
  });
});

describe('todayKey', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(todayKey(new Date('2026-09-29T23:59:59.000Z'))).toBe('2026-09-29');
  });
});

describe('formatReviewTime', () => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (isoUtc: string) => {
    const d = new Date(isoUtc);
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  it('parses SQLite UTC datetime and renders local MM-DD HH:mm', () => {
    expect(formatReviewTime('2026-10-04 03:05:00')).toBe(local('2026-10-04T03:05:00Z'));
  });

  it('drops seconds', () => {
    expect(formatReviewTime('2026-10-04 03:05:59')).toBe(local('2026-10-04T03:05:59Z'));
  });

  it('returns the input unchanged when it is not a valid datetime', () => {
    expect(formatReviewTime('not-a-time')).toBe('not-a-time');
  });
});

describe('bucketHistory', () => {
  it('pads missing days with zero and ends at today', () => {
    const out = bucketHistory([{ day: '2026-09-27', count: 5 }], 3, '2026-09-29');
    expect(out).toEqual([
      { day: '2026-09-27', count: 5 },
      { day: '2026-09-28', count: 0 },
      { day: '2026-09-29', count: 0 },
    ]);
  });

  it('handles a month boundary', () => {
    const out = bucketHistory([{ day: '2026-08-31', count: 2 }], 2, '2026-09-01');
    expect(out.map((r) => r.day)).toEqual(['2026-08-31', '2026-09-01']);
  });

  it('returns all-zero for no rows', () => {
    const out = bucketHistory([], 7, '2026-09-29');
    expect(out).toHaveLength(7);
    expect(out.every((r) => r.count === 0)).toBe(true);
  });

  it('ignores rows outside the window', () => {
    const out = bucketHistory([{ day: '2026-01-01', count: 9 }], 2, '2026-09-29');
    expect(out.map((r) => r.count)).toEqual([0, 0]);
  });
});

describe('futureLoad', () => {
  it('returns all-zero 7/30 day sequences for empty input', () => {
    const r = futureLoad([], '2026-10-05');
    expect(r.todayCount).toBe(0);
    expect(r.daily7).toEqual([
      { day: '2026-10-05', count: 0 },
      { day: '2026-10-06', count: 0 },
      { day: '2026-10-07', count: 0 },
      { day: '2026-10-08', count: 0 },
      { day: '2026-10-09', count: 0 },
      { day: '2026-10-10', count: 0 },
      { day: '2026-10-11', count: 0 },
    ]);
    expect(r.daily30).toHaveLength(30);
    expect(r.daily30.every((d) => d.count === 0)).toBe(true);
    expect(r.daily30[29].day).toBe('2026-11-03');
  });

  it('keeps the cross-midnight boundary: 23:59:59.999 vs next day 00:00:00', () => {
    const r = futureLoad(['2026-10-05T23:59:59.999Z', '2026-10-06T00:00:00.000Z'], '2026-10-05');
    expect(r.todayCount).toBe(1);
    expect(r.daily7[0]).toEqual({ day: '2026-10-05', count: 1 });
    expect(r.daily7[1]).toEqual({ day: '2026-10-06', count: 1 });
    expect(r.daily7[2].count).toBe(0);
  });

  it('clamps overdue dues into today (baseline = overdue + due today)', () => {
    const r = futureLoad(
      ['2026-10-01T00:00:00.000Z', '2026-10-04T12:00:00.000Z', '2026-10-05T08:00:00.000Z'],
      '2026-10-05',
    );
    expect(r.todayCount).toBe(3);
    expect(r.daily7[0]).toEqual({ day: '2026-10-05', count: 3 });
    expect(r.daily7[1].count).toBe(0);
  });

  it('respects the 7-day window edge: day 6 inside, day 7 only in the 30-day window', () => {
    const r = futureLoad(['2026-10-11T12:00:00.000Z', '2026-10-12T12:00:00.000Z'], '2026-10-05');
    expect(r.daily7[6]).toEqual({ day: '2026-10-11', count: 1 });
    expect(r.daily7.slice(0, 6).every((d) => d.count === 0)).toBe(true);
    expect(r.daily30[6]).toEqual({ day: '2026-10-11', count: 1 });
    expect(r.daily30[7]).toEqual({ day: '2026-10-12', count: 1 });
  });

  it('counts the last day of the 30-day window and ignores the day after', () => {
    const r = futureLoad(['2026-11-03T12:00:00.000Z', '2026-11-04T00:00:00.000Z'], '2026-10-05');
    expect(r.daily30[29]).toEqual({ day: '2026-11-03', count: 1 });
    expect(r.daily30.every((d, i) => (i === 29 ? d.count === 1 : d.count === 0))).toBe(true);
  });

  it('ignores dues beyond 30 days', () => {
    const r = futureLoad(['2026-11-20T00:00:00.000Z'], '2026-10-05');
    expect(r.todayCount).toBe(0);
    expect(r.daily30.every((d) => d.count === 0)).toBe(true);
  });

  it('handles a month boundary between today and the following days', () => {
    const r = futureLoad(['2026-10-31T23:00:00.000Z', '2026-11-01T01:00:00.000Z'], '2026-10-31');
    expect(r.daily7.map((d) => d.day)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
    expect(r.daily7[0].count).toBe(1);
    expect(r.daily7[1].count).toBe(1);
  });

  it('sums multiple dues falling on the same day', () => {
    const r = futureLoad(
      ['2026-10-06T01:00:00.000Z', '2026-10-06T09:00:00.000Z', '2026-10-06T23:00:00.000Z'],
      '2026-10-05',
    );
    expect(r.daily7[1]).toEqual({ day: '2026-10-06', count: 3 });
  });

  it('skips malformed timestamps instead of throwing', () => {
    const r = futureLoad(['not-a-date', '', '2026-10-06T00:00:00.000Z'], '2026-10-05');
    expect(r.todayCount).toBe(0);
    expect(r.daily7[1]).toEqual({ day: '2026-10-06', count: 1 });
  });
});

describe('heatLevel', () => {
  it('maps 0 to the colorless level', () => {
    expect(heatLevel(0)).toBe(0);
  });

  it('uses fixed thresholds 1-2 / 3-5 / 6-9 / 10+', () => {
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(1);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(5)).toBe(2);
    expect(heatLevel(6)).toBe(3);
    expect(heatLevel(9)).toBe(3);
    expect(heatLevel(10)).toBe(4);
    expect(heatLevel(500)).toBe(4);
  });
});

describe('heatmapData', () => {
  it('returns 365 zero days for empty input', () => {
    const r = heatmapData([], '2026-09-29');
    expect(r.days).toHaveLength(365);
    expect(r.days.every((d) => d.count === 0 && d.level === 0)).toBe(true);
    expect(r.days[364].day).toBe('2026-09-29');
    expect(r.days[0].day).toBe('2025-09-30');
  });

  it('builds week columns of exactly 7 cells padded with nulls, cells in weekday rows', () => {
    const r = heatmapData([], '2026-09-29');
    // 2025-09-30 是周二（getUTCDay=2），第一列前补 2 个 null
    expect(r.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(r.weeks[0][2]?.day).toBe('2025-09-30');
    expect(r.weeks[0]).toHaveLength(7);
    // 全部周列都是 7 格；非 null 格总数 = 365；最后一个非 null 格是今天
    const flat = r.weeks.flat();
    expect(flat.filter((c) => c !== null)).toHaveLength(365);
    expect(flat.filter((c) => c !== null).at(-1)?.day).toBe('2026-09-29');
    for (const week of r.weeks) expect(week).toHaveLength(7);
  });

  it('aggregates timestamps per day across both SQLite and ISO formats', () => {
    const r = heatmapData(
      [
        '2026-09-28 08:00:00', // SQLite datetime('now')，kind 无关（review+practice 由调用方合并传入）
        '2026-09-28 21:30:00',
        '2026-09-28T23:59:59.000Z',
        '2026-09-29T00:00:00.000Z',
      ],
      '2026-09-29',
    );
    expect(r.days[363]).toMatchObject({ day: '2026-09-28', count: 3, level: 2 });
    expect(r.days[364]).toMatchObject({ day: '2026-09-29', count: 1, level: 1 });
  });

  it('skips malformed timestamps instead of throwing', () => {
    const r = heatmapData(['not-a-date', '', '2026-13-99 10:00:00', '2026-09-29 09:00:00'], '2026-09-29');
    expect(r.days[364].count).toBe(1);
    expect(r.days.every((d) => d.count <= 1)).toBe(true);
  });

  it('cuts +08:00-offset ISO timestamps by their UTC instant, not the local prefix', () => {
    const r = heatmapData(['2026-09-29T07:00:00+08:00'], '2026-09-29');
    // 该时刻 = 2026-09-28T23:00Z，按 UTC 落 09-28
    expect(r.days[363]).toMatchObject({ day: '2026-09-28', count: 1, level: 1 });
    expect(r.days[364].count).toBe(0);
  });

  it('skips impossible calendar dates like Feb 30 instead of rolling them forward', () => {
    const r = heatmapData(['2026-02-30T10:00:00.000Z'], '2026-09-29');
    expect(r.days.find((d) => d.day === '2026-03-02')?.count).toBe(0);
    expect(r.days.every((d) => d.count === 0)).toBe(true);
  });

  it('covers leap day across a leap-year window', () => {
    const r = heatmapData(['2024-02-29 12:00:00'], '2024-03-01');
    expect(r.days[0].day).toBe('2023-03-03');
    expect(r.days).toHaveLength(365);
    const leap = r.days.find((d) => d.day === '2024-02-29');
    expect(leap).toMatchObject({ count: 1, level: 1 });
  });

  it('keeps counting across the year boundary', () => {
    const r = heatmapData(['2025-12-31 23:00:00', '2026-01-01 00:30:00'], '2026-01-05');
    expect(r.days[0].day).toBe('2025-01-06');
    expect(r.days.find((d) => d.day === '2025-12-31')?.count).toBe(1);
    expect(r.days.find((d) => d.day === '2026-01-01')?.count).toBe(1);
  });
});

describe('aggregateTrend', () => {
  it('groups an 8-day window by ISO week, zero-fills the empty week, Monday starts a new week', () => {
    const days = bucketHistory(
      [
        { day: '2026-09-28', count: 3 },
        { day: '2026-10-01', count: 5 },
      ],
      8,
      '2026-10-05',
    );
    const r = aggregateTrend(days, 'week');
    expect(r).toEqual([
      { label: '2026-W40', start: '2026-09-28', end: '2026-10-04', count: 8 },
      { label: '2026-W41', start: '2026-10-05', end: '2026-10-05', count: 0 },
    ]);
  });

  it('splits a window across a month boundary', () => {
    const days = bucketHistory([{ day: '2026-09-30', count: 2 }, { day: '2026-10-02', count: 7 }], 16, '2026-10-05');
    expect(aggregateTrend(days, 'month')).toEqual([
      { label: '2026-09', start: '2026-09-20', end: '2026-09-30', count: 2 },
      { label: '2026-10', start: '2026-10-01', end: '2026-10-05', count: 7 },
    ]);
  });

  it('keeps an ISO week together across the year boundary (2025-12-29 → 2026-W01)', () => {
    const r = aggregateTrend(
      [
        { day: '2025-12-28', count: 1 }, // 周日，属 2025-W52
        { day: '2025-12-29', count: 2 }, // 周一，开启 2026-W01
        { day: '2026-01-01', count: 4 },
      ],
      'week',
    );
    expect(r).toEqual([
      { label: '2025-W52', start: '2025-12-28', end: '2025-12-28', count: 1 },
      { label: '2026-W01', start: '2025-12-29', end: '2026-01-01', count: 6 },
    ]);
  });

  it('assigns a Friday Jan 1 to the previous ISO year (2021-01-01 → 2020-W53)', () => {
    // ISO 年可倒退：2021-01-01 是周五，本周四在 2020-12-31，故属 2020-W53
    const r = aggregateTrend(
      [
        { day: '2020-12-31', count: 1 },
        { day: '2021-01-01', count: 2 },
      ],
      'week',
    );
    expect(r).toEqual([
      { label: '2020-W53', start: '2020-12-31', end: '2021-01-01', count: 3 },
    ]);
  });

  it('splits months across the year boundary', () => {
    const r = aggregateTrend(
      [
        { day: '2025-12-30', count: 1 },
        { day: '2026-01-02', count: 3 },
      ],
      'month',
    );
    expect(r).toEqual([
      { label: '2025-12', start: '2025-12-30', end: '2025-12-30', count: 1 },
      { label: '2026-01', start: '2026-01-02', end: '2026-01-02', count: 3 },
    ]);
  });

  it('returns an empty series for empty input', () => {
    expect(aggregateTrend([], 'week')).toEqual([]);
    expect(aggregateTrend([], 'month')).toEqual([]);
  });

  it('maps a single day to one bucket with start = end', () => {
    expect(aggregateTrend([{ day: '2026-10-05', count: 9 }], 'week')).toEqual([
      { label: '2026-W41', start: '2026-10-05', end: '2026-10-05', count: 9 },
    ]);
    expect(aggregateTrend([{ day: '2026-10-05', count: 9 }], 'month')).toEqual([
      { label: '2026-10', start: '2026-10-05', end: '2026-10-05', count: 9 },
    ]);
  });
});
