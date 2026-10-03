import { describe, expect, it } from 'vitest';

import {
  buildFtsMatch,
  buildLikePattern,
  escapeLike,
  hasCjk,
  isTooShort,
  matchRank,
  shouldUseLikeFallback,
} from '../src/db/search';

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

// 内测反馈「搜索太宽泛」后的收紧规则
describe('isTooShort', () => {
  it('rejects single latin letters (FTS prefix would match thousands)', () => {
    expect(isTooShort('a')).toBe(true);
    expect(isTooShort(' r ')).toBe(true);
  });

  it('accepts 2+ latin letters', () => {
    expect(isTooShort('ru')).toBe(false);
    expect(isTooShort('run')).toBe(false);
  });

  it('accepts single CJK char (走 is a meaningful query)', () => {
    expect(isTooShort('走')).toBe(false);
  });

  it('rejects empty and whitespace', () => {
    expect(isTooShort('')).toBe(true);
    expect(isTooShort('   ')).toBe(true);
  });
});

describe('matchRank', () => {
  it('ranks exact headword first, then prefix, then definition hits', () => {
    expect(matchRank('run', 'run')).toBe(0);
    expect(matchRank('run', 'Run')).toBe(0);
    expect(matchRank('running', 'run')).toBe(1);
    expect(matchRank('rerun', 'run')).toBe(2);
  });
});
