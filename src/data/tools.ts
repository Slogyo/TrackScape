import type { Tool } from '../types'

export const tools: Tool[] = [
  { id: 'select', label: 'Select / Move', shortLabel: 'S', shortcut: 'V' },
  { id: 'delete', label: 'Delete', shortLabel: 'D', shortcut: 'Delete' },
  { id: 'line', label: 'Line', shortLabel: 'L', shortcut: 'L' },
  { id: 'shape', label: 'Shape', shortLabel: 'R', shortcut: 'R' },
  { id: 'track', label: 'Track', shortLabel: 'T', shortcut: 'T' },
  {
    id: 'measurement',
    label: 'Measurement',
    shortLabel: 'M',
    shortcut: 'M',
  },
  { id: 'text', label: 'Text / Label', shortLabel: 'A', shortcut: 'A' },
]

export const getTool = (toolId: Tool['id']) =>
  tools.find((tool) => tool.id === toolId) ?? tools[0]
