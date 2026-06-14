import { MILLIMETRES_PER_PIXEL, type Bounds } from './canvas'

export const DEFAULT_WORKSPACE_ZOOM = 2
export const MIN_WORKSPACE_ZOOM = 0.25
export const MAX_WORKSPACE_ZOOM = 4
export const WORKSPACE_ZOOM_STEP = 0.1

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

export function stepZoom(zoom: number, wheelDeltaY: number): number {
  if (wheelDeltaY === 0) {
    return clampZoom(zoom)
  }

  const direction = wheelDeltaY < 0 ? 1 : -1
  return clampZoom(
    Math.round((zoom + direction * WORKSPACE_ZOOM_STEP) * 100) / 100,
  )
}

export function clampCamera(position: CameraPosition): CameraPosition {
  return {
    x: Math.max(0, position.x),
    y: Math.max(0, position.y),
  }
}

export function getCursorAnchoredCamera(
  current: CameraPosition,
  cursor: CameraPosition,
  oldZoom: number,
  newZoom: number,
): CameraPosition {
  return clampCamera({
    x: current.x + cursor.x / oldZoom - cursor.x / newZoom,
    y: current.y + cursor.y / oldZoom - cursor.y / newZoom,
  })
}

export function getCanvasRelativeWheelCameraOffset(
  currentOffset: number,
  wheelDelta: number,
  zoom: number,
): number {
  return Math.max(0, currentOffset - wheelDelta / zoom)
}

export function isHorizontalWheelGesture(
  deltaX: number,
  deltaY: number,
): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY)
}

export function getCenteredCamera(
  bounds: Bounds | null,
  zoom: number,
  viewport: ViewportSize,
): CameraPosition {
  if (!bounds) {
    return { x: 0, y: 0 }
  }

  const centerX =
    (bounds.minX + bounds.maxX) / 2 / MILLIMETRES_PER_PIXEL
  const centerY =
    (bounds.minY + bounds.maxY) / 2 / MILLIMETRES_PER_PIXEL

  return clampCamera({
    x: centerX - viewport.width / zoom / 2,
    y: centerY - viewport.height / zoom / 2,
  })
}
