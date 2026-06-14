import { describe, expect, it } from 'vitest'
import type { TrackPieceObject } from '../types'
import {
  findNearestTrackConnector,
  getAvailableTrackConnectors,
  getTrackBounds,
  getTrackConnectors,
  getTrackEndPoint,
  getTrackLength,
  getTrackLabelPosition,
  getTrackLocalGeometry,
  normalizeRotation,
  rotatePoint,
  screenPixelsToMillimetres,
  snapTrackObjectToConnector,
} from './trackGeometry'

const piece = (
  overrides: Partial<TrackPieceObject> = {},
): TrackPieceObject => ({
  id: 'track-1',
  type: 'track-piece',
  layerId: 'track',
  definitionId: 'straight-200',
  position: { x: 100, y: 200 },
  rotation: 0,
  direction: 'right',
  ...overrides,
})

describe('track geometry', () => {
  it('uses the fixed catalog dimensions and curve arc length', () => {
    expect(getTrackLength(piece())).toBe(200)
    expect(
      getTrackLength(
        piece({ definitionId: 'curve-r300-30' }),
      ),
    ).toBeCloseTo(157.0796, 4)
  })

  it('calculates rotated straight endpoints and outward headings', () => {
    const object = piece({ rotation: 90 })

    expect(getTrackEndPoint(object)).toEqual({ x: 100, y: 400 })
    expect(getTrackConnectors(object)).toMatchObject([
      {
        objectId: 'track-1',
        connectorId: 'connector-1',
        end: 'route-main-start',
        position: { x: 100, y: 200 },
        heading: 270,
        routeIds: ['route-main'],
      },
      {
        objectId: 'track-1',
        connectorId: 'connector-2',
        end: 'route-main-end',
        position: { x: 100, y: 400 },
        heading: 90,
        routeIds: ['route-main'],
      },
    ])
  })

  it('calculates left and right curve endpoints and headings', () => {
    const right = piece({
      definitionId: 'curve-r300-30',
      position: { x: 0, y: 0 },
    })
    const left = { ...right, direction: 'left' as const }

    expect(getTrackEndPoint(right)).toEqual({
      x: 149.99999999999997,
      y: 40.192378864668385,
    })
    expect(getTrackEndPoint(left)).toEqual({
      x: 149.99999999999997,
      y: -40.192378864668385,
    })
    expect(getTrackConnectors(right)[1].heading).toBe(30)
    expect(getTrackConnectors(left)[1].heading).toBe(330)
  })

  it('normalizes every 15 degree placement rotation', () => {
    for (let rotation = -360; rotation <= 720; rotation += 15) {
      expect(normalizeRotation(rotation)).toBeGreaterThanOrEqual(0)
      expect(normalizeRotation(rotation)).toBeLessThan(360)
      expect(normalizeRotation(rotation) % 15).toBe(0)
    }
  })

  it('returns curve bounds that include its full arc', () => {
    const bounds = getTrackBounds(
      piece({
        definitionId: 'curve-r450-30',
        position: { x: 0, y: 0 },
        rotation: 180,
      }),
    )

    expect(bounds.minX).toBeLessThan(-225)
    expect(bounds.maxX).toBeGreaterThan(0)
    expect(bounds.minY).toBeLessThan(-60.2886)
  })

  it('includes special level-crossing decks in world bounds', () => {
    const bounds = getTrackBounds(
      piece({
        definitionId: 'peco-ho-oo-st-268',
        position: { x: 0, y: 100 },
      }),
    )

    expect(bounds.minY).toBeLessThan(100 - 16.5 * 1.35)
    expect(bounds.maxY).toBeGreaterThan(100 + 16.5 * 1.35)
  })

  it('excludes occupied connectors and snaps to the nearest available one', () => {
    const first = piece({
      id: 'first',
      position: { x: 0, y: 0 },
    })
    const second = piece({
      id: 'second',
      position: { x: 200, y: 0 },
    })

    const available = getAvailableTrackConnectors([first, second])
    expect(available).toHaveLength(2)
    expect(
      findNearestTrackConnector({ x: 395, y: 5 }, [first, second]),
    ).toMatchObject({
      objectId: 'second',
      end: 'route-main-end',
      heading: 0,
    })
    expect(
      findNearestTrackConnector({ x: 1000, y: 1000 }, [first, second]),
    ).toBeNull()
  })

  it('renders PECO turnouts with main and diverging routes', () => {
    const turnout = piece({
      definitionId: 'peco-o-sl-e791bh',
      position: { x: 0, y: 0 },
    })

    expect(getTrackLength(turnout)).toBe(416)
    expect(getTrackConnectors(turnout)).toHaveLength(3)
    expect(getTrackConnectors(turnout)[0].routeIds).toEqual([
      'route-main',
      'route-branch',
    ])
    expect(getTrackBounds(turnout).maxX).toBeGreaterThan(416)
    expect(getTrackBounds(turnout).maxY).toBeGreaterThan(0)
  })

  it('exposes every unique physical endpoint for complex pieces', () => {
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-ho-oo-sl-99',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(4)
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-ho-oo-sl-93',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(4)
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-n-sl-e383f',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(4)
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-ho-oo-sl-8356',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(2)
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-ho-oo-sl-84',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(2)
    expect(
      getTrackConnectors(
        piece({
          definitionId: 'peco-ho-oo-sl-e199',
          position: { x: 0, y: 0 },
        }),
      ),
    ).toHaveLength(4)
  })

  it('mirrors handed crossings while preserving published route length', () => {
    const right = getTrackLocalGeometry(
      piece({
        definitionId: 'peco-n-st-50',
        position: { x: 0, y: 0 },
      }),
    )
    const left = getTrackLocalGeometry(
      piece({
        definitionId: 'peco-n-st-51',
        position: { x: 0, y: 0 },
      }),
    )

    expect(right.routes[1].start.y).toBe(0)
    expect(left.routes[1].end.y).toBe(0)
    expect(right.routes[1].lengthMm).toBeCloseTo(87, 6)
    expect(left.routes[1].lengthMm).toBeCloseTo(87, 6)
  })

  it('keeps catch branches internal and delayed three-way starts non-connectable', () => {
    const catchTurnout = getTrackLocalGeometry(
      piece({
        definitionId: 'peco-ho-oo-sl-84',
        position: { x: 0, y: 0 },
      }),
    )
    const asymmetric = getTrackLocalGeometry(
      piece({
        definitionId: 'peco-ho-oo-sl-e199',
        position: { x: 0, y: 0 },
      }),
    )

    expect(catchTurnout.routes[1]).toMatchObject({
      connectStart: false,
      connectEnd: false,
    })
    expect(catchTurnout.connectors).toHaveLength(2)
    expect(asymmetric.routes[2]).toMatchObject({
      connectStart: false,
      connectEnd: true,
    })
    expect(asymmetric.connectors).toHaveLength(4)
  })

  it('can attach either preview end by matching outward headings', () => {
    const existing = piece({
      id: 'existing',
      position: { x: 500, y: 0 },
    })
    const targetStart = getTrackConnectors(existing)[0]
    const placement = snapTrackObjectToConnector(
      piece({
        id: 'preview',
        position: { x: 500, y: 0 },
      }),
      targetStart,
    )

    expect(placement.sourceConnector.end).toBe('route-main-end')
    expect(placement.object.position).toEqual({ x: 300, y: 0 })
    expect(getTrackConnectors(placement.object)[1].position).toEqual(
      targetStart.position,
    )
  })

  it('can explicitly cycle the preview connector used for a snap', () => {
    const existing = piece({
      id: 'existing',
      position: { x: 500, y: 0 },
    })
    const targetEnd = getTrackConnectors(existing)[1]
    const preview = piece({
      id: 'preview',
      definitionId: 'peco-ho-oo-sl-95',
      position: targetEnd.position,
    })
    const first = snapTrackObjectToConnector(preview, targetEnd, 0)
    const second = snapTrackObjectToConnector(preview, targetEnd, 1)

    expect(first.sourceConnector.id).not.toBe(
      second.sourceConnector.id,
    )
    expect(
      getTrackConnectors(first.object).find(
        (connector) =>
          connector.connectorId === first.sourceConnector.id,
      )?.position,
    ).toEqual(targetEnd.position)
    expect(
      getTrackConnectors(second.object).find(
        (connector) =>
          connector.connectorId === second.sourceConnector.id,
      )?.position,
    ).toEqual(targetEnd.position)
  })

  it('keeps screen-space snap tolerance stable across zoom', () => {
    expect(screenPixelsToMillimetres(18, 0.5)).toBe(360)
    expect(screenPixelsToMillimetres(18, 1)).toBe(180)
    expect(screenPixelsToMillimetres(18, 4)).toBe(45)
  })

  it('keeps route endpoints and merged connectors aligned', () => {
    const turnout = piece({
      definitionId: 'peco-ho-oo-sl-99',
      position: { x: 0, y: 0 },
    })
    const local = getTrackLocalGeometry(turnout)

    expect(local.connectors[0].position).toEqual({ x: 0, y: 0 })
    expect(local.connectors[0].routeIds).toHaveLength(3)
    for (const connector of local.connectors.slice(1)) {
      expect(
        local.routes.some(
          (route) =>
            Math.hypot(
              route.end.x - connector.position.x,
              route.end.y - connector.position.y,
            ) < 0.001,
        ),
      ).toBe(true)
    }
  })

  it('keeps every connector aligned through all 15 degree rotations', () => {
    const definitionIds = [
      'straight-200',
      'curve-r300-30',
      'peco-ho-oo-sl-95',
      'peco-ho-oo-sl-99',
      'peco-ho-oo-sl-93',
      'peco-n-sl-e383f',
      'peco-ho-oo-sl-8356',
    ]

    for (const definitionId of definitionIds) {
      for (let rotation = 0; rotation < 360; rotation += 15) {
        const object = piece({
          definitionId,
          position: { x: 1200, y: 800 },
          rotation,
        })
        const local = getTrackLocalGeometry(object)
        const world = getTrackConnectors(object)

        expect(world).toHaveLength(local.connectors.length)
        world.forEach((connector, index) => {
          const rotated = rotatePoint(
            local.connectors[index].position,
            rotation,
          )
          expect(connector.position.x).toBeCloseTo(1200 + rotated.x, 6)
          expect(connector.position.y).toBeCloseTo(800 + rotated.y, 6)
          expect(connector.heading).toBe(
            normalizeRotation(
              local.connectors[index].heading + rotation,
            ),
          )
        })
      }
    }
  })

  it('snaps every connector on every representative piece exactly', () => {
    const targetObject = piece({
      id: 'target',
      position: { x: 2000, y: 1600 },
      rotation: 45,
    })
    const target = getTrackConnectors(targetObject)[1]
    const definitionIds = [
      'straight-200',
      'curve-r300-30',
      'peco-ho-oo-sl-95',
      'peco-ho-oo-sl-99',
      'peco-ho-oo-sl-93',
      'peco-n-sl-e383f',
      'peco-ho-oo-sl-8356',
    ]

    for (const definitionId of definitionIds) {
      const preview = piece({
        id: `preview-${definitionId}`,
        definitionId,
        position: target.position,
        rotation: 75,
      })
      const connectorCount =
        getTrackLocalGeometry(preview).connectors.length

      for (let index = 0; index < connectorCount; index += 1) {
        const placement = snapTrackObjectToConnector(
          preview,
          target,
          index,
        )
        const attached = getTrackConnectors(placement.object).find(
          (connector) =>
            connector.connectorId === placement.sourceConnector.id,
        )

        expect(attached?.position.x).toBeCloseTo(target.position.x, 6)
        expect(attached?.position.y).toBeCloseTo(target.position.y, 6)
        expect(
          normalizeRotation((attached?.heading ?? 0) - target.heading),
        ).toBe(180)
      }
    }
  })

  it('keeps curved turnouts within PECO published length', () => {
    const turnout = piece({
      definitionId: 'peco-ho-oo-sl-86',
      position: { x: 0, y: 0 },
    })
    const endConnectors = getTrackConnectors(turnout).filter((connector) =>
      connector.end.endsWith('-end'),
    )

    expect(getTrackBounds(turnout).maxX).toBeGreaterThan(258)
    expect(endConnectors).toHaveLength(2)
    expect(endConnectors[0].position.x).toBeCloseTo(258)
    expect(endConnectors[1].position.x).toBeCloseTo(258)
  })

  it('uses both published N Setrack curved-turnout route lengths', () => {
    const turnout = piece({
      definitionId: 'peco-n-st-44',
      position: { x: 0, y: 0 },
    })
    const routes = getTrackLocalGeometry(turnout).routes

    expect(getTrackLength(turnout)).toBe(156)
    expect(routes[0].lengthMm).toBeCloseTo(156, 1)
    expect(routes[1].lengthMm).toBeCloseTo(138.5, 1)
  })

  it('places radius labels below track at the origin and above elsewhere', () => {
    const nearOrigin = piece({
      definitionId: 'curve-r300-30',
      position: { x: 0, y: 0 },
    })
    const awayFromOrigin = {
      ...nearOrigin,
      position: { x: 1000, y: 1000 },
    }

    expect(getTrackLabelPosition(nearOrigin).y).toBeGreaterThan(
      getTrackBounds(nearOrigin).maxY,
    )
    expect(getTrackLabelPosition(awayFromOrigin).y).toBeLessThan(
      getTrackBounds(awayFromOrigin).minY,
    )
  })
})
