import { describe, expect, it } from 'vitest';

import { bucketHistory, computeStreak, todayKey } from '../src/study/stats-core';

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

describe('todayKey', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(todayKey(new Date('2026-09-29T23:59:59.000Z'))).toBe('2026-09-29');
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
