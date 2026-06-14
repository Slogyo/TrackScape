import type {
  CanvasObject,
  MeasurementObject,
  MeasurementSystem,
  TextObject,
} from '../types'
import { millimetresToPixels } from '../utils/canvas'
import {
  getMeasurementLayout,
  getTextCaretPosition,
  getTextLayout,
  TEXT_EDITING_MIN_CHARACTERS,
} from '../utils/annotations'
import { defaultUnitForSystem, formatMillimetres } from '../utils/units'

interface MeasurementGeometryProps {
  object: MeasurementObject
  objects: CanvasObject[]
  measurementSystem: MeasurementSystem
  selected: boolean
  zoom: number
}

export function MeasurementGeometry({
  object,
  objects,
  measurementSystem,
  selected,
  zoom,
}: MeasurementGeometryProps) {
  const layout = getMeasurementLayout(object, objects)
  const tangent = {
    x: (layout.dimensionEnd.x - layout.dimensionStart.x) /
      Math.max(layout.length, 1),
    y: (layout.dimensionEnd.y - layout.dimensionStart.y) /
      Math.max(layout.length, 1),
  }
  const arrowSize = 55
  const offsetHandleDistance = 14 / zoom
  const offsetHandleSize = 6 / zoom
  const offsetHandle = {
    x:
      millimetresToPixels(layout.label.x) +
      layout.normal.x * offsetHandleDistance,
    y:
      millimetresToPixels(layout.label.y) +
      layout.normal.y * offsetHandleDistance,
  }
  const arrowPath = (point: typeof layout.start, direction: number) => {
    const base = {
      x: point.x + tangent.x * arrowSize * direction,
      y: point.y + tangent.y * arrowSize * direction,
    }
    return `M ${millimetresToPixels(point.x)} ${millimetresToPixels(point.y)}
      L ${millimetresToPixels(base.x + layout.normal.x * arrowSize * 0.35)}
      ${millimetresToPixels(base.y + layout.normal.y * arrowSize * 0.35)}
      M ${millimetresToPixels(point.x)} ${millimetresToPixels(point.y)}
      L ${millimetresToPixels(base.x - layout.normal.x * arrowSize * 0.35)}
      ${millimetresToPixels(base.y - layout.normal.y * arrowSize * 0.35)}`
  }
  const unit = defaultUnitForSystem(measurementSystem)

  return (
    <g className={`measurement-object ${selected ? 'is-selected' : ''}`}>
      <line
        className="measurement-extension"
        x1={millimetresToPixels(layout.start.x)}
        y1={millimetresToPixels(layout.start.y)}
        x2={millimetresToPixels(layout.dimensionStart.x)}
        y2={millimetresToPixels(layout.dimensionStart.y)}
      />
      <line
        className="measurement-extension"
        x1={millimetresToPixels(layout.end.x)}
        y1={millimetresToPixels(layout.end.y)}
        x2={millimetresToPixels(layout.dimensionEnd.x)}
        y2={millimetresToPixels(layout.dimensionEnd.y)}
      />
      <line
        className="measurement-line"
        x1={millimetresToPixels(layout.dimensionStart.x)}
        y1={millimetresToPixels(layout.dimensionStart.y)}
        x2={millimetresToPixels(layout.dimensionEnd.x)}
        y2={millimetresToPixels(layout.dimensionEnd.y)}
      />
      <path className="measurement-arrow" d={arrowPath(layout.dimensionStart, 1)} />
      <path className="measurement-arrow" d={arrowPath(layout.dimensionEnd, -1)} />
      <text
        className="measurement-label"
        x={millimetresToPixels(layout.label.x)}
        y={millimetresToPixels(layout.label.y)}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {formatMillimetres(layout.length, unit)}
      </text>
      <line
        className="measurement-hit-target"
        data-object-id={object.id}
        x1={millimetresToPixels(layout.dimensionStart.x)}
        y1={millimetresToPixels(layout.dimensionStart.y)}
        x2={millimetresToPixels(layout.dimensionEnd.x)}
        y2={millimetresToPixels(layout.dimensionEnd.y)}
      />
      {selected && (
        <>
          <circle
            className="annotation-handle"
            data-measurement-handle="start"
            data-object-id={object.id}
            cx={millimetresToPixels(layout.start.x)}
            cy={millimetresToPixels(layout.start.y)}
            r={4 / zoom}
          />
          <circle
            className="annotation-handle"
            data-measurement-handle="end"
            data-object-id={object.id}
            cx={millimetresToPixels(layout.end.x)}
            cy={millimetresToPixels(layout.end.y)}
            r={4 / zoom}
          />
          <rect
            className="annotation-handle annotation-offset-handle"
            data-measurement-handle="offset"
            data-object-id={object.id}
            x={offsetHandle.x - offsetHandleSize / 2}
            y={offsetHandle.y - offsetHandleSize / 2}
            width={offsetHandleSize}
            height={offsetHandleSize}
          />
        </>
      )}
    </g>
  )
}

