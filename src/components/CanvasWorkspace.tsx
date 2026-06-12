import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PointerEvent } from 'react'
import type {
  CanvasObject,
  DraftMeasurement,
  Layer,
  MovementDelta,
  Point,
  TrackPieceObject,
  TrackPlacementSettings,
  TrackPreviewStatus,
  ToolId,
} from '../types'
import {
  canDrawOnLayer,
  boundsIntersect,
  clampGroupTranslationToOrigin,
  getCombinedBounds,
  getObjectBounds,
  isNonZeroLine,
  isNonZeroRectangle,
  lineLength,
  millimetresToPixels,
  normalizeRectangle,
  pointFromViewportPixels,
  snapDelta,
  snapPoint,
  translateObject,
} from '../utils/canvas'
import {
  type CameraPosition,
  DEFAULT_WORKSPACE_ZOOM,
  getCanvasRelativeWheelCameraOffset,
  getCenteredCamera,
  getCursorAnchoredCamera,
  stepZoom,
} from '../utils/viewport'
import { createShapeObject } from '../utils/shapeMode'
import {
  findNearestTrackConnector,
  getAvailableTrackConnectors,
  getTrackBounds,
  normalizeRotation,
} from '../utils/trackGeometry'
import { getTrackDefinition } from '../data/trackCatalog'
import TrackGeometry from './TrackGeometry'

interface CanvasWorkspaceProps {
  activeLayer: Layer
  activeToolId: ToolId
  layers: Layer[]
  objects: CanvasObject[]
  projectId: string
  resetViewToken: number
  selectedObjectIds: string[]
  trackSettings: TrackPlacementSettings
  zoom: number
  onAddObject: (object: CanvasObject, selectObject?: boolean) => void
  onCursorMove: (position: Point) => void
  onDraftMeasurementChange: (measurement: DraftMeasurement | null) => void
  onMovementDeltaChange: (delta: MovementDelta | null) => void
  onRemoveObject: (objectId: string) => void
  onRemoveObjects: (objectIds: string[]) => void
  onSelectObjects: (objectIds: string[]) => void
  onTrackPreviewChange: (status: TrackPreviewStatus | null) => void
  onTrackSettingsChange: (settings: TrackPlacementSettings) => void
  onUpdateObjects: (objects: CanvasObject[]) => void
  onZoomChange: (zoom: number) => void
}

type DrawingToolId = Extract<ToolId, 'line' | 'shape'>

interface DrawingDraft {
  toolId: DrawingToolId
  start: Point
  end: Point
  pointerId: number
}

interface MovementDraft {
  originals: CanvasObject[]
  previews: CanvasObject[]
  collapseToObjectId: string | null
  startPointer: Point
  delta: MovementDelta
  pointerId: number
}

interface AreaSelectionDraft {
  start: Point
  end: Point
  pointerId: number
}

interface PanDraft {
  pointerId: number
  startClient: Point
  startCamera: CameraPosition
  clearSelectionOnClick: boolean
}

