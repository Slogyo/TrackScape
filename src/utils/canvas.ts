import type {
  CanvasObject,
  Layer,
  MovementDelta,
  Point,
  RectangularCanvasObject,
} from '../types'

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

export const snapDelta = (
  delta: MovementDelta,
  interval = SNAP_INTERVAL_MM,
): MovementDelta => ({
  x: Math.round(delta.x / interval) * interval,
  y: Math.round(delta.y / interval) * interval,
})

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

export const getObjectBounds = (object: CanvasObject) => {
  if (object.type === 'line') {
    return {
      minX: Math.min(object.start.x, object.end.x),
      minY: Math.min(object.start.y, object.end.y),
      maxX: Math.max(object.start.x, object.end.x),
      maxY: Math.max(object.start.y, object.end.y),
    }
  }

  return {
    minX: object.x,
    minY: object.y,
    maxX: object.x + object.width,
    maxY: object.y + object.height,
  }
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
): CanvasObject => {
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

  return {
    ...object,
    x: object.x + delta.x,
    y: object.y + delta.y,
  }
}
