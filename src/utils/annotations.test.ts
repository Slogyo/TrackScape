import { describe, expect, it } from 'vitest'
import type { CanvasObject, MeasurementObject } from '../types'
import {
  createObjectAnchor,
  detachMeasurementsForDeletedObjects,
  findNearestObjectAnchor,
  getMeasurementLayout,
  getObjectAnchors,
  getTextCaretIndexAtPoint,
  getTextCaretPosition,
  getTextBounds,
  getTextLayout,
  resolveMeasurement,
} from './annotations'

const rectangle: CanvasObject = {
  id: 'rectangle-1',
  type: 'rectangle',
  layerId: 'scenery',
  x: 100,
  y: 200,
  width: 400,
  height: 200,
}

const measurement = (
  start = createObjectAnchor(getObjectAnchors(rectangle)[0]),
): MeasurementObject => ({
  id: 'measurement-1',
  type: 'measurement',
  layerId: 'scenery',
  start,
  end: { kind: 'fixed', point: { x: 900, y: 200 } },
  offset: 180,
})

describe('annotation geometry', () => {
  it('exposes corners and edge midpoints for rectangular objects', () => {
    expect(getObjectAnchors(rectangle).map((anchor) => anchor.anchorId)).toEqual(
      [
        'top-left',
        'top',
        'top-right',
        'right',
        'bottom-right',
        'bottom',
        'bottom-left',
        'left',
      ],
    )
  })

  it('uses a screen-space tolerance when finding nearby anchors', () => {
    expect(
      findNearestObjectAnchor({ x: 130, y: 210 }, [rectangle], 2),
    ).toMatchObject({ objectId: 'rectangle-1', anchorId: 'top-left' })
    expect(
      findNearestObjectAnchor({ x: 400, y: 500 }, [rectangle], 4),
    ).toBeNull()
  })

  it('follows attached geometry after the source object moves', () => {
    const moved = { ...rectangle, x: 500, y: 600 }
    expect(resolveMeasurement(measurement(), [moved])).toEqual({
      start: { x: 500, y: 600 },
      end: { x: 900, y: 200 },
    })
  })

  it('computes an offset dimension line and exact length', () => {
    const layout = getMeasurementLayout(measurement(), [rectangle])
    expect(layout.length).toBe(800)
    expect(layout.dimensionStart).toEqual({ x: 100, y: 380 })
    expect(layout.dimensionEnd).toEqual({ x: 900, y: 380 })
  })

  it('detaches references at their last resolved position before deletion', () => {
    const result = detachMeasurementsForDeletedObjects(
      [rectangle, measurement()],
      new Set(['rectangle-1']),
    )
    expect(result).toEqual([
      expect.objectContaining({
        type: 'measurement',
        start: { kind: 'fixed', point: { x: 100, y: 200 } },
      }),
    ])
  })

  it('calculates bounds for multiline rotated labels', () => {
    const bounds = getTextBounds({
      id: 'text-1',
      type: 'text',
      layerId: 'scenery',
      position: { x: 100, y: 200 },
      text: 'First\nSecond',
      fontSizeMm: 120,
      rotation: 90,
    })
    expect(bounds.minX).toBeCloseTo(-68)
    expect(bounds.minY).toBeCloseTo(200)
    expect(bounds.maxX).toBeCloseTo(220)
    expect(bounds.maxY).toBeCloseTo(617.6)
  })

  it('uses one layout for line widths, height, and caret geometry', () => {
    const object = {
      id: 'text-2',
      type: 'text' as const,
      layerId: 'scenery',
      position: { x: 100, y: 200 },
      text: 'AB\nCDEF',
      fontSizeMm: 100,
      rotation: 0,
    }
    const measure = (text: string, fontSizeMm: number) =>
      text.length * fontSizeMm * 0.5
    const layout = getTextLayout(object, measure)
    expect(layout.lines.map((line) => line.width)).toEqual([100, 200])
    expect(layout.width).toBe(200)
    expect(layout.height).toBe(240)
    expect(getTextCaretPosition(object, 5, measure)).toEqual({
      x: 200,
      y: 220,
    })
    expect(
      getTextCaretIndexAtPoint(object, { x: 198, y: 225 }, measure),
    ).toBe(5)
  })
})
