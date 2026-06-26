import type { CanvasObject } from '../types'

export type CanvasObjectAction =
  | {
      type: 'add'
      object: CanvasObject
    }
  | {
      type: 'update'
      object: CanvasObject
    }
  | {
      type: 'remove'
      id: string
    }
  | {
      type: 'replace'
      objects: CanvasObject[]
    }

export const canvasObjectsReducer = (
  objects: CanvasObject[],
  action: CanvasObjectAction,
): CanvasObject[] => {
  switch (action.type) {
    case 'add':
      return [...objects, action.object]
    case 'update':
      return objects.map((object) =>
        object.id === action.object.id ? action.object : object,
      )
    case 'remove':
      return objects.filter((object) => object.id !== action.id)
    case 'replace':
      return [...action.objects]
  }
}
