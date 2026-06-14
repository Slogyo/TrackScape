import { getTrackDefinition } from '../data/trackCatalog'
import type {
  Point,
  TrackConnector,
  TrackCurveDirection,
  TrackDefinition,
  TrackPieceObject,
} from '../types'

export const TRACK_SNAP_RADIUS_PX = 18
export const TRACK_CONNECTOR_REVEAL_RADIUS_PX = 84
export const CONNECTOR_OCCUPIED_TOLERANCE_MM = 1
export const TRACK_ROTATION_STEP = 15

const ENDPOINT_MERGE_TOLERANCE_MM = 0.01
const ENDPOINT_HEADING_TOLERANCE_DEGREES = 0.01

export type TrackRouteRole =
  | 'main'
  | 'branch'
  | 'crossing'
  | 'crossover'

export interface TrackRouteGeometry {
  id: string
  role: TrackRouteRole
  path: string
  points: Point[]
  start: Point
  end: Point
  startHeading: number
  endHeading: number
  lengthMm: number
  sleeperStartMm: number
  connectStart: boolean
  connectEnd: boolean
}

export interface LocalTrackConnector {
  id: string
  end: string
  position: Point
  heading: number
  routeIds: string[]
}

export interface TrackLocalGeometry {
  definition: TrackDefinition
  routes: TrackRouteGeometry[]
  connectors: LocalTrackConnector[]
}

export interface SnappedTrackPlacement {
  object: TrackPieceObject
  sourceConnector: LocalTrackConnector
  targetConnector: TrackConnector
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

export const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

const shortestAngleDistance = (first: number, second: number): number => {
  const delta = Math.abs(normalizeRotation(first) - normalizeRotation(second))
  return Math.min(delta, 360 - delta)
}

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

const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const pointsToPath = (points: Point[]): string =>
  points.length === 0
    ? 'M 0 0'
    : points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
        )
        .join(' ')

const polylineLength = (points: Point[]): number =>
  points.slice(1).reduce(
    (total, point, index) => total + distance(points[index], point),
    0,
  )

const createRoute = (
  id: string,
  role: TrackRouteRole,
  points: Point[],
  startHeading: number,
  endHeading: number,
  sleeperStartMm = 0,
  connectStart = true,
  connectEnd = true,
): TrackRouteGeometry => ({
  id,
  role,
  path: pointsToPath(points),
  points,
  start: points[0] ?? { x: 0, y: 0 },
  end: points[points.length - 1] ?? { x: 0, y: 0 },
  startHeading: normalizeRotation(startHeading),
  endHeading: normalizeRotation(endHeading),
  lengthMm: polylineLength(points),
  sleeperStartMm,
  connectStart,
  connectEnd,
})

const lineRoute = (
  id: string,
  start: Point,
  end: Point,
  heading: number,
  role: TrackRouteRole = 'main',
  sleeperStartMm = 0,
  connectStart = true,
  connectEnd = true,
): TrackRouteGeometry =>
  createRoute(
    id,
    role,
    [start, end],
    heading,
    heading,
    sleeperStartMm,
    connectStart,
    connectEnd,
  )

const arcRoute = (
  id: string,
  radius: number,
  angleDegrees: number,
  direction: TrackCurveDirection,
  role: TrackRouteRole = 'main',
  targetX?: number,
  sleeperStartMm = 0,
  connectStart = true,
  connectEnd = true,
): TrackRouteGeometry => {
  const sign = direction === 'right' ? 1 : -1
  const points: Point[] = []
  const sampleCount = Math.max(8, Math.ceil(angleDegrees / 1.5))

  for (let index = 0; index <= sampleCount; index += 1) {
    const sampleAngle =
      degreesToRadians((angleDegrees * index) / sampleCount)
    const x = radius * Math.sin(sampleAngle)
    const y = sign * radius * (1 - Math.cos(sampleAngle))
    points.push({
      x: Math.abs(x) < 1e-10 ? 0 : x,
      y: Math.abs(y) < 1e-10 ? 0 : y,
    })
  }

  const angle = degreesToRadians(angleDegrees)
  const arcEnd = points[points.length - 1]
  if (targetX && targetX > arcEnd.x) {
    const extension = (targetX - arcEnd.x) / Math.cos(angle)
    points.push({
      x: arcEnd.x + extension * Math.cos(angle),
      y: arcEnd.y + sign * extension * Math.sin(angle),
    })
  }

  return createRoute(
    id,
    role,
    points,
    0,
    sign * angleDegrees,
    sleeperStartMm,
    connectStart,
    connectEnd,
  )
}

