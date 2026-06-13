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
  normalizeRotation,
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
    expect(getTrackConnectors(object)).toEqual([
      {
        objectId: 'track-1',
        end: 'route-main-start',
        position: { x: 100, y: 200 },
        heading: 270,
      },
      {
        objectId: 'track-1',
        end: 'route-main-end',
        position: { x: 100, y: 400 },
        heading: 90,
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

    expect(bounds.minX).toBeCloseTo(-225)
    expect(bounds.maxX).toBeCloseTo(0)
    expect(bounds.minY).toBeCloseTo(-60.2886, 4)
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
    expect(getTrackConnectors(turnout)).toHaveLength(4)
    expect(getTrackBounds(turnout).maxX).toBeCloseTo(416)
    expect(getTrackBounds(turnout).maxY).toBeGreaterThan(0)
  })

  it('keeps curved turnouts within PECO published length', () => {
    const turnout = piece({
      definitionId: 'peco-ho-oo-sl-86',
      position: { x: 0, y: 0 },
    })
    const endConnectors = getTrackConnectors(turnout).filter((connector) =>
      connector.end.endsWith('-end'),
    )

    expect(getTrackBounds(turnout).maxX).toBeCloseTo(258)
    expect(endConnectors).toHaveLength(2)
    expect(endConnectors[0].position.x).toBeCloseTo(258)
    expect(endConnectors[1].position.x).toBeCloseTo(258)
  })

  it('uses both published N Setrack curved-turnout route lengths', () => {
    const turnout = piece({
      definitionId: 'peco-n-st-44',
      position: { x: 0, y: 0 },
    })
    const endConnectors = getTrackConnectors(turnout).filter((connector) =>
      connector.end.endsWith('-end'),
    )

    expect(getTrackLength(turnout)).toBe(156)
    expect(
      Math.hypot(
        endConnectors[0].position.x,
        endConnectors[0].position.y,
      ),
    ).toBeCloseTo(156)
    expect(
      Math.hypot(
        endConnectors[1].position.x,
        endConnectors[1].position.y,
      ),
    ).toBeCloseTo(138.5)
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
