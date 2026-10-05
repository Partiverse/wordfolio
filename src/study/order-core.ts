// 新卡补卡顺序纯逻辑（H2，Anki gather order 对齐）：三档取值解析 + 候选重排（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 持久化由统计页与学习屏经 db/study.ts 的 settings 表完成（key='newCardOrder'，值为档位字符串本身），
// 风格与评分模式（rating-core.ts，key='ratingMode'）一致。
// 顺序语义作用于「候选选取」（聚焦重建时从 4× 候选池里取哪些词）；入队后的段内排序
// 仍由 fsrs-core.sortForQueue 决定（复习在前、新卡按 due/stable_id），与现状一致。

export const NEW_CARD_ORDER_KEY = 'newCardOrder';

export const NEW_CARD_ORDERS = ['freq', 'random', 'favoriteFirst'] as const;

export type NewCardOrder = (typeof NEW_CARD_ORDERS)[number];

/** 统计页「新卡顺序」三段选择文案。 */
export const NEW_CARD_ORDER_LABELS: Record<NewCardOrder, string> = {
  freq: '词频',
  random: '随机',
  favoriteFirst: '收藏优先',
};

/** 恢复补卡顺序：settings 读出的任意值 → 合法档位；缺失/无效（含大小写不符）回退 'freq'（词频序，现状默认）。 */
export function parseNewCardOrder(value: string | null | undefined): NewCardOrder {
  if (value && (NEW_CARD_ORDERS as readonly string[]).includes(value)) {
    return value as NewCardOrder;
  }
  return 'freq';
}

/** 新卡候选元数据：发布物侧出 stable_id + 所属词条 id + 词频序（null=无词频，排尾部）。 */
export interface NewCardCandidate {
  stableId: string;
  entryId: number;
  freqRank: number | null;
}

function freqRankOf(candidate: NewCardCandidate): number {
  return candidate.freqRank === null ? Number.POSITIVE_INFINITY : candidate.freqRank;
}

/** 词频序比较（升序、null 居尾）；Array.sort 稳定，同频保持输入（SQL order_key）序。 */
function byFreq(a: NewCardCandidate, b: NewCardCandidate): number {
  return freqRankOf(a) - freqRankOf(b);
}

/** Fisher–Yates 洗牌（注入随机源保持可测；算法形态与 queue.ts 内部 shuffle 一致）。 */
function shuffleWith<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 新卡候选重排（Anki gather order 对齐）：
 * - 'freq'：词频升序（默认，与 SQL 既有 ORDER BY e.freq_rank 同口径）；
 * - 'random'：注入 rng 洗牌——每次聚焦重建队列时随机一次即可（队列本就聚焦重建），不追求全天稳定；
 * - 'favoriteFirst'：收藏词条（learning.db favorite 表，entry_id 级）的义项排前、组内保持频序，其余按频序。
 * 纯函数：不改入参；rng 为注入随机源（缺省 Math.random 仅供调用方免注入的便利）。
 */
export function orderNewCards(
  candidates: readonly NewCardCandidate[],
  order: NewCardOrder,
  favoriteEntryIds: ReadonlySet<number>,
  rng: () => number = Math.random,
): NewCardCandidate[] {
  if (order === 'random') return shuffleWith(candidates, rng);
  if (order === 'favoriteFirst') {
    return [...candidates].sort((a, b) => {
      const aFav = favoriteEntryIds.has(a.entryId) ? 0 : 1;
      const bFav = favoriteEntryIds.has(b.entryId) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return byFreq(a, b);
    });
  }
  return [...candidates].sort(byFreq);
}
