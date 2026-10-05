// morpheme 展示纯逻辑（F2）：kind → 中文标签 / 展示排序。
// SQL 查询在 ./repository.ts，这里只放 UI 可复用的纯函数。

export type MorphemeKind = 'root' | 'prefix' | 'suffix';

/** kind → 中文标签；未知值回退原样（防发布物 CHECK 约束变更外的脏数据） */
export function morphemeKindZh(kind: string): string {
  if (kind === 'root') return '词根';
  if (kind === 'prefix') return '前缀';
  if (kind === 'suffix') return '后缀';
  return kind;
}

/** 展示排序：前缀(0) → 词根(1) → 后缀(2)，未知 kind 排最后 */
export function morphemeDisplayOrder(kind: string): number {
  if (kind === 'prefix') return 0;
  if (kind === 'root') return 1;
  if (kind === 'suffix') return 2;
  return 3;
}

export interface MorphemeLike {
  morpheme: string;
  kind: string;
}

/** 词根词缀展示排序：前缀→词根→后缀，同 kind 按形态字母序（稳定输出，不改动入参） */
export function sortMorphemes<T extends MorphemeLike>(list: readonly T[]): T[] {
  return [...list].sort(
    (a, b) =>
      morphemeDisplayOrder(a.kind) - morphemeDisplayOrder(b.kind) ||
      a.morpheme.localeCompare(b.morpheme, 'en'),
  );
}
