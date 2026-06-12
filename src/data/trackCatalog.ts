import type { TrackDefinition, TrackDefinitionId } from '../types'

export const trackCatalog: TrackDefinition[] = [
  {
    id: 'straight-100',
    name: 'Straight 100',
    kind: 'straight',
    lengthMm: 100,
  },
  {
    id: 'straight-200',
    name: 'Straight 200',
    kind: 'straight',
    lengthMm: 200,
  },
  {
    id: 'curve-r300-30',
    name: 'Curve R300 / 30°',
    kind: 'curve',
    radiusMm: 300,
    angleDegrees: 30,
  },
  {
    id: 'curve-r450-30',
    name: 'Curve R450 / 30°',
    kind: 'curve',
    radiusMm: 450,
    angleDegrees: 30,
  },
]

export const getTrackDefinition = (
  definitionId: TrackDefinitionId,
): TrackDefinition =>
  trackCatalog.find((definition) => definition.id === definitionId) ??
  trackCatalog[0]

export const isTrackDefinitionId = (
  value: unknown,
): value is TrackDefinitionId =>
  typeof value === 'string' &&
  trackCatalog.some((definition) => definition.id === value)
