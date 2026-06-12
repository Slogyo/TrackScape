import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import type {
  CanvasObject,
  DraftMeasurement,
  Layer,
  MovementDelta,
  Point,
  ToolId,
} from '../types'
import {
  canDrawOnLayer,
  clampTranslationToOrigin,
  isNonZeroLine,
  isNonZeroRectangle,
  lineLength,
  millimetresToPixels,
  normalizeRectangle,
  pointFromPixels,
  snapDelta,
  snapPoint,
  translateObject,
} from '../utils/canvas'
import { createShapeObject } from '../utils/shapeMode'

interface CanvasWorkspaceProps {
  activeLayer: Layer
  activeToolId: ToolId
  layers: Layer[]
  objects: CanvasObject[]
  selectedObjectId: string | null
  onAddObject: (object: CanvasObject, selectObject?: boolean) => void
  onCursorMove: (position: Point) => void
  onDraftMeasurementChange: (measurement: DraftMeasurement | null) => void
  onMovementDeltaChange: (delta: MovementDelta | null) => void
  onRemoveObject: (objectId: string) => void
  onSelectObject: (objectId: string | null) => void
  onUpdateObject: (object: CanvasObject) => void
}

type DrawingToolId = Extract<ToolId, 'line' | 'shape'>

interface DrawingDraft {
  toolId: DrawingToolId
  start: Point
  end: Point
  pointerId: number
}

interface MovementDraft {
  original: CanvasObject
  preview: CanvasObject
  startPointer: Point
  delta: MovementDelta
  pointerId: number
}

const isDrawingTool = (toolId: ToolId): toolId is DrawingToolId =>
  toolId === 'line' || toolId === 'shape'

const isTextEntryTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable)

