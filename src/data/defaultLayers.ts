import type { Layer } from '../types'

export const defaultLayers: Layer[] = [
  { id: 'room', name: 'Room', visible: true, locked: false, expanded: true },
  {
    id: 'tabletop',
    name: 'Tabletop',
    visible: true,
    locked: false,
    expanded: true,
  },
  { id: 'track', name: 'Track', visible: true, locked: false, expanded: true },
  {
    id: 'elevation',
    name: 'Elevation',
    visible: true,
    locked: false,
    expanded: true,
  },
  {
    id: 'buildings',
    name: 'Buildings',
    visible: true,
    locked: false,
    expanded: true,
  },
  {
    id: 'scenery',
    name: 'Scenery',
    visible: true,
    locked: false,
    expanded: true,
  },
]
