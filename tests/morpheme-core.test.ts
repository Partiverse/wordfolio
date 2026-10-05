import { describe, expect, it } from 'vitest';

import { morphemeDisplayOrder, morphemeKindZh, sortMorphemes } from '../src/db/morpheme-core';

describe('morphemeKindZh', () => {
  it('maps the three kinds to Chinese labels', () => {
    expect(morphemeKindZh('root')).toBe('词根');
    expect(morphemeKindZh('prefix')).toBe('前缀');
    expect(morphemeKindZh('suffix')).toBe('后缀');
  });

  it('falls back to the raw kind for unknown values', () => {
    expect(morphemeKindZh('combining')).toBe('combining');
    expect(morphemeKindZh('')).toBe('');
  });
});

describe('morphemeDisplayOrder', () => {
  it('orders prefix before root before suffix', () => {
    expect(morphemeDisplayOrder('prefix')).toBeLessThan(morphemeDisplayOrder('root'));
    expect(morphemeDisplayOrder('root')).toBeLessThan(morphemeDisplayOrder('suffix'));
  });

  it('sorts unknown kinds last', () => {
    expect(morphemeDisplayOrder('weird')).toBeGreaterThan(morphemeDisplayOrder('suffix'));
  });
});

describe('sortMorphemes', () => {
  it('orders prefix, root, suffix and breaks ties alphabetically', () => {
    const sorted = sortMorphemes([
      { morpheme: 'spect', kind: 'root' },
      { morpheme: 're', kind: 'prefix' },
      { morpheme: 'ion', kind: 'suffix' },
      { morpheme: 'pre', kind: 'prefix' },
    ]);
    expect(sorted.map((m) => m.morpheme)).toEqual(['pre', 're', 'spect', 'ion']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { morpheme: 'ion', kind: 'suffix' },
      { morpheme: 're', kind: 'prefix' },
    ];
    const copy = [...input];
    sortMorphemes(input);
    expect(input).toEqual(copy);
  });

  it('keeps unknown kinds at the end', () => {
    const sorted = sortMorphemes([
      { morpheme: 'x', kind: 'weird' },
      { morpheme: 'a', kind: 'root' },
    ]);
    expect(sorted.map((m) => m.morpheme)).toEqual(['a', 'x']);
  });
});
