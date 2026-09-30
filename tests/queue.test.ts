import { describe, expect, it } from 'vitest';

import { spreadByHeadword } from '../src/study/queue';

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
