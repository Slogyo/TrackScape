import { describe, expect, it } from 'vitest'
import type { CanvasObject, Layer } from '../types'
import {
  getObjectsInRenderOrder,
  isObjectLocked,
  isObjectVisible,
  reorderLayers,
  reorderObjects,
  withObjectOutlinerDefaults,
} from './outliner'

const layers: Layer[] = [
  {
    id: 'foreground',
    name: 'Foreground',
    visible: true,
    locked: false,
    expanded: true,
  },
  {
    id: 'background',
    name: 'Background',
    visible: true,
    locked: false,
    expanded: true,
  },
]

const line = (
  id: string,
  layerId: string,
  overrides: Partial<CanvasObject> = {},
): CanvasObject =>
  ({
    id,
    type: 'line',
    layerId,
    name: id,
    visible: true,
    locked: false,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    ...overrides,
  }) as CanvasObject

describe('outliner helpers', () => {
  it('assigns stable unique names and default object state', () => {
    const first = withObjectOutlinerDefaults(
      line('line-1', 'foreground', {
        name: undefined,
        visible: undefined,
        locked: undefined,
      }),
    )
    const second = withObjectOutlinerDefaults(
      line('line-2', 'foreground', {
        name: undefined,
        visible: undefined,
        locked: undefined,
      }),
      [first],
    )

    expect(first).toMatchObject({
      name: 'Line',
      visible: true,
      locked: false,
    })
    expect(second.name).toBe('Line 2')
  })

  it('combines folder and object visibility and locking', () => {
    const object = line('line-1', 'foreground')
    expect(isObjectVisible(object, layers)).toBe(true)
    expect(isObjectLocked(object, layers)).toBe(false)
    expect(
      isObjectVisible(
        object,
        layers.map((layer) =>
          layer.id === 'foreground' ? { ...layer, visible: false } : layer,
        ),
      ),
    ).toBe(false)
    expect(
      isObjectLocked(
        object,
        layers.map((layer) =>
          layer.id === 'foreground' ? { ...layer, locked: true } : layer,
        ),
      ),
    ).toBe(true)
    expect(isObjectVisible({ ...object, visible: false }, layers)).toBe(false)
    expect(isObjectLocked({ ...object, locked: true }, layers)).toBe(true)
  })

  it('renders top outliner folders and rows frontmost', () => {
    const objects = [
      line('front-a', 'foreground'),
      line('front-b', 'foreground'),
      line('back-a', 'background'),
    ]

    expect(getObjectsInRenderOrder(layers, objects).map(({ id }) => id)).toEqual(
      ['back-a', 'front-b', 'front-a'],
    )
  })

  it('reorders folders without changing their contents', () => {
    expect(
      reorderLayers(layers, 'background', 'foreground', 'before').map(
        ({ id }) => id,
      ),
    ).toEqual(['background', 'foreground'])
  })

  it('moves selected assets together and preserves their order', () => {
    const objects = [
      line('a', 'foreground'),
      line('b', 'foreground'),
      line('c', 'foreground'),
      line('d', 'background'),
    ]

    const reordered = reorderObjects(
      layers,
      objects,
      ['a', 'b'],
      'foreground',
      3,
    )
    expect(reordered.map(({ id }) => id)).toEqual(['c', 'a', 'b', 'd'])

    const reparented = reorderObjects(
      layers,
      reordered,
      ['a', 'b'],
      'background',
      0,
    )
    expect(reparented.map(({ id, layerId }) => `${layerId}:${id}`)).toEqual([
      'foreground:c',
      'background:a',
      'background:b',
      'background:d',
    ])
  })
})
