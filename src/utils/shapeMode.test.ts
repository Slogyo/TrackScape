import { describe, expect, it } from 'vitest'
import {
  createShapeObject,
  getObjectTypeLabel,
  getShapeMode,
} from './shapeMode'

describe('shape modes', () => {
  it('maps the Room layer to semantic room creation', () => {
    expect(getShapeMode('room')).toEqual({
      type: 'room',
      layerId: 'room',
      label: 'Create Room',
    })
  })

  it('maps the Tabletop layer to semantic tabletop creation', () => {
    expect(getShapeMode('tabletop')).toEqual({
      type: 'tabletop',
      layerId: 'tabletop',
      label: 'Create Tabletop',
    })
  })

  it('keeps generic rectangles on any other active layer', () => {
    expect(getShapeMode('scenery')).toEqual({
      type: 'rectangle',
      layerId: 'scenery',
      label: 'Create Rectangle',
    })
  })

  it('provides display labels for every object type', () => {
    expect(getObjectTypeLabel('line')).toBe('Line')
    expect(getObjectTypeLabel('rectangle')).toBe('Rectangle')
    expect(getObjectTypeLabel('room')).toBe('Room')
    expect(getObjectTypeLabel('tabletop')).toBe('Tabletop')
  })

  it('creates semantic objects with forced matching layers', () => {
    const geometry = { x: 100, y: 200, width: 300, height: 400 }

    expect(createShapeObject('room-1', 'room', geometry)).toEqual({
      id: 'room-1',
      type: 'room',
      layerId: 'room',
      ...geometry,
    })
    expect(createShapeObject('tabletop-1', 'tabletop', geometry)).toEqual({
      id: 'tabletop-1',
      type: 'tabletop',
      layerId: 'tabletop',
      ...geometry,
    })
    expect(createShapeObject('rectangle-1', 'scenery', geometry)).toEqual({
      id: 'rectangle-1',
      type: 'rectangle',
      layerId: 'scenery',
      ...geometry,
    })
  })
})
