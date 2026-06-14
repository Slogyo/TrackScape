import type {
  CanvasObject,
  GeometryField,
  MeasurementSystem,
} from '../types'
import {
  displayValueToMillimetres,
  millimetresTo,
} from './units'
import { getTrackBounds } from './trackGeometry'
import { resolveMeasurement } from './annotations'

export const propertyUnitForSystem = (
  measurementSystem: MeasurementSystem,
): 'cm' | 'in' => (measurementSystem === 'metric' ? 'cm' : 'in')

export const formatPropertyValue = (
  millimetres: number,
  measurementSystem: MeasurementSystem,
): string => {
  const unit = propertyUnitForSystem(measurementSystem)
  const precision = unit === 'cm' ? 3 : 4

  return String(Number(millimetresTo(millimetres, unit).toFixed(precision)))
}

export const parsePropertyValue = (
  value: string,
  measurementSystem: MeasurementSystem,
): number | null => {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return displayValueToMillimetres(
    parsed,
    propertyUnitForSystem(measurementSystem),
  )
}

export const getGeometryValue = (
  object: CanvasObject,
  field: GeometryField,
  objects: CanvasObject[] = [object],
): number | null => {
  if (object.type === 'track-piece') {
    const values: Partial<Record<GeometryField, number>> = {
      x: object.position.x,
      y: object.position.y,
      rotation: object.rotation,
    }
    return values[field] ?? null
  }

  if (object.type === 'line') {
    const values: Partial<Record<GeometryField, number>> = {
      x1: object.start.x,
      y1: object.start.y,
      x2: object.end.x,
      y2: object.end.y,
    }
    return values[field] ?? null
  }
  if (object.type === 'text') {
    const values: Partial<Record<GeometryField, number>> = {
      x: object.position.x,
      y: object.position.y,
      fontSize: object.fontSizeMm,
      rotation: object.rotation,
    }
    return values[field] ?? null
  }
  if (object.type === 'measurement') {
    const resolved = resolveMeasurement(object, objects)
    const values: Partial<Record<GeometryField, number>> = {
      x1: resolved.start.x,
      y1: resolved.start.y,
      x2: resolved.end.x,
      y2: resolved.end.y,
      offset: object.offset,
    }
    return values[field] ?? null
  }

  const values: Partial<Record<GeometryField, number>> = {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  }
  return values[field] ?? null
}

export const updateGeometryValue = (
  object: CanvasObject,
  field: GeometryField,
  millimetres: number,
): CanvasObject | null => {
  if (!Number.isFinite(millimetres)) {
    return null
  }

  if (object.type === 'track-piece') {
    if (field === 'rotation') {
      if (
        millimetres < 0 ||
        millimetres >= 360 ||
        millimetres % 15 !== 0
      ) {
        return null
      }
      const rotatedObject = { ...object, rotation: millimetres }
      const bounds = getTrackBounds(rotatedObject)
      return bounds.minX < -0.001 || bounds.minY < -0.001
        ? null
        : rotatedObject
    }

    if ((field !== 'x' && field !== 'y') || millimetres < 0) {
      return null
    }

    const positionedObject = {
      ...object,
      position: {
        ...object.position,
        [field]: millimetres,
      },
    }
    const bounds = getTrackBounds(positionedObject)
    return bounds.minX < -0.001 || bounds.minY < -0.001
      ? null
      : positionedObject
  }

  if (object.type === 'line') {
    if (!['x1', 'y1', 'x2', 'y2'].includes(field) || millimetres < 0) {
      return null
    }

    const nextObject = {
      ...object,
      start: { ...object.start },
      end: { ...object.end },
    }

    if (field === 'x1') nextObject.start.x = millimetres
    if (field === 'y1') nextObject.start.y = millimetres
    if (field === 'x2') nextObject.end.x = millimetres
    if (field === 'y2') nextObject.end.y = millimetres

    if (
      nextObject.start.x === nextObject.end.x &&
      nextObject.start.y === nextObject.end.y
    ) {
      return null
    }

    return nextObject
  }
  if (object.type === 'text') {
    if (field === 'rotation') {
      return millimetres >= 0 && millimetres < 360
        ? { ...object, rotation: millimetres }
        : null
    }
    if (field === 'fontSize') {
      return millimetres > 0
        ? { ...object, fontSizeMm: millimetres }
        : null
    }
    if ((field !== 'x' && field !== 'y') || millimetres < 0) return null
    return {
      ...object,
      position: { ...object.position, [field]: millimetres },
    }
  }
  if (object.type === 'measurement') {
    if (field === 'offset') return { ...object, offset: millimetres }
    const endpoint =
      field === 'x1' || field === 'y1'
        ? 'start'
        : field === 'x2' || field === 'y2'
          ? 'end'
          : null
    if (!endpoint || object[endpoint].kind === 'object' || millimetres < 0) {
      return null
    }
    const coordinate = field.startsWith('x') ? 'x' : 'y'
    return {
      ...object,
      [endpoint]: {
        ...object[endpoint],
        point: { ...object[endpoint].point, [coordinate]: millimetres },
      },
    }
  }

  if (!['x', 'y', 'width', 'height'].includes(field)) {
    return null
  }

  if (
    ((field === 'x' || field === 'y') && millimetres < 0) ||
    ((field === 'width' || field === 'height') && millimetres <= 0)
  ) {
    return null
  }

  return {
    ...object,
    [field]: millimetres,
  }
}
