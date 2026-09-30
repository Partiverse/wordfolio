// 收藏内存态（zustand）：乐观更新 Set，再异步落 learning.db。
import { create } from 'zustand';

import { addFavoriteEntry, getFavoriteEntryIds, removeFavoriteEntry } from '@/db/study';
import { applyToggle } from '@/db/learning-core';

interface FavoritesState {
  ids: ReadonlySet<number>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: (entryId: number) => void;
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: new Set<number>(),
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const ids = await getFavoriteEntryIds();
      set({ ids: new Set(ids), hydrated: true });
    } catch {
      // 读失败保持空集，下次挂载重试；不打断 UI
    }
  },
  toggle: (entryId) => {
    const current = get().ids;
    const next = applyToggle([...current], entryId);
    set({ ids: new Set(next) });
    const persist = current.has(entryId) ? removeFavoriteEntry : addFavoriteEntry;
    persist(entryId).catch(() => {});
  },
}));
