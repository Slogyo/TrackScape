import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_ZOOM,
  MAX_WORKSPACE_ZOOM,
  MIN_WORKSPACE_ZOOM,
  clampZoom,
  getCanvasRelativeWheelCameraOffset,
  getCenteredCamera,
  getWorkspaceZoomPercent,
  getViewportCenteredZoomCamera,
  isHorizontalWheelGesture,
  stepZoom,
} from './viewport'

describe('workspace viewport', () => {
  it('uses the configured default and clamps zoom to the supported range', () => {
    expect(DEFAULT_WORKSPACE_ZOOM).toBe(5)
    expect(getWorkspaceZoomPercent(DEFAULT_WORKSPACE_ZOOM)).toBe(100)
    expect(clampZoom(0.1)).toBe(MIN_WORKSPACE_ZOOM)
    expect(clampZoom(10)).toBe(MAX_WORKSPACE_ZOOM)
  })

  it('scales zoom by wheel delta magnitude', () => {
    expect(stepZoom(DEFAULT_WORKSPACE_ZOOM, -100)).toBe(5.5)
    expect(stepZoom(DEFAULT_WORKSPACE_ZOOM, 100)).toBe(4.5)
    expect(stepZoom(DEFAULT_WORKSPACE_ZOOM, -1)).toBe(5.005)
    expect(stepZoom(DEFAULT_WORKSPACE_ZOOM, 1)).toBe(4.995)
    expect(stepZoom(MAX_WORKSPACE_ZOOM, -1)).toBe(MAX_WORKSPACE_ZOOM)
    expect(stepZoom(MIN_WORKSPACE_ZOOM, 1)).toBe(MIN_WORKSPACE_ZOOM)
  })

  it('keeps the same model point at the viewport centre while zooming', () => {
    const current = { x: -200, y: 300 }
    const viewport = { width: 400, height: 200 }
    const next = getViewportCenteredZoomCamera(current, viewport, 2, 2.5)

    expect(next.x + viewport.width / 2 / 2.5).toBe(
      current.x + viewport.width / 2 / 2,
    )
    expect(next.y + viewport.height / 2 / 2.5).toBe(
      current.y + viewport.height / 2 / 2,
    )
  })

  it('applies signed canvas-relative wheel navigation', () => {
    expect(getCanvasRelativeWheelCameraOffset(500, 120, 2)).toBe(440)
    expect(getCanvasRelativeWheelCameraOffset(500, -120, 2)).toBe(560)
    expect(getCanvasRelativeWheelCameraOffset(20, 120, 2)).toBe(-40)
    expect(getCanvasRelativeWheelCameraOffset(1_000_000, -120, 2)).toBe(
      1_000_060,
    )
  })

  it('distinguishes side-wheel scrolling from ordinary zoom scrolling', () => {
    expect(isHorizontalWheelGesture(120, 0)).toBe(true)
    expect(isHorizontalWheelGesture(-120, 1)).toBe(true)
    expect(isHorizontalWheelGesture(120, 2)).toBe(false)
    expect(isHorizontalWheelGesture(0, 120)).toBe(false)
    expect(isHorizontalWheelGesture(80, 40)).toBe(false)
    expect(isHorizontalWheelGesture(20, 40)).toBe(false)
  })

  it('centres object bounds and places an empty project around the origin', () => {
    const viewport = { width: 1000, height: 800 }

    expect(getCenteredCamera(null, DEFAULT_WORKSPACE_ZOOM, viewport)).toEqual({
      x: -100,
      y: -80,
    })
    expect(
      getCenteredCamera(
        { minX: 10_000, minY: 20_000, maxX: 20_000, maxY: 30_000 },
        DEFAULT_WORKSPACE_ZOOM,
        viewport,
      ),
    ).toEqual({ x: 1400, y: 2420 })
  })
})
