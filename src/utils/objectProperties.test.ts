import { describe, expect, it } from 'vitest'
import type {
  LineObject,
  MeasurementObject,
  RectangleObject,
  RoomObject,
  TabletopObject,
  TrackPieceObject,
  TextObject,
} from '../types'
import {
  formatPropertyValue,
  getGeometryValue,
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
  const trackPiece: TrackPieceObject = {
    id: 'track',
    type: 'track-piece',
    layerId: 'track',
    definitionId: 'straight-200',
    position: { x: 500, y: 600 },
    rotation: 30,
    direction: 'right',
  }
  const text: TextObject = {
    id: 'text',
    type: 'text',
    layerId: 'room',
    position: { x: 100, y: 200 },
    text: 'Station',
    fontSizeMm: 120,
    rotation: 0,
  }
  const measurement: MeasurementObject = {
    id: 'measurement',
    type: 'measurement',
    layerId: 'room',
    start: { kind: 'fixed', point: { x: 100, y: 200 } },
    end: {
      kind: 'object',
      objectId: 'line',
      anchorId: 'end',
      point: { x: 300, y: 400 },
    },
    offset: 180,
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

  it('reads and updates track position and rotation exactly', () => {
    expect(getGeometryValue(trackPiece, 'x')).toBe(500)
    expect(getGeometryValue(trackPiece, 'y')).toBe(600)
    expect(getGeometryValue(trackPiece, 'rotation')).toBe(30)
    expect(updateGeometryValue(trackPiece, 'x', 525.4)).toMatchObject({
      position: { x: 525.4, y: 600 },
    })
    expect(updateGeometryValue(trackPiece, 'rotation', 45)).toMatchObject({
      rotation: 45,
    })
  })

  it('rejects invalid track rotations and origin-crossing edits', () => {
    expect(updateGeometryValue(trackPiece, 'rotation', 17)).toBeNull()
    expect(updateGeometryValue(trackPiece, 'rotation', 360)).toBeNull()
    expect(
      updateGeometryValue(
        {
          ...trackPiece,
          definitionId: 'curve-r450-30',
          position: { x: 10, y: 10 },
          rotation: 180,
        },
        'x',
        0,
      ),
    ).toBeNull()
  })

  it('reads and edits text size, position, and rotation', () => {
    expect(getGeometryValue(text, 'fontSize')).toBe(120)
    expect(updateGeometryValue(text, 'fontSize', 85.5)).toMatchObject({
      fontSizeMm: 85.5,
    })
    expect(updateGeometryValue(text, 'rotation', 22.5)).toMatchObject({
      rotation: 22.5,
    })
    expect(updateGeometryValue(text, 'fontSize', 0)).toBeNull()
  })

  it('edits fixed measurement coordinates but protects attached anchors', () => {
    expect(
      getGeometryValue(measurement, 'x2', [line, measurement]),
    ).toBe(300)
    expect(updateGeometryValue(measurement, 'x1', 125)).toMatchObject({
      start: { kind: 'fixed', point: { x: 125, y: 200 } },
    })
    expect(updateGeometryValue(measurement, 'x2', 350)).toBeNull()
    expect(updateGeometryValue(measurement, 'offset', -90)).toMatchObject({
      offset: -90,
    })
  })
})
