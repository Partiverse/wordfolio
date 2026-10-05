import { describe, expect, it } from 'vitest';

import {
  NEW_CARD_ORDER_KEY,
  NEW_CARD_ORDERS,
  orderNewCards,
  parseNewCardOrder,
  type NewCardCandidate,
} from '../src/study/order-core';

const c = (stableId: string, entryId: number, freqRank: number | null): NewCardCandidate => ({
  stableId,
  entryId,
  freqRank,
});

const alpha = [c('a', 1, 1), c('b', 2, 2), c('c', 3, 3), c('d', 4, 4)];

describe('parseNewCardOrder', () => {
  it('falls back to freq for missing/invalid values', () => {
    expect(parseNewCardOrder(null)).toBe('freq');
    expect(parseNewCardOrder(undefined)).toBe('freq');
    expect(parseNewCardOrder('')).toBe('freq');
    expect(parseNewCardOrder('Freq')).toBe('freq'); // 大小写不符回退
    expect(parseNewCardOrder('favorite')).toBe('freq');
  });

  it('accepts every valid order value', () => {
    for (const order of NEW_CARD_ORDERS) {
      expect(parseNewCardOrder(order)).toBe(order);
    }
  });

  it('uses the ratingMode-style settings key', () => {
    expect(NEW_CARD_ORDER_KEY).toBe('newCardOrder');
  });
});

describe('orderNewCards', () => {
  it('freq sorts ascending by freq_rank with null last, keeping ties in input order', () => {
    const input = [c('late', 9, null), c('m', 7, 30), c('a', 1, 10), c('b', 2, 10), c('z', 5, 2)];
    expect(orderNewCards(input, 'freq', new Set()).map((x) => x.stableId)).toEqual([
      'z',
      'a',
      'b',
      'm',
      'late',
    ]);
  });

  it('freq on empty input stays empty', () => {
    expect(orderNewCards([], 'freq', new Set())).toEqual([]);
  });

  it('random is deterministic for a fixed rng', () => {
    // rng 恒 0：每步 j=0，Fisher–Yates 依次把当前末位换到首位 → [b,c,d,a]
    expect(orderNewCards(alpha, 'random', new Set(), () => 0).map((x) => x.stableId)).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
  });

  it('random returns a permutation of the input and reacts to the rng', () => {
    const first = orderNewCards(alpha, 'random', new Set(), () => 0.5).map((x) => x.stableId);
    expect([...first].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(first).not.toEqual(orderNewCards(alpha, 'random', new Set(), () => 0).map((x) => x.stableId));
  });

  it('random on empty input stays empty', () => {
    expect(orderNewCards([], 'random', new Set(), () => 0)).toEqual([]);
  });

  it('favoriteFirst puts favorited entries first (group keeps freq order), others follow by freq', () => {
    const input = [c('a', 1, 1), c('b', 2, 2), c('c', 3, 3), c('d', 4, null)];
    const favs = new Set([3, 4]);
    expect(orderNewCards(input, 'favoriteFirst', favs).map((x) => x.stableId)).toEqual([
      'c',
      'd',
      'a',
      'b',
    ]);
  });

  it('favoriteFirst with no favorites equals freq order', () => {
    const input = [c('b', 2, 2), c('a', 1, 1)];
    expect(orderNewCards(input, 'favoriteFirst', new Set()).map((x) => x.stableId)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [c('b', 2, 2), c('a', 1, 1)];
    orderNewCards(input, 'freq', new Set());
    orderNewCards(input, 'random', new Set(), () => 0);
    orderNewCards(input, 'favoriteFirst', new Set([1]));
    expect(input.map((x) => x.stableId)).toEqual(['b', 'a']);
  });
});