const cubicRoute = (
  id: string,
  role: TrackRouteRole,
  start: Point,
  end: Point,
  startHeading: number,
  endHeading: number,
  sleeperStartMm = 0,
  connectStart = true,
  connectEnd = true,
): TrackRouteGeometry => {
  const chord = distance(start, end)
  const controlDistance = chord * 0.4
  const startRadians = degreesToRadians(startHeading)
  const endRadians = degreesToRadians(endHeading)
  const firstControl = {
    x: start.x + Math.cos(startRadians) * controlDistance,
    y: start.y + Math.sin(startRadians) * controlDistance,
  }
  const secondControl = {
    x: end.x - Math.cos(endRadians) * controlDistance,
    y: end.y - Math.sin(endRadians) * controlDistance,
  }
  const points: Point[] = []

  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32
    const inverse = 1 - t
    points.push({
      x:
        inverse ** 3 * start.x +
        3 * inverse ** 2 * t * firstControl.x +
        3 * inverse * t ** 2 * secondControl.x +
        t ** 3 * end.x,
      y:
        inverse ** 3 * start.y +
        3 * inverse ** 2 * t * firstControl.y +
        3 * inverse * t ** 2 * secondControl.y +
        t ** 3 * end.y,
    })
  }

  return createRoute(
    id,
    role,
    points,
    startHeading,
    endHeading,
    sleeperStartMm,
    connectStart,
    connectEnd,
  )
}

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

const getCrossingRoutes = (
  definition: TrackDefinition,
): TrackRouteGeometry[] => {
  const length = definition.lengthMm ?? 0
  const angle = definition.angleDegrees ?? 90
  const gauge = definition.gaugeMm ?? 16.5

  if (definition.topology === 'scissors-crossing') {
    const separation = Math.max(gauge * 4, 36)
    return [
      lineRoute(
        'route-upper',
        { x: 0, y: 0 },
        { x: length, y: 0 },
        0,
        'main',
      ),
      lineRoute(
        'route-lower',
        { x: 0, y: separation },
        { x: length, y: separation },
        0,
        'main',
      ),
      cubicRoute(
        'route-down',
        'crossover',
        { x: 0, y: 0 },
        { x: length, y: separation },
        0,
        0,
        length * 0.1,
      ),
      cubicRoute(
        'route-up',
        'crossover',
        { x: 0, y: separation },
        { x: length, y: 0 },
        0,
        0,
        length * 0.1,
      ),
    ]
  }

  const signedAngle =
    definition.handedness === 'left' ? -angle : angle
  const angleRadians = degreesToRadians(angle)
  const height = Math.abs(length * Math.sin(angleRadians))
  const inset = Math.max(
    0,
    (length - Math.abs(length * Math.cos(angleRadians))) / 2,
  )
  const diagonalStart =
    signedAngle < 0
      ? { x: inset, y: height }
      : { x: inset, y: 0 }
  const diagonalEnd =
    signedAngle < 0
      ? { x: length - inset, y: 0 }
      : { x: length - inset, y: height }

  return [
    lineRoute(
      'route-a',
      { x: 0, y: height / 2 },
      { x: length, y: height / 2 },
      0,
      'crossing',
    ),
    lineRoute(
      'route-b',
      diagonalStart,
      diagonalEnd,
      signedAngle,
      'crossing',
    ),
  ]
}

