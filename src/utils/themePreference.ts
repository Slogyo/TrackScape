import type { Theme } from '../types'

export const THEME_PREFERENCE_KEY = 'trackscape.theme'

export interface ThemePreference {
  theme: Theme
  hasManualPreference: boolean
}

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark'

export const getSystemTheme = (
  matchMedia: ((query: string) => MediaQueryList) | undefined,
): Theme => {
  try {
    return matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  } catch {
    return 'light'
  }
}

export const loadThemePreference = (
  getStorage: () => Storage,
  matchMedia?: (query: string) => MediaQueryList,
): ThemePreference => {
  try {
    const storedTheme = getStorage().getItem(THEME_PREFERENCE_KEY)
    if (isTheme(storedTheme)) {
      return { theme: storedTheme, hasManualPreference: true }
    }
  } catch {
    // System preference remains a safe fallback when storage is unavailable.
  }

  return {
    theme: getSystemTheme(matchMedia),
    hasManualPreference: false,
  }
}

export const saveThemePreference = (
  theme: Theme,
  getStorage: () => Storage,
): boolean => {
  try {
    getStorage().setItem(THEME_PREFERENCE_KEY, theme)
    return true
  } catch {
    return false
  }
}
