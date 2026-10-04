// 词库发布物只读数据层（M-A）。所有查询集中在此，UI 不直接拼 SQL。
// 发布物 DB 引导见 ./release.ts；查询构造纯函数见 ./search.ts。

import { openReleaseDb, type SearchHit } from './release';
import { buildFtsMatch, buildLikePattern, isTooShort, shouldUseLikeFallback } from './search';

export interface BrowseItem {
  entryId: number;
  headword: string;
  ipaAm: string | null;
  cefr: string | null;
  band: string | null;
  pos: string | null;
  glossZh: string | null;
}

export interface BrowseFilters {
  cefr?: string | null;
  pos?: string | null;
  /** 限定词条 id 集（如收藏视图）；空数组直接返回空页 */
  entryIds?: number[];
}

export interface BrowsePage {
  items: BrowseItem[];
  total: number;
}

export interface ExampleDetail {
  textEn: string;
  textZh: string | null;
}

export interface SenseDetail {
  id: number;
  stableId: string;
  pos: string;
  labelZh: string | null;
  definitionEn: string;
  definitionZh: string;
  grammarPattern: string | null;
  examples: ExampleDetail[];
}

export interface FormDetail {
  form: string;
  tags: string[];
}

export interface EntryDetail {
  entryId: number;
  headword: string;
  ipaBr: string | null;
  ipaAm: string | null;
  etymologyZh: string | null;
  cefr: string | null;
  band: string | null;
  collinsStar: number | null;
  isOxford3000: boolean;
  forms: FormDetail[];
  senses: SenseDetail[];
}

const POS_VALUES = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'int', 'aux', 'modal', 'phrase', 'affix', 'other'] as const;
const CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const POS_OPTIONS: readonly string[] = POS_VALUES;
export const CEFR_OPTIONS: readonly string[] = CEFR_VALUES;

function normalizeFilter(value: string | null | undefined, allowed: readonly string[]): string | null {
  return value && (allowed as readonly string[]).includes(value) ? value : null;
}

