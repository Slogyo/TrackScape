import type {
  CanvasObject,
  Layer,
  MovementDelta,
  Point,
  RectangularCanvasObject,
} from '../types'
import { getTrackBounds } from './trackGeometry'
import {
  getMeasurementBounds,
  getTextBounds,
  translateMeasurement,
} from './annotations'

export const MILLIMETRES_PER_PIXEL = 10
export const SNAP_INTERVAL_MM = 100

export const pixelsToMillimetres = (pixels: number): number =>
  pixels * MILLIMETRES_PER_PIXEL

export const millimetresToPixels = (millimetres: number): number =>
  millimetres / MILLIMETRES_PER_PIXEL

export const pointFromPixels = (x: number, y: number): Point => ({
  x: Math.max(0, Math.round(pixelsToMillimetres(x))),
  y: Math.max(0, Math.round(pixelsToMillimetres(y))),
})

export const pointFromViewportPixels = (
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  zoom = 1,
): Point =>
  pointFromPixels(x / zoom + cameraX, y / zoom + cameraY)

export const snapValue = (
  value: number,
  interval = SNAP_INTERVAL_MM,
): number => Math.max(0, Math.round(value / interval) * interval)

export const snapPoint = (
  point: Point,
  interval = SNAP_INTERVAL_MM,
): Point => ({
  x: snapValue(point.x, interval),
  y: snapValue(point.y, interval),
})

export const resolvePointSnapping = (
  point: Point,
  bypassSnapping: boolean,
): Point => (bypassSnapping ? point : snapPoint(point))

export const shouldBypassSnapping = (
  isSnappingEnabled: boolean,
  isShiftPressed: boolean,
): boolean => !isSnappingEnabled || isShiftPressed

export const snapDelta = (
  delta: MovementDelta,
  interval = SNAP_INTERVAL_MM,
): MovementDelta => ({
  x: Math.round(delta.x / interval) * interval,
  y: Math.round(delta.y / interval) * interval,
})

export const resolveDeltaSnapping = (
  delta: MovementDelta,
  bypassSnapping: boolean,
): MovementDelta => (bypassSnapping ? delta : snapDelta(delta))

export const normalizeRectangle = (
  start: Point,
  end: Point,
): Omit<RectangularCanvasObject, 'id' | 'layerId' | 'type'> => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
})

export const lineLength = (start: Point, end: Point): number =>
  Math.hypot(end.x - start.x, end.y - start.y)

export const canDrawOnLayer = (
  layer: Pick<Layer, 'visible' | 'locked'>,
): boolean => layer.visible && !layer.locked

export const isNonZeroLine = (start: Point, end: Point): boolean =>
  start.x !== end.x || start.y !== end.y

export const isNonZeroRectangle = (
  rectangle: Pick<RectangularCanvasObject, 'width' | 'height'>,
): boolean => rectangle.width > 0 && rectangle.height > 0

export const getObjectBounds = (
  object: CanvasObject,
  objects: CanvasObject[] = [object],
) => {
  if (object.type === 'track-piece') {
    return getTrackBounds(object)
  }

  if (object.type === 'line') {
    return {
      minX: Math.min(object.start.x, object.end.x),
      minY: Math.min(object.start.y, object.end.y),
      maxX: Math.max(object.start.x, object.end.x),
      maxY: Math.max(object.start.y, object.end.y),
    }
  }
  if (object.type === 'measurement') {
    return getMeasurementBounds(object, objects)
  }
  if (object.type === 'text') {
    return getTextBounds(object)
  }

  return {
    minX: object.x,
    minY: object.y,
    maxX: object.x + object.width,
    maxY: object.y + object.height,
  }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const boundsIntersect = (
  first: Bounds,
  second: Bounds,
): boolean =>
  first.minX <= second.maxX &&
  first.maxX >= second.minX &&
  first.minY <= second.maxY &&
  first.maxY >= second.minY

export const getCombinedBounds = (objects: CanvasObject[]): Bounds | null => {
  if (objects.length === 0) {
    return null
  }

  const bounds = objects.map((object) => getObjectBounds(object, objects))
  return {
    minX: Math.min(...bounds.map((candidate) => candidate.minX)),
    minY: Math.min(...bounds.map((candidate) => candidate.minY)),
    maxX: Math.max(...bounds.map((candidate) => candidate.maxX)),
    maxY: Math.max(...bounds.map((candidate) => candidate.maxY)),
  }
}

export const clampGroupTranslationToOrigin = (
  objects: CanvasObject[],
  delta: MovementDelta,
): MovementDelta => {
  const bounds = getCombinedBounds(objects)
  return bounds
    ? {
        x: Math.max(delta.x, -bounds.minX),
        y: Math.max(delta.y, -bounds.minY),
      }
    : { x: 0, y: 0 }
}

export const clampTranslationToOrigin = (
  object: CanvasObject,
  delta: MovementDelta,
): MovementDelta => {
  const bounds = getObjectBounds(object)

  return {
    x: Math.max(delta.x, -bounds.minX),
    y: Math.max(delta.y, -bounds.minY),
  }
}

export const translateObject = (
  object: CanvasObject,
  delta: MovementDelta,
  objects: CanvasObject[] = [object],
): CanvasObject => {
  if (object.type === 'track-piece') {
    return {
      ...object,
      position: {
        x: object.position.x + delta.x,
        y: object.position.y + delta.y,
      },
    }
  }

  if (object.type === 'line') {
    return {
      ...object,
      start: {
        x: object.start.x + delta.x,
        y: object.start.y + delta.y,
      },
      end: {
        x: object.end.x + delta.x,
        y: object.end.y + delta.y,
      },
    }
  }
  if (object.type === 'measurement') {
    return translateMeasurement(object, delta, objects)
  }
  if (object.type === 'text') {
    return {
      ...object,
      position: {
        x: object.position.x + delta.x,
        y: object.position.y + delta.y,
      },
    }
  }

  return {
    ...object,
    x: object.x + delta.x,
    y: object.y + delta.y,
  }
}
