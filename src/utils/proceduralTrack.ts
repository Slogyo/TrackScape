import type { Point, TrackPieceObject } from '../types'
import {
  getTrackLocalGeometry,
  type TrackRouteGeometry,
} from './trackGeometry'

export interface ProceduralPath {
  id: string
  path: string
  kind:
    | 'rail'
    | 'stock-rail'
    | 'closure-rail'
    | 'switch-rail'
    | 'frog'
    | 'guard-rail'
    | 'pit-edge'
}

export interface ProceduralArea {
  id: string
  path: string
  kind: 'inspection-pit-floor' | 'level-crossing-deck'
}

export interface ProceduralSleeper {
  id: string
  start: Point
  end: Point
}

export interface ProceduralTrackGeometry {
  routes: TrackRouteGeometry[]
  areas: ProceduralArea[]
  rails: ProceduralPath[]
  sleepers: ProceduralSleeper[]
  details: ProceduralPath[]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  gaugeMm: number
}

interface SampledPoint {
  point: Point
  tangent: Point
}

const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const normalize = (vector: Point): Point => {
  const length = Math.hypot(vector.x, vector.y) || 1
  return { x: vector.x / length, y: vector.y / length }
}

const normalFor = (tangent: Point): Point => ({
  x: -tangent.y,
  y: tangent.x,
})

const pointAtDistance = (
  route: TrackRouteGeometry,
  targetDistance: number,
): SampledPoint => {
  const clampedDistance = Math.max(
    0,
    Math.min(targetDistance, route.lengthMm),
  )
  let travelled = 0

  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]
    const end = route.points[index]
    const segmentLength = distance(start, end)
    if (travelled + segmentLength >= clampedDistance) {
      const ratio =
        segmentLength === 0
          ? 0
          : (clampedDistance - travelled) / segmentLength
      return {
        point: {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        },
        tangent: normalize({
          x: end.x - start.x,
          y: end.y - start.y,
        }),
      }
    }
    travelled += segmentLength
  }

  const end = route.points[route.points.length - 1] ?? { x: 0, y: 0 }
  const beforeEnd =
    route.points[route.points.length - 2] ?? {
      x: end.x - 1,
      y: end.y,
    }
  return {
    point: end,
    tangent: normalize({
      x: end.x - beforeEnd.x,
      y: end.y - beforeEnd.y,
    }),
  }
}

const offsetRoutePoints = (
  route: TrackRouteGeometry,
  offset: number,
): Point[] =>
  route.points.map((point, index, points) => {
    const before = points[Math.max(0, index - 1)]
    const after = points[Math.min(points.length - 1, index + 1)]
    const tangent = normalize({
      x: after.x - before.x,
      y: after.y - before.y,
    })
    const normal = normalFor(tangent)
    return {
        x: point.x + normal.x * offset,
        y: point.y + normal.y * offset,
      }
  })

const pointsToPath = (points: Point[]): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ')

const offsetRoutePath = (
  route: TrackRouteGeometry,
  offset: number,
): string => pointsToPath(offsetRoutePoints(route, offset))

const routeEnvelopePath = (
  route: TrackRouteGeometry,
  halfWidth: number,
): string => {
  const firstSide = offsetRoutePoints(route, -halfWidth)
  const secondSide = offsetRoutePoints(route, halfWidth).reverse()
  return `${pointsToPath([...firstSide, ...secondSide])} Z`
}

const offsetSegmentPath = (
  route: TrackRouteGeometry,
  startDistance: number,
  endDistance: number,
  offset: number,
): string => {
  const sampleCount = 12
  const points = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const sampleDistance =
      startDistance +
      ((endDistance - startDistance) * index) / sampleCount
    const sample = pointAtDistance(route, sampleDistance)
    const normal = normalFor(sample.tangent)
    return {
      x: sample.point.x + normal.x * offset,
      y: sample.point.y + normal.y * offset,
    }
  })

  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ')
}

