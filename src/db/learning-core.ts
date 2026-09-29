// 收藏状态纯逻辑（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 持久化在 learning.db（见 ./learning.ts），内存态在 zustand store（见 ../stores/favorites.ts）。

export function isFavorited(ids: readonly number[], entryId: number): boolean {
  return ids.includes(entryId);
}

// 切换收藏：已收藏则移除，否则追加（保持顺序，返回新数组）。
export function applyToggle(ids: readonly number[], entryId: number): number[] {
  if (ids.includes(entryId)) {
    return ids.filter((id) => id !== entryId);
  }
  return [...ids, entryId];
}