function CanvasWorkspace({
  activeLayer,
  activeToolId,
  layers,
  objects,
  selectedObjectId,
  onAddObject,
  onCursorMove,
  onDraftMeasurementChange,
  onMovementDeltaChange,
  onRemoveObject,
  onSelectObject,
  onUpdateObject,
}: CanvasWorkspaceProps) {
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft | null>(null)
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(null)
  const visibleLayerIds = useMemo(
    () =>
      new Set(
        layers.filter((layer) => layer.visible).map((layer) => layer.id),
      ),
    [layers],
  )
  const visibleObjects = objects.filter((object) =>
    visibleLayerIds.has(object.layerId),
  )
  const selectedObject =
    objects.find((object) => object.id === selectedObjectId) ?? null
  const selectedLayer =
    layers.find((layer) => layer.id === selectedObject?.layerId) ?? null

  const cancelDrawing = useCallback(() => {
    setDrawingDraft(null)
    onDraftMeasurementChange(null)
  }, [onDraftMeasurementChange])

  const cancelMovement = useCallback(() => {
    setMovementDraft(null)
    onMovementDeltaChange(null)
  }, [onMovementDeltaChange])

  const cancelInteractions = useCallback(() => {
    cancelDrawing()
    cancelMovement()
  }, [cancelDrawing, cancelMovement])

  useEffect(() => {
    cancelInteractions()
  }, [activeLayer.id, activeToolId, cancelInteractions])

  useEffect(() => {
    if (
      movementDraft &&
      (!selectedLayer?.visible || selectedLayer.locked)
    ) {
      cancelMovement()
    }
  }, [cancelMovement, movementDraft, selectedLayer])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelInteractions()
        return
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedObjectId &&
        !isTextEntryTarget(event.target)
      ) {
        event.preventDefault()
        onRemoveObject(selectedObjectId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelInteractions, onRemoveObject, selectedObjectId])

  const getPointerPosition = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    return pointFromPixels(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    )
  }

  const getTargetObject = (event: PointerEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) {
      return null
    }

    const target = event.target.closest<SVGElement>('[data-object-id]')
    const objectId = target?.dataset.objectId

    return visibleObjects.find((object) => object.id === objectId) ?? null
  }

  const updateDrawingMeasurement = (nextDraft: DrawingDraft | null) => {
    if (!nextDraft) {
      onDraftMeasurementChange(null)
      return
    }

    if (nextDraft.toolId === 'line') {
      onDraftMeasurementChange({
        type: 'line',
        lengthMm: lineLength(nextDraft.start, nextDraft.end),
      })
      return
    }

    const rectangle = normalizeRectangle(nextDraft.start, nextDraft.end)
    onDraftMeasurementChange({
      type: 'rectangle',
      widthMm: rectangle.width,
      heightMm: rectangle.height,
    })
  }

  const getMovementPreview = (
    draft: MovementDraft,
    pointerPosition: Point,
  ): MovementDraft => {
    const snappedDelta = snapDelta({
      x: pointerPosition.x - draft.startPointer.x,
      y: pointerPosition.y - draft.startPointer.y,
    })
    const delta = clampTranslationToOrigin(draft.original, snappedDelta)

    return {
      ...draft,
      delta,
      preview: translateObject(draft.original, delta),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    const targetObject = getTargetObject(event)
    const targetLayer = layers.find(
      (layer) => layer.id === targetObject?.layerId,
    )

    if (activeToolId === 'select') {
      if (!targetObject || !targetLayer) {
        onSelectObject(null)
        return
      }

      onSelectObject(targetObject.id)
      if (targetLayer.locked) {
        return
      }

      const startPointer = getPointerPosition(event)
      const nextDraft: MovementDraft = {
        original: targetObject,
        preview: targetObject,
        startPointer,
        delta: { x: 0, y: 0 },
        pointerId: event.pointerId,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      setMovementDraft(nextDraft)
      onMovementDeltaChange(nextDraft.delta)
      return
    }

    if (activeToolId === 'delete') {
      if (!targetObject || !targetLayer) {
        onSelectObject(null)
        return
      }

      onSelectObject(targetObject.id)
      if (!targetLayer.locked) {
        onRemoveObject(targetObject.id)
      }
      return
    }

    if (!isDrawingTool(activeToolId) || !canDrawOnLayer(activeLayer)) {
      return
    }

    const start = snapPoint(getPointerPosition(event))
    const nextDraft: DrawingDraft = {
      toolId: activeToolId,
      start,
      end: start,
      pointerId: event.pointerId,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrawingDraft(nextDraft)
    updateDrawingMeasurement(nextDraft)
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointerPosition = getPointerPosition(event)
    onCursorMove(pointerPosition)

    if (
      movementDraft &&
      movementDraft.pointerId === event.pointerId
    ) {
      const nextDraft = getMovementPreview(movementDraft, pointerPosition)
      setMovementDraft(nextDraft)
      onMovementDeltaChange(nextDraft.delta)
      return
    }

    if (
      drawingDraft &&
      drawingDraft.pointerId === event.pointerId
    ) {
      const nextDraft = {
        ...drawingDraft,
        end: snapPoint(pointerPosition),
      }
      setDrawingDraft(nextDraft)
      updateDrawingMeasurement(nextDraft)
    }
  }

  const releasePointer = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (
      movementDraft &&
      movementDraft.pointerId === event.pointerId
    ) {
      const completedDraft = getMovementPreview(
        movementDraft,
        getPointerPosition(event),
      )
      releasePointer(event)

      if (completedDraft.delta.x !== 0 || completedDraft.delta.y !== 0) {
        onUpdateObject(completedDraft.preview)
      }
      cancelMovement()
      return
    }

    if (
      !drawingDraft ||
      drawingDraft.pointerId !== event.pointerId
    ) {
      return
    }

    const completedDraft = {
      ...drawingDraft,
      end: snapPoint(getPointerPosition(event)),
    }
    releasePointer(event)

    if (completedDraft.toolId === 'line') {
      if (isNonZeroLine(completedDraft.start, completedDraft.end)) {
        onAddObject({
          id: crypto.randomUUID(),
          type: 'line',
          layerId: activeLayer.id,
          start: completedDraft.start,
          end: completedDraft.end,
        })
      }
    } else {
      const rectangle = normalizeRectangle(
        completedDraft.start,
        completedDraft.end,
      )

      if (isNonZeroRectangle(rectangle)) {
        const object = createShapeObject(
          crypto.randomUUID(),
          activeLayer.id,
          rectangle,
        )
        onAddObject(
          object,
          object.type === 'room' || object.type === 'tabletop',
        )
      }
    }

    cancelDrawing()
  }

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (
      drawingDraft?.pointerId === event.pointerId ||
      movementDraft?.pointerId === event.pointerId
    ) {
      cancelInteractions()
    }
  }

  const renderGeometry = (
    object: CanvasObject,
    className: string,
    dataObjectId?: string,
  ) => {
    if (object.type === 'line') {
      return (
        <line
          className={className}
          data-object-id={dataObjectId}
          x1={millimetresToPixels(object.start.x)}
          x2={millimetresToPixels(object.end.x)}
          y1={millimetresToPixels(object.start.y)}
          y2={millimetresToPixels(object.end.y)}
        />
      )
    }

    return (
      <rect
        className={className}
        data-object-id={dataObjectId}
        x={millimetresToPixels(object.x)}
        y={millimetresToPixels(object.y)}
        width={millimetresToPixels(object.width)}
        height={millimetresToPixels(object.height)}
      />
    )
  }

  const renderRoomInset = (object: CanvasObject) => {
    if (object.type !== 'room') {
      return null
    }

    const x = millimetresToPixels(object.x)
    const y = millimetresToPixels(object.y)
    const width = millimetresToPixels(object.width)
    const height = millimetresToPixels(object.height)
    const inset = 4

    if (width <= inset * 2 || height <= inset * 2) {
      return null
    }

    return (
      <rect
        className="room-inner-outline"
        x={x + inset}
        y={y + inset}
        width={width - inset * 2}
        height={height - inset * 2}
      />
    )
  }

  const renderObject = (object: CanvasObject) => {
    const renderedObject =
      movementDraft?.original.id === object.id
        ? movementDraft.preview
        : object
    const isSelected = selectedObjectId === object.id
    const isMoving = movementDraft?.original.id === object.id
    const semanticClass =
      renderedObject.type === 'line' ? '' : `is-${renderedObject.type}`

    return (
      <g key={object.id}>
        {renderGeometry(
          renderedObject,
          `canvas-object ${semanticClass} ${
            isSelected ? 'is-selected' : ''
          } ${isMoving ? 'is-moving' : ''}`.trim(),
        )}
        {renderRoomInset(renderedObject)}
        {renderGeometry(
          renderedObject,
          `canvas-hit-target ${
            renderedObject.type === 'line' ? 'is-line' : 'is-rectangle'
          }`,
          object.id,
        )}
      </g>
    )
  }

  const draftObject: CanvasObject | null = drawingDraft
    ? drawingDraft.toolId === 'line'
      ? {
          id: 'draft',
          type: 'line',
          layerId: activeLayer.id,
          start: drawingDraft.start,
          end: drawingDraft.end,
        }
      : {
          ...createShapeObject(
            'draft',
            activeLayer.id,
            normalizeRectangle(drawingDraft.start, drawingDraft.end),
          ),
        }
    : null

  const workspaceClassName = [
    'canvas-workspace',
    isDrawingTool(activeToolId) ? 'is-drawing-tool' : '',
    activeToolId === 'select' ? 'is-selection-tool' : '',
    activeToolId === 'delete' ? 'is-delete-tool' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={workspaceClassName}
      aria-label="Layout workspace"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg className="drawing-surface" aria-label="Layout drawing">
        {visibleObjects.map(renderObject)}
        {draftObject && (
          <g>
            {renderGeometry(
              draftObject,
              `canvas-object is-draft ${
                draftObject.type === 'line'
                  ? ''
                  : `is-${draftObject.type}`
              }`.trim(),
            )}
            {renderRoomInset(draftObject)}
          </g>
        )}
      </svg>
      <div className="canvas-origin" aria-hidden="true">
        0,0
      </div>
      {objects.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-crosshair" aria-hidden="true" />
          <p>Start by drawing a room or tabletop.</p>
        </div>
      )}
    </section>
  )
}

export default CanvasWorkspace
