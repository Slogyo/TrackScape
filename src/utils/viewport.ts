import { MILLIMETRES_PER_PIXEL, type Bounds } from './canvas'

export const DEFAULT_WORKSPACE_ZOOM = 5
export const MIN_WORKSPACE_ZOOM = DEFAULT_WORKSPACE_ZOOM * 0.1
export const MAX_WORKSPACE_ZOOM = DEFAULT_WORKSPACE_ZOOM * 2
export const WORKSPACE_ZOOM_PERCENT_PER_DELTA = 0.1
export const HORIZONTAL_WHEEL_VERTICAL_TOLERANCE = 1

export interface CameraPosition {
  x: number
  y: number
}

export interface ViewportSize {
  width: number
  height: number
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_WORKSPACE_ZOOM, Math.max(MIN_WORKSPACE_ZOOM, zoom))
}

export function getWorkspaceZoomPercent(zoom: number): number {
  return Math.round((clampZoom(zoom) / DEFAULT_WORKSPACE_ZOOM) * 100)
}

export function stepZoom(zoom: number, wheelDeltaY: number): number {
  if (wheelDeltaY === 0) {
    return clampZoom(zoom)
  }

  const nextPercent =
    (clampZoom(zoom) / DEFAULT_WORKSPACE_ZOOM) * 100 -
    wheelDeltaY * WORKSPACE_ZOOM_PERCENT_PER_DELTA
  return clampZoom(
    Math.round(DEFAULT_WORKSPACE_ZOOM * (nextPercent / 100) * 1000) / 1000,
  )
}

export function getViewportCenteredZoomCamera(
  current: CameraPosition,
  viewport: ViewportSize,
  oldZoom: number,
  newZoom: number,
): CameraPosition {
  const center = {
    x: viewport.width / 2,
    y: viewport.height / 2,
  }

  return {
    x: current.x + center.x / oldZoom - center.x / newZoom,
    y: current.y + center.y / oldZoom - center.y / newZoom,
  }
}

export function getCanvasRelativeWheelCameraOffset(
  currentOffset: number,
  wheelDelta: number,
  zoom: number,
): number {
  return currentOffset - wheelDelta / zoom
}

export function isHorizontalWheelGesture(
  deltaX: number,
  deltaY: number,
): boolean {
  return (
    Math.abs(deltaX) > 0 &&
    Math.abs(deltaY) <= HORIZONTAL_WHEEL_VERTICAL_TOLERANCE
  )
}

export function getCenteredCamera(
  bounds: Bounds | null,
  zoom: number,
  viewport: ViewportSize,
): CameraPosition {
  if (!bounds) {
    return {
      x: -viewport.width / zoom / 2,
      y: -viewport.height / zoom / 2,
    }
  }

  const centerX =
    (bounds.minX + bounds.maxX) / 2 / MILLIMETRES_PER_PIXEL
  const centerY =
    (bounds.minY + bounds.maxY) / 2 / MILLIMETRES_PER_PIXEL

  return {
    x: centerX - viewport.width / zoom / 2,
    y: centerY - viewport.height / zoom / 2,
  }
}
