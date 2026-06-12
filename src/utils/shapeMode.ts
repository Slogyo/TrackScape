import type {
  CanvasObject,
  RectangularCanvasObject,
} from '../types'

export type ShapeMode =
  | { type: 'room'; layerId: 'room'; label: 'Create Room' }
  | {
      type: 'tabletop'
      layerId: 'tabletop'
      label: 'Create Tabletop'
    }
  | {
      type: 'rectangle'
      layerId: string
      label: 'Create Rectangle'
    }

type RectangularGeometry = Pick<
  RectangularCanvasObject,
  'x' | 'y' | 'width' | 'height'
>

export const getShapeMode = (activeLayerId: string): ShapeMode => {
  if (activeLayerId === 'room') {
    return {
      type: 'room',
      layerId: 'room',
      label: 'Create Room',
    }
  }

  if (activeLayerId === 'tabletop') {
    return {
      type: 'tabletop',
      layerId: 'tabletop',
      label: 'Create Tabletop',
    }
  }

  return {
    type: 'rectangle',
    layerId: activeLayerId,
    label: 'Create Rectangle',
  }
}

export const createShapeObject = (
  id: string,
  activeLayerId: string,
  geometry: RectangularGeometry,
): RectangularCanvasObject => {
  const mode = getShapeMode(activeLayerId)

  if (mode.type === 'room') {
    return { id, type: 'room', layerId: 'room', ...geometry }
  }

  if (mode.type === 'tabletop') {
    return {
      id,
      type: 'tabletop',
      layerId: 'tabletop',
      ...geometry,
    }
  }

  return {
    id,
    type: 'rectangle',
    layerId: mode.layerId,
    ...geometry,
  }
}

export const getObjectTypeLabel = (
  type: CanvasObject['type'],
): string => {
  const labels = {
    line: 'Line',
    rectangle: 'Rectangle',
    room: 'Room',
    tabletop: 'Tabletop',
    'track-piece': 'Track Piece',
  } as const

  return labels[type]
}