const PAN_DRAG_THRESHOLD_PX = 3

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
  projectId,
  resetViewToken,
  selectedObjectIds,
  trackSettings,
  zoom,
  onAddObject,
  onCursorMove,
  onDraftMeasurementChange,
  onMovementDeltaChange,
  onRemoveObject,
  onRemoveObjects,
  onSelectObjects,
  onTrackPreviewChange,
  onTrackSettingsChange,
  onUpdateObjects,
  onZoomChange,
}: CanvasWorkspaceProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const cameraRef = useRef<CameraPosition>({ x: 0, y: 0 })
  const objectsRef = useRef(objects)
  const spacePressedRef = useRef(false)
  objectsRef.current = objects
  const [camera, setCameraState] = useState<CameraPosition>({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState({
    width: 1,
    height: 1,
  })
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft | null>(null)
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(null)
  const [areaSelectionDraft, setAreaSelectionDraft] =
    useState<AreaSelectionDraft | null>(null)
  const [panDraft, setPanDraft] = useState<PanDraft | null>(null)
  const [trackPointer, setTrackPointer] = useState<Point | null>(null)
  const setCamera = useCallback((nextCamera: CameraPosition) => {
    cameraRef.current = nextCamera
    setCameraState(nextCamera)
  }, [])
  const visibleLayerIds = useMemo(
    () =>
      new Set(
        layers.filter((layer) => layer.visible).map((layer) => layer.id),
      ),
    [layers],
  )
  const visibleObjects = useMemo(
    () => objects.filter((object) => visibleLayerIds.has(object.layerId)),
    [objects, visibleLayerIds],
  )
  const selectedObjects = objects.filter((object) =>
    selectedObjectIds.includes(object.id),
  )
  const trackLayer = layers.find((layer) => layer.id === 'track') ?? null
  const visibleTrackObjects = useMemo(
    () =>
      visibleObjects.filter(
        (object): object is TrackPieceObject =>
          object.type === 'track-piece',
      ),
    [visibleObjects],
  )
  const availableTrackConnectors = useMemo(
    () => getAvailableTrackConnectors(visibleTrackObjects),
    [visibleTrackObjects],
  )
  const trackPreview = useMemo(() => {
    if (
      activeToolId !== 'track' ||
      !trackPointer ||
      !trackLayer ||
      !trackLayer.visible ||
      trackLayer.locked
    ) {
      return null
    }

    const connector = findNearestTrackConnector(
      trackPointer,
      visibleTrackObjects,
    )
    const preview: TrackPieceObject = {
      id: 'track-preview',
      type: 'track-piece',
      layerId: 'track',
      definitionId: trackSettings.definitionId,
      position: connector ? connector.position : snapPoint(trackPointer),
      rotation: connector ? connector.heading : trackSettings.rotation,
      direction: trackSettings.direction,
    }

    return {
      object: preview,
      snapped: connector !== null,
      withinOrigin: (() => {
        const bounds = getTrackBounds(preview)
        return bounds.minX >= -0.001 && bounds.minY >= -0.001
      })(),
    }
  }, [
    activeToolId,
    trackLayer,
    trackPointer,
    trackSettings,
    visibleTrackObjects,
  ])

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
    setAreaSelectionDraft(null)
  }, [cancelDrawing, cancelMovement])

  useEffect(() => {
    cancelInteractions()
    setTrackPointer(null)
  }, [activeLayer.id, activeToolId, cancelInteractions])

  useEffect(() => {
    onZoomChange(DEFAULT_WORKSPACE_ZOOM)
    setCamera({ x: 0, y: 0 })
  }, [onZoomChange, projectId, setCamera])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const updateSize = () => {
      setViewportSize({
        width: Math.max(viewport.clientWidth, 1),
        height: Math.max(viewport.clientHeight, 1),
      })
    }
    const observer = new ResizeObserver(updateSize)

    updateSize()
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (resetViewToken === 0 || !viewportRef.current) {
      return
    }

    const viewport = viewportRef.current
    const nextCamera = getCenteredCamera(
      getCombinedBounds(objectsRef.current),
      DEFAULT_WORKSPACE_ZOOM,
      { width: viewport.clientWidth, height: viewport.clientHeight },
    )

    onZoomChange(DEFAULT_WORKSPACE_ZOOM)
    setCamera(nextCamera)
  }, [onZoomChange, resetViewToken, setCamera])

  useEffect(() => {
    onTrackPreviewChange(
      trackPreview
        ? {
            definitionId: trackPreview.object.definitionId,
            rotation: trackPreview.object.rotation,
            direction: trackPreview.object.direction,
            snapped: trackPreview.snapped,
          }
        : null,
    )
  }, [onTrackPreviewChange, trackPreview])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTextEntryTarget(event.target)) {
        event.preventDefault()
        spacePressedRef.current = true
      }

      if (event.key === 'Escape') {
        cancelInteractions()
        setTrackPointer(null)
        setPanDraft(null)
        return
      }

      if (
        activeToolId === 'track' &&
        !isTextEntryTarget(event.target)
      ) {
        if (event.key === '[' || event.key === ']') {
          event.preventDefault()
          onTrackSettingsChange({
            ...trackSettings,
            rotation: normalizeRotation(
              trackSettings.rotation + (event.key === '[' ? -15 : 15),
            ),
          })
          return
        }

        if (
          event.key.toLowerCase() === 'f' &&
          getTrackDefinition(trackSettings.definitionId).kind === 'curve'
        ) {
          event.preventDefault()
          onTrackSettingsChange({
            ...trackSettings,
            direction:
              trackSettings.direction === 'left' ? 'right' : 'left',
          })
          return
        }
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedObjectIds.length > 0 &&
        !isTextEntryTarget(event.target)
      ) {
        event.preventDefault()
        onRemoveObjects(selectedObjectIds)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    activeToolId,
    cancelInteractions,
    onRemoveObjects,
    onTrackSettingsChange,
    selectedObjectIds,
    trackSettings,
  ])

  const getPointerPosition = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    return pointFromViewportPixels(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      cameraRef.current.x,
      cameraRef.current.y,
      zoom,
    )
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    if (event.altKey) {
      setCamera({
        ...cameraRef.current,
        x: getCanvasRelativeWheelCameraOffset(
          cameraRef.current.x,
          event.deltaY,
          zoom,
        ),
      })
      return
    }

    if (event.shiftKey) {
      setCamera({
        ...cameraRef.current,
        y: getCanvasRelativeWheelCameraOffset(
          cameraRef.current.y,
          event.deltaY,
          zoom,
        ),
      })
      return
    }

    const nextZoom = stepZoom(zoom, event.deltaY)
    if (nextZoom === zoom) {
      return
    }

    const bounds = viewport.getBoundingClientRect()
    const nextCamera = getCursorAnchoredCamera(
      cameraRef.current,
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
      zoom,
      nextZoom,
    )

    setCamera(nextCamera)
    onZoomChange(nextZoom)
  }, [onZoomChange, setCamera, zoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

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
    const delta = clampGroupTranslationToOrigin(
      draft.originals,
      snappedDelta,
    )

    return {
      ...draft,
      delta,
      previews: draft.originals.map((object) =>
        translateObject(object, delta),
      ),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    const isPanStart =
      event.button === 1 ||
      (event.button === 0 && spacePressedRef.current)

    if (isPanStart) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setPanDraft({
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startCamera: cameraRef.current,
        clearSelectionOnClick: false,
      })
      cancelInteractions()
      return
    }

    if (event.button !== 0) {
      return
    }

    const targetObject = getTargetObject(event)
    const targetLayer = layers.find(
      (layer) => layer.id === targetObject?.layerId,
    )

    if (activeToolId === 'select' || activeToolId === 'area-select') {
      if (!targetObject || !targetLayer) {
        if (activeToolId === 'area-select') {
          onSelectObjects([])
          const start = getPointerPosition(event)
          event.currentTarget.setPointerCapture(event.pointerId)
          setAreaSelectionDraft({
            start,
            end: start,
            pointerId: event.pointerId,
          })
        } else {
          event.currentTarget.setPointerCapture(event.pointerId)
          setPanDraft({
            pointerId: event.pointerId,
            startClient: { x: event.clientX, y: event.clientY },
            startCamera: cameraRef.current,
            clearSelectionOnClick: true,
          })
        }
        return
      }

      const targetWasSelected = selectedObjectIds.includes(targetObject.id)
      const nextSelection = targetWasSelected
        ? selectedObjects
        : [targetObject]
      if (!targetWasSelected) {
        onSelectObjects([targetObject.id])
      }

      const movableObjects = nextSelection.filter((object) => {
        const layer = layers.find(
          (candidate) => candidate.id === object.layerId,
        )
        return Boolean(layer?.visible && !layer.locked)
      })
      if (movableObjects.length === 0 || targetLayer.locked) {
        onSelectObjects([targetObject.id])
        return
      }

      const startPointer = getPointerPosition(event)
      const nextDraft: MovementDraft = {
        originals: movableObjects,
        previews: movableObjects,
        collapseToObjectId:
          targetWasSelected && selectedObjectIds.length > 1
            ? targetObject.id
            : null,
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
        onSelectObjects([])
        return
      }

      onSelectObjects([targetObject.id])
      if (!targetLayer.locked) {
        onRemoveObject(targetObject.id)
      }
      return
    }

    if (activeToolId === 'track') {
      if (
        trackLayer?.visible &&
        !trackLayer.locked &&
        trackPreview?.withinOrigin
      ) {
        onAddObject({
          ...trackPreview.object,
          id: crypto.randomUUID(),
        })
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
    if (panDraft?.pointerId === event.pointerId) {
      setCamera({
        x: Math.max(
          0,
          panDraft.startCamera.x -
            (event.clientX - panDraft.startClient.x) / zoom,
        ),
        y: Math.max(
          0,
          panDraft.startCamera.y -
            (event.clientY - panDraft.startClient.y) / zoom,
        ),
      })
      return
    }

    const pointerPosition = getPointerPosition(event)
    onCursorMove(pointerPosition)

    if (activeToolId === 'track') {
      setTrackPointer(pointerPosition)
    }

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
      areaSelectionDraft &&
      areaSelectionDraft.pointerId === event.pointerId
    ) {
      setAreaSelectionDraft({
        ...areaSelectionDraft,
        end: pointerPosition,
      })
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
    if (panDraft?.pointerId === event.pointerId) {
      const dragDistance = Math.hypot(
        event.clientX - panDraft.startClient.x,
        event.clientY - panDraft.startClient.y,
      )
      releasePointer(event)
      if (
        panDraft.clearSelectionOnClick &&
        dragDistance < PAN_DRAG_THRESHOLD_PX
      ) {
        onSelectObjects([])
      }
      setPanDraft(null)
      return
    }

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
        onUpdateObjects(completedDraft.previews)
      } else if (completedDraft.collapseToObjectId) {
        onSelectObjects([completedDraft.collapseToObjectId])
      }
      cancelMovement()
      return
    }

    if (
      areaSelectionDraft &&
      areaSelectionDraft.pointerId === event.pointerId
    ) {
      const completedDraft = {
        ...areaSelectionDraft,
        end: getPointerPosition(event),
      }
      const marquee = normalizeRectangle(
        completedDraft.start,
        completedDraft.end,
      )
      const marqueeBounds = {
        minX: marquee.x,
        minY: marquee.y,
        maxX: marquee.x + marquee.width,
        maxY: marquee.y + marquee.height,
      }
      releasePointer(event)
      onSelectObjects(
        visibleObjects
          .filter((object) =>
            boundsIntersect(getObjectBounds(object), marqueeBounds),
          )
          .map((object) => object.id),
      )
      setAreaSelectionDraft(null)
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
    if (panDraft?.pointerId === event.pointerId) {
      setPanDraft(null)
      return
    }
    if (
      drawingDraft?.pointerId === event.pointerId ||
      movementDraft?.pointerId === event.pointerId ||
      areaSelectionDraft?.pointerId === event.pointerId
    ) {
      cancelInteractions()
    }
  }

  const renderGeometry = (
    object: CanvasObject,
    className: string,
    dataObjectId?: string,
  ) => {
    if (object.type === 'track-piece') {
      return null
    }

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
    const movementPreview = movementDraft?.previews.find(
      (preview) => preview.id === object.id,
    )
    const renderedObject = movementPreview ?? object
    const isSelected = selectedObjectIds.includes(object.id)
    const isMoving = Boolean(movementPreview)
    if (renderedObject.type === 'track-piece') {
      return (
        <TrackGeometry
          key={object.id}
          className={`track-object ${
            isSelected ? 'is-selected' : ''
          } ${isMoving ? 'is-moving' : ''}`.trim()}
          dataObjectId={object.id}
          object={renderedObject}
        />
      )
    }

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
    isDrawingTool(activeToolId) || activeToolId === 'track'
      ? 'is-drawing-tool'
      : '',
    activeToolId === 'select' || activeToolId === 'area-select'
      ? 'is-selection-tool'
      : '',
    activeToolId === 'area-select' ? 'is-area-selection-tool' : '',
    activeToolId === 'delete' ? 'is-delete-tool' : '',
    panDraft ? 'is-panning' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const viewWidth = viewportSize.width / zoom
  const viewHeight = viewportSize.height / zoom

  return (
    <section
      ref={viewportRef}
      className={workspaceClassName}
      aria-label="Layout workspace"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="workspace-content"
        style={{
          backgroundSize: `${10 * zoom}px ${10 * zoom}px, ${
            100 * zoom
          }px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px`,
          backgroundPosition: `${
            -camera.x * zoom - 1
          }px ${-camera.y * zoom - 1}px`,
        }}
      >
        <svg
          className="drawing-surface"
          aria-label="Layout drawing"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox={`${camera.x} ${camera.y} ${viewWidth} ${viewHeight}`}
        >
          {visibleObjects.map(renderObject)}
        {activeToolId === 'track' &&
          availableTrackConnectors.map((connector) => (
            <circle
              className="track-connector"
              key={`${connector.objectId}-${connector.end}`}
              cx={millimetresToPixels(connector.position.x)}
              cy={millimetresToPixels(connector.position.y)}
              r="4"
            />
          ))}
        {trackPreview && (
          <TrackGeometry
            className={`track-object is-preview ${
              trackPreview.snapped ? 'is-snapped' : ''
            } ${trackPreview.withinOrigin ? '' : 'is-invalid'}`.trim()}
            object={trackPreview.object}
          />
        )}
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
          {areaSelectionDraft && (
            <rect
              className="area-selection-marquee"
              x={millimetresToPixels(
                Math.min(
                  areaSelectionDraft.start.x,
                  areaSelectionDraft.end.x,
                ),
              )}
              y={millimetresToPixels(
                Math.min(
                  areaSelectionDraft.start.y,
                  areaSelectionDraft.end.y,
                ),
              )}
              width={millimetresToPixels(
                Math.abs(
                  areaSelectionDraft.end.x -
                    areaSelectionDraft.start.x,
                ),
              )}
              height={millimetresToPixels(
                Math.abs(
                  areaSelectionDraft.end.y -
                    areaSelectionDraft.start.y,
                ),
              )}
            />
          )}
        </svg>
        <div
          className="canvas-origin"
          aria-hidden="true"
          style={{
            left: 14 - camera.x * zoom,
            top: 12 - camera.y * zoom,
          }}
        >
          0,0
        </div>
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