const gaugeFallback = (object: TrackPieceObject): number => {
  const { definition } = getTrackLocalGeometry(object)
  if (definition.gaugeMm) {
    return definition.gaugeMm
  }
  if (definition.gaugeId === 'n') {
    return 9
  }
  if (definition.gaugeId === 'o') {
    return 32
  }
  return 16.5
}

const getSleeperDimensions = (gaugeMm: number) => ({
  length: gaugeMm * 1.7,
  spacing: Math.max(4.5, gaugeMm * 0.5),
})

const createSleepers = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
  isTurnout: boolean,
  omitSleepers: boolean,
): ProceduralSleeper[] => {
  if (omitSleepers) {
    return []
  }

  const dimensions = getSleeperDimensions(gaugeMm)
  if (isTurnout) {
    const primary =
      routes.find((route) => route.role === 'main') ??
      [...routes].sort(
        (first, second) => second.lengthMm - first.lengthMm,
      )[0]
    if (!primary) {
      return []
    }

    const sleepers: ProceduralSleeper[] = []
    for (
      let along = dimensions.spacing / 2;
      along <= primary.lengthMm - dimensions.spacing / 3;
      along += dimensions.spacing
    ) {
      const base = pointAtDistance(primary, along)
      const normal = normalFor(base.tangent)
      const fraction = along / Math.max(primary.lengthMm, 1)
      const projections = routes.flatMap((route) => {
        const routeDistance = fraction * route.lengthMm
        if (routeDistance < route.sleeperStartMm) {
          return []
        }
        const sample = pointAtDistance(route, routeDistance)
        return [
          (sample.point.x - base.point.x) * normal.x +
            (sample.point.y - base.point.y) * normal.y,
        ]
      })
      const minProjection = Math.min(0, ...projections)
      const maxProjection = Math.max(0, ...projections)
      const margin = dimensions.length / 2
      sleepers.push({
        id: `${primary.id}-turnout-sleeper-${sleepers.length + 1}`,
        start: {
          x: base.point.x + normal.x * (minProjection - margin),
          y: base.point.y + normal.y * (minProjection - margin),
        },
        end: {
          x: base.point.x + normal.x * (maxProjection + margin),
          y: base.point.y + normal.y * (maxProjection + margin),
        },
      })
    }
    return sleepers
  }

  const sleepers: ProceduralSleeper[] = []
  const centres: Point[] = []

  for (const route of routes) {
    const start = Math.max(
      dimensions.spacing / 2,
      route.sleeperStartMm,
    )
    for (
      let along = start;
      along <= route.lengthMm - dimensions.spacing / 3;
      along += dimensions.spacing
    ) {
      const sample = pointAtDistance(route, along)
      if (
        centres.some(
          (centre) =>
            distance(centre, sample.point) < dimensions.spacing * 0.42,
        )
      ) {
        continue
      }
      centres.push(sample.point)
      const normal = normalFor(sample.tangent)
      const halfLength = dimensions.length / 2
      sleepers.push({
        id: `${route.id}-sleeper-${sleepers.length + 1}`,
        start: {
          x: sample.point.x - normal.x * halfLength,
          y: sample.point.y - normal.y * halfLength,
        },
        end: {
          x: sample.point.x + normal.x * halfLength,
          y: sample.point.y + normal.y * halfLength,
        },
      })
    }
  }

  return sleepers
}

const createRailPaths = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
  isTurnout: boolean,
): ProceduralPath[] =>
  routes.flatMap((route) => {
    const kind = isTurnout
      ? route.role === 'main'
        ? 'stock-rail'
        : 'closure-rail'
      : 'rail'
    return [
      {
        id: `${route.id}-rail-left`,
        path: offsetRoutePath(route, -gaugeMm / 2),
        kind,
      },
      {
        id: `${route.id}-rail-right`,
        path: offsetRoutePath(route, gaugeMm / 2),
        kind,
      },
    ]
  })

