import { describe, expect, it } from 'vitest'
import type {
  ProjectDocumentV1,
  ProjectDocumentV2,
  ProjectDocumentV3,
} from '../types'
import {
  getProjectFilename,
  parseProjectDocument,
  serializeProjectDocument,
  validateProjectName,
  validateProjectDocument,
} from './projectDocument'

const validProject = (): ProjectDocumentV3 => ({
  schemaVersion: 3,
  metadata: {
    id: 'project-1',
    name: 'Main Layout',
    createdAt: '2026-06-11T01:00:00.000Z',
    updatedAt: '2026-06-11T02:00:00.000Z',
  },
  settings: {
    measurementSystem: 'imperial',
    layoutScaleId: 'oo',
  },
  layers: [
    { id: 'room', name: 'Room', visible: true, locked: false },
    { id: 'tabletop', name: 'Tabletop', visible: true, locked: false },
    { id: 'scenery', name: 'Scenery', visible: false, locked: true },
  ],
  objects: [
    {
      id: 'line-1',
      type: 'line',
      layerId: 'scenery',
      start: { x: 25.4, y: 10 },
      end: { x: 500.25, y: 350.5 },
    },
    {
      id: 'rectangle-1',
      type: 'rectangle',
      layerId: 'scenery',
      x: 100,
      y: 200,
      width: 300.5,
      height: 400.25,
    },
    {
      id: 'room-1',
      type: 'room',
      layerId: 'room',
      x: 0,
      y: 0,
      width: 4000,
      height: 3000,
    },
    {
      id: 'tabletop-1',
      type: 'tabletop',
      layerId: 'tabletop',
      x: 500,
      y: 500,
      width: 1800,
      height: 900,
    },
  ],
})

describe('project document', () => {
  it('round trips every object and exact millimetre value', () => {
    const project = validProject()

    expect(parseProjectDocument(serializeProjectDocument(project))).toEqual({
      ok: true,
      project,
    })
  })

  it('migrates schema version 1 projects to version 3 with HO scale', () => {
    const project = validProject()
    const legacyProject: ProjectDocumentV1 = {
      ...project,
      schemaVersion: 1,
      settings: { measurementSystem: project.settings.measurementSystem },
      objects: project.objects.filter(
        (object) => object.type !== 'track-piece',
      ) as ProjectDocumentV1['objects'],
    }

    expect(validateProjectDocument(legacyProject)).toEqual({
      ok: true,
      project: {
        ...project,
        schemaVersion: 3,
        settings: {
          measurementSystem: project.settings.measurementSystem,
          layoutScaleId: 'ho',
        },
      },
    })
  })

  it('migrates schema version 2 track projects to version 3 with HO scale', () => {
    const project = validProject()
    const trackPiece = {
      id: 'track-piece-1',
      type: 'track-piece' as const,
      layerId: 'track' as const,
      definitionId: 'curve-r450-30' as const,
      position: { x: 1000, y: 1000 },
      rotation: 30,
      direction: 'left' as const,
    }
    const legacyProject: ProjectDocumentV2 = {
      ...project,
      schemaVersion: 2,
      settings: { measurementSystem: project.settings.measurementSystem },
      layers: [
        ...project.layers,
        { id: 'track', name: 'Track', visible: true, locked: false },
      ],
      objects: [...project.objects, trackPiece],
    }

    expect(validateProjectDocument(legacyProject)).toEqual({
      ok: true,
      project: {
        ...legacyProject,
        schemaVersion: 3,
        settings: {
          measurementSystem: project.settings.measurementSystem,
          layoutScaleId: 'ho',
        },
      },
    })
  })

  it('round trips a valid track piece and rejects invalid catalog data', () => {
    const project = validProject()
    const trackPiece = {
      id: 'track-piece-1',
      type: 'track-piece' as const,
      layerId: 'track' as const,
      definitionId: 'curve-r450-30' as const,
      position: { x: 1000, y: 1000 },
      rotation: 30,
      direction: 'left' as const,
    }
    const withTrack: ProjectDocumentV3 = {
      ...project,
      layers: [
        ...project.layers,
        { id: 'track', name: 'Track', visible: true, locked: false },
      ],
      objects: [...project.objects, trackPiece],
    }

    expect(parseProjectDocument(serializeProjectDocument(withTrack))).toEqual({
      ok: true,
      project: withTrack,
    })
    expect(
      validateProjectDocument({
        ...withTrack,
        objects: [{ ...trackPiece, definitionId: 'unknown-track' }],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectDocument({
        ...withTrack,
        objects: [{ ...trackPiece, rotation: 17 }],
      }).ok,
    ).toBe(false)
  })

  it('rejects malformed JSON and unsupported versions', () => {
    expect(parseProjectDocument('{broken')).toEqual({
      ok: false,
      error: 'The selected file is not valid JSON.',
    })
    expect(
      validateProjectDocument({ ...validProject(), schemaVersion: 4 }),
    ).toEqual({
      ok: false,
      error: 'Unsupported project schema version: 4.',
    })
  })

  it('rejects unknown version 3 layout scales', () => {
    expect(
      validateProjectDocument({
        ...validProject(),
        settings: {
          measurementSystem: 'metric',
          layoutScaleId: 'custom',
        },
      }),
    ).toEqual({
      ok: false,
      error: 'Project layout scale is invalid.',
    })
  })

  it('rejects duplicate layer and object IDs', () => {
    const project = validProject()
    expect(
      validateProjectDocument({
        ...project,
        layers: [...project.layers, { ...project.layers[0] }],
      }),
    ).toEqual({
      ok: false,
      error: 'Duplicate layer ID: room.',
    })
    expect(
      validateProjectDocument({
        ...project,
        objects: [...project.objects, { ...project.objects[0] }],
      }),
    ).toEqual({
      ok: false,
      error: 'Duplicate object ID: line-1.',
    })
  })

  it('rejects missing layer references and invalid geometry', () => {
    const project = validProject()
    expect(
      validateProjectDocument({
        ...project,
        objects: [{ ...project.objects[0], layerId: 'missing' }],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectDocument({
        ...project,
        objects: [
          {
            ...project.objects[0],
            start: { x: 100, y: 100 },
            end: { x: 100, y: 100 },
          },
        ],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectDocument({
        ...project,
        objects: [{ ...project.objects[1], width: 0 }],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectDocument({
        ...project,
        objects: [{ ...project.objects[1], x: -1 }],
      }).ok,
    ).toBe(false)
  })

  it('rejects semantic objects on mismatched layers', () => {
    const project = validProject()
    expect(
      validateProjectDocument({
        ...project,
        objects: [{ ...project.objects[2], layerId: 'scenery' }],
      }),
    ).toEqual({
      ok: false,
      error: 'Room room-1 must belong to the Room layer.',
    })
    expect(
      validateProjectDocument({
        ...project,
        objects: [{ ...project.objects[3], layerId: 'room' }],
      }),
    ).toEqual({
      ok: false,
      error: 'Tabletop tabletop-1 must belong to the Tabletop layer.',
    })
  })

  it('creates a filesystem-safe TrackScape filename', () => {
    expect(getProjectFilename('  My Great Layout!  ')).toBe(
      'my-great-layout.trackscape.json',
    )
    expect(getProjectFilename('***')).toBe(
      'untitled-layout.trackscape.json',
    )
  })

  it('validates editable project names', () => {
    expect(validateProjectName('  ')).toBe('Project name cannot be blank.')
    expect(validateProjectName('A'.repeat(81))).toBe(
      'Project name cannot exceed 80 characters.',
    )
    expect(validateProjectName('Branch Line')).toBeNull()
  })
})
