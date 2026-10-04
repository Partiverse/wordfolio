import { describe, expect, it } from 'vitest';

import { parseThemePreference, resolveScheme } from '../src/theme/theme-core';

describe('parseThemePreference', () => {
  it('accepts the two explicit preferences', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('falls back to system for null / invalid / undefined', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('Dark')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
  });
});

describe('resolveScheme', () => {
  it('explicit preference overrides the system scheme', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('system preference follows the system scheme', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('system preference with unknown / unmounted scheme resolves to light', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });
});
