import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV3 } from '../types'
import {
  createLocalProjectStorage,
  PROJECT_STORAGE_KEY,
} from './projectStorage'

const project: ProjectDocumentV3 = {
  schemaVersion: 3,
  metadata: {
    id: 'project-1',
    name: 'Stored Layout',
    createdAt: '2026-06-11T01:00:00.000Z',
    updatedAt: '2026-06-11T02:00:00.000Z',
  },
  settings: {
    measurementSystem: 'metric',
    layoutScaleId: 'oo',
  },
  layers: [{ id: 'room', name: 'Room', visible: true, locked: false }],
  objects: [],
}

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('local project storage', () => {
  it('returns null when there is no saved project', () => {
    const storage = createLocalProjectStorage(createMemoryStorage)

    expect(storage.load()).toEqual({ ok: true, project: null })
  })

  it('saves, loads, and clears a valid project', () => {
    const memoryStorage = createMemoryStorage()
    const storage = createLocalProjectStorage(() => memoryStorage)

    expect(storage.save(project)).toEqual({ ok: true })
    expect(storage.load()).toEqual({ ok: true, project })
    expect(storage.clear()).toEqual({ ok: true })
    expect(memoryStorage.getItem(PROJECT_STORAGE_KEY)).toBeNull()
  })

  it('reports malformed stored data without deleting it', () => {
    const memoryStorage = createMemoryStorage()
    memoryStorage.setItem(PROJECT_STORAGE_KEY, '{broken')
    const storage = createLocalProjectStorage(() => memoryStorage)

    expect(storage.load()).toEqual({
      ok: false,
      error: 'The selected file is not valid JSON.',
    })
    expect(memoryStorage.getItem(PROJECT_STORAGE_KEY)).toBe('{broken')
  })

  it('reports unavailable, read-only, and uncleared storage', () => {
    const unavailable = createLocalProjectStorage(() => {
      throw new Error('unavailable')
    })
    expect(unavailable.load().ok).toBe(false)
    expect(unavailable.save(project).ok).toBe(false)
    expect(unavailable.clear().ok).toBe(false)

    const failingStorage = createMemoryStorage()
    failingStorage.setItem = () => {
      throw new Error('quota')
    }
    const quotaStorage = createLocalProjectStorage(() => failingStorage)
    expect(quotaStorage.save(project)).toEqual({
      ok: false,
      error: 'The project could not be saved to browser storage.',
    })
  })
})
