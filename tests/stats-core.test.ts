import { describe, expect, it } from 'vitest';

import { bestStreak, bucketHistory, computeStreak, formatReviewTime, futureLoad, todayKey } from '../src/study/stats-core';

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
