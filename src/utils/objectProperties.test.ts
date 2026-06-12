import { describe, expect, it } from 'vitest'
import type {
  LineObject,
  RectangleObject,
  RoomObject,
  TabletopObject,
} from '../types'
import {
  formatPropertyValue,
  parsePropertyValue,
  propertyUnitForSystem,
  updateGeometryValue,
} from './objectProperties'

describe('object property helpers', () => {
  const line: LineObject = {
    id: 'line',
    type: 'line',
    layerId: 'room',
    start: { x: 100, y: 200 },
    end: { x: 300, y: 400 },
  }
  const rectangle: RectangleObject = {
    id: 'rectangle',
    type: 'rectangle',
    layerId: 'room',
    x: 100,
    y: 200,
    width: 300,
    height: 400,
  }
  const room: RoomObject = {
    ...rectangle,
    id: 'room',
    type: 'room',
    layerId: 'room',
  }
  const tabletop: TabletopObject = {
    ...rectangle,
    id: 'tabletop',
    type: 'tabletop',
    layerId: 'tabletop',
  }

  it('uses centimetres for metric properties and inches for imperial', () => {
    expect(propertyUnitForSystem('metric')).toBe('cm')
    expect(propertyUnitForSystem('imperial')).toBe('in')
    expect(formatPropertyValue(254, 'metric')).toBe('25.4')
    expect(formatPropertyValue(254, 'imperial')).toBe('10')
  })

  it('converts exact property input values to millimetres', () => {
    expect(parsePropertyValue('12.345', 'metric')).toBeCloseTo(123.45)
    expect(parsePropertyValue('2.5', 'imperial')).toBeCloseTo(63.5)
  })

  it('updates valid line and rectangle geometry', () => {
    expect(updateGeometryValue(line, 'x1', 125)).toMatchObject({
      start: { x: 125, y: 200 },
    })
    expect(updateGeometryValue(rectangle, 'width', 325)).toMatchObject({
      width: 325,
    })
    expect(updateGeometryValue(room, 'height', 425)).toMatchObject({
      type: 'room',
      layerId: 'room',
      height: 425,
    })
    expect(updateGeometryValue(tabletop, 'x', 125)).toMatchObject({
      type: 'tabletop',
      layerId: 'tabletop',
      x: 125,
    })
  })

  it('rejects negative coordinates, non-positive sizes, and zero lines', () => {
    expect(updateGeometryValue(rectangle, 'x', -1)).toBeNull()
    expect(updateGeometryValue(rectangle, 'height', 0)).toBeNull()
    expect(updateGeometryValue(line, 'x1', 300)).not.toBeNull()
    expect(
      updateGeometryValue(
        { ...line, start: { x: 100, y: 400 } },
        'x1',
        300,
      ),
    ).toBeNull()
  })
})
