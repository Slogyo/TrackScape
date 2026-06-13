import { getTrackDefinition } from '../data/trackCatalog'
import type {
  Point,
  TrackConnector,
  TrackCurveDirection,
  TrackDefinition,
  TrackPieceObject,
} from '../types'

export const TRACK_SNAP_DISTANCE_MM = 150
export const CONNECTOR_OCCUPIED_TOLERANCE_MM = 1
export const TRACK_ROTATION_STEP = 15

interface LocalRoute {
  id: string
  path: string
  points: Point[]
  start: Point
  end: Point
  startHeading: number
  endHeading: number
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

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

const getDefinitionDirection = (
  definition: TrackDefinition,
  object: TrackPieceObject,
): TrackCurveDirection => {
  if (
    definition.handedness === 'left' ||
    definition.handedness === 'right'
  ) {
    return definition.handedness
  }
  return object.direction
}

const lineRoute = (
  id: string,
  start: Point,
  end: Point,
  heading: number,
): LocalRoute => ({
  id,
  path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
  points: [start, end],
  start,
  end,
  startHeading: normalizeRotation(heading),
  endHeading: normalizeRotation(heading),
})

const angledLineRoute = (
  id: string,
  length: number,
  heading: number,
): LocalRoute => {
  const radians = degreesToRadians(heading)
  return lineRoute(
    id,
    { x: 0, y: 0 },
    {
      x: length * Math.cos(radians),
      y: length * Math.sin(radians),
    },
    heading,
  )
}

const arcRoute = (
  id: string,
  radius: number,
  angleDegrees: number,
  direction: TrackCurveDirection,
  targetLength?: number,
): LocalRoute => {
  const sign = directionSign(direction)
  const angle = degreesToRadians(angleDegrees)
  const arcEnd = {
    x: radius * Math.sin(angle),
    y: sign * radius * (1 - Math.cos(angle)),
  }
  const points: Point[] = [{ x: 0, y: 0 }]

  for (let step = 1; step <= angleDegrees; step += 1) {
    const sampleAngle = degreesToRadians(Math.min(step, angleDegrees))
    points.push({
      x: radius * Math.sin(sampleAngle),
      y: sign * radius * (1 - Math.cos(sampleAngle)),
    })
  }
  const lastPoint = points[points.length - 1]
  if (
    Math.abs(lastPoint.x - arcEnd.x) > 1e-9 ||
    Math.abs(lastPoint.y - arcEnd.y) > 1e-9
  ) {
    points.push(arcEnd)
  }

  let end = arcEnd
  let path = `M 0 0 A ${radius} ${radius} 0 0 ${
    direction === 'right' ? 1 : 0
  } ${arcEnd.x} ${arcEnd.y}`

  if (targetLength && targetLength > arcEnd.x) {
    const extension = (targetLength - arcEnd.x) / Math.cos(angle)
    end = {
      x: arcEnd.x + extension * Math.cos(angle),
      y: arcEnd.y + sign * extension * Math.sin(angle),
    }
    points.push(end)
    path += ` L ${end.x} ${end.y}`
  }

  return {
    id,
    path,
    points,
    start: { x: 0, y: 0 },
    end,
    startHeading: 0,
    endHeading: sign * angleDegrees,
  }
}

const getCrossingRoutes = (
  definition: TrackDefinition,
): LocalRoute[] => {
  const length = definition.lengthMm ?? 0
  const angle = definition.angleDegrees ?? 90
  const height =
    Math.abs(angle - 90) < 0.001
      ? length
      : Math.abs(length * Math.tan(degreesToRadians(angle)))

  return [
    lineRoute(
      'route-a',
      { x: 0, y: height / 2 },
      { x: length, y: height / 2 },
      0,
    ),
    lineRoute(
      'route-b',
      { x: 0, y: 0 },
      { x: length, y: height },
      angle,
    ),
  ]
}

const getTurnoutRoutes = (
  definition: TrackDefinition,
  object: TrackPieceObject,
): LocalRoute[] => {
  const radii = definition.radiiMm ?? []
  const radius = definition.radiusMm ?? radii[0]
  const angle = definition.angleDegrees ?? 10
  const length = definition.lengthMm
  const routeLengths = definition.routeLengthsMm ?? []
  const direction = getDefinitionDirection(definition, object)
  const angleForRadius = (candidateRadius: number) =>
    definition.angleDegrees ??
    (length && length <= candidateRadius
      ? radiansToDegrees(Math.asin(length / candidateRadius))
      : angle)

  if (
    /curved turnout/i.test(definition.name) &&
    radii.length < 2 &&
    routeLengths.length >= 2
  ) {
    const [innerLength, outerLength] = routeLengths
    return [
      angledLineRoute('route-outer', outerLength, 0),
      angledLineRoute(
        'route-inner',
        innerLength,
        directionSign(direction) * angle,
      ),
    ]
  }

  if (/curved turnout/i.test(definition.name) && radii.length >= 2) {
    return radii.slice(0, 2).map((candidate, index) =>
      arcRoute(
        `route-${index + 1}`,
        candidate,
        angleForRadius(candidate),
        direction,
      ),
    )
  }

  if (definition.handedness === 'symmetric') {
    const branchRadius = radius ?? Math.max(length ?? 100, 100)
    const routes = [
      arcRoute('route-left', branchRadius, angle, 'left', length),
      arcRoute('route-right', branchRadius, angle, 'right', length),
    ]
    if (/3 way/i.test(definition.name) && length) {
      routes.splice(
        1,
        0,
        lineRoute(
          'route-centre',
          { x: 0, y: 0 },
          { x: length, y: 0 },
          0,
        ),
      )
    }
    return routes
  }

  const mainLength =
    length ??
    (radius && angle ? radius * degreesToRadians(angle) : 100)
  const branch = radius
    ? arcRoute(
        'route-branch',
        radius,
        angleForRadius(radius),
        direction,
        length,
      )
    : lineRoute(
        'route-branch',
        { x: 0, y: 0 },
        {
          x: mainLength,
          y:
            directionSign(direction) *
            mainLength *
            Math.tan(degreesToRadians(angle)),
        },
        directionSign(direction) * angle,
      )

  return [
    lineRoute(
      'route-main',
      { x: 0, y: 0 },
      { x: mainLength, y: 0 },
      0,
    ),
    branch,
  ]
}

const getLocalRoutes = (object: TrackPieceObject): LocalRoute[] => {
  const definition = getTrackDefinition(object.definitionId)
  const radius = definition.radiusMm ?? definition.radiiMm?.[0]
  const angle = definition.angleDegrees ?? 0

  if (definition.kind === 'curve' && radius && angle) {
    return [
      arcRoute(
        'route-main',
        radius,
        angle,
        getDefinitionDirection(definition, object),
      ),
    ]
  }
  if (definition.kind === 'turnout') {
    return getTurnoutRoutes(definition, object)
  }
  if (definition.kind === 'crossing') {
    return getCrossingRoutes(definition)
  }

  const length = definition.lengthMm ?? 0
  return [
    lineRoute(
      'route-main',
      { x: 0, y: 0 },
      { x: length, y: 0 },
      0,
    ),
  ]
}

const toWorldPoint = (
  point: Point,
  object: TrackPieceObject,
): Point => {
  const rotated = rotatePoint(point, object.rotation)
  return {
    x: object.position.x + rotated.x,
    y: object.position.y + rotated.y,
  }
}

export const getTrackLength = (object: TrackPieceObject): number => {
  const definition = getTrackDefinition(object.definitionId)
  if (definition.routeLengthsMm?.length) {
    return Math.max(...definition.routeLengthsMm)
  }
  if (definition.lengthMm) {
    return definition.lengthMm
  }

  const radii = definition.radiiMm ?? []
  const radius = Math.max(definition.radiusMm ?? 0, ...radii, 0)
  return radius * degreesToRadians(definition.angleDegrees ?? 0)
}

export const getTrackPathDataList = (
  object: TrackPieceObject,
): string[] => getLocalRoutes(object).map((route) => route.path)

export const getTrackPathData = (object: TrackPieceObject): string =>
  getTrackPathDataList(object)[0] ?? 'M 0 0'

export const getTrackLocalEnd = (object: TrackPieceObject): Point =>
  getLocalRoutes(object)[0]?.end ?? { x: 0, y: 0 }

export const getTrackEndHeading = (object: TrackPieceObject): number =>
  normalizeRotation(
    object.rotation + (getLocalRoutes(object)[0]?.endHeading ?? 0),
  )

export const getTrackEndPoint = (object: TrackPieceObject): Point =>
  toWorldPoint(getTrackLocalEnd(object), object)

export const getTrackConnectors = (
  object: TrackPieceObject,
): TrackConnector[] =>
  getLocalRoutes(object).flatMap((route) => [
    {
      objectId: object.id,
      end: `${route.id}-start`,
      position: toWorldPoint(route.start, object),
      heading: normalizeRotation(
        object.rotation + route.startHeading + 180,
      ),
    },
    {
      objectId: object.id,
      end: `${route.id}-end`,
      position: toWorldPoint(route.end, object),
      heading: normalizeRotation(object.rotation + route.endHeading),
    },
  ])

const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y)

export const getAvailableTrackConnectors = (
  objects: TrackPieceObject[],
): TrackConnector[] => {
  const connectors = objects.flatMap(getTrackConnectors)

  return connectors.filter(
    (connector, index) =>
      !connectors.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
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
  const points = getLocalRoutes(object).flatMap((route) =>
    route.points.map((point) => toWorldPoint(point, object)),
  )

  if (points.length === 0) {
    points.push({ ...object.position })
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

export const getTrackLabelPosition = (
  object: TrackPieceObject,
): Point => {
  const bounds = getTrackBounds(object)
  const placeBelow = bounds.minY < 100
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: placeBelow ? bounds.maxY + 80 : bounds.minY - 60,
  }
}