const getTurnoutRoutes = (
  definition: TrackDefinition,
  object: TrackPieceObject,
): TrackRouteGeometry[] => {
  const radii = definition.radiiMm ?? []
  const radius = definition.radiusMm ?? radii[0]
  const angle = definition.angleDegrees ?? 10
  const length = definition.lengthMm
  const routeLengths = definition.routeLengthsMm ?? []
  const direction = getDefinitionDirection(definition, object)
  const sign = direction === 'right' ? 1 : -1
  const angleForRadius = (candidateRadius: number) =>
    definition.angleDegrees ??
    (length && length <= candidateRadius
      ? radiansToDegrees(Math.asin(length / candidateRadius))
      : angle)

  if (definition.topology === 'catch-turnout') {
    const mainLength = length ?? 100
    const gauge = definition.gaugeMm ?? 16.5
    const branchStart = { x: mainLength * 0.18, y: 0 }
    const branchEnd = {
      x: mainLength * 0.78,
      y: sign * gauge * 1.35,
    }
    const branchHeading = radiansToDegrees(
      Math.atan2(
        branchEnd.y - branchStart.y,
        branchEnd.x - branchStart.x,
      ),
    )

    return [
      lineRoute(
        'route-main',
        { x: 0, y: 0 },
        { x: mainLength, y: 0 },
        0,
        'main',
      ),
      cubicRoute(
        'route-catch',
        'branch',
        branchStart,
        branchEnd,
        0,
        branchHeading,
        mainLength * 0.18,
        false,
        false,
      ),
    ]
  }

  if (
    definition.topology === 'three-way-asymmetric-turnout' &&
    length
  ) {
    const branchRadius = radius ?? Math.max(length, 100)
    const delayedStart = { x: length * 0.22, y: 0 }
    const delayedEnd = {
      x: length,
      y: branchRadius * (1 - Math.cos(degreesToRadians(angle))),
    }

    return [
      lineRoute(
        'route-main',
        { x: 0, y: 0 },
        { x: length, y: 0 },
        0,
        'main',
      ),
      arcRoute(
        'route-left',
        branchRadius,
        angle,
        'left',
        'branch',
        length,
        length * 0.16,
      ),
      cubicRoute(
        'route-right',
        'branch',
        delayedStart,
        delayedEnd,
        0,
        angle,
        length * 0.3,
        false,
        true,
      ),
    ]
  }

  if (
    definition.topology === 'curved-turnout' &&
    radii.length < 2 &&
    routeLengths.length >= 2
  ) {
    const orderedRouteLengths = [...routeLengths]
      .sort((first, second) => second - first)
      .slice(0, 2)
    return orderedRouteLengths.map((routeLength, index) =>
      arcRoute(
        index === 0 ? 'route-outer' : 'route-inner',
        routeLength / degreesToRadians(angle),
        angle,
        direction,
        index === 0 ? 'main' : 'branch',
        undefined,
        index === 0 ? 0 : routeLength * 0.18,
      ),
    )
  }

  if (
    definition.topology === 'curved-turnout' &&
    radii.length >= 2
  ) {
    return radii.slice(0, 2).map((candidate, index) =>
      arcRoute(
        `route-${index + 1}`,
        candidate,
        angleForRadius(candidate),
        direction,
        index === 0 ? 'branch' : 'main',
        undefined,
        index === 0 ? candidate * degreesToRadians(angle) * 0.18 : 0,
      ),
    )
  }

  if (definition.handedness === 'symmetric') {
    const branchRadius = radius ?? Math.max(length ?? 100, 100)
    const branchLength =
      length ?? branchRadius * degreesToRadians(angle)
    const routes: TrackRouteGeometry[] = [
      arcRoute(
        'route-left',
        branchRadius,
        angle,
        'left',
        'branch',
        length,
        branchLength * 0.18,
      ),
      arcRoute(
        'route-right',
        branchRadius,
        angle,
        'right',
        'branch',
        length,
        branchLength * 0.18,
      ),
    ]
    if (definition.topology === 'three-way-turnout' && length) {
      routes.splice(
        1,
        0,
        lineRoute(
          'route-centre',
          { x: 0, y: 0 },
          { x: length, y: 0 },
          0,
          'main',
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
        'branch',
        length,
        mainLength * 0.18,
      )
    : cubicRoute(
        'route-branch',
        'branch',
        { x: 0, y: 0 },
        {
          x: mainLength,
          y:
            sign *
            mainLength *
            Math.tan(degreesToRadians(angle)),
        },
        0,
        sign * angle,
        mainLength * 0.18,
      )

  return [
    lineRoute(
      'route-main',
      { x: 0, y: 0 },
      { x: mainLength, y: 0 },
      0,
      'main',
    ),
    branch,
  ]
}

const getLocalRoutes = (
  object: TrackPieceObject,
  definition: TrackDefinition,
): TrackRouteGeometry[] => {
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

interface EndpointCandidate {
  end: string
  position: Point
  heading: number
  routeId: string
}

const buildLocalConnectors = (
  routes: TrackRouteGeometry[],
): LocalTrackConnector[] => {
  const candidates: EndpointCandidate[] = routes.flatMap((route) => [
    ...(route.connectStart
      ? [
          {
            end: `${route.id}-start`,
            position: route.start,
            heading: normalizeRotation(route.startHeading + 180),
            routeId: route.id,
          },
        ]
      : []),
    ...(route.connectEnd
      ? [
          {
            end: `${route.id}-end`,
            position: route.end,
            heading: normalizeRotation(route.endHeading),
            routeId: route.id,
          },
        ]
      : []),
  ])
  const connectors: LocalTrackConnector[] = []

  for (const candidate of candidates) {
    const existing = connectors.find(
      (connector) =>
        distance(connector.position, candidate.position) <=
          ENDPOINT_MERGE_TOLERANCE_MM &&
        shortestAngleDistance(connector.heading, candidate.heading) <=
          ENDPOINT_HEADING_TOLERANCE_DEGREES,
    )

    if (existing) {
      existing.end = `${existing.end}+${candidate.end}`
      existing.routeIds.push(candidate.routeId)
      continue
    }

    connectors.push({
      id: `connector-${connectors.length + 1}`,
      end: candidate.end,
      position: { ...candidate.position },
      heading: candidate.heading,
      routeIds: [candidate.routeId],
    })
  }

  return connectors
}

export const getTrackLocalGeometry = (
  object: TrackPieceObject,
): TrackLocalGeometry => {
  const definition = getTrackDefinition(object.definitionId)
  const routes = getLocalRoutes(object, definition)
  return {
    definition,
    routes,
    connectors: buildLocalConnectors(routes),
  }
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

const getRouteEnvelopePoints = (
  route: TrackRouteGeometry,
  halfWidth: number,
): Point[] =>
  route.points.flatMap((point, index, points) => {
    const before = points[Math.max(0, index - 1)]
    const after = points[Math.min(points.length - 1, index + 1)]
    const delta = {
      x: after.x - before.x,
      y: after.y - before.y,
    }
    const length = Math.hypot(delta.x, delta.y) || 1
    const normal = {
      x: -delta.y / length,
      y: delta.x / length,
    }
    return [
      {
        x: point.x - normal.x * halfWidth,
        y: point.y - normal.y * halfWidth,
      },
      {
        x: point.x + normal.x * halfWidth,
        y: point.y + normal.y * halfWidth,
      },
    ]
  })

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
): string[] => getTrackLocalGeometry(object).routes.map((route) => route.path)

export const getTrackPathData = (object: TrackPieceObject): string =>
  getTrackPathDataList(object)[0] ?? 'M 0 0'

export const getTrackLocalEnd = (object: TrackPieceObject): Point =>
  getTrackLocalGeometry(object).routes[0]?.end ?? { x: 0, y: 0 }

export const getTrackEndHeading = (object: TrackPieceObject): number =>
  normalizeRotation(
    object.rotation +
      (getTrackLocalGeometry(object).routes[0]?.endHeading ?? 0),
  )

export const getTrackEndPoint = (object: TrackPieceObject): Point =>
  toWorldPoint(getTrackLocalEnd(object), object)

export const getTrackConnectors = (
  object: TrackPieceObject,
): TrackConnector[] =>
  getTrackLocalGeometry(object).connectors.map((connector) => ({
    objectId: object.id,
    connectorId: connector.id,
    end: connector.end,
    position: toWorldPoint(connector.position, object),
    heading: normalizeRotation(object.rotation + connector.heading),
    routeIds: [...connector.routeIds],
  }))

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

export const screenPixelsToMillimetres = (
  screenPixels: number,
  zoom: number,
): number => (screenPixels * 10) / Math.max(zoom, 0.0001)

export const findNearestTrackConnector = (
  pointer: Point,
  objects: TrackPieceObject[],
  maximumDistance = 150,
): TrackConnector | null => {
  let nearest: TrackConnector | null = null
  let nearestDistance = maximumDistance

  for (const connector of getAvailableTrackConnectors(objects)) {
    const connectorDistance = distance(pointer, connector.position)
    if (
      connectorDistance <= maximumDistance &&
      (!nearest || connectorDistance < nearestDistance)
    ) {
      nearest = connector
      nearestDistance = connectorDistance
    }
  }

  return nearest
}

export const snapTrackObjectToConnector = (
  baseObject: TrackPieceObject,
  targetConnector: TrackConnector,
  preferredConnectorIndex?: number,
): SnappedTrackPlacement => {
  const localConnectors = getTrackLocalGeometry(baseObject).connectors
  const desiredHeading = normalizeRotation(targetConnector.heading + 180)
  const sourceConnector =
    preferredConnectorIndex === undefined
      ? ([...localConnectors].sort((first, second) => {
          const firstHeading = normalizeRotation(
            first.heading + baseObject.rotation,
          )
          const secondHeading = normalizeRotation(
            second.heading + baseObject.rotation,
          )
          return (
            shortestAngleDistance(firstHeading, desiredHeading) -
            shortestAngleDistance(secondHeading, desiredHeading)
          )
        })[0] ?? localConnectors[0])
      : localConnectors[
          ((preferredConnectorIndex % localConnectors.length) +
            localConnectors.length) %
            localConnectors.length
        ]
  const rotation = normalizeRotation(
    desiredHeading - (sourceConnector?.heading ?? 180),
  )
  const rotatedSource = rotatePoint(
    sourceConnector?.position ?? { x: 0, y: 0 },
    rotation,
  )

  return {
    object: {
      ...baseObject,
      position: {
        x: targetConnector.position.x - rotatedSource.x,
        y: targetConnector.position.y - rotatedSource.y,
      },
      rotation,
    },
    sourceConnector,
    targetConnector,
  }
}

export const getTrackBounds = (object: TrackPieceObject) => {
  const local = getTrackLocalGeometry(object)
  const gaugeMm = local.definition.gaugeMm ?? 16.5
  const visualHalfWidth =
    local.definition.detailType === 'level-crossing'
      ? gaugeMm * 1.35
      : gaugeMm * 0.85
  const halfWidth =
    visualHalfWidth + Math.max(gaugeMm * 0.12, 1)
  const points = local.routes.flatMap((route) =>
    getRouteEnvelopePoints(route, halfWidth).map((point) =>
      toWorldPoint(point, object),
    ),
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
