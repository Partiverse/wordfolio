// 设计 token：从早期原型 shared-design-system.css 迁移（:root 与 [data-theme="dark"]）。
// 颜色值与原型逐一对应；后续 M-A 接入 nativewind 时，tailwind.config 以此为 color map。

import { useColorScheme } from 'react-native';

export const lightTokens = {
  // 基础中性色阶
  bgCanvas: '#f8fafc',
  bgSurface: '#ffffff',
  bgSurfaceElevated: '#f1f5f9',
  borderSubtle: '#e2e8f0',
  borderStrong: '#cbd5e1',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',

  // shadcn/ui 语义代币（Amber 主色 + Taupe 中性色）
  background: '#f9f6f0',
  foreground: '#1c1917',
  card: '#ffffff',
  cardForeground: '#1c1917',
  primary: '#d97706',
  primaryForeground: '#ffffff',
  secondary: '#ede8e1',
  secondaryForeground: '#1c1917',
  muted: '#ede8e1',
  mutedForeground: '#78716c',
  accent: '#f5f0e8',
  accentForeground: '#1c1917',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  border: '#dfd9d1',
  input: '#dfd9d1',
  ring: '#d97706',

  // 交互与状态
  accentPrimary: '#0284c7',
  accentPrimaryHover: '#0369a1',
  accentSuccess: '#059669',
  accentWarning: '#d97706',

  tooltipBg: '#0f172a',
  tooltipText: '#ffffff',
} as const;

export const darkTokens = {
  bgCanvas: '#090d16',
  bgSurface: '#111726',
  bgSurfaceElevated: '#182033',
  borderSubtle: '#1e293b',
  borderStrong: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  background: '#090d16',
  foreground: '#f8fafc',
  card: '#111726',
  cardForeground: '#f8fafc',
  primary: '#f8fafc',
  primaryForeground: '#090d16',
  secondary: '#182033',
  secondaryForeground: '#f8fafc',
  muted: '#182033',
  mutedForeground: '#94a3b8',
  accent: '#182033',
  accentForeground: '#f8fafc',
  destructive: '#7f1d1d',
  destructiveForeground: '#f8fafc',
  border: '#1e293b',
  input: '#1e293b',
  ring: '#38bdf8',

  accentPrimary: '#38bdf8',
  accentPrimaryHover: '#0284c7',
  accentSuccess: '#34d399',
  accentWarning: '#fbbf24',

  tooltipBg: '#f8fafc',
  tooltipText: '#090d16',
} as const;

export type ThemeTokens = Record<keyof typeof lightTokens, string>;

// 圆角与间距沿用原型 .ui-btn / .card 的 8px 基数体系
export const radii = { sm: 6, md: 10, lg: 14, full: 999 } as const;
export const spacing = (n: number) => n * 4;

export function useTheme(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTokens : lightTokens;
}
