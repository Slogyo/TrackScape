import type { LayoutScaleId, LayoutScalePreset } from '../types'

export const DEFAULT_LAYOUT_SCALE_ID: LayoutScaleId = 'ho'

export const layoutScalePresets: LayoutScalePreset[] = [
  { id: 'ho', name: 'HO', ratio: 87 },
  { id: 'n', name: 'N', ratio: 160 },
  { id: 'oo', name: 'OO', ratio: 76.2 },
  { id: 'o', name: 'O', ratio: 48 },
]

export const isLayoutScaleId = (value: unknown): value is LayoutScaleId =>
  layoutScalePresets.some((preset) => preset.id === value)

export const getLayoutScalePreset = (
  id: LayoutScaleId,
): LayoutScalePreset =>
  layoutScalePresets.find((preset) => preset.id === id) ??
  layoutScalePresets[0]