// 浏览列表：按 freq_rank 排序的词条 + 首义项预览；支持 CEFR / 词性筛选。
export async function browseEntries(
  offset: number,
  limit: number,
  filters: BrowseFilters = {},
): Promise<BrowsePage> {
  const db = await openReleaseDb();
  const cefr = normalizeFilter(filters.cefr, CEFR_VALUES);
  const pos = normalizeFilter(filters.pos, POS_VALUES);
  const entryIds = filters.entryIds;

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (cefr) {
    where.push('e.cefr = ?');
    params.push(cefr);
  }
  if (pos) {
    where.push('EXISTS (SELECT 1 FROM sense fp WHERE fp.entry_id = e.id AND fp.pos = ?)');
    params.push(pos);
  }
  if (entryIds) {
    if (entryIds.length === 0) return { items: [], total: 0 };
    where.push(`e.id IN (${entryIds.map(() => '?').join(',')})`);
    params.push(...entryIds);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entry e ${whereSql}`,
    params,
  );

  const items = await db.getAllAsync<BrowseItem>(
    `SELECT e.id            AS entryId,
            e.headword      AS headword,
            e.ipa_am        AS ipaAm,
            e.cefr          AS cefr,
            e.band          AS band,
            s.pos           AS pos,
            COALESCE(s.label_zh, s.definition_zh) AS glossZh
       FROM entry e
       LEFT JOIN sense s ON s.id = (
         SELECT id FROM sense WHERE entry_id = e.id ORDER BY order_key LIMIT 1
       )
       ${whereSql}
      ORDER BY e.freq_rank IS NULL, e.freq_rank, e.headword
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { items, total: totalRow?.n ?? 0 };
}

// 词条详情：entry + 词形变化 + 义项（含例句），义项按 order_key。
export async function getEntryDetail(entryId: number): Promise<EntryDetail | null> {
  const db = await openReleaseDb();
  const entry = await db.getFirstAsync<{
    entryId: number;
    headword: string;
    ipaBr: string | null;
    ipaAm: string | null;
    etymologyZh: string | null;
    cefr: string | null;
    band: string | null;
    collinsStar: number | null;
    isOxford3000: number;
  }>(
    `SELECT id AS entryId, headword, ipa_br AS ipaBr, ipa_am AS ipaAm,
            etymology_zh AS etymologyZh, cefr, band, collins_star AS collinsStar,
            is_oxford3000 AS isOxford3000
       FROM entry WHERE id = ?`,
    [entryId],
  );
  if (!entry) return null;

  const formRows = await db.getAllAsync<{ form: string; tags: string }>(
    'SELECT form, tags FROM form WHERE entry_id = ? ORDER BY id',
    [entryId],
  );

  const senses = await db.getAllAsync<SenseDetail>(
    `SELECT id, stable_id AS stableId, pos, label_zh AS labelZh,
            definition_en AS definitionEn, definition_zh AS definitionZh,
            grammar_pattern AS grammarPattern
       FROM sense WHERE entry_id = ? ORDER BY order_key`,
    [entryId],
  );

  if (senses.length) {
    const placeholders = senses.map(() => '?').join(',');
    const exampleRows = await db.getAllAsync<{ sense_id: number; textEn: string; textZh: string | null }>(
      `SELECT sense_id, text_en AS textEn, text_zh AS textZh
         FROM example WHERE sense_id IN (${placeholders}) ORDER BY id`,
      senses.map((s) => s.id),
    );
    const bySense = new Map<number, ExampleDetail[]>();
    for (const row of exampleRows) {
      const list = bySense.get(row.sense_id) ?? [];
      list.push({ textEn: row.textEn, textZh: row.textZh });
      bySense.set(row.sense_id, list);
    }
    for (const sense of senses) {
      sense.examples = bySense.get(sense.id) ?? [];
    }
  }

  return {
    entryId: entry.entryId,
    headword: entry.headword,
    ipaBr: entry.ipaBr,
    ipaAm: entry.ipaAm,
    etymologyZh: entry.etymologyZh,
    cefr: entry.cefr,
    band: entry.band,
    collinsStar: entry.collinsStar,
    isOxford3000: entry.isOxford3000 === 1,
    forms: formRows.map((f) => ({ form: f.form, tags: safeParseTags(f.tags) })),
    senses,
  };
}

function safeParseTags(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export interface StudySense {
  stableId: string;
  headword: string;
  pos: string;
  labelZh: string | null;
  definitionEn: string;
  definitionZh: string;
  exampleEn: string | null;
  exampleZh: string | null;
}

// 学习队列用：按 stable_id 批量取义项（每义项取首条例句）。
export async function getStudySenses(stableIds: readonly string[]): Promise<Map<string, StudySense>> {
  const out = new Map<string, StudySense>();
  if (stableIds.length === 0) return out;
  const db = await openReleaseDb();
  const placeholders = stableIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{
    stableId: string;
    headword: string;
    pos: string;
    labelZh: string | null;
    definitionEn: string;
    definitionZh: string;
    exampleEn: string | null;
    exampleZh: string | null;
  }>(
    `SELECT s.stable_id AS stableId,
            e.headword   AS headword,
            s.pos        AS pos,
            s.label_zh   AS labelZh,
            s.definition_en AS definitionEn,
            s.definition_zh AS definitionZh,
            (SELECT x.text_en FROM example x WHERE x.sense_id = s.id ORDER BY x.id LIMIT 1) AS exampleEn,
            (SELECT x.text_zh FROM example x WHERE x.sense_id = s.id ORDER BY x.id LIMIT 1) AS exampleZh
       FROM sense s
       JOIN entry e ON e.id = s.entry_id
      WHERE s.stable_id IN (${placeholders})`,
    [...stableIds],
  );
  for (const r of rows) out.set(r.stableId, r);
  return out;
}

// 词库首批新卡候选：按词频排序的义项（义项级，先取前 limit 个）。
export async function getSeedSenseIds(limit: number): Promise<string[]> {
  const db = await openReleaseDb();
  const rows = await db.getAllAsync<{ stableId: string }>(
    `SELECT s.stable_id AS stableId
       FROM sense s
       JOIN entry e ON e.id = s.entry_id
      ORDER BY e.freq_rank IS NULL, e.freq_rank, s.order_key
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.stableId);
}

/**
 * 四选一干扰项：随机抽 other senses 的释义做选项。
 * 同词性优先（干扰更有效），词性候选不足时放宽到任意词性；
 * 排除正确项本身与同词头的其它义项（同词头做干扰会变成「词义辨析」而非「义项辨析」）。
 */
export async function getDistractorSenses(
  pos: string,
  excludeStableId: string,
  limit = 9,
): Promise<StudySense[]> {
  const db = await openReleaseDb();
  const query = (wherePos: string) => `
    SELECT s.stable_id AS stableId,
           e.headword   AS headword,
           s.pos        AS pos,
           s.label_zh   AS labelZh,
           s.definition_en AS definitionEn,
           s.definition_zh AS definitionZh,
           NULL AS exampleEn,
           NULL AS exampleZh
      FROM sense s
      JOIN entry e ON e.id = s.entry_id
     WHERE s.stable_id != ?
       AND e.headword != (SELECT e2.headword FROM sense s2 JOIN entry e2 ON e2.id = s2.entry_id WHERE s2.stable_id = ?)
       ${wherePos}
     ORDER BY RANDOM()
     LIMIT ?`;
  let rows = await db.getAllAsync<StudySense>(query('AND s.pos = ?'), [
    excludeStableId,
    excludeStableId,
    pos,
    limit,
  ]);
  if (rows.length < limit) {
    const extra = await db.getAllAsync<StudySense>(query(''), [
      excludeStableId,
      excludeStableId,
      limit,
    ]);
    const seen = new Set(rows.map((r) => r.stableId));
    for (const r of extra) {
      if (!seen.has(r.stableId)) {
        rows = [...rows, r];
        seen.add(r.stableId);
      }
    }
  }
  return rows;
}

// 上游富集数据探测（E5 接入骨架）：发布物是否带 CEFR 标注 / 例句数据。
// UI 据此决定是否渲染预留槽位（词库 CEFR 筛选 chips、学习「例句挖空」入口）；
// 显隐判定纯逻辑见 ../study/upstream-core.ts。当前 v0.1-m1 两项均无 → 槽位自动隐藏。
export async function hasCefrData(): Promise<boolean> {
  const db = await openReleaseDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM entry WHERE cefr IS NOT NULL AND cefr != ''",
  );
  return (row?.n ?? 0) > 0;
}

export async function hasExampleData(): Promise<boolean> {
  const db = await openReleaseDb();
  const row = await db.getFirstAsync<{ ok: number }>('SELECT 1 AS ok FROM example LIMIT 1');
  return row?.ok === 1;
}

// 检索：拉丁走 FTS5 前缀 + bm25；中文（或含中文的混查）走 LIKE 回退。
// 内测反馈「结果太多没意义」后的收紧策略（见 src/db/search.ts）：
// ① 拉丁查询不足 2 字符直接拒（单字母前缀会命中海量）；中文单字仍可搜
// ② 结果按「词头精确 > 词头前缀 > 释义命中」分层，释义命中只取少量
// ③ 总结果上限收紧，避免长列表淹没用户
export async function searchSenses(query: string, limit = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q || isTooShort(q)) return [];
  const db = await openReleaseDb();

  const baseSelect = `SELECT s.stable_id AS stableId,
                             s.id AS senseId,
                             e.id AS entryId,
                             e.headword AS headword,
                             s.pos AS pos,
                             s.definition_zh AS definitionZh`;

  if (shouldUseLikeFallback(q)) {
    // LIKE 回退（ESCAPE '\'，模式由 buildLikePattern 转义 %/_）
    const pattern = buildLikePattern(q);
    const headwordPattern = buildLikePattern(q);
    return db.getAllAsync<SearchHit>(
      `${baseSelect},
              CASE WHEN lower(e.headword) = lower(?) THEN 0
                   WHEN lower(e.headword) LIKE lower(?) THEN 1
                   ELSE 2 END AS rank
         FROM sense s
         JOIN entry e ON e.id = s.entry_id
        WHERE s.definition_zh LIKE ? ESCAPE '\\'
           OR s.label_zh      LIKE ? ESCAPE '\\'
           OR e.headword      LIKE ? ESCAPE '\\'
        ORDER BY rank, e.freq_rank IS NULL, e.freq_rank, s.order_key
        LIMIT ?`,
      [q, headwordPattern, pattern, pattern, pattern, limit],
    );
  }

  // 拉丁：先取词头精确/前缀命中（用户多半想找的就是这个词），再补释义命中
  const byHeadword = await db.getAllAsync<SearchHit>(
    `${baseSelect}
       FROM sense s
       JOIN entry e ON e.id = s.entry_id
      WHERE lower(e.headword) LIKE lower(?) || '%'
      ORDER BY CASE WHEN lower(e.headword) = lower(?) THEN 0 ELSE 1 END,
               e.freq_rank IS NULL, e.freq_rank, s.order_key
      LIMIT ?`,
    [q, q, limit],
  );
  if (byHeadword.length >= limit) return byHeadword.slice(0, limit);

  const byDefinition = await db.getAllAsync<SearchHit>(
    `${baseSelect}
       FROM sense_fts f
       JOIN sense s ON s.id = f.rowid
       JOIN entry e ON e.id = s.entry_id
      WHERE sense_fts MATCH ?
        AND s.stable_id NOT IN (${byHeadword.map(() => '?').join(',') || "''"})
      ORDER BY bm25(sense_fts)
      LIMIT ?`,
    [buildFtsMatch(q), ...byHeadword.map((h) => h.stableId), limit - byHeadword.length],
  );
  return [...byHeadword, ...byDefinition];
}
