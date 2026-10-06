import { describe, expect, it } from 'vitest';

import { filterPracticeScope, pickPracticeRound, retryWrong, spreadByHeadword } from '../src/study/queue';

interface Card {
  stableId: string;
  headword: string;
}

const card = (headword: string, n: number): Card => ({ stableId: `${headword}#${n}`, headword });
const headwordOf = (c: Card) => c.headword;
const ids = (cards: Card[]) => cards.map((c) => c.stableId);

describe('spreadByHeadword', () => {
  it('passes through empty and single-card queues', () => {
    expect(spreadByHeadword([], headwordOf)).toEqual([]);
    expect(spreadByHeadword([card('a', 1)], headwordOf)).toEqual([card('a', 1)]);
  });

  it('separates consecutive senses of the same headword', () => {
    const input = [card('a', 1), card('a', 2), card('b', 1), card('c', 1)];
    expect(ids(spreadByHeadword(input, headwordOf))).toEqual(['a#1', 'b#1', 'a#2', 'c#1']);
  });

  it('keeps all cards exactly once', () => {
    const input = [card('a', 1), card('a', 2), card('a', 3), card('b', 1)];
    const out = spreadByHeadword(input, headwordOf);
    expect(out).toHaveLength(input.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(input)));
  });

  it('degrades gracefully when every card shares one headword', () => {
    const input = [card('run', 1), card('run', 2), card('run', 3)];
    expect(ids(spreadByHeadword(input, headwordOf))).toEqual(['run#1', 'run#2', 'run#3']);
  });
});

describe('pickPracticeRound', () => {
  const c = (i: number) => ({ stableId: `s${i}` });

  it('samples n distinct cards', () => {
    const cards = Array.from({ length: 20 }, (_, i) => c(i));
    const round = pickPracticeRound(cards, 10);
    expect(round).toHaveLength(10);
    expect(new Set(round.map((c2) => c2.stableId)).size).toBe(10);
  });

  it('returns all cards when pool is smaller than n', () => {
    const cards = [c(1), c(2)];
    expect(pickPracticeRound(cards, 10)).toHaveLength(2);
  });

  it('returns empty for empty pool or zero n', () => {
    expect(pickPracticeRound([], 10)).toEqual([]);
    expect(pickPracticeRound([c(1)], 0)).toEqual([]);
  });

  it('draws different rounds over many trials (random sampling works)', () => {
    const cards = Array.from({ length: 30 }, (_, i) => c(i));
    const firsts = new Set(Array.from({ length: 40 }, () => pickPracticeRound(cards, 1)[0].stableId));
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe('filterPracticeScope', () => {
  const card = (id: string) => ({ stableId: id, headword: id.split('#')[0] });
  const pool = [card('a#1'), card('b#1'), card('a#2'), card('c#1')];

  it('passes through the whole pool (copy) when scope set is null/undefined', () => {
    expect(filterPracticeScope(pool, null)).toEqual(pool);
    expect(filterPracticeScope(pool, undefined)).toEqual(pool);
    expect(filterPracticeScope(pool, null)).not.toBe(pool); // 不复用入参数组
  });

  it('keeps only cards whose stableId is in the scope set, preserving order', () => {
    const scope = new Set(['b#1', 'c#1']);
    expect(filterPracticeScope(pool, scope).map((x) => x.stableId)).toEqual(['b#1', 'c#1']);
    const scope2 = new Set(['a#2', 'a#1']);
    expect(filterPracticeScope(pool, scope2).map((x) => x.stableId)).toEqual(['a#1', 'a#2']);
  });

  it('returns empty for an empty scope set', () => {
    expect(filterPracticeScope(pool, new Set())).toEqual([]);
  });

  it('does not mutate the input pool', () => {
    const snapshot = [...pool];
    filterPracticeScope(pool, new Set(['a#1']));
    expect(pool).toEqual(snapshot);
  });

  it('composes with pickPracticeRound as the full pipeline (pool < n takes all)', () => {
    const scope = new Set(['a#1', 'c#1']);
    const round = pickPracticeRound(filterPracticeScope(pool, scope), 10);
    expect(new Set(round.map((x) => x.stableId))).toEqual(scope);
  });
});

describe('retryWrong', () => {
  const q = (id: string) => ({ stableId: id });
  const order = (queue: { stableId: string }[]) => queue.map((c) => c.stableId);

  it('moves the missed card to the tail and records it (retry requeue)', () => {
    const res = retryWrong([q('a'), q('b'), q('c')], 'a', new Set());
    expect(order(res.queue)).toEqual(['b', 'c', 'a']);
    expect([...res.retried]).toEqual(['a']);
    expect(res.moved).toBe(true);
  });

  it('keeps the relative order of the untouched cards', () => {
    const res = retryWrong([q('a'), q('b'), q('c'), q('d')], 'b', new Set());
    expect(order(res.queue)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('does not requeue a card that already used its retry (second miss)', () => {
    const res = retryWrong([q('a'), q('b')], 'a', new Set(['a']));
    expect(order(res.queue)).toEqual(['a', 'b']); // 不重排
    expect(res.retried.size).toBe(1); // 重试后再错不再累计
    expect(res.moved).toBe(false);
  });

  it('is a safe no-op for a stableId outside the queue', () => {
    const res = retryWrong([q('a'), q('b')], 'zz', new Set());
    expect(order(res.queue)).toEqual(['a', 'b']);
    expect(res.retried.size).toBe(0);
    expect(res.moved).toBe(false);
  });

  it('treats a last-position miss as bookkeeping only (tail insert changes nothing)', () => {
    const res = retryWrong([q('a'), q('b')], 'b', new Set());
    expect(order(res.queue)).toEqual(['a', 'b']);
    expect([...res.retried]).toEqual(['b']);
    expect(res.moved).toBe(false);
  });

  it('requeues several distinct misses in one round (at most one retry each)', () => {
    let queue = [q('a'), q('b'), q('c')];
    let retried: ReadonlySet<string> = new Set<string>();
    ({ queue, retried } = retryWrong(queue, 'a', retried)); // [b, c, a]
    ({ queue, retried } = retryWrong(queue, 'b', retried)); // [c, a, b]
    expect(order(queue)).toEqual(['c', 'a', 'b']);
    expect(retried.size).toBe(2);
  });

  it('does not mutate the input queue or retried set', () => {
    const queue = [q('a'), q('b'), q('c')];
    const retried = new Set(['x']);
    const queueSnapshot = [...queue];
    retryWrong(queue, 'a', retried);
    expect(queue).toEqual(queueSnapshot);
    expect(queue).not.toBe(retryWrong(queue, 'a', retried).queue); // 返回副本，不复用入参数组
    expect([...retried]).toEqual(['x']);
  });
});
