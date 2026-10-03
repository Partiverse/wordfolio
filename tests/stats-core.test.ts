import { describe, expect, it } from 'vitest';

import { computeStreak, todayKey } from '../src/study/stats-core';

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
