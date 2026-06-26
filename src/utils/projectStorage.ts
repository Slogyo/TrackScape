import type { ProjectDocumentV5 } from '../types'
import {
  parseProjectDocument,
  serializeProjectDocument,
} from './projectDocument'

export const PROJECT_STORAGE_KEY = 'trackscape.project.v1'

export type ProjectLoadResult =
  | { ok: true; project: ProjectDocumentV5 | null }
  | { ok: false; error: string }

export type ProjectSaveResult =
  | { ok: true }
  | { ok: false; error: string }

export interface ProjectStorage {
  load: () => ProjectLoadResult
  save: (project: ProjectDocumentV5) => ProjectSaveResult
  clear: () => ProjectSaveResult
}

export const createLocalProjectStorage = (
  getStorage: () => Storage,
): ProjectStorage => ({
  load: () => {
    try {
      const storedProject = getStorage().getItem(PROJECT_STORAGE_KEY)
      if (storedProject === null) {
        return { ok: true, project: null }
      }

      const result = parseProjectDocument(storedProject)
      return result.ok ? result : { ok: false, error: result.error }
    } catch {
      return {
        ok: false,
        error: 'The saved project could not be read from browser storage.',
      }
    }
  },
  save: (project) => {
    try {
      getStorage().setItem(
        PROJECT_STORAGE_KEY,
        serializeProjectDocument(project),
      )
      return { ok: true }
    } catch {
      return {
        ok: false,
        error: 'The project could not be saved to browser storage.',
      }
    }
  },
  clear: () => {
    try {
      getStorage().removeItem(PROJECT_STORAGE_KEY)
      return { ok: true }
    } catch {
      return {
        ok: false,
        error: 'The saved project could not be cleared from browser storage.',
      }
    }
  },
})
