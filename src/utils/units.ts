import type {
  DisplayUnit,
  ImperialUnit,
  MeasurementSystem,
  MetricUnit,
} from '../types'

const MILLIMETRES_PER_INCH = 25.4
const MILLIMETRES_PER_FOOT = 304.8

export const defaultUnitForSystem = (
  system: MeasurementSystem,
): DisplayUnit => (system === 'metric' ? 'mm' : 'in')

export const millimetresTo = (
  millimetres: number,
  unit: DisplayUnit,
): number => {
  const conversions: Record<DisplayUnit, number> = {
    mm: millimetres,
    cm: millimetres / 10,
    m: millimetres / 1000,
    in: millimetres / MILLIMETRES_PER_INCH,
    ft: millimetres / MILLIMETRES_PER_FOOT,
  }

  return conversions[unit]
}

export const displayValueToMillimetres = (
  value: number,
  unit: DisplayUnit,
): number => {
  const conversions: Record<DisplayUnit, number> = {
    mm: value,
    cm: value * 10,
    m: value * 1000,
    in: value * MILLIMETRES_PER_INCH,
    ft: value * MILLIMETRES_PER_FOOT,
  }

  return conversions[unit]
}

export const formatMillimetres = (
  millimetres: number,
  unit: DisplayUnit,
): string => {
  const convertedValue = millimetresTo(millimetres, unit)
  const fractionDigits = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2

  return `${convertedValue.toFixed(fractionDigits)} ${unit}`
}

export const isMetricUnit = (unit: DisplayUnit): unit is MetricUnit =>
  unit === 'mm' || unit === 'cm' || unit === 'm'

export const isImperialUnit = (unit: DisplayUnit): unit is ImperialUnit =>
  unit === 'in' || unit === 'ft'
