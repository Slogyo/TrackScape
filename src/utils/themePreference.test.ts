import { describe, expect, it } from 'vitest'
import {
  loadThemePreference,
  saveThemePreference,
  THEME_PREFERENCE_KEY,
} from './themePreference'

const createStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

const media = (matches: boolean) =>
  ((query: string) =>
    ({
      matches,
      media: query,
    }) as MediaQueryList)

describe('theme preference', () => {
  it('prefers a saved manual choice over the system theme', () => {
    const storage = createStorage()
    storage.setItem(THEME_PREFERENCE_KEY, 'light')

    expect(loadThemePreference(() => storage, media(true))).toEqual({
      theme: 'light',
      hasManualPreference: true,
    })
  })

  it('uses the system theme when no manual choice exists', () => {
    expect(loadThemePreference(createStorage, media(true))).toEqual({
      theme: 'dark',
      hasManualPreference: false,
    })
  })

  it('falls back safely when browser APIs are unavailable', () => {
    expect(
      loadThemePreference(
        () => {
          throw new Error('blocked')
        },
        undefined,
      ),
    ).toEqual({ theme: 'light', hasManualPreference: false })
  })

  it('persists manual choices without throwing on storage errors', () => {
    const storage = createStorage()
    expect(saveThemePreference('dark', () => storage)).toBe(true)
    expect(storage.getItem(THEME_PREFERENCE_KEY)).toBe('dark')
    expect(
      saveThemePreference('light', () => {
        throw new Error('blocked')
      }),
    ).toBe(false)
  })
})
