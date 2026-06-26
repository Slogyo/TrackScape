import { describe, expect, it } from 'vitest'
import type {
  LineObject,
  RoomObject,
  TabletopObject,
  TrackPieceObject,
} from '../types'
import { canvasObjectsReducer } from './canvasObjects'

describe('canvasObjectsReducer', () => {
  it('adds an object without changing the existing collection', () => {
    const existing: LineObject = {
      id: 'existing',
      type: 'line',
      layerId: 'room',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    }
    const added: LineObject = {
      id: 'added',
      type: 'line',
      layerId: 'track',
      start: { x: 200, y: 200 },
      end: { x: 500, y: 200 },
    }
    const initial = [existing]

    const result = canvasObjectsReducer(initial, {
      type: 'add',
      object: added,
    })

    expect(result).toEqual([existing, added])
    expect(initial).toEqual([existing])
  })

  it('updates an object in place without changing its order', () => {
    const first: LineObject = {
      id: 'first',
      type: 'line',
      layerId: 'room',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    }
    const second: LineObject = {
      id: 'second',
      type: 'line',
      layerId: 'track',
      start: { x: 200, y: 200 },
      end: { x: 300, y: 300 },
    }
    const updated = {
      ...first,
      end: { x: 500, y: 500 },
    }

    expect(
      canvasObjectsReducer([first, second], {
        type: 'update',
        object: updated,
      }),
    ).toEqual([updated, second])
  })

  it('removes only the requested object', () => {
    const first: LineObject = {
      id: 'first',
      type: 'line',
      layerId: 'room',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    }
    const second: LineObject = {
      ...first,
      id: 'second',
    }

    expect(
      canvasObjectsReducer([first, second], {
        type: 'remove',
        id: 'first',
      }),
    ).toEqual([second])
  })

  it('allows multiple semantic rooms and tabletops to coexist', () => {
    const roomOne: RoomObject = {
      id: 'room-1',
      type: 'room',
      layerId: 'room',
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    }
    const roomTwo: RoomObject = {
      ...roomOne,
      id: 'room-2',
      x: 1200,
    }
    const tabletop: TabletopObject = {
      id: 'tabletop-1',
      type: 'tabletop',
      layerId: 'tabletop',
      x: 100,
      y: 100,
      width: 600,
      height: 300,
    }

    const withRooms = canvasObjectsReducer([], {
      type: 'add',
      object: roomOne,
    })
    const withSecondRoom = canvasObjectsReducer(withRooms, {
      type: 'add',
      object: roomTwo,
    })
    const result = canvasObjectsReducer(withSecondRoom, {
      type: 'add',
      object: tabletop,
    })

    expect(result).toEqual([roomOne, roomTwo, tabletop])
  })

  it('replaces every object without retaining the previous collection', () => {
    const previous: LineObject = {
      id: 'previous',
      type: 'line',
      layerId: 'room',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    }
    const replacement: LineObject = {
      ...previous,
      id: 'replacement',
      end: { x: 300, y: 200 },
    }
    const replacements = [replacement]

    const result = canvasObjectsReducer([previous], {
      type: 'replace',
      objects: replacements,
    })

    expect(result).toEqual(replacements)
    expect(result).not.toBe(replacements)
  })

  it('adds, updates, and removes track pieces with the shared reducer', () => {
    const track: TrackPieceObject = {
      id: 'track-1',
      type: 'track-piece',
      layerId: 'track',
      definitionId: 'straight-100',
      position: { x: 100, y: 100 },
      rotation: 0,
      direction: 'right',
    }
    const added = canvasObjectsReducer([], { type: 'add', object: track })
    const updatedTrack = {
      ...track,
      position: { x: 200, y: 100 },
    }
    const updated = canvasObjectsReducer(added, {
      type: 'update',
      object: updatedTrack,
    })

    expect(updated).toEqual([updatedTrack])
    expect(
      canvasObjectsReducer(updated, { type: 'remove', id: track.id }),
    ).toEqual([])
  })
})
