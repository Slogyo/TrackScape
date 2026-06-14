import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_ZOOM,
  MAX_WORKSPACE_ZOOM,
  MIN_WORKSPACE_ZOOM,
  clampCamera,
  clampZoom,
  getCanvasRelativeWheelCameraOffset,
  getCenteredCamera,
  getCursorAnchoredCamera,
  isHorizontalWheelGesture,
  stepZoom,
} from './viewport'

describe('workspace viewport', () => {
  it('uses the configured default and clamps zoom to the supported range', () => {
    expect(DEFAULT_WORKSPACE_ZOOM).toBe(2)
    expect(clampZoom(0.1)).toBe(MIN_WORKSPACE_ZOOM)
    expect(clampZoom(5)).toBe(MAX_WORKSPACE_ZOOM)
  })

  it('steps zoom by ten percentage points', () => {
    expect(stepZoom(2, -1)).toBe(2.1)
    expect(stepZoom(2, 1)).toBe(1.9)
    expect(stepZoom(MAX_WORKSPACE_ZOOM, -1)).toBe(MAX_WORKSPACE_ZOOM)
    expect(stepZoom(MIN_WORKSPACE_ZOOM, 1)).toBe(MIN_WORKSPACE_ZOOM)
  })

  it('keeps the same model point beneath the cursor', () => {
    const current = { x: 200, y: 300 }
    const cursor = { x: 200, y: 100 }
    const next = getCursorAnchoredCamera(current, cursor, 2, 2.5)

    expect(next.x + cursor.x / 2.5).toBe(current.x + cursor.x / 2)
    expect(next.y + cursor.y / 2.5).toBe(current.y + cursor.y / 2)
  })

  it('applies canvas-relative wheel navigation without an upper bound', () => {
    expect(getCanvasRelativeWheelCameraOffset(500, 120, 2)).toBe(440)
    expect(getCanvasRelativeWheelCameraOffset(500, -120, 2)).toBe(560)
    expect(getCanvasRelativeWheelCameraOffset(20, 120, 2)).toBe(0)
    expect(getCanvasRelativeWheelCameraOffset(1_000_000, -120, 2)).toBe(
      1_000_060,
    )
  })

  it('distinguishes side-wheel scrolling from ordinary zoom scrolling', () => {
    expect(isHorizontalWheelGesture(120, 0)).toBe(true)
    expect(isHorizontalWheelGesture(-120, 1)).toBe(true)
    expect(isHorizontalWheelGesture(0, 120)).toBe(false)
    expect(isHorizontalWheelGesture(20, 40)).toBe(false)
  })

  it('centres object bounds and keeps an empty project at the origin', () => {
    const viewport = { width: 1000, height: 800 }

    expect(getCenteredCamera(null, 2, viewport)).toEqual({ x: 0, y: 0 })
    expect(
      getCenteredCamera(
        { minX: 10_000, minY: 20_000, maxX: 20_000, maxY: 30_000 },
        2,
        viewport,
      ),
    ).toEqual({ x: 1250, y: 2300 })
    expect(clampCamera({ x: -100, y: -200 })).toEqual({ x: 0, y: 0 })
  })
})
