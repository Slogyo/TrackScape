import { describe, expect, it } from 'vitest'
import {
  canDrawOnLayer,
  clampTranslationToOrigin,
  getObjectBounds,
  isNonZeroLine,
  isNonZeroRectangle,
  lineLength,
  normalizeRectangle,
  pointFromPixels,
  snapDelta,
  snapPoint,
  translateObject,
} from './canvas'

describe('canvas geometry', () => {
  it('converts pixel coordinates to millimetres', () => {
    expect(pointFromPixels(12.5, 20)).toEqual({ x: 125, y: 200 })
  })

  it('clamps pointer coordinates to the positive workspace', () => {
    expect(pointFromPixels(-4, -10)).toEqual({ x: 0, y: 0 })
  })

  it('snaps points to the nearest 100 millimetres', () => {
    expect(snapPoint({ x: 149, y: 151 })).toEqual({ x: 100, y: 200 })
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
  })

  it('calculates bounds and clamps movement at the origin', () => {
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
    expect(clampTranslationToOrigin(line, { x: -500, y: -300 })).toEqual({
      x: -100,
      y: -200,
    })
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
})
