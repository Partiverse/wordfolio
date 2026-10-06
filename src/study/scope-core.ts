// 练习范围纯逻辑（I1）：自由练习（练习/听音/拼写）抽题池的范围档位解析 + CEFR 档位解析
// （无 RN / SQLite 依赖，供 vitest 覆盖）。持久化由学习屏经 db/study.ts 的 settings 表完成
// （key='practiceScope' / 'practiceCefr'，值为档位字符串本身），风格与补卡顺序（order-core.ts）
// 、评分模式（rating-core.ts）一致。备份导出/导入对 settings 是不透明 key/value，新键自动携带。

export const PRACTICE_SCOPE_KEY = 'practiceScope';

/** CEFR 具体档位的 settings 键：仅 scope='cefr' 时生效。 */
export const PRACTICE_CEFR_KEY = 'practiceCefr';

export const PRACTICE_SCOPES = ['all', 'favorites', 'exam', 'cefr'] as const;

export type PracticeScope = (typeof PRACTICE_SCOPES)[number];

/** 学习屏范围选择 segChip 文案。 */
export const PRACTICE_SCOPE_LABELS: Record<PracticeScope, string> = {
  all: '全部',
  favorites: '收藏',
  exam: '考试',
  cefr: 'CEFR',
};

/**
 * CEFR 档位 chips：当前发布物（v0.1-m1）entry.cefr 有标注的五个档位（A1 328 / A2 93 / B1 19 /
 * B2 10 / C1 1，C2 为 0 条不渲染空档）。上游发布物带 C2 数据时在此扩充即可，parse 同步放宽。
 */
export const PRACTICE_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export type PracticeCefr = (typeof PRACTICE_CEFR_LEVELS)[number];

/** 恢复练习范围：settings 读出的任意值 → 合法档位；缺失/无效（含大小写不符）回退 'all'（现状全集）。 */
export function parsePracticeScope(value: string | null | undefined): PracticeScope {
  if (value && (PRACTICE_SCOPES as readonly string[]).includes(value)) {
    return value as PracticeScope;
  }
  return 'all';
}

/** 恢复 CEFR 档位：缺失/无效（含大小写不符、schema 合法但无数据的 'C2'）回退 'A1'（标注量最大的档）。 */
export function parsePracticeCefr(value: string | null | undefined): PracticeCefr {
  if (value && (PRACTICE_CEFR_LEVELS as readonly string[]).includes(value)) {
    return value as PracticeCefr;
  }
  return 'A1';
}
