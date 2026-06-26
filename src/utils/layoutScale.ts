import { getLayoutScalePreset } from '../data/layoutScales'
import type {
  LayoutScaleId,
  LayoutScalePreset,
  MeasurementSystem,
} from '../types'
import { formatMillimetres } from './units'

export const modelToPrototypeMillimetres = (
  millimetres: number,
  scale: LayoutScalePreset,
): number => millimetres * scale.ratio

export const formatPrototypeLength = (
  millimetres: number,
  scaleId: LayoutScaleId,
  measurementSystem: MeasurementSystem,
): string => {
  const scale = getLayoutScalePreset(scaleId)
  const unit = measurementSystem === 'metric' ? 'm' : 'ft'

  return formatMillimetres(
    modelToPrototypeMillimetres(millimetres, scale),
    unit,
  )
}
