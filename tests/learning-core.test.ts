import { describe, expect, it } from 'vitest';

import { applyToggle, isFavorited } from '../src/db/learning-core';

describe('applyToggle', () => {
  it('appends when not favorited, preserving order', () => {
    expect(applyToggle([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it('removes when already favorited, preserving remaining order', () => {
    expect(applyToggle([5, 2, 9], 2)).toEqual([5, 9]);
  });

  it('does not mutate the input array', () => {
    const ids = [1, 2];
    applyToggle(ids, 3);
    applyToggle(ids, 1);
    expect(ids).toEqual([1, 2]);
  });

  it('is toggle-stable (double toggle returns to original)', () => {
    const once = applyToggle([4], 7);
    expect(applyToggle(once, 7)).toEqual([4]);
  });
});

describe('isFavorited', () => {
  it('finds ids', () => {
    expect(isFavorited([1, 42], 42)).toBe(true);
    expect(isFavorited([1, 42], 7)).toBe(false);
    expect(isFavorited([], 1)).toBe(false);
  });
});
