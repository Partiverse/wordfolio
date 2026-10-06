// 队列整形：义项级学习时避免同一词头的义项连排（连排会让"这个词我会"掩盖"这个义项我不会"）。
// 纯函数，无 RN / SQLite 依赖，供 vitest 覆盖。

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface SpreadableCard {
  stableId: string;
}

/**
 * 贪心打散：保持原队列的到期优先级，但在能换词头时优先选与上一张不同词头的卡。
 * 不改变卡片集合与相对优先级（只做同层换位），stableId 作为无词头信息的回退键。
 */
export function spreadByHeadword<T extends SpreadableCard>(
  cards: readonly T[],
  headwordOf: (card: T) => string,
): T[] {
  if (cards.length < 2) return [...cards];

  const remaining = [...cards];
  const out: T[] = [];
  let lastHeadword: string | null = null;

  while (remaining.length > 0) {
    let index = remaining.findIndex((c) => headwordOf(c) !== lastHeadword);
    if (index === -1) index = 0; // 剩余全是同一词头，按原序取
    const [picked] = remaining.splice(index, 1);
    out.push(picked);
    lastHeadword = headwordOf(picked);
  }
  return out;
}

/**
 * 自由练习抽题：从已学卡里随机抽 n 张（每轮不同，与正式排期互不影响）。
 * 卡片不足 n 张时全取（练习模式永远可用，哪怕只有 1 张卡）。
 */
export function pickPracticeRound<T>(cards: readonly T[], n: number): T[] {
  return shuffle(cards).slice(0, Math.max(0, n));
}

/**
 * 练习范围筛选（I1）：把自由练习抽题池从「已学卡全集」缩到「范围 ∩ 已学卡」。
 * scopeStableIds 为 null/undefined 表示不设限（scope='all'，原样返回副本）；
 * 否则只保留 stableId 命中范围集合的卡，保持入参相对顺序。纯函数：不改入参。
 * 与 pickPracticeRound 组合即完整抽题管线：pickPracticeRound(filterPracticeScope(cards, set), n)。
 */
export function filterPracticeScope<T extends SpreadableCard>(
  cards: readonly T[],
  scopeStableIds: ReadonlySet<string> | null | undefined,
): T[] {
  if (!scopeStableIds) return [...cards];
  return cards.filter((c) => scopeStableIds.has(c.stableId));
}

export interface RetryWrongResult<T> {
  /** 重排后的队列（首错尾插）；未重排时为入参的副本 */
  queue: T[];
  /** 记账后的已答错卡集合（同卡重试后再错不重复累计），兼当「本轮答错 x」计数 */
  retried: ReadonlySet<string>;
  /**
   * 队列顺序是否真的变了。调用方据此决定游标：moved=true 说明当前卡已移走、
   * 下一张自动落位到原 index（游标保持）；moved=false 原样跳过（游标 +1）。
   */
  moved: boolean;
}

/**
 * 轮内错题重试（I2）：把答错卡移到队尾，本轮稍后再来一次。
 * - 每卡每轮最多重试一次：stableId 已在 retriedSet 则不再重排（二错只记账不重排→游标跳过）；
 * - stableId 不在队内（理论上不该发生）：安全原样返回，不改记账；
 * - 答错卡已是队尾时「移到队尾」不改变顺序（moved=false）：本轮无可排的后续卡，
 *   按跳过处理收尾（同卡原位重显会因 stableId 作 key 不重挂载、卡在已答状态，故不这么做）。
 * 纯函数：不改入参数组与集合，no-op 分支也返回副本。
 */
export function retryWrong<T extends SpreadableCard>(
  queue: readonly T[],
  stableId: string,
  retriedSet: ReadonlySet<string>,
): RetryWrongResult<T> {
  if (retriedSet.has(stableId)) {
    return { queue: [...queue], retried: new Set(retriedSet), moved: false };
  }
  const index = queue.findIndex((c) => c.stableId === stableId);
  if (index === -1) {
    return { queue: [...queue], retried: new Set(retriedSet), moved: false };
  }
  const next = [...queue];
  const [missed] = next.splice(index, 1);
  next.push(missed);
  const nextRetried = new Set(retriedSet);
  nextRetried.add(stableId);
  return { queue: next, retried: nextRetried, moved: index !== queue.length - 1 };
}
