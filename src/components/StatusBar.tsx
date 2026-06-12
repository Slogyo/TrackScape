import { getTool } from '../data/tools'
import type {
  CanvasObject,
  DraftMeasurement,
  Layer,
  MeasurementSystem,
  MovementDelta,
  Point,
  ToolId,
} from '../types'
import { defaultUnitForSystem, formatMillimetres } from '../utils/units'
import { getObjectTypeLabel, getShapeMode } from '../utils/shapeMode'

interface StatusBarProps {
  activeLayer: Layer
  activeToolId: ToolId
  cursorPositionMm: Point
  draftMeasurement: DraftMeasurement | null
  measurementSystem: MeasurementSystem
  movementDelta: MovementDelta | null
  selectedLayer: Layer | null
  selectedObject: CanvasObject | null
}

function StatusBar({
  activeLayer,
  activeToolId,
  cursorPositionMm,
  draftMeasurement,
  measurementSystem,
  movementDelta,
  selectedLayer,
  selectedObject,
}: StatusBarProps) {
  const activeTool = getTool(activeToolId)
  const activeToolLabel =
    activeToolId === 'shape'
      ? getShapeMode(activeLayer.id).label
      : activeTool.label
  const displayUnit = defaultUnitForSystem(measurementSystem)
  const isDrawingTool = activeToolId === 'line' || activeToolId === 'shape'

  let attributeLabel = 'Active layer'
  let attributeValue = activeLayer.name

  if (isDrawingTool && !activeLayer.visible) {
    attributeLabel = 'Drawing'
    attributeValue = `${activeLayer.name} layer is hidden`
  } else if (isDrawingTool && activeLayer.locked) {
    attributeLabel = 'Drawing'
    attributeValue = `${activeLayer.name} layer is locked`
  } else if (draftMeasurement?.type === 'line') {
    attributeLabel = 'Length'
    attributeValue = formatMillimetres(
      draftMeasurement.lengthMm,
      displayUnit,
    )
  } else if (draftMeasurement?.type === 'rectangle') {
    attributeLabel = 'Dimensions'
    attributeValue = `${formatMillimetres(
      draftMeasurement.widthMm,
      displayUnit,
    )} x ${formatMillimetres(draftMeasurement.heightMm, displayUnit)}`
  } else if (movementDelta) {
    attributeLabel = 'Move'
    attributeValue = `X ${formatMillimetres(
      movementDelta.x,
      displayUnit,
    )} / Y ${formatMillimetres(movementDelta.y, displayUnit)}`
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
        <strong>1:87 HO</strong>
      </div>
      <div className="status-item">
        <span className="status-label">Tool</span>
        <strong className="status-accent">{activeToolLabel}</strong>
      </div>
      <div className="status-item">
        <span className="status-label">Units</span>
        <strong>{measurementSystem === 'metric' ? 'Metric' : 'Imperial'}</strong>
      </div>
      <div className="status-item status-attributes">
        <span className="status-label">{attributeLabel}</span>
        <strong>{attributeValue}</strong>
      </div>
    </footer>
  )
}

export default StatusBar
