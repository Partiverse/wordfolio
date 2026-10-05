import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';

import {
  gradesForMode,
  parseRatingMode,
  RATING_LABELS,
  RATING_MODES,
} from '../src/study/rating-core';

describe('parseRatingMode', () => {
  it('accepts both valid modes verbatim', () => {
    for (const m of RATING_MODES) {
      expect(parseRatingMode(m)).toBe(m);
    }
  });

  it('falls back to simple for missing values', () => {
    expect(parseRatingMode(null)).toBe('simple');
    expect(parseRatingMode(undefined)).toBe('simple');
    expect(parseRatingMode('')).toBe('simple');
  });

  it('falls back to simple for invalid or case-mismatched values', () => {
    expect(parseRatingMode('EXPERT')).toBe('simple');
    expect(parseRatingMode(' expert')).toBe('simple');
    expect(parseRatingMode('hard')).toBe('simple');
  });
});

describe('gradesForMode', () => {
  it('simple mode maps 认识→Good、模糊→Hard、忘记→Again', () => {
    expect(gradesForMode('simple')).toEqual([Rating.Good, Rating.Hard, Rating.Again]);
  });

  it('expert mode inserts Easy after Good, order 认识/简单/模糊/忘记', () => {
    expect(gradesForMode('expert')).toEqual([Rating.Good, Rating.Easy, Rating.Hard, Rating.Again]);
    expect(gradesForMode('expert')).toHaveLength(4);
  });

  it('button labels use the self-rating vocabulary', () => {
    expect(RATING_LABELS[Rating.Good]).toBe('认识');
    expect(RATING_LABELS[Rating.Easy]).toBe('简单');
    expect(RATING_LABELS[Rating.Hard]).toBe('模糊');
    expect(RATING_LABELS[Rating.Again]).toBe('忘记');
  });
});
