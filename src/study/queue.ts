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
