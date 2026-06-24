import { describe, expect, it } from 'vitest'
import type { TrackPieceObject } from '../types'
import {
  canDrawOnLayer,
  boundsIntersect,
  getCombinedBounds,
  getObjectBounds,
  isNonZeroLine,
  isNonZeroRectangle,
  lineLength,
  normalizeRectangle,
  pointFromPixels,
  pointFromViewportPixels,
  resolveDeltaSnapping,
  resolvePointSnapping,
  shouldBypassSnapping,
  snapDelta,
  snapPoint,
  translateObject,
} from './canvas'

describe('canvas geometry', () => {
  it('converts pixel coordinates to millimetres', () => {
    expect(pointFromPixels(12.5, 20)).toEqual({ x: 125, y: 200 })
  })

  it('preserves signed pointer coordinates', () => {
    expect(pointFromPixels(-4, -10)).toEqual({ x: -40, y: -100 })
  })

  it('includes the viewport camera offset without an upper limit', () => {
    expect(pointFromViewportPixels(20, 30, 400, 500)).toEqual({
      x: 4200,
      y: 5300,
    })
    expect(pointFromPixels(20_000, 20_000)).toEqual({
      x: 200_000,
      y: 200_000,
    })
  })

  it('accounts for workspace zoom when converting pointer coordinates', () => {
    expect(pointFromViewportPixels(200, 100, 400, 600, 2)).toEqual({
      x: 5000,
      y: 6500,
    })
  })

  it('snaps points to the nearest 100 millimetres', () => {
    expect(snapPoint({ x: 149, y: 151 })).toEqual({ x: 100, y: 200 })
    expect(snapPoint({ x: -149, y: -151 })).toEqual({ x: -100, y: -200 })
    expect(resolvePointSnapping({ x: 149, y: 151 }, true)).toEqual({
      x: 149,
      y: 151,
    })
  })

  it('bypasses snapping when disabled or while Shift is held', () => {
    expect(shouldBypassSnapping(true, false)).toBe(false)
    expect(shouldBypassSnapping(true, true)).toBe(true)
    expect(shouldBypassSnapping(false, false)).toBe(true)
    expect(shouldBypassSnapping(false, true)).toBe(true)
  })

  it('normalizes rectangles drawn in reverse directions', () => {
    expect(
      normalizeRectangle({ x: 600, y: 500 }, { x: 200, y: 100 }),
    ).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 400,
    })
  })

  it('calculates line length in millimetres', () => {
    expect(lineLength({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500)
  })

  it('allows drawing only on visible, unlocked layers', () => {
    expect(canDrawOnLayer({ visible: true, locked: false })).toBe(true)
    expect(canDrawOnLayer({ visible: false, locked: false })).toBe(false)
    expect(canDrawOnLayer({ visible: true, locked: true })).toBe(false)
  })

  it('rejects zero-length lines and zero-area rectangles', () => {
    expect(isNonZeroLine({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(
      false,
    )
    expect(isNonZeroLine({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(
      true,
    )
    expect(isNonZeroRectangle({ width: 0, height: 100 })).toBe(false)
    expect(isNonZeroRectangle({ width: 100, height: 100 })).toBe(true)
  })

  it('snaps signed movement deltas', () => {
    expect(snapDelta({ x: 149, y: -151 })).toEqual({ x: 100, y: -200 })
    expect(resolveDeltaSnapping({ x: 149, y: -151 }, true)).toEqual({
      x: 149,
      y: -151,
    })
  })

  it('calculates bounds while allowing signed movement', () => {
    const line = {
      id: 'line',
      type: 'line' as const,
      layerId: 'room',
      start: { x: 300, y: 200 },
      end: { x: 100, y: 500 },
    }

    expect(getObjectBounds(line)).toEqual({
      minX: 100,
      minY: 200,
      maxX: 300,
      maxY: 500,
    })
    expect(translateObject(line, { x: -500, y: -300 })).toMatchObject({
      start: { x: -200, y: -100 },
      end: { x: -400, y: 200 },
    })
  })

  it('combines bounds and detects any marquee intersection', () => {
    const objects = [
      {
        id: 'a',
        type: 'rectangle' as const,
        layerId: 'room',
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      },
      {
        id: 'b',
        type: 'line' as const,
        layerId: 'room',
        start: { x: 600, y: 100 },
        end: { x: 800, y: 300 },
      },
    ]

    expect(getCombinedBounds(objects)).toEqual({
      minX: 100,
      minY: 100,
      maxX: 800,
      maxY: 600,
    })
    expect(
      boundsIntersect(
        { minX: 350, minY: 500, maxX: 450, maxY: 700 },
        { minX: 100, minY: 200, maxX: 400, maxY: 600 },
      ),
    ).toBe(true)
  })

  it('translates objects without changing dimensions or line orientation', () => {
    expect(
      translateObject(
        {
          id: 'rectangle',
          type: 'rectangle',
          layerId: 'room',
          x: 100,
          y: 200,
          width: 300,
          height: 400,
        },
        { x: 200, y: -100 },
      ),
    ).toEqual({
      id: 'rectangle',
      type: 'rectangle',
      layerId: 'room',
      x: 300,
      y: 100,
      width: 300,
      height: 400,
    })

    expect(
      translateObject(
        {
          id: 'room',
          type: 'room',
          layerId: 'room',
          x: 100,
          y: 200,
          width: 300,
          height: 400,
        },
        { x: 200, y: -100 },
      ),
    ).toEqual({
      id: 'room',
      type: 'room',
      layerId: 'room',
      x: 300,
      y: 100,
      width: 300,
      height: 400,
    })
  })

  it('translates track pieces through signed coordinates', () => {
    const track: TrackPieceObject = {
      id: 'track-1',
      type: 'track-piece',
      layerId: 'track',
      definitionId: 'straight-200',
      position: { x: 300, y: 200 },
      rotation: 180,
      direction: 'right',
    }

    expect(translateObject(track, { x: -500, y: -500 })).toMatchObject({
      type: 'track-piece',
      definitionId: 'straight-200',
      position: { x: -200, y: -300 },
      rotation: 180,
    })
    expect(translateObject(track, { x: 100, y: 200 })).toMatchObject({
      type: 'track-piece',
      definitionId: 'straight-200',
      position: { x: 400, y: 400 },
      rotation: 180,
    })
  })
})
