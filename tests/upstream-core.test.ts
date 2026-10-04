import { describe, expect, it } from 'vitest';

import { shouldShowBlankExercise, shouldShowCefrFilter } from '../src/study/upstream-core';

describe('shouldShowCefrFilter', () => {
  it('shows the CEFR chips only when the release has cefr data', () => {
    expect(shouldShowCefrFilter(true)).toBe(true);
    expect(shouldShowCefrFilter(false)).toBe(false);
  });
});

describe('shouldShowBlankExercise', () => {
  it('shows the blank-exercise entry only with both example and cefr data', () => {
    expect(shouldShowBlankExercise(true, true)).toBe(true);
  });

  it('hides the entry when either upstream data source is missing', () => {
    expect(shouldShowBlankExercise(false, false)).toBe(false);
    expect(shouldShowBlankExercise(true, false)).toBe(false);
    expect(shouldShowBlankExercise(false, true)).toBe(false);
  });

  it('stays hidden for the current v0.1-m1 release (no examples, no cefr)', () => {
    // 回归锚点：v0.1-m1 两项探测均为 false，chips 区必须与无骨架时一致
    expect(shouldShowBlankExercise(false, false)).toBe(false);
    expect(shouldShowCefrFilter(false)).toBe(false);
  });
});
