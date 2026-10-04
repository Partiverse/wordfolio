// 主题偏好（zustand，E4）：'light' | 'dark' | 'system'（默认），落 settings 表 key='theme'。
// 解析/回落纯逻辑见 ../theme/theme-core.ts；hydrate 模式同 useFavorites（标记一次，失败重试）。
import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/study';
import { parseThemePreference, type ThemePreference } from '@/theme/theme-core';

const THEME_KEY = 'theme';

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (p: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await getSetting(THEME_KEY);
      // 等待期间用户已手动选择（setPreference）则不回写覆盖
      if (get().hydrated) return;
      set({ preference: parseThemePreference(raw), hydrated: true });
    } catch {
      // 读失败保持 system，下次挂载重试；不打断 UI
    }
  },
  setPreference: (p) => {
    set({ preference: p, hydrated: true });
    setSetting(THEME_KEY, p).catch(() => {});
  },
}));
