import type { Layer } from '../types'

export const defaultLayers: Layer[] = [
  { id: 'room', name: 'Room', visible: true, locked: false },
  { id: 'tabletop', name: 'Tabletop', visible: true, locked: false },
  { id: 'track', name: 'Track', visible: true, locked: false },
  { id: 'elevation', name: 'Elevation', visible: true, locked: false },
  { id: 'buildings', name: 'Buildings', visible: true, locked: false },
  { id: 'scenery', name: 'Scenery', visible: true, locked: false },
]
