import { describe, expect, it } from 'vitest'
import type { TrackPieceObject } from '../types'
import {
  findNearestTrackConnector,
  getAvailableTrackConnectors,
  getTrackBounds,
  getTrackConnectors,
  getTrackEndPoint,
  getTrackLength,
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
        end: 'start',
        position: { x: 100, y: 200 },
        heading: 270,
      },
      {
        objectId: 'track-1',
        end: 'end',
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
      end: 'end',
      heading: 0,
    })
    expect(
      findNearestTrackConnector({ x: 1000, y: 1000 }, [first, second]),
    ).toBeNull()
  })
})
