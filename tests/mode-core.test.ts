import { describe, expect, it } from 'vitest';

import { STUDY_MODES, parseStudyMode } from '../src/study/mode-core';

describe('parseStudyMode', () => {
  it('accepts all four valid modes verbatim', () => {
    for (const m of STUDY_MODES) {
      expect(parseStudyMode(m)).toBe(m);
    }
  });

  it('falls back to flip for missing values', () => {
    expect(parseStudyMode(null)).toBe('flip');
    expect(parseStudyMode(undefined)).toBe('flip');
    expect(parseStudyMode('')).toBe('flip');
  });

  it('falls back to flip for invalid or case-mismatched values', () => {
    expect(parseStudyMode('quiz')).toBe('flip');
    expect(parseStudyMode('review')).toBe('flip');
    expect(parseStudyMode('FLIP')).toBe('flip');
    expect(parseStudyMode(' flip')).toBe('flip');
  });
});
