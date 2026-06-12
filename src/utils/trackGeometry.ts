import { getTrackDefinition } from '../data/trackCatalog'
import type {
  Point,
  TrackConnector,
  TrackCurveDirection,
  TrackPieceObject,
} from '../types'

export const TRACK_SNAP_DISTANCE_MM = 150
export const CONNECTOR_OCCUPIED_TOLERANCE_MM = 1
export const TRACK_ROTATION_STEP = 15

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180

export const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

export const rotatePoint = (point: Point, rotation: number): Point => {
  const radians = degreesToRadians(rotation)
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)

  const x = point.x * cosine - point.y * sine
  const y = point.x * sine + point.y * cosine

  return {
    x: Math.abs(x) < 1e-10 ? 0 : x,
    y: Math.abs(y) < 1e-10 ? 0 : y,
  }
}

const directionSign = (direction: TrackCurveDirection) =>
  direction === 'right' ? 1 : -1

export const getTrackLength = (object: TrackPieceObject): number => {
  const definition = getTrackDefinition(object.definitionId)
  if (definition.kind === 'straight') {
    return definition.lengthMm ?? 0
  }

  return (
    (definition.radiusMm ?? 0) *
    degreesToRadians(definition.angleDegrees ?? 0)
  )
}

export const getTrackLocalEnd = (object: TrackPieceObject): Point => {
  const definition = getTrackDefinition(object.definitionId)
  if (definition.kind === 'straight') {
    return { x: definition.lengthMm ?? 0, y: 0 }
  }

  const radius = definition.radiusMm ?? 0
  const angle = degreesToRadians(definition.angleDegrees ?? 0)
  const sign = directionSign(object.direction)

  return {
    x: radius * Math.sin(angle),
    y: sign * radius * (1 - Math.cos(angle)),
  }
}

export const getTrackEndHeading = (object: TrackPieceObject): number => {
  const definition = getTrackDefinition(object.definitionId)
  const turn =
    definition.kind === 'curve'
      ? directionSign(object.direction) * (definition.angleDegrees ?? 0)
      : 0

  return normalizeRotation(object.rotation + turn)
}

export const getTrackEndPoint = (object: TrackPieceObject): Point => {
  const offset = rotatePoint(getTrackLocalEnd(object), object.rotation)
  return {
    x: object.position.x + offset.x,
    y: object.position.y + offset.y,
  }
}

export const getTrackConnectors = (
  object: TrackPieceObject,
): TrackConnector[] => [
  {
    objectId: object.id,
    end: 'start',
    position: { ...object.position },
    heading: normalizeRotation(object.rotation + 180),
  },
  {
    objectId: object.id,
    end: 'end',
    position: getTrackEndPoint(object),
    heading: getTrackEndHeading(object),
  },
]

export const getTrackPathData = (object: TrackPieceObject): string => {
  const end = getTrackEndPoint(object)
  const definition = getTrackDefinition(object.definitionId)

  if (definition.kind === 'straight') {
    return `M ${object.position.x} ${object.position.y} L ${end.x} ${end.y}`
  }

  const radius = definition.radiusMm ?? 0
  const sweep = object.direction === 'right' ? 1 : 0
  return `M ${object.position.x} ${object.position.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`
}

const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y)

export const getAvailableTrackConnectors = (
  objects: TrackPieceObject[],
): TrackConnector[] => {
  const connectors = objects.flatMap(getTrackConnectors)

  return connectors.filter(
    (connector) =>
      !connectors.some(
        (candidate) =>
          candidate.objectId !== connector.objectId &&
          distance(candidate.position, connector.position) <=
            CONNECTOR_OCCUPIED_TOLERANCE_MM,
      ),
  )
}

export const findNearestTrackConnector = (
  pointer: Point,
  objects: TrackPieceObject[],
  maximumDistance = TRACK_SNAP_DISTANCE_MM,
): TrackConnector | null => {
  let nearest: TrackConnector | null = null
  let nearestDistance = maximumDistance

  for (const connector of getAvailableTrackConnectors(objects)) {
    const connectorDistance = distance(pointer, connector.position)
    if (connectorDistance <= nearestDistance) {
      nearest = connector
      nearestDistance = connectorDistance
    }
  }

  return nearest
}

export const getTrackBounds = (object: TrackPieceObject) => {
  const definition = getTrackDefinition(object.definitionId)
  const points: Point[] = [{ ...object.position }, getTrackEndPoint(object)]

  if (definition.kind === 'curve') {
    const angle = definition.angleDegrees ?? 0
    const radius = definition.radiusMm ?? 0
    const sign = directionSign(object.direction)

    for (let step = 1; step < angle; step += 1) {
      const radians = degreesToRadians(step)
      const local = {
        x: radius * Math.sin(radians),
        y: sign * radius * (1 - Math.cos(radians)),
      }
      const rotated = rotatePoint(local, object.rotation)
      points.push({
        x: object.position.x + rotated.x,
        y: object.position.y + rotated.y,
      })
    }
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}