const createTurnoutDetails = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
): ProceduralPath[] => {
  const details: ProceduralPath[] = []
  const branches = routes.filter((route) => route.role === 'branch')

  branches.forEach((branch, index) => {
    const switchStart = Math.max(gaugeMm * 0.8, branch.lengthMm * 0.08)
    const switchEnd = branch.lengthMm * 0.43
    details.push({
      id: `${branch.id}-switch-${index}`,
      kind: 'switch-rail',
      path: offsetSegmentPath(
        branch,
        switchStart,
        switchEnd,
        index % 2 === 0 ? -gaugeMm / 2 : gaugeMm / 2,
      ),
    })

    const guardStart = branch.lengthMm * 0.62
    const guardEnd = branch.lengthMm * 0.82
    details.push(
      {
        id: `${branch.id}-guard-inner-${index}`,
        kind: 'guard-rail',
        path: offsetSegmentPath(
          branch,
          guardStart,
          guardEnd,
          -gaugeMm * 0.72,
        ),
      },
      {
        id: `${branch.id}-frog-${index}`,
        kind: 'frog',
        path: offsetSegmentPath(
          branch,
          branch.lengthMm * 0.48,
          branch.lengthMm * 0.72,
          gaugeMm * 0.18,
        ),
      },
    )
  })

  const main = routes.find((route) => route.role === 'main')
  if (main && branches.length > 0) {
    details.push({
      id: `${main.id}-guard`,
      kind: 'guard-rail',
      path: offsetSegmentPath(
        main,
        main.lengthMm * 0.58,
        main.lengthMm * 0.8,
        gaugeMm * 0.72,
      ),
    })
  }

  return details
}

const createCrossingDetails = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
): ProceduralPath[] =>
  routes.flatMap((route, index) => [
    {
      id: `${route.id}-check-left-${index}`,
      kind: 'guard-rail',
      path: offsetSegmentPath(
        route,
        route.lengthMm * 0.36,
        route.lengthMm * 0.64,
        -gaugeMm * 0.72,
      ),
    },
    {
      id: `${route.id}-check-right-${index}`,
      kind: 'guard-rail',
      path: offsetSegmentPath(
        route,
        route.lengthMm * 0.36,
        route.lengthMm * 0.64,
        gaugeMm * 0.72,
      ),
    },
  ])

const createSlipDetails = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
  isDouble: boolean,
): ProceduralPath[] => {
  const [first, second] = routes
  if (!first || !second) {
    return []
  }
  const centre = {
    x:
      (first.start.x +
        first.end.x +
        second.start.x +
        second.end.x) /
      4,
    y:
      (first.start.y +
        first.end.y +
        second.start.y +
        second.end.y) /
      4,
  }
  const connections = [
    {
      id: 'slip-route-a',
      start: first.start,
      end: second.end,
      bend: gaugeMm * 0.9,
    },
    ...(isDouble
      ? [
          {
            id: 'slip-route-b',
            start: second.start,
            end: first.end,
            bend: -gaugeMm * 0.9,
          },
        ]
      : []),
  ]

  return connections.flatMap((connection) => {
    const control = {
      x: centre.x,
      y: centre.y + connection.bend,
    }
    return [-gaugeMm / 2, gaugeMm / 2].map((offset, index) => ({
      id: `${connection.id}-${index}`,
      kind: 'switch-rail' as const,
      path: `M ${connection.start.x} ${
        connection.start.y + offset
      } Q ${control.x} ${control.y + offset} ${connection.end.x} ${
        connection.end.y + offset
      }`,
    }))
  })
}

const createInspectionPitDetails = (
  route: TrackRouteGeometry,
  gaugeMm: number,
): ProceduralPath[] => {
  const details: ProceduralPath[] = [
    {
      id: 'inspection-pit-left',
      kind: 'pit-edge',
      path: offsetRoutePath(route, -gaugeMm * 0.3),
    },
    {
      id: 'inspection-pit-right',
      kind: 'pit-edge',
      path: offsetRoutePath(route, gaugeMm * 0.3),
    },
  ]
  const stepSpacing = Math.max(gaugeMm * 0.9, 12)

  for (
    let along = stepSpacing;
    along < route.lengthMm - stepSpacing / 2;
    along += stepSpacing
  ) {
    const sample = pointAtDistance(route, along)
    const normal = normalFor(sample.tangent)
    details.push({
      id: `inspection-pit-step-${along}`,
      kind: 'pit-edge',
      path: `M ${
        sample.point.x - normal.x * gaugeMm * 0.3
      } ${sample.point.y - normal.y * gaugeMm * 0.3} L ${
        sample.point.x + normal.x * gaugeMm * 0.3
      } ${sample.point.y + normal.y * gaugeMm * 0.3}`,
    })
  }

  return details
}

