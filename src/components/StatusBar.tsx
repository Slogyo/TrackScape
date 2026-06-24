import { getLayoutScalePreset } from '../data/layoutScales'
import { getTool } from '../data/tools'
import { getTrackDefinition } from '../data/trackCatalog'
import type {
  CanvasObject,
  DraftMeasurement,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
  MovementDelta,
  Point,
  ToolId,
  TrackPreviewStatus,
} from '../types'
import { formatPrototypeLength } from '../utils/layoutScale'
import { getObjectTypeLabel, getShapeMode } from '../utils/shapeMode'
import { getTrackLength } from '../utils/trackGeometry'
import { defaultUnitForSystem, formatMillimetres } from '../utils/units'
import { getWorkspaceZoomPercent } from '../utils/viewport'

interface StatusBarProps {
  activeLayer: Layer
  activeToolId: ToolId
  cursorPositionMm: Point
  draftMeasurement: DraftMeasurement | null
  layoutScaleId: LayoutScaleId
  measurementSystem: MeasurementSystem
  movementDelta: MovementDelta | null
  isSnappingEnabled: boolean
  selectedLayer: Layer | null
  selectedObject: CanvasObject | null
  selectedObjectCount: number
  selectedLockedCount: number
  trackLayer: Layer | null
  trackPreviewStatus: TrackPreviewStatus | null
  workspaceZoom: number
  onToggleSnapping: () => void
  onResetView: () => void
}

