// 设计 token：从早期原型 shared-design-system.css 迁移（:root 与 [data-theme="dark"]）。
// 颜色值与原型逐一对应；后续 M-A 接入 nativewind 时，tailwind.config 以此为 color map。

import { useColorScheme } from 'react-native';

export const lightTokens = {
  // 基础中性色阶（画布用暖中性，与琥珀 brand 同一温度；表面积白）
  bgCanvas: '#f8f6f2',
  bgSurface: '#ffffff',
  bgSurfaceElevated: '#f1efe9',
  borderSubtle: '#e7e4dd',
  borderStrong: '#d6d2c9',
  textPrimary: '#1c1917',
  textSecondary: '#57534e',
  textMuted: '#a8a29e',

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
  // 中性阶保持石板蓝夜色；brand 琥珀加亮以保对比度（4.5:1+ on #090d16）
  bgCanvas: '#090d16',
  bgSurface: '#111726',
  bgSurfaceElevated: '#182033',
  borderSubtle: '#1e293b',
  borderStrong: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#a2a9b8',
  textMuted: '#64748b',

  background: '#090d16',
  foreground: '#f1f5f9',
  card: '#111726',
  cardForeground: '#f1f5f9',
  // 主行动色：暗色下保持琥珀 brand（beta.4 前是白色——正是「颜色不和谐」主因）
  primary: '#f59e0b',
  primaryForeground: '#1c1917',
  secondary: '#182033',
  secondaryForeground: '#f1f5f9',
  muted: '#182033',
  mutedForeground: '#94a3b8',
  accent: '#182033',
  accentForeground: '#f1f5f9',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  border: '#1e293b',
  input: '#1e293b',
  ring: '#f59e0b',

  accentPrimary: '#7dd3fc',
  accentPrimaryHover: '#38bdf8',
  accentSuccess: '#34d399',
  accentWarning: '#fbbf24',

  tooltipBg: '#f8fafc',
  tooltipText: '#090d16',
} as const;

export type ThemeTokens = Record<keyof typeof lightTokens, string>;

// 圆角与间距沿用原型 .ui-btn / .card 的 8px 基数体系
export const radii = { sm: 6, md: 10, lg: 14, full: 999 } as const;
export const spacing = (n: number) => n * 4;

/**
 * 语义色使用规范：内测反馈「颜色搭配混乱」后收敛——
 * 全 app 只允许 3 类色相 + 中性阶，避免 brand / interactive / 各状态色混用。
 *   brand（琥珀）  主行动：激活 chip、主按钮、已收藏星标
 *   interactive（蓝）可点击文本：返回链接、筛选入口
 *   neutral        中性阶：卡片、边框、正文层级
 *   success（绿）   仅用于确切的「完成/正确」语义（进度条、完成页），不作装饰
 */
export function useTheme(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTokens : lightTokens;
}
