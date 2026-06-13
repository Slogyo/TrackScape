import { useEffect, useMemo, useState } from 'react'
import type {
  CanvasObject,
  GeometryField,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
} from '../types'
import { lineLength } from '../utils/canvas'
import { getTrackDefinition } from '../data/trackCatalog'
import {
  formatPropertyValue,
  getGeometryValue,
  parsePropertyValue,
  propertyUnitForSystem,
  updateGeometryValue,
} from '../utils/objectProperties'
import { getObjectTypeLabel } from '../utils/shapeMode'
import { formatMillimetres } from '../utils/units'
import { getTrackLength } from '../utils/trackGeometry'
import { formatPrototypeLength } from '../utils/layoutScale'

interface ObjectPropertiesProps {
  layer: Layer | null
  layoutScaleId: LayoutScaleId
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

const trackFields: PropertyDefinition[] = [
  { field: 'x', label: 'X' },
  { field: 'y', label: 'Y' },
  { field: 'rotation', label: 'Rotation' },
]

function ObjectProperties({
  layer,
  layoutScaleId,
  measurementSystem,
  object,
  onUpdateObject,
}: ObjectPropertiesProps) {
  const unit = propertyUnitForSystem(measurementSystem)
  const definitions =
    object?.type === 'line'
      ? lineFields
      : object?.type === 'track-piece'
        ? trackFields
        : rectangleFields
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
            : field === 'rotation'
              ? String(value)
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

    const rawValue = values[field] ?? ''
    const millimetres =
      field === 'rotation'
        ? rawValue.trim() === ''
          ? null
          : Number(rawValue)
        : parsePropertyValue(rawValue, measurementSystem)
    const updatedObject =
      millimetres === null
        ? null
        : updateGeometryValue(object, field, millimetres)

    if (!updatedObject) {
      setErrorField(field)
      setError(
        object.type === 'track-piece'
          ? 'Use non-negative positions and rotation in 15 degree steps from 0 to 345.'
          : object.type === 'line'
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
                  aria-label={
                    field === 'rotation'
                      ? 'Rotation (degrees)'
                      : `${label} (${unit})`
                  }
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
            <>
              <div className="property-readout">
                <span>Length</span>
                <strong>
                  {formatMillimetres(
                    lineLength(object.start, object.end),
                    unit,
                  )}
                </strong>
              </div>
              <div className="property-readout">
                <span>Prototype length</span>
                <strong>
                  {formatPrototypeLength(
                    lineLength(object.start, object.end),
                    layoutScaleId,
                    measurementSystem,
                  )}
                </strong>
              </div>
            </>
          )}

          {object.type !== 'line' && object.type !== 'track-piece' && (
            <>
              <div className="property-readout">
                <span>Prototype width</span>
                <strong>
                  {formatPrototypeLength(
                    object.width,
                    layoutScaleId,
                    measurementSystem,
                  )}
                </strong>
              </div>
              <div className="property-readout">
                <span>Prototype height</span>
                <strong>
                  {formatPrototypeLength(
                    object.height,
                    layoutScaleId,
                    measurementSystem,
                  )}
                </strong>
              </div>
            </>
          )}

          {object.type === 'track-piece' && (() => {
            const definition = getTrackDefinition(object.definitionId)
            const radii = definition.radiiMm ?? (
              definition.radiusMm ? [definition.radiusMm] : []
            )
            return (
              <>
                <div className="property-readout">
                  <span>Piece</span>
                  <strong>{definition.name}</strong>
                </div>
                <div className="property-readout">
                  <span>Manufacturer</span>
                  <strong>{definition.manufacturer}</strong>
                </div>
                {definition.productCode && (
                  <div className="property-readout">
                    <span>Product code</span>
                    <strong>{definition.productCode}</strong>
                  </div>
                )}
                {definition.railCode && (
                  <div className="property-readout">
                    <span>Rail code</span>
                    <strong>Code {definition.railCode}</strong>
                  </div>
                )}
                {definition.productRange && (
                  <div className="property-readout">
                    <span>Range</span>
                    <strong>{definition.productRange}</strong>
                  </div>
                )}
                {definition.gaugeMm && (
                  <div className="property-readout">
                    <span>Gauge</span>
                    <strong>{definition.gaugeMm} mm</strong>
                  </div>
                )}
                {definition.frogType && (
                  <div className="property-readout">
                    <span>Frog</span>
                    <strong>{definition.frogType}</strong>
                  </div>
                )}
                <div className="property-readout">
                  <span>
                    {definition.routeLengthsMm?.length
                      ? 'Max length'
                      : 'Length'}
                  </span>
                  <strong>
                    {formatMillimetres(getTrackLength(object), unit)}
                  </strong>
                </div>
                {definition.routeLengthsMm?.length && (
                  <div className="property-readout">
                    <span>Route lengths</span>
                    <strong>
                      {definition.routeLengthsMm
                        .map((length) =>
                          formatMillimetres(length, unit),
                        )
                        .join(' / ')}
                    </strong>
                  </div>
                )}
                <div className="property-readout">
                  <span>Prototype length</span>
                  <strong>
                    {formatPrototypeLength(
                      getTrackLength(object),
                      layoutScaleId,
                      measurementSystem,
                    )}
                  </strong>
                </div>
                {radii.length > 0 && (
                  <>
                    <div className="property-readout">
                      <span>Radius</span>
                      <strong>R{radii.join('/')} mm</strong>
                    </div>
                    <div className="property-readout">
                      <span>Prototype radius</span>
                      <strong>
                        {radii
                          .map((radius) =>
                            formatPrototypeLength(
                              radius,
                              layoutScaleId,
                              measurementSystem,
                            ),
                          )
                          .join(' / ')}
                      </strong>
                    </div>
                    <div className="property-readout">
                      <span>Curve</span>
                      <strong>
                        {definition.angleDegrees}°{' '}
                        {definition.handedness ?? object.direction}
                      </strong>
                    </div>
                  </>
                )}
                {definition.technicalSpecifications &&
                  Object.keys(definition.technicalSpecifications).length >
                    0 && (
                    <div className="track-technical-specifications">
                      <span className="status-label">
                        Official specifications
                      </span>
                      <dl>
                        {Object.entries(
                          definition.technicalSpecifications,
                        ).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                {definition.sourceUrl && (
                  <a
                    className="track-source-link"
                    href={definition.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View official PECO product
                  </a>
                )}
              </>
            )
          })()}

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