function StatusBar({
  activeLayer,
  activeToolId,
  cursorPositionMm,
  draftMeasurement,
  layoutScaleId,
  measurementSystem,
  movementDelta,
  isSnappingEnabled,
  selectedLayer,
  selectedObject,
  selectedObjectCount,
  selectedLockedCount,
  trackLayer,
  trackPreviewStatus,
  workspaceZoom,
  onToggleSnapping,
  onResetView,
}: StatusBarProps) {
  const activeTool = getTool(activeToolId)
  const activeToolLabel =
    activeToolId === 'shape'
      ? getShapeMode(activeLayer.id).label
      : activeTool.label
  const displayUnit = defaultUnitForSystem(measurementSystem)
  const scale = getLayoutScalePreset(layoutScaleId)
  const zoomPercent = getWorkspaceZoomPercent(workspaceZoom)
  const isDrawingTool =
    activeToolId === 'line' ||
    activeToolId === 'shape' ||
    activeToolId === 'track' ||
    activeToolId === 'measurement' ||
    activeToolId === 'text'

  let attributeLabel = 'Active layer'
  let attributeValue = activeLayer.name

  if (activeToolId === 'track' && !trackLayer) {
    attributeLabel = 'Track'
    attributeValue = 'Track layer is missing'
  } else if (activeToolId === 'track' && !trackLayer?.visible) {
    attributeLabel = 'Track'
    attributeValue = 'Track layer is hidden'
  } else if (activeToolId === 'track' && trackLayer?.locked) {
    attributeLabel = 'Track'
    attributeValue = 'Track layer is locked'
  } else if (activeToolId === 'track' && trackPreviewStatus) {
    const definition = getTrackDefinition(trackPreviewStatus.definitionId)
    const radii = definition.radiiMm ?? (
      definition.radiusMm ? [definition.radiusMm] : []
    )
    const previewObject = {
      id: 'status-preview',
      type: 'track-piece' as const,
      layerId: 'track' as const,
      definitionId: definition.id,
      position: { x: 0, y: 0 },
      rotation: trackPreviewStatus.rotation,
      direction: trackPreviewStatus.direction,
    }
    attributeLabel = trackPreviewStatus.snapped ? 'Connector snap' : 'Track'
    attributeValue = `${definition.name} | ${formatMillimetres(
      getTrackLength(previewObject),
      displayUnit,
    )} | Prototype ${formatPrototypeLength(
      getTrackLength(previewObject),
      layoutScaleId,
      measurementSystem,
    )} | ${trackPreviewStatus.rotation} degrees${
      radii.length > 0
        ? ` | R${radii
            .map((radius) => formatMillimetres(radius, displayUnit))
            .join('/')} ${
            definition.handedness ?? trackPreviewStatus.direction
          }`
        : ''
    }`
  } else if (isDrawingTool && !activeLayer.visible) {
    attributeLabel = 'Drawing'
    attributeValue = `${activeLayer.name} layer is hidden`
  } else if (isDrawingTool && activeLayer.locked) {
    attributeLabel = 'Drawing'
    attributeValue = `${activeLayer.name} layer is locked`
  } else if (draftMeasurement?.type === 'line') {
    attributeLabel = 'Length'
    attributeValue = `${formatMillimetres(
      draftMeasurement.lengthMm,
      displayUnit,
    )} | Prototype ${formatPrototypeLength(
      draftMeasurement.lengthMm,
      layoutScaleId,
      measurementSystem,
    )}`
  } else if (draftMeasurement?.type === 'rectangle') {
    attributeLabel = 'Dimensions'
    attributeValue = `${formatMillimetres(
      draftMeasurement.widthMm,
      displayUnit,
    )} x ${formatMillimetres(
      draftMeasurement.heightMm,
      displayUnit,
    )} | Prototype ${formatPrototypeLength(
      draftMeasurement.widthMm,
      layoutScaleId,
      measurementSystem,
    )} x ${formatPrototypeLength(
      draftMeasurement.heightMm,
      layoutScaleId,
      measurementSystem,
    )}`
  } else if (draftMeasurement?.type === 'measurement') {
    attributeLabel = 'Measurement'
    attributeValue = `${formatMillimetres(
      draftMeasurement.lengthMm,
      displayUnit,
    )} | ${draftMeasurement.startAttached ? 'Attached' : 'Fixed'} to ${
      draftMeasurement.endAttached ? 'Attached' : 'Fixed'
    } | Offset ${formatMillimetres(
      draftMeasurement.offsetMm,
      displayUnit,
    )}`
  } else if (activeToolId === 'text') {
    attributeLabel = 'Label'
    attributeValue = 'Click to type. Enter commits; Shift+Enter adds a line.'
  } else if (movementDelta) {
    attributeLabel = 'Move'
    attributeValue = `X ${formatMillimetres(
      movementDelta.x,
      displayUnit,
    )} / Y ${formatMillimetres(movementDelta.y, displayUnit)}`
  } else if (selectedObjectCount > 1) {
    attributeLabel = 'Selection'
    attributeValue = `${selectedObjectCount} objects | ${
      selectedObjectCount - selectedLockedCount
    } unlocked | ${selectedLockedCount} locked`
  } else if (selectedObject && selectedLayer?.locked) {
    attributeLabel = 'Selection'
    attributeValue = `${selectedLayer.name} layer is locked`
  } else if (selectedObject && selectedLayer) {
    attributeLabel = 'Selection'
    attributeValue = `${getObjectTypeLabel(selectedObject.type)} / ${
      selectedLayer.name
    }`
  }

  return (
    <footer className="status-bar">
      <div className="status-item status-coordinate">
        <span className="status-label">Cursor</span>
        <strong>
          X {formatMillimetres(cursorPositionMm.x, displayUnit)} / Y{' '}
          {formatMillimetres(cursorPositionMm.y, displayUnit)}
        </strong>
      </div>
      <div className="status-item">
        <span className="status-label">Scale</span>
        <strong>
          1:{scale.ratio} {scale.name}
        </strong>
      </div>
      <div className="status-item">
        <span className="status-label">Tool</span>
        <strong className="status-accent">{activeToolLabel}</strong>
      </div>
      <div className="status-item status-snap">
        <span className="status-label">Snap</span>
        <button
          className={`status-toggle-button ${
            isSnappingEnabled ? 'is-active' : ''
          }`}
          type="button"
          aria-pressed={isSnappingEnabled}
          aria-label={`Turn snapping ${
            isSnappingEnabled ? 'off' : 'on'
          }`}
          onClick={onToggleSnapping}
        >
          {isSnappingEnabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="status-item">
        <span className="status-label">Units</span>
        <strong>{measurementSystem === 'metric' ? 'Metric' : 'Imperial'}</strong>
      </div>
      <div className="status-item status-view">
        <span className="status-label">View</span>
        <button
          className="status-view-button"
          type="button"
          title="Reset zoom and centre project"
          aria-label={`Reset workspace view. Current zoom ${zoomPercent} percent`}
          onClick={onResetView}
        >
          {zoomPercent}%
        </button>
      </div>
      <div className="status-item status-attributes">
        <span className="status-label">{attributeLabel}</span>
        <strong>{attributeValue}</strong>
      </div>
    </footer>
  )
}

export default StatusBar
