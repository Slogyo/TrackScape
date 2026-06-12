import type { CanvasObject, Layer, MeasurementSystem } from '../types'
import { getObjectBounds } from '../utils/canvas'
import { propertyUnitForSystem } from '../utils/objectProperties'
import { formatMillimetres } from '../utils/units'

interface MultiSelectionPropertiesProps {
  layers: Layer[]
  measurementSystem: MeasurementSystem
  objects: CanvasObject[]
}

function MultiSelectionProperties({
  layers,
  measurementSystem,
  objects,
}: MultiSelectionPropertiesProps) {
  const bounds = objects.map(getObjectBounds)
  const minX = Math.min(...bounds.map((candidate) => candidate.minX))
  const minY = Math.min(...bounds.map((candidate) => candidate.minY))
  const maxX = Math.max(...bounds.map((candidate) => candidate.maxX))
  const maxY = Math.max(...bounds.map((candidate) => candidate.maxY))
  const lockedCount = objects.filter((object) =>
    layers.find((layer) => layer.id === object.layerId)?.locked,
  ).length
  const unit = propertyUnitForSystem(measurementSystem)

  return (
    <section
      className="object-properties"
      aria-labelledby="properties-heading"
    >
      <div className="properties-heading">
        <div>
          <span className="eyebrow">Selection</span>
          <h2 id="properties-heading">Properties</h2>
        </div>
        <span className="properties-unit">{unit}</span>
      </div>
      <div className="properties-content">
        <dl className="properties-summary">
          <div>
            <dt>Objects</dt>
            <dd>{objects.length}</dd>
          </div>
          <div>
            <dt>Unlocked</dt>
            <dd>{objects.length - lockedCount}</dd>
          </div>
          <div>
            <dt>Locked</dt>
            <dd>{lockedCount}</dd>
          </div>
          <div>
            <dt>Combined width</dt>
            <dd>{formatMillimetres(maxX - minX, unit)}</dd>
          </div>
          <div>
            <dt>Combined height</dt>
            <dd>{formatMillimetres(maxY - minY, unit)}</dd>
          </div>
        </dl>
        <p className="properties-notice">
          Group actions affect unlocked objects only.
        </p>
      </div>
    </section>
  )
}

export default MultiSelectionProperties
