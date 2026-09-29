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
