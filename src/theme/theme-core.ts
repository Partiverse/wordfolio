// 主题偏好的纯逻辑（E4）：解析 settings 表存值、把「偏好 × 系统色」解析成实际 scheme。
// 不依赖 react-native / expo——vitest（node 环境）可直接导入，与 db/search.ts 同模式。

export type ThemePreference = 'light' | 'dark' | 'system';

/** settings 表 key='theme' 的存值解析：缺失/非法一律回落 'system'（写坏不锁死 UI）。 */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * 实际生效的 scheme：偏好为 light/dark 时直接覆盖；
 * system 时回落系统色（RN ColorSchemeName 还含 'unspecified'，未知一律按 light，
 * 与既有 useTheme 行为一致）。
 */
export function resolveScheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
