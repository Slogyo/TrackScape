import { useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
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

const MIN_SECTION_HEIGHT = 140
const PANEL_FIXED_SPACE = 205
const SECTION_KEYBOARD_STEP = 16

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
  const panelRef = useRef<HTMLElement>(null)
  const propertiesRef = useRef<HTMLDivElement>(null)
  const [propertiesHeight, setPropertiesHeight] = useState<number | null>(null)

  const clampPropertiesHeight = (height: number) => {
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
    return Math.min(
      Math.max(MIN_SECTION_HEIGHT, height),
      Math.max(MIN_SECTION_HEIGHT, panelHeight - PANEL_FIXED_SPACE),
    )
  }

  const handleSectionResizeStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight =
      propertiesRef.current?.getBoundingClientRect().height ??
      MIN_SECTION_HEIGHT

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      setPropertiesHeight(
        clampPropertiesHeight(
          startHeight + startY - pointerEvent.clientY,
        ),
      )
    }
    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing-panel-section')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    document.body.classList.add('is-resizing-panel-section')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const handleSectionResizeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const currentHeight =
      propertiesRef.current?.getBoundingClientRect().height ??
      MIN_SECTION_HEIGHT
    setPropertiesHeight(
      clampPropertiesHeight(
        currentHeight +
          (event.key === 'ArrowUp'
            ? SECTION_KEYBOARD_STEP
            : -SECTION_KEYBOARD_STEP),
      ),
    )
  }

  return (
    <aside
      className="layers-panel"
      ref={panelRef}
      style={
        propertiesHeight === null
          ? undefined
          : ({
              '--properties-panel-height': `${propertiesHeight}px`,
            } as CSSProperties)
      }
    >
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
      <div
        className="panel-section-resize-handle"
        role="separator"
        aria-label="Resize Layers and Properties sections"
        aria-orientation="horizontal"
        aria-valuemin={MIN_SECTION_HEIGHT}
        aria-valuenow={Math.round(
          propertiesHeight ??
            propertiesRef.current?.getBoundingClientRect().height ??
            MIN_SECTION_HEIGHT,
        )}
        tabIndex={0}
        onKeyDown={handleSectionResizeKeyDown}
        onPointerDown={handleSectionResizeStart}
      />
      <div className="properties-panel-slot" ref={propertiesRef}>
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
      </div>
    </aside>
  )
}

export default LayersPanel
