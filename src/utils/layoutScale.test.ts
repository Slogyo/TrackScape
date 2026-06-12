import { describe, expect, it } from 'vitest'
import {
  getLayoutScalePreset,
  layoutScalePresets,
} from '../data/layoutScales'
import {
  formatPrototypeLength,
  modelToPrototypeMillimetres,
} from './layoutScale'

describe('layout scale helpers', () => {
  it('defines the supported scale presets and ratios', () => {
    expect(layoutScalePresets).toEqual([
      { id: 'ho', name: 'HO', ratio: 87 },
      { id: 'n', name: 'N', ratio: 160 },
      { id: 'oo', name: 'OO', ratio: 76.2 },
      { id: 'o', name: 'O', ratio: 48 },
    ])
  })

  it('converts model millimetres without rounding the result', () => {
    expect(
      modelToPrototypeMillimetres(123.456, getLayoutScalePreset('oo')),
    ).toBe(9407.3472)
  })

  it('formats prototype lengths in metres or feet', () => {
    expect(formatPrototypeLength(1000, 'ho', 'metric')).toBe('87.00 m')
    expect(formatPrototypeLength(304.8, 'o', 'imperial')).toBe('48.00 ft')
  })
})
