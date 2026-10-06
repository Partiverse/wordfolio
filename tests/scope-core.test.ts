import { describe, expect, it } from 'vitest';

import {
  PRACTICE_CEFR_KEY,
  PRACTICE_CEFR_LEVELS,
  PRACTICE_SCOPE_KEY,
  PRACTICE_SCOPES,
  parsePracticeCefr,
  parsePracticeScope,
} from '../src/study/scope-core';

describe('parsePracticeScope', () => {
  it('falls back to all for missing/invalid values', () => {
    expect(parsePracticeScope(null)).toBe('all');
    expect(parsePracticeScope(undefined)).toBe('all');
    expect(parsePracticeScope('')).toBe('all');
    expect(parsePracticeScope('All')).toBe('all'); // 大小写不符回退
    expect(parsePracticeScope('favorite')).toBe('all');
    expect(parsePracticeScope('exam ')).toBe('all');
  });

  it('accepts every valid scope value', () => {
    for (const scope of PRACTICE_SCOPES) {
      expect(parsePracticeScope(scope)).toBe(scope);
    }
  });

  it('uses the order-core-style settings keys', () => {
    expect(PRACTICE_SCOPE_KEY).toBe('practiceScope');
    expect(PRACTICE_CEFR_KEY).toBe('practiceCefr');
  });
});

describe('parsePracticeCefr', () => {
  it('falls back to A1 for missing/invalid values', () => {
    expect(parsePracticeCefr(null)).toBe('A1');
    expect(parsePracticeCefr(undefined)).toBe('A1');
    expect(parsePracticeCefr('')).toBe('A1');
    expect(parsePracticeCefr('a1')).toBe('A1'); // 大小写不符回退
    expect(parsePracticeCefr('B3')).toBe('A1');
    expect(parsePracticeCefr('C2')).toBe('A1'); // schema 合法但当前发布物无数据的档，仍按无效回退
  });

  it('accepts every rendered level', () => {
    for (const level of PRACTICE_CEFR_LEVELS) {
      expect(parsePracticeCefr(level)).toBe(level);
    }
    expect(PRACTICE_CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });
});