const createSpecialAreas = (
  routes: TrackRouteGeometry[],
  gaugeMm: number,
  detailType: 'inspection-pit' | 'level-crossing' | undefined,
): ProceduralArea[] => {
  const route = routes[0]
  if (!route) {
    return []
  }
  if (detailType === 'inspection-pit') {
    return [
      {
        id: 'inspection-pit-floor',
        kind: 'inspection-pit-floor',
        path: routeEnvelopePath(route, gaugeMm * 0.3),
      },
    ]
  }
  if (detailType === 'level-crossing') {
    return [
      {
        id: 'level-crossing-deck',
        kind: 'level-crossing-deck',
        path: routeEnvelopePath(route, gaugeMm * 1.35),
      },
    ]
  }
  return []
}

const getBounds = (
  routes: TrackRouteGeometry[],
  sleepers: ProceduralSleeper[],
  gaugeMm: number,
  detailType: 'inspection-pit' | 'level-crossing' | undefined,
) => {
  const routeHalfWidth =
    detailType === 'level-crossing' ? gaugeMm * 1.35 : gaugeMm * 0.85
  const points = [
    ...routes.flatMap((route) => [
      ...offsetRoutePoints(route, -routeHalfWidth),
      ...offsetRoutePoints(route, routeHalfWidth),
    ]),
    ...sleepers.flatMap((sleeper) => [sleeper.start, sleeper.end]),
  ]
  if (points.length === 0) {
    points.push({ x: 0, y: 0 })
  }
  const padding = Math.max(gaugeMm * 0.12, 1)
  return {
    minX: Math.min(...points.map((point) => point.x)) - padding,
    minY: Math.min(...points.map((point) => point.y)) - padding,
    maxX: Math.max(...points.map((point) => point.x)) + padding,
    maxY: Math.max(...points.map((point) => point.y)) + padding,
  }
}

export const buildProceduralTrackGeometry = (
  object: TrackPieceObject,
): ProceduralTrackGeometry => {
  const local = getTrackLocalGeometry(object)
  const gaugeMm = gaugeFallback(object)
  const isTurnout = local.definition.kind === 'turnout'
  const sleepers = createSleepers(
    local.routes,
    gaugeMm,
    isTurnout,
    local.definition.detailType === 'inspection-pit',
  )
  const rails = createRailPaths(local.routes, gaugeMm, isTurnout)
  const areas = createSpecialAreas(
    local.routes,
    gaugeMm,
    local.definition.detailType,
  )
  const details =
    local.definition.detailType === 'inspection-pit'
      ? createInspectionPitDetails(local.routes[0], gaugeMm)
      : local.definition.kind === 'turnout'
        ? createTurnoutDetails(local.routes, gaugeMm)
        : local.definition.kind === 'crossing'
          ? [
              ...createCrossingDetails(local.routes, gaugeMm),
              ...(local.definition.topology === 'single-slip' ||
              local.definition.topology === 'double-slip'
                ? createSlipDetails(
                    local.routes,
                    gaugeMm,
                    local.definition.topology === 'double-slip',
                  )
                : []),
            ]
          : []

  // TODO: Manufacturer geometry can replace these gauge-scaled defaults when
  // sleeper dimensions, blade lengths, frog positions, and pit widths are
  // published as structured catalog data.
  return {
    routes: local.routes,
    areas,
    rails,
    sleepers,
    details,
    bounds: getBounds(
      local.routes,
      sleepers,
      gaugeMm,
      local.definition.detailType,
    ),
    gaugeMm,
  }
}
