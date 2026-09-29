// 词库发布物只读数据层（M-A）。所有查询集中在此，UI 不直接拼 SQL。
// 发布物 DB 引导见 ./release.ts；查询构造纯函数见 ./search.ts。

import { openReleaseDb, type SearchHit } from './release';
import { buildFtsMatch, buildLikePattern, shouldUseLikeFallback } from './search';

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

// 检索：拉丁走 FTS5 前缀 + bm25；中文（或含中文的混查）走 LIKE 回退。
// 每条命中带 entryId，供结果卡跳转词条详情。
export async function searchSenses(query: string, limit = 30): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
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
    return db.getAllAsync<SearchHit>(
      `${baseSelect}
         FROM sense s
         JOIN entry e ON e.id = s.entry_id
        WHERE s.definition_zh LIKE ? ESCAPE '\\'
           OR s.label_zh      LIKE ? ESCAPE '\\'
           OR e.headword      LIKE ? ESCAPE '\\'
        ORDER BY e.freq_rank IS NULL, e.freq_rank, s.order_key
        LIMIT ?`,
      [pattern, pattern, pattern, limit],
    );
  }

  return db.getAllAsync<SearchHit>(
    `${baseSelect}
       FROM sense_fts f
       JOIN sense s ON s.id = f.rowid
       JOIN entry e ON e.id = s.entry_id
      WHERE sense_fts MATCH ?
      ORDER BY bm25(sense_fts)
      LIMIT ?`,
    [buildFtsMatch(q), limit],
  );
}
