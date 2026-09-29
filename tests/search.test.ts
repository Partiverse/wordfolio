import { describe, expect, it } from 'vitest';

import { buildFtsMatch, buildLikePattern, escapeLike, hasCjk, shouldUseLikeFallback } from '../src/db/search';

describe('hasCjk', () => {
  it('detects CJK ideographs', () => {
    expect(hasCjk('走')).toBe(true);
    expect(hasCjk('跑')).toBe(true);
  });

  it('detects CJK in mixed queries', () => {
    expect(hasCjk('run 跑')).toBe(true);
  });

  it('returns false for latin and punctuation', () => {
    expect(hasCjk('run')).toBe(false);
    expect(hasCjk("don't 123")).toBe(false);
    expect(hasCjk('')).toBe(false);
  });
});

describe('shouldUseLikeFallback', () => {
  it('falls back to LIKE for any CJK-containing query', () => {
    expect(shouldUseLikeFallback('走')).toBe(true);
    expect(shouldUseLikeFallback('run 跑')).toBe(true);
  });

  it('uses FTS for latin queries', () => {
    expect(shouldUseLikeFallback('run')).toBe(false);
    expect(shouldUseLikeFallback('  apple ')).toBe(false);
  });
});

describe('buildFtsMatch', () => {
  it('wraps latin query as quoted prefix', () => {
    expect(buildFtsMatch('run')).toBe('"run"*');
    expect(buildFtsMatch('  run ')).toBe('"run"*');
  });

  it('wraps CJK query as exact phrase', () => {
    expect(buildFtsMatch('走')).toBe('"走"');
  });
});

describe('escapeLike / buildLikePattern', () => {
  it('escapes LIKE wildcards with backslash', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('builds escaped contains-pattern', () => {
    expect(buildLikePattern('走')).toBe('%走%');
    expect(buildLikePattern('100%')).toBe('%100\\%%');
  });
});
