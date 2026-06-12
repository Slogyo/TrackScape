import type {
  CanvasObject,
  Layer,
  Point,
  ProjectDocumentV3,
  ProjectMetadata,
} from '../types'
import { isTrackDefinitionId } from '../data/trackCatalog'
import {
  DEFAULT_LAYOUT_SCALE_ID,
  isLayoutScaleId,
} from '../data/layoutScales'
import { getTrackBounds } from './trackGeometry'

export const PROJECT_SCHEMA_VERSION = 3
export const PROJECT_NAME_MAX_LENGTH = 80

export type ProjectValidationResult =
  | { ok: true; project: ProjectDocumentV3 }
  | { ok: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  Number.isFinite(Date.parse(value))

const validateMetadata = (
  value: unknown,
): { ok: true; metadata: ProjectMetadata } | { ok: false; error: string } => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Project metadata is missing or invalid.' }
  }

  if (!isNonEmptyString(value.id)) {
    return { ok: false, error: 'Project metadata requires an ID.' }
  }

  if (
    !isNonEmptyString(value.name) ||
    value.name.trim().length > PROJECT_NAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Project name must be between 1 and ${PROJECT_NAME_MAX_LENGTH} characters.`,
    }
  }

  if (!isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) {
    return { ok: false, error: 'Project timestamps are invalid.' }
  }

  return {
    ok: true,
    metadata: {
      id: value.id,
      name: value.name.trim(),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  }
}

const validateLayers = (
  value: unknown,
): { ok: true; layers: Layer[] } | { ok: false; error: string } => {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'A project requires at least one layer.' }
  }

  const ids = new Set<string>()
  const layers: Layer[] = []

  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.name) ||
      typeof candidate.visible !== 'boolean' ||
      typeof candidate.locked !== 'boolean'
    ) {
      return { ok: false, error: 'One or more layers are invalid.' }
    }

    if (ids.has(candidate.id)) {
      return { ok: false, error: `Duplicate layer ID: ${candidate.id}.` }
    }

    ids.add(candidate.id)
    layers.push({
      id: candidate.id,
      name: candidate.name,
      visible: candidate.visible,
      locked: candidate.locked,
    })
  }

  return { ok: true, layers }
}

const validatePoint = (value: unknown): value is Point =>
  isRecord(value) &&
  isFiniteNonNegativeNumber(value.x) &&
  isFiniteNonNegativeNumber(value.y)

const validateObjects = (
  value: unknown,
  layers: Layer[],
  allowTrackPieces: boolean,
): { ok: true; objects: CanvasObject[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'Project objects must be an array.' }
  }

  const layerIds = new Set(layers.map((layer) => layer.id))
  const objectIds = new Set<string>()
  const objects: CanvasObject[] = []

  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.layerId) ||
      !layerIds.has(candidate.layerId)
    ) {
      return {
        ok: false,
        error: 'One or more objects have invalid IDs or layer references.',
      }
    }

    if (objectIds.has(candidate.id)) {
      return { ok: false, error: `Duplicate object ID: ${candidate.id}.` }
    }
    objectIds.add(candidate.id)

    if (candidate.type === 'line') {
      if (
        !validatePoint(candidate.start) ||
        !validatePoint(candidate.end) ||
        (candidate.start.x === candidate.end.x &&
          candidate.start.y === candidate.end.y)
      ) {
        return { ok: false, error: `Line ${candidate.id} has invalid geometry.` }
      }

      objects.push({
        id: candidate.id,
        type: 'line',
        layerId: candidate.layerId,
        start: { x: candidate.start.x, y: candidate.start.y },
        end: { x: candidate.end.x, y: candidate.end.y },
      })
      continue
    }

    if (candidate.type === 'track-piece') {
      if (!allowTrackPieces) {
        return {
          ok: false,
          error: 'Track pieces are not supported by project schema version 1.',
        }
      }

      if (
        candidate.layerId !== 'track' ||
        !isTrackDefinitionId(candidate.definitionId) ||
        !validatePoint(candidate.position) ||
        typeof candidate.rotation !== 'number' ||
        !Number.isFinite(candidate.rotation) ||
        candidate.rotation < 0 ||
        candidate.rotation >= 360 ||
        candidate.rotation % 15 !== 0 ||
        (candidate.direction !== 'left' && candidate.direction !== 'right')
      ) {
        return {
          ok: false,
          error: `Track piece ${candidate.id} has invalid geometry or catalog data.`,
        }
      }

      const trackPiece: CanvasObject = {
        id: candidate.id,
        type: 'track-piece',
        layerId: 'track',
        definitionId: candidate.definitionId,
        position: {
          x: candidate.position.x,
          y: candidate.position.y,
        },
        rotation: candidate.rotation,
        direction: candidate.direction,
      }
      const bounds = getTrackBounds(trackPiece)
      if (bounds.minX < -0.001 || bounds.minY < -0.001) {
        return {
          ok: false,
          error: `Track piece ${candidate.id} crosses the workspace origin.`,
        }
      }

      objects.push(trackPiece)
      continue
    }

    if (
      candidate.type !== 'rectangle' &&
      candidate.type !== 'room' &&
      candidate.type !== 'tabletop'
    ) {
      return { ok: false, error: `Object ${candidate.id} has an unknown type.` }
    }

    if (
      !isFiniteNonNegativeNumber(candidate.x) ||
      !isFiniteNonNegativeNumber(candidate.y) ||
      !isPositiveNumber(candidate.width) ||
      !isPositiveNumber(candidate.height)
    ) {
      return {
        ok: false,
        error: `Object ${candidate.id} has invalid rectangular geometry.`,
      }
    }

    if (candidate.type === 'room' && candidate.layerId !== 'room') {
      return {
        ok: false,
        error: `Room ${candidate.id} must belong to the Room layer.`,
      }
    }

    if (candidate.type === 'tabletop' && candidate.layerId !== 'tabletop') {
      return {
        ok: false,
        error: `Tabletop ${candidate.id} must belong to the Tabletop layer.`,
      }
    }

    objects.push({
      id: candidate.id,
      type: candidate.type,
      layerId: candidate.layerId,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
    } as CanvasObject)
  }

  return { ok: true, objects }
}

export const validateProjectDocument = (
  value: unknown,
): ProjectValidationResult => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Project data must be a JSON object.' }
  }

  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3
  ) {
    return {
      ok: false,
      error: `Unsupported project schema version: ${String(value.schemaVersion)}.`,
    }
  }

  const metadataResult = validateMetadata(value.metadata)
  if (!metadataResult.ok) {
    return metadataResult
  }

  if (
    !isRecord(value.settings) ||
    (value.settings.measurementSystem !== 'metric' &&
      value.settings.measurementSystem !== 'imperial')
  ) {
    return { ok: false, error: 'Project measurement settings are invalid.' }
  }

  let layoutScaleId = DEFAULT_LAYOUT_SCALE_ID
  if (value.schemaVersion === 3) {
    const candidateScaleId = value.settings.layoutScaleId
    if (!isLayoutScaleId(candidateScaleId)) {
      return { ok: false, error: 'Project layout scale is invalid.' }
    }
    layoutScaleId = candidateScaleId
  }

  const layersResult = validateLayers(value.layers)
  if (!layersResult.ok) {
    return layersResult
  }

  const objectsResult = validateObjects(
    value.objects,
    layersResult.layers,
    value.schemaVersion >= 2,
  )
  if (!objectsResult.ok) {
    return objectsResult
  }

  return {
    ok: true,
    project: {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      metadata: metadataResult.metadata,
      settings: {
        measurementSystem: value.settings.measurementSystem,
        layoutScaleId,
      },
      layers: layersResult.layers,
      objects: objectsResult.objects,
    },
  }
}

export const parseProjectDocument = (
  json: string,
): ProjectValidationResult => {
  try {
    return validateProjectDocument(JSON.parse(json))
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' }
  }
}

export const serializeProjectDocument = (
  project: ProjectDocumentV3,
): string => JSON.stringify(project, null, 2)

export const validateProjectName = (name: string): string | null => {
  if (name.trim().length === 0) {
    return 'Project name cannot be blank.'
  }

  if (name.trim().length > PROJECT_NAME_MAX_LENGTH) {
    return `Project name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters.`
  }

  return null
}

export const createProjectMetadata = (
  id: string,
  now: string,
): ProjectMetadata => ({
  id,
  name: 'Untitled Layout',
  createdAt: now,
  updatedAt: now,
})

export const getProjectFilename = (name: string): string => {
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${safeName || 'untitled-layout'}.trackscape.json`
}
