import { describe, expect, it } from 'vitest'
import type {
  ProjectDocumentV1,
  ProjectDocumentV2,
  ProjectDocumentV4,
  ProjectDocumentV5,
} from '../types'
import {
  getProjectFilename,
  parseProjectDocument,
  serializeProjectDocument,
  validateProjectName,
  validateProjectDocument,
} from './projectDocument'

const validProject = (): ProjectDocumentV5 => ({
  schemaVersion: 5,
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
    { id: 'room', name: 'Room', visible: true, locked: false, expanded: true },
    {
      id: 'tabletop',
      name: 'Tabletop',
      visible: true,
      locked: false,
      expanded: true,
    },
    {
      id: 'scenery',
      name: 'Scenery',
      visible: false,
      locked: true,
      expanded: false,
    },
  ],
  objects: [
    {
      id: 'line-1',
      type: 'line',
      layerId: 'scenery',
      name: 'Guide line',
      visible: true,
      locked: false,
      start: { x: 25.4, y: 10 },
      end: { x: 500.25, y: 350.5 },
    },
    {
      id: 'rectangle-1',
      type: 'rectangle',
      layerId: 'scenery',
      name: 'Scenery zone',
      visible: false,
      locked: false,
      x: 100,
      y: 200,
      width: 300.5,
      height: 400.25,
    },
    {
      id: 'room-1',
      type: 'room',
      layerId: 'room',
      name: 'Main room',
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      width: 4000,
      height: 3000,
    },
    {
      id: 'tabletop-1',
      type: 'tabletop',
      layerId: 'tabletop',
      name: 'North bench',
      visible: true,
      locked: false,
      x: 500,
      y: 500,
      width: 1800,
      height: 900,
    },
  ],
})

describe('project document', () => {
  it('round trips every object and exact millimetre value', () => {
    const project: ProjectDocumentV5 = {
      ...validProject(),
      objects: [
        ...validProject().objects,
        {
          id: 'measurement-1',
          type: 'measurement',
          layerId: 'scenery',
          name: 'Aisle width',
          visible: true,
          locked: false,
          start: {
            kind: 'object',
            objectId: 'rectangle-1',
            anchorId: 'top-left',
            point: { x: 100, y: 200 },
          },
          end: { kind: 'fixed', point: { x: 900.25, y: 200 } },
          offset: -180.5,
        },
        {
          id: 'text-1',
          type: 'text',
          layerId: 'scenery',
          name: 'Platform label',
          visible: true,
          locked: false,
          position: { x: 50.5, y: 75.25 },
          text: 'Platform\nRoad',
          fontSizeMm: 120,
          rotation: 22.5,
        },
      ],
    }

    expect(parseProjectDocument(serializeProjectDocument(project))).toEqual({
      ok: true,
      project,
    })
  })

  it('migrates schema version 4 projects to version 5 with outliner defaults', () => {
    const project = validProject()
    const legacy: ProjectDocumentV4 = {
      ...project,
      schemaVersion: 4,
      layers: project.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
      })),
      objects: project.objects.map((object) => {
        const legacyObject = { ...object }
        delete legacyObject.name
        delete legacyObject.visible
        delete legacyObject.locked
        return legacyObject
      }),
    }
    const result = validateProjectDocument(legacy)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.schemaVersion).toBe(5)
    expect(result.project.layers.every((layer) => layer.expanded)).toBe(true)
    expect(result.project.objects.map((object) => object.name)).toEqual([
      'Line',
      'Rectangle',
      'Room',
      'Tabletop',
    ])
    expect(
      result.project.objects.every(
        (object) => object.visible === true && object.locked === false,
      ),
    ).toBe(true)
  })

  it('rejects invalid annotation references and zero-length measurements', () => {
    const project = validProject()
    const baseMeasurement = {
      id: 'measurement-1',
      type: 'measurement',
      layerId: 'scenery',
      start: { kind: 'fixed', point: { x: 100, y: 100 } },
      end: { kind: 'fixed', point: { x: 200, y: 100 } },
      offset: 100,
    }
    expect(
      validateProjectDocument({
        ...project,
        objects: [
          ...project.objects,
          {
            ...baseMeasurement,
            start: {
              kind: 'object',
              objectId: 'missing',
              anchorId: 'start',
              point: { x: 100, y: 100 },
            },
          },
        ],
      }).ok,
    ).toBe(false)
    expect(
      validateProjectDocument({
        ...project,
        objects: [
          ...project.objects,
          {
            ...baseMeasurement,
            end: { kind: 'fixed', point: { x: 100, y: 100 } },
          },
        ],
      }).ok,
    ).toBe(false)
  })

  it('migrates schema version 1 projects to version 5 with HO scale', () => {
    const project = validProject()
    const legacyProject: ProjectDocumentV1 = {
      ...project,
      schemaVersion: 1,
      settings: { measurementSystem: project.settings.measurementSystem },
      objects: project.objects.filter(
        (object) => object.type !== 'track-piece',
      ) as ProjectDocumentV1['objects'],
    }

    const result = validateProjectDocument(legacyProject)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.schemaVersion).toBe(5)
    expect(result.project.settings).toEqual({
      measurementSystem: project.settings.measurementSystem,
      layoutScaleId: 'ho',
    })
  })

  it('migrates schema version 2 track projects to version 5 with HO scale', () => {
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
        {
          id: 'track',
          name: 'Track',
          visible: true,
          locked: false,
          expanded: true,
        },
      ],
      objects: [
        ...(project.objects as ProjectDocumentV2['objects']),
        trackPiece,
      ],
    }

    const result = validateProjectDocument(legacyProject)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.schemaVersion).toBe(5)
    expect(result.project.settings.layoutScaleId).toBe('ho')
    expect(result.project.objects[result.project.objects.length - 1]).toMatchObject({
      id: 'track-piece-1',
      layerId: 'track',
      visible: true,
      locked: false,
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
    const withTrack: ProjectDocumentV5 = {
      ...project,
      layers: [
        ...project.layers,
        {
          id: 'track',
          name: 'Track',
          visible: true,
          locked: false,
          expanded: true,
        },
      ],
      objects: [
        ...project.objects,
        {
          ...trackPiece,
          name: 'Curve 450',
          visible: true,
          locked: false,
        },
      ],
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
      validateProjectDocument({ ...validProject(), schemaVersion: 6 }),
    ).toEqual({
      ok: false,
      error: 'Unsupported project schema version: 6.',
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

  it('allows semantic objects to be reparented to any folder', () => {
    const project = validProject()
    const result = validateProjectDocument({
      ...project,
      objects: [
        { ...project.objects[2], layerId: 'scenery' },
        { ...project.objects[3], layerId: 'room' },
      ],
    })
    expect(result.ok).toBe(true)
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