interface TextGeometryProps {
  object: TextObject
  selected: boolean
  zoom?: number
  editing?: {
    caretIndex: number
    selectionEnd: number
  }
}

export function TextGeometry({
  object,
  selected,
  zoom = 1,
  editing,
}: TextGeometryProps) {
  const x = millimetresToPixels(object.position.x)
  const y = millimetresToPixels(object.position.y)
  const layout = getTextLayout(
    object,
    undefined,
    editing ? TEXT_EDITING_MIN_CHARACTERS : 1,
  )
  const fontSize = millimetresToPixels(layout.fontSize)
  const originX = millimetresToPixels(layout.origin.x)
  const originY = millimetresToPixels(layout.origin.y)
  const width = millimetresToPixels(layout.width)
  const height = millimetresToPixels(layout.height)
  const lineHeight = millimetresToPixels(layout.lineHeight)
  const caret = editing
    ? getTextCaretPosition(object, editing.caretIndex)
    : null
  const handleSize = 6 / zoom
  const editingInset = 2 / zoom
  return (
    <g
      className={`text-object ${selected ? 'is-selected' : ''} ${
        editing ? 'is-editing' : ''
      }`.trim()}
      transform={`rotate(${object.rotation} ${x} ${y})`}
    >
      <text
        className="text-label"
        data-object-id={editing ? undefined : object.id}
        x={originX}
        y={originY}
        fontSize={fontSize}
        dominantBaseline="text-before-edge"
      >
        {layout.lines.map((line, index) =>
          line.text ? (
            <tspan
              key={`${index}-${line.text}`}
              x={originX}
              dy={index === 0 ? 0 : lineHeight}
            >
              {line.text}
            </tspan>
          ) : null,
        )}
      </text>
      <rect
        className="text-hit-target"
        data-object-id={editing ? undefined : object.id}
        data-text-editor-target={editing ? 'true' : undefined}
        x={originX}
        y={originY}
        width={width}
        height={height}
      />
      {editing && (
        <>
          <rect
            className="text-edit-boundary"
            data-text-editor-target="true"
            x={originX - editingInset}
            y={originY - editingInset}
            width={width + editingInset * 2}
            height={height + editingInset * 2}
          />
          <line
            className="text-edit-baseline"
            x1={originX}
            y1={originY + fontSize}
            x2={originX + width}
            y2={originY + fontSize}
          />
          <rect
            className="text-edit-drag-handle"
            data-text-editor-drag="true"
            x={originX - handleSize / 2}
            y={originY - handleSize / 2}
            width={handleSize}
            height={handleSize}
          />
          {caret && editing.caretIndex === editing.selectionEnd && (
            <line
              className="text-edit-caret"
              x1={millimetresToPixels(caret.x)}
              y1={millimetresToPixels(caret.y)}
              x2={millimetresToPixels(caret.x)}
              y2={millimetresToPixels(caret.y + object.fontSizeMm)}
            />
          )}
        </>
      )}
    </g>
  )
}
