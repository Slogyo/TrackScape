import { useEffect, useMemo, useState } from 'react'
import type {
  CanvasObject,
  GeometryField,
  Layer,
  MeasurementSystem,
} from '../types'
import { lineLength } from '../utils/canvas'
import {
  formatPropertyValue,
  getGeometryValue,
  parsePropertyValue,
  propertyUnitForSystem,
  updateGeometryValue,
} from '../utils/objectProperties'
import { getObjectTypeLabel } from '../utils/shapeMode'
import { formatMillimetres } from '../utils/units'

interface ObjectPropertiesProps {
  layer: Layer | null
  measurementSystem: MeasurementSystem
  object: CanvasObject | null
  onUpdateObject: (object: CanvasObject) => void
}

interface PropertyDefinition {
  field: GeometryField
  label: string
}

const lineFields: PropertyDefinition[] = [
  { field: 'x1', label: 'X1' },
  { field: 'y1', label: 'Y1' },
  { field: 'x2', label: 'X2' },
  { field: 'y2', label: 'Y2' },
]

const rectangleFields: PropertyDefinition[] = [
  { field: 'x', label: 'X' },
  { field: 'y', label: 'Y' },
  { field: 'width', label: 'Width' },
  { field: 'height', label: 'Height' },
]

function ObjectProperties({
  layer,
  measurementSystem,
  object,
  onUpdateObject,
}: ObjectPropertiesProps) {
  const unit = propertyUnitForSystem(measurementSystem)
  const definitions = object?.type === 'line' ? lineFields : rectangleFields
  const [values, setValues] = useState<Partial<Record<GeometryField, string>>>(
    {},
  )
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<GeometryField | null>(null)

  const formattedValues = useMemo(() => {
    if (!object) {
      return {}
    }

    return Object.fromEntries(
      definitions.map(({ field }) => {
        const value = getGeometryValue(object, field)
        return [
          field,
          value === null
            ? ''
            : formatPropertyValue(value, measurementSystem),
        ]
      }),
    ) as Partial<Record<GeometryField, string>>
  }, [definitions, measurementSystem, object])

  useEffect(() => {
    setValues(formattedValues)
    setError(null)
    setErrorField(null)
  }, [formattedValues])

  const commitValue = (field: GeometryField) => {
    if (!object || layer?.locked) {
      return
    }

    if ((values[field] ?? '') === (formattedValues[field] ?? '')) {
      setError(null)
      setErrorField(null)
      return
    }

    const millimetres = parsePropertyValue(
      values[field] ?? '',
      measurementSystem,
    )
    const updatedObject =
      millimetres === null
        ? null
        : updateGeometryValue(object, field, millimetres)

    if (!updatedObject) {
      setErrorField(field)
      setError(
        object.type === 'line'
          ? 'Use non-negative coordinates and keep the line length above zero.'
          : 'Use non-negative positions and dimensions greater than zero.',
      )
      return
    }

    setError(null)
    setErrorField(null)
    onUpdateObject(updatedObject)
  }

  const restoreValue = (field: GeometryField) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: formattedValues[field] ?? '',
    }))
    setError(null)
    setErrorField(null)
  }

  return (
    <section className="object-properties" aria-labelledby="properties-heading">
      <div className="properties-heading">
        <div>
          <span className="eyebrow">Selection</span>
          <h2 id="properties-heading">Properties</h2>
        </div>
        {object && <span className="properties-unit">{unit}</span>}
      </div>

      {!object || !layer ? (
        <p className="properties-empty">Select an object to inspect it.</p>
      ) : (
        <div className="properties-content">
          <dl className="properties-summary">
            <div>
              <dt>Type</dt>
              <dd>{getObjectTypeLabel(object.type)}</dd>
            </div>
            <div>
              <dt>Layer</dt>
              <dd>{layer.name}</dd>
            </div>
          </dl>

          <div className="properties-grid">
            {definitions.map(({ field, label }) => (
              <label className="property-field" key={field}>
                <span>{label}</span>
                <input
                  aria-invalid={errorField === field}
                  aria-label={`${label} (${unit})`}
                  disabled={layer.locked}
                  inputMode="decimal"
                  step="any"
                  type="number"
                  value={values[field] ?? ''}
                  onBlur={() => commitValue(field)}
                  onChange={(event) => {
                    setValues((currentValues) => ({
                      ...currentValues,
                      [field]: event.target.value,
                    }))
                    setError(null)
                    setErrorField(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitValue(field)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      restoreValue(field)
                    }
                  }}
                />
              </label>
            ))}
          </div>

          {object.type === 'line' && (
            <div className="property-readout">
              <span>Length</span>
              <strong>
                {formatMillimetres(
                  lineLength(object.start, object.end),
                  unit,
                )}
              </strong>
            </div>
          )}

          {layer.locked && (
            <p className="properties-notice">Unlock this layer to edit.</p>
          )}
          {error && (
            <p className="properties-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default ObjectProperties
