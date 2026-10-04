import { describe, expect, it } from 'vitest';

import { pickPracticeRound, spreadByHeadword } from '../src/study/queue';

interface Card {
  stableId: string;
  headword: string;
}

const card = (headword: string, n: number): Card => ({ stableId: `${headword}#${n}`, headword });
const headwordOf = (c: Card) => c.headword;
const ids = (cards: Card[]) => cards.map((c) => c.stableId);

describe('spreadByHeadword', () => {
  it('passes through empty and single-card queues', () => {
    expect(spreadByHeadword([], headwordOf)).toEqual([]);
    expect(spreadByHeadword([card('a', 1)], headwordOf)).toEqual([card('a', 1)]);
  });

  it('separates consecutive senses of the same headword', () => {
    const input = [card('a', 1), card('a', 2), card('b', 1), card('c', 1)];
    expect(ids(spreadByHeadword(input, headwordOf))).toEqual(['a#1', 'b#1', 'a#2', 'c#1']);
  });

  it('keeps all cards exactly once', () => {
    const input = [card('a', 1), card('a', 2), card('a', 3), card('b', 1)];
    const out = spreadByHeadword(input, headwordOf);
    expect(out).toHaveLength(input.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(input)));
  });

  it('degrades gracefully when every card shares one headword', () => {
    const input = [card('run', 1), card('run', 2), card('run', 3)];
    expect(ids(spreadByHeadword(input, headwordOf))).toEqual(['run#1', 'run#2', 'run#3']);
  });
});

describe('pickPracticeRound', () => {
  const c = (i: number) => ({ stableId: `s${i}` });

  it('samples n distinct cards', () => {
    const cards = Array.from({ length: 20 }, (_, i) => c(i));
    const round = pickPracticeRound(cards, 10);
    expect(round).toHaveLength(10);
    expect(new Set(round.map((c2) => c2.stableId)).size).toBe(10);
  });

  it('returns all cards when pool is smaller than n', () => {
    const cards = [c(1), c(2)];
    expect(pickPracticeRound(cards, 10)).toHaveLength(2);
  });

  it('returns empty for empty pool or zero n', () => {
    expect(pickPracticeRound([], 10)).toEqual([]);
    expect(pickPracticeRound([c(1)], 0)).toEqual([]);
  });

  it('draws different rounds over many trials (random sampling works)', () => {
    const cards = Array.from({ length: 30 }, (_, i) => c(i));
    const firsts = new Set(Array.from({ length: 40 }, () => pickPracticeRound(cards, 1)[0].stableId));
    expect(firsts.size).toBeGreaterThan(1);
  });
});
