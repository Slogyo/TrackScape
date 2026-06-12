import type {
  CanvasObject,
  Layer,
  MeasurementSystem,
} from '../types'
import ObjectProperties from './ObjectProperties'

interface LayersPanelProps {
  activeLayerId: string
  layers: Layer[]
  measurementSystem: MeasurementSystem
  selectedLayer: Layer | null
  selectedObject: CanvasObject | null
  onSelectLayer: (layerId: string) => void
  onToggleVisibility: (layerId: string) => void
  onToggleLock: (layerId: string) => void
  onUpdateObject: (object: CanvasObject) => void
}

function LayersPanel({
  activeLayerId,
  layers,
  measurementSystem,
  selectedLayer,
  selectedObject,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onUpdateObject,
}: LayersPanelProps) {
  return (
    <aside className="layers-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>Layers</h2>
        </div>
        <button className="panel-action" type="button" disabled aria-label="Add layer">
          +
        </button>
      </div>

      <div className="layer-list">
        {layers.map((layer) => {
          const isActive = layer.id === activeLayerId

          return (
            <div
              className={`layer-row ${isActive ? 'is-active' : ''}`}
              key={layer.id}
            >
              <button
                className="layer-state-button"
                type="button"
                aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                aria-pressed={layer.visible}
                title={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                onClick={() => onToggleVisibility(layer.id)}
              >
                {layer.visible ? 'VIS' : 'OFF'}
              </button>
              <button
                className="layer-name-button"
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectLayer(layer.id)}
              >
                <span className="layer-folder" aria-hidden="true" />
                {layer.name}
              </button>
              <button
                className="layer-state-button"
                type="button"
                aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                aria-pressed={layer.locked}
                title={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                onClick={() => onToggleLock(layer.id)}
              >
                {layer.locked ? 'LCK' : 'OPN'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="panel-footer">
        <span>{layers.length} default layers</span>
        <span>Phase 2</span>
      </div>
      <ObjectProperties
        layer={selectedLayer}
        measurementSystem={measurementSystem}
        object={selectedObject}
        onUpdateObject={onUpdateObject}
      />
    </aside>
  )
}

export default LayersPanel
