import { describe, expect, it } from 'vitest';
import { Rating, State } from 'ts-fsrs';

import {
  buildTodayQueue,
  fromStored,
  gradeCard,
  GRADES,
  isDue,
  newCard,
  queueProgress,
  sortForQueue,
  toStored,
  type StoredCard,
} from '../src/study/fsrs-core';

const NOW = new Date('2026-09-29T09:00:00.000Z');

describe('newCard', () => {
  it('creates a New-state card due immediately', () => {
    const card = newCard('s1', NOW);
    expect(card.stableId).toBe('s1');
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(isDue(card, NOW)).toBe(true);
  });
});

describe('gradeCard', () => {
  it('increments reps and schedules a future due date', () => {
    const graded = gradeCard(newCard('s1', NOW), Rating.Good, NOW);
    expect(graded.reps).toBe(1);
    expect(new Date(graded.due).getTime()).toBeGreaterThan(NOW.getTime());
    expect(graded.lastReview).toBe(NOW.toISOString());
  });

  it('pushes Easy further out than Again', () => {
    const base = newCard('s1', NOW);
    const again = gradeCard(base, Rating.Again, NOW);
    const easy = gradeCard(base, Rating.Easy, NOW);
    expect(new Date(easy.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
  });

  it('round-trips through toStored/fromStored without drift', () => {
    const graded = gradeCard(newCard('s1', NOW), Rating.Good, NOW);
    expect(toStored('s1', fromStored(graded))).toEqual(graded);
  });
});

describe('isDue', () => {
  const due = (iso: string): StoredCard => ({ ...newCard('s', NOW), state: State.Review, due: iso });

  it('is due at or before now', () => {
    expect(isDue(due('2026-09-29T08:59:00.000Z'), NOW)).toBe(true);
    expect(isDue(due('2026-09-29T09:00:00.000Z'), NOW)).toBe(true);
  });

  it('is not due in the future', () => {
    expect(isDue(due('2026-09-30T09:00:00.000Z'), NOW)).toBe(false);
  });

  it('treats New cards as always due', () => {
    expect(isDue(newCard('s', NOW), NOW)).toBe(true);
  });
});

describe('sortForQueue', () => {
  it('puts review cards before new cards, earliest due first, stable within ties', () => {
    const review1 = { ...newCard('b', NOW), state: State.Review, due: '2026-09-28T10:00:00.000Z' };
    const review2 = { ...newCard('a', NOW), state: State.Review, due: '2026-09-28T10:00:00.000Z' };
    const fresh = newCard('z', NOW);
    const sorted = sortForQueue([fresh, review2, review1]);
    expect(sorted.map((c) => c.stableId)).toEqual(['a', 'b', 'z']);
  });
});

describe('buildTodayQueue', () => {
  const review = (id: string, due: string): StoredCard => ({ ...newCard(id, NOW), state: State.Review, due });

  it('keeps only due review cards and respects the review limit', () => {
    const cards = [
      review('due-1', '2026-09-28T10:00:00.000Z'),
      review('due-2', '2026-09-28T11:00:00.000Z'),
      review('future', '2026-10-10T10:00:00.000Z'),
    ];
    expect(buildTodayQueue(cards, 10, 0, NOW).map((c) => c.stableId)).toEqual(['due-1', 'due-2']);
    expect(buildTodayQueue(cards, 1, 0, NOW).map((c) => c.stableId)).toEqual(['due-1']);
  });

  it('caps due review cards by reviewLimit and new cards by newLimit, reviews first', () => {
    const cards = [
      review('due-1', '2026-09-28T10:00:00.000Z'),
      review('due-2', '2026-09-28T11:00:00.000Z'),
      review('due-3', '2026-09-28T12:00:00.000Z'),
      newCard('new-a', NOW),
      newCard('new-b', NOW),
    ];
    const queue = buildTodayQueue(cards, 2, 1, NOW);
    expect(queue.map((c) => c.stableId)).toEqual(['due-1', 'due-2', 'new-a']);
    // 新学上限为 0 时只出复习卡
    expect(buildTodayQueue(cards, 10, 0, NOW).map((c) => c.stableId)).toEqual(['due-1', 'due-2', 'due-3']);
    // 复习上限为 0 时只出新卡
    expect(buildTodayQueue(cards, 0, 10, NOW).map((c) => c.stableId)).toEqual(['new-a', 'new-b']);
  });

  it('returns empty for non-positive limits', () => {
    expect(buildTodayQueue([newCard('s', NOW)], 0, 0, NOW)).toEqual([]);
  });
});

describe('queueProgress', () => {
  it('clamps to 0..1 and guards total<=0', () => {
    expect(queueProgress(0, 0)).toBe(0);
    expect(queueProgress(5, 0)).toBe(0);
    expect(queueProgress(5, 10)).toBe(0.5);
    expect(queueProgress(20, 10)).toBe(1);
  });
});

describe('GRADES', () => {
  it('exposes the four rating buttons in order', () => {
    expect(GRADES).toEqual([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]);
  });
});
