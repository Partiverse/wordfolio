// 检索查询构造的纯函数（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 中文检索策略（T0 缺口结论 + M-A 决策）：sense_fts 用 unicode61 tokenizer，
// 不分词中文——整短语可 MATCH，单字/子串 0 行。因此 CJK 查询直接走
// definition_zh/label_zh 的 LIKE 回退（当前 2495 义项毫秒级）；
// 拉丁查询走 FTS5 前缀 MATCH + bm25。trigram 留到 10 万词级再评估。

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

export function hasCjk(query: string): boolean {
  return CJK_RE.test(query);
}

// FTS5 MATCH 表达式：CJK 用整短语（退化为强匹配，配合 LIKE 兜底），
// 拉丁用 quoted prefix（"run"*）。
export function buildFtsMatch(query: string): string {
  const q = query.trim();
  if (hasCjk(q)) return `"${q}"`;
  return `"${q}"*`;
}

export function escapeLike(query: string): string {
  return query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// LIKE 回退模式（配合 ESCAPE '\'）：单字/子串也能命中。
export function buildLikePattern(query: string): string {
  return `%${escapeLike(query.trim())}%`;
}

// 路由决策：中文（含中英混查，如 "run 跑"）走 LIKE 回退。
export function shouldUseLikeFallback(query: string): boolean {
  return hasCjk(query.trim());
}

/**
 * 最短可检索长度：拉丁查询 1 个字母会命中海量前缀（FTS 前缀匹配），无意义；
 * 中文单字有效（"走"），故只对拉丁设门槛。
 */
export function isTooShort(query: string): boolean {
  const q = query.trim();
  if (hasCjk(q)) return q.length === 0;
  return q.length < 2;
}

/**
 * 命中层级（越小越准），用于搜索结果排序：
 * 0 词头精确匹配 → 1 词头前缀 → 2 释义/标签命中。
 */
export function matchRank(headword: string, query: string): 0 | 1 | 2 {
  const q = query.trim().toLowerCase();
  const head = headword.toLowerCase();
  if (head === q) return 0;
  if (head.startsWith(q)) return 1;
  return 2;
}
