import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV4 } from '../types'
import { getProjectHydration } from './appState'

describe('getProjectHydration', () => {
  it('restores persisted project data and resets transient UI state', () => {
    const project: ProjectDocumentV4 = {
      schemaVersion: 4,
      metadata: {
        id: 'project-1',
        name: 'Imported Layout',
        createdAt: '2026-06-11T01:00:00.000Z',
        updatedAt: '2026-06-11T02:00:00.000Z',
      },
      settings: {
        measurementSystem: 'imperial',
        layoutScaleId: 'n',
      },
      layers: [
        { id: 'scenery', name: 'Scenery', visible: false, locked: true },
        { id: 'room', name: 'Room', visible: true, locked: false },
      ],
      objects: [
        {
          id: 'rectangle-1',
          type: 'rectangle',
          layerId: 'scenery',
          x: 25.4,
          y: 50.8,
          width: 300,
          height: 200,
        },
      ],
    }

    const result = getProjectHydration(project)

    expect(result).toMatchObject({
      metadata: project.metadata,
      measurementSystem: 'imperial',
      layoutScaleId: 'n',
      activeLayerId: 'scenery',
      activeToolId: 'select',
      selectedObjectIds: [],
    })
    expect(result.layers).toEqual(project.layers)
    expect(result.objects).toEqual(project.objects)
    expect(result.layers).not.toBe(project.layers)
    expect(result.objects).not.toBe(project.objects)
    expect(result.objects[0]).not.toBe(project.objects[0])
  })
})
