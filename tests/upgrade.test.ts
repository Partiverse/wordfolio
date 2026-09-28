import { describe, expect, it } from 'vitest';

import { resolveBootstrapAction } from '../src/db/upgrade';

describe('resolveBootstrapAction', () => {
  it('copies when sandbox has no db', () => {
    expect(resolveBootstrapAction(null, 'v0.1-m1')).toBe('copy');
  });

  it('recopies when sandbox edition is behind or divergent', () => {
    expect(resolveBootstrapAction('v0.1-m1', 'v0.2-m2')).toBe('recopy');
    expect(resolveBootstrapAction('v0.2-rc', 'v0.2-m2')).toBe('recopy');
  });

  it('reuses when editions match', () => {
    expect(resolveBootstrapAction('v0.1-m1', 'v0.1-m1')).toBe('reuse');
  });
});
