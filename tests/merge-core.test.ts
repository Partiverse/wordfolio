import { describe, expect, it } from 'vitest';

import { parseBackup, planMerge, type BackupPayload } from '../src/study/merge-core';

function samplePayload(): BackupPayload {
  return {
    exportedAt: '2026-10-04T08:00:00.000Z',
    edition: 'v0.1-m1',
    data: {
      favorite: [{ entry_id: 42, created_at: '2026-10-01 10:00:00' }],
      review_card: [
        {
          stable_id: 'word#1',
          due: '2026-10-05 08:00:00',
          stability: 3.5,
          difficulty: 4.2,
          elapsed_days: 1,
          scheduled_days: 3,
          learning_steps: 0,
          reps: 2,
          lapses: 0,
          state: 2,
          last_review: '2026-10-02 08:00:00',
          created_at: '2026-10-01 08:00:00',
        },
      ],
      review_log: [
        {
          stable_id: 'word#1',
          rating: 3,
          due_after: '2026-10-05 08:00:00',
          reviewed_at: '2026-10-02 08:00:00',
          kind: 'review',
        },
      ],
      daily_goal: [{ day: '2026-10-02', target_count: 20, completed_count: 5 }],
      settings: [{ key: 'reminder_hour', value: '8' }],
    },
  };
}

describe('parseBackup', () => {
  it('round-trips a valid payload (JSON.stringify → parse)', () => {
    const payload = samplePayload();
    expect(parseBackup(JSON.stringify(payload))).toEqual(payload);
  });

  it('accepts all-empty tables', () => {
    const payload = samplePayload();
    payload.data = { favorite: [], review_card: [], review_log: [], daily_goal: [], settings: [] };
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.data.favorite).toEqual([]);
    expect(parsed.data.settings).toEqual([]);
  });

  it('throws on malformed JSON, and the caller can catch it', () => {
    let caught: unknown;
    try {
      parseBackup('{not-json');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('JSON');
  });

  it('throws when a table is missing', () => {
    const raw = JSON.stringify({ exportedAt: 'x', edition: 'v0.1-m1', data: {} });
    expect(() => parseBackup(raw)).toThrow(/data\.favorite/);
  });

  it('throws when the root is not an object', () => {
    expect(() => parseBackup('[]')).toThrow(/根节点/);
    expect(() => parseBackup('null')).toThrow(/根节点/);
    expect(() => parseBackup('42')).toThrow(/根节点/);
  });

  it('throws when a row key field has the wrong type', () => {
    const payload = samplePayload();
    (payload.data.favorite[0] as { entry_id: unknown }).entry_id = '42';
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(/favorite\[0\]\.entry_id/);
  });

  it('throws when review_log.kind is unknown', () => {
    const payload = samplePayload();
    (payload.data.review_log[0] as { kind: unknown }).kind = 'quiz';
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(/kind/);
  });
});

describe('planMerge', () => {
  it('returns everything to write when the table is empty (no existing keys)', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const plan = planMerge(rows, new Set<number>(), (r) => r.id);
    expect(plan.toWrite).toEqual(rows);
    expect(plan.skipped).toBe(0);
  });

  it('returns nothing to write on empty incoming', () => {
    const plan = planMerge([], new Set([1, 2]), (id: number) => id);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toBe(0);
  });

  it('skips everything on full conflict', () => {
    const rows = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }];
    const plan = planMerge(rows, new Set([1, 2]), (r) => r.id);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toBe(2);
  });

  it('splits on partial conflict, preserving incoming order', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const plan = planMerge(rows, new Set([2]), (r) => r.id);
    expect(plan.toWrite).toEqual([{ id: 1 }, { id: 3 }]);
    expect(plan.skipped).toBe(1);
  });

  it('does not mutate the incoming array', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    planMerge(rows, new Set([1]), (r) => r.id);
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('works with string keys (settings / daily_goal / review_card)', () => {
    const rows = [{ key: 'a' }, { key: 'b' }];
    const plan = planMerge(rows, new Set(['a']), (r) => r.key);
    expect(plan.toWrite).toEqual([{ key: 'b' }]);
    expect(plan.skipped).toBe(1);
  });
});
