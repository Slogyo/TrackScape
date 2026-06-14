import type {
  CanvasObject,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
  ToolId,
  TrackPlacementSettings,
} from '../types'
import ObjectProperties from './ObjectProperties'
import TrackPalette from './TrackPalette'
import MultiSelectionProperties from './MultiSelectionProperties'
import invisibleIcon from '../../SVG/Invisible.svg?url'
import visibleIcon from '../../SVG/Visible.svg?url'

interface LayersPanelProps {
  activeLayerId: string
  activeToolId: ToolId
  layers: Layer[]
  layoutScaleId: LayoutScaleId
  measurementSystem: MeasurementSystem
  objects: CanvasObject[]
  selectedLayer: Layer | null
  selectedObject: CanvasObject | null
  selectedObjects: CanvasObject[]
  trackSettings: TrackPlacementSettings
  onSelectLayer: (layerId: string) => void
  onTrackSettingsChange: (settings: TrackPlacementSettings) => void
  onToggleVisibility: (layerId: string) => void
  onToggleLock: (layerId: string) => void
  onUpdateObject: (object: CanvasObject) => void
}

function LayersPanel({
  activeLayerId,
  activeToolId,
  layers,
  layoutScaleId,
  measurementSystem,
  objects,
  selectedLayer,
  selectedObject,
  selectedObjects,
  trackSettings,
  onSelectLayer,
  onTrackSettingsChange,
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
                <span
                  className="layer-visibility-icon"
                  aria-hidden="true"
                  style={{
                    '--visibility-icon': `url("${
                      layer.visible ? visibleIcon : invisibleIcon
                    }")`,
                  } as React.CSSProperties}
                />
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
        <span>Phase 4</span>
      </div>
      {activeToolId === 'track' ? (
        <TrackPalette
          layoutScaleId={layoutScaleId}
          measurementSystem={measurementSystem}
          settings={trackSettings}
          onChange={onTrackSettingsChange}
        />
      ) : selectedObjects.length > 1 ? (
        <MultiSelectionProperties
          layers={layers}
          measurementSystem={measurementSystem}
          objects={selectedObjects}
        />
      ) : (
        <ObjectProperties
          layer={selectedLayer}
          layoutScaleId={layoutScaleId}
          measurementSystem={measurementSystem}
          object={selectedObject}
          objects={objects}
          onUpdateObject={onUpdateObject}
        />
      )}
    </aside>
  )
}

export default LayersPanel
