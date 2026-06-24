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
  MeasurementAnchor,
  MeasurementObject,
  MeasurementSystem,
  MovementDelta,
  Point,
  TrackPieceObject,
  TrackPlacementSettings,
  TrackPreviewStatus,
  TextObject,
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
  resolveDeltaSnapping,
  resolvePointSnapping,
  shouldBypassSnapping,
  translateObject,
} from '../utils/canvas'
import {
  type CameraPosition,
  DEFAULT_WORKSPACE_ZOOM,
  getCanvasRelativeWheelCameraOffset,
  getCenteredCamera,
  getCursorAnchoredCamera,
  isHorizontalWheelGesture,
  stepZoom,
} from '../utils/viewport'
import { createShapeObject } from '../utils/shapeMode'
import {
  findNearestTrackConnector,
  getAvailableTrackConnectors,
  getTrackBounds,
  getTrackConnectors,
  getTrackLocalGeometry,
  normalizeRotation,
  screenPixelsToMillimetres,
  snapTrackObjectToConnector,
  TRACK_CONNECTOR_REVEAL_RADIUS_PX,
  TRACK_ROTATION_STEP,
  TRACK_SNAP_RADIUS_PX,
} from '../utils/trackGeometry'
import { getTrackDefinition } from '../data/trackCatalog'
import TrackGeometry from './TrackGeometry'
import { MeasurementGeometry, TextGeometry } from './AnnotationGeometry'
import {
  createFixedAnchor,
  createObjectAnchor,
  DEFAULT_MEASUREMENT_OFFSET_MM,
  DEFAULT_TEXT_SIZE_MM,
  findNearestObjectAnchor,
  getMeasurementLayout,
  getTextCaretIndexAtPoint,
  resolveMeasurementAnchor,
} from '../utils/annotations'
import {
  getObjectsInRenderOrder,
  isObjectLocked,
  isObjectVisible,
} from '../utils/outliner'

interface CanvasWorkspaceProps {
  activeLayer: Layer
  activeToolId: ToolId
  layers: Layer[]
  objects: CanvasObject[]
  projectId: string
  resetViewToken: number
  selectedObjectIds: string[]
  isSnappingEnabled: boolean
  measurementSystem: MeasurementSystem
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

interface MeasurementDraft {
  start: MeasurementAnchor
  end: MeasurementAnchor
  pointerId: number
}

interface MeasurementEditDraft {
  handle: 'start' | 'end' | 'offset'
  object: MeasurementObject
  preview: MeasurementObject
  pointerId: number
}

interface TextEditorState {
  sessionId: string
  objectId: string | null
  layerId: string
  position: Point
  value: string
  fontSizeMm: number
  rotation: number
  selectionStart: number
  selectionEnd: number
}

interface TextEditorDrag {
  pointerId: number
  startClient: Point
  startPosition: Point
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
  isSnappingEnabled,
  measurementSystem,
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
  const [measurementDraft, setMeasurementDraft] =
    useState<MeasurementDraft | null>(null)
  const [measurementEditDraft, setMeasurementEditDraft] =
    useState<MeasurementEditDraft | null>(null)
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)
  const textEditorRef = useRef<HTMLTextAreaElement>(null)
  const textEditorDragRef = useRef<TextEditorDrag | null>(null)
  const committedTextSessionRef = useRef<string | null>(null)
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(null)
  const [areaSelectionDraft, setAreaSelectionDraft] =
    useState<AreaSelectionDraft | null>(null)
  const [panDraft, setPanDraft] = useState<PanDraft | null>(null)
  const [trackPointer, setTrackPointer] = useState<Point | null>(null)
  const [trackAttachmentIndex, setTrackAttachmentIndex] = useState<
    number | null
  >(null)
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(
    null,
  )
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const setCamera = useCallback((nextCamera: CameraPosition) => {
    cameraRef.current = nextCamera
    setCameraState(nextCamera)
  }, [])
  const visibleObjects = useMemo(
    () => objects.filter((object) => isObjectVisible(object, layers)),
    [layers, objects],
  )
  const renderObjects = useMemo(
    () => getObjectsInRenderOrder(layers, visibleObjects),
    [layers, visibleObjects],
  )
  const resolveMeasurementInputAnchor = useCallback(
    (point: Point, bypassSnapping: boolean): MeasurementAnchor => {
      if (bypassSnapping) return createFixedAnchor(point)
      const nearby = findNearestObjectAnchor(point, visibleObjects, zoom)
      return nearby
        ? createObjectAnchor(nearby)
        : createFixedAnchor(resolvePointSnapping(point, false))
    },
    [visibleObjects, zoom],
  )
  const selectedObjects = objects.filter((object) =>
    selectedObjectIds.includes(object.id),
  )
  const trackLayer = activeLayer
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

    const bypassSnapping = shouldBypassSnapping(
      isSnappingEnabled,
      isShiftPressed,
    )
    const connector = bypassSnapping
      ? null
      : findNearestTrackConnector(
          trackPointer,
          visibleTrackObjects,
          screenPixelsToMillimetres(TRACK_SNAP_RADIUS_PX, zoom),
        )
    const basePreview: TrackPieceObject = {
      id: 'track-preview',
      type: 'track-piece',
      layerId: trackLayer.id,
      definitionId: trackSettings.definitionId,
      position: resolvePointSnapping(trackPointer, bypassSnapping),
      rotation: trackSettings.rotation,
      direction: trackSettings.direction,
    }
    const snappedPlacement = connector
      ? snapTrackObjectToConnector(
          basePreview,
          connector,
          trackAttachmentIndex ?? undefined,
        )
      : null
    const preview = snappedPlacement?.object ?? basePreview

    return {
      object: preview,
      snapped: connector !== null,
      sourceConnectorId:
        snappedPlacement?.sourceConnector.id ?? null,
      targetConnector: connector,
      withinOrigin: (() => {
        const bounds = getTrackBounds(preview)
        return bounds.minX >= -0.001 && bounds.minY >= -0.001
      })(),
    }
  }, [
    activeToolId,
    isSnappingEnabled,
    isShiftPressed,
    trackLayer,
    trackAttachmentIndex,
    trackPointer,
    trackSettings,
    visibleTrackObjects,
    zoom,
  ])
  const previewConnectors = useMemo(
    () => (trackPreview ? getTrackConnectors(trackPreview.object) : []),
    [trackPreview],
  )
  const nearbyTrackConnectors = useMemo(() => {
    if (!trackPointer) {
      return []
    }
    const revealDistance = screenPixelsToMillimetres(
      TRACK_CONNECTOR_REVEAL_RADIUS_PX,
      zoom,
    )
    return availableTrackConnectors.filter(
      (connector) =>
        Math.hypot(
          connector.position.x - trackPointer.x,
          connector.position.y - trackPointer.y,
        ) <= revealDistance,
    )
  }, [availableTrackConnectors, trackPointer, zoom])

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
    setMeasurementDraft(null)
    setMeasurementEditDraft(null)
  }, [cancelDrawing, cancelMovement])

  useEffect(() => {
    const editor = textEditorRef.current
    editor?.focus()
    if (editor) {
      const caretIndex = editor.value.length
      editor.setSelectionRange(caretIndex, caretIndex)
    }
  }, [textEditor?.sessionId])

  const commitTextEditor = useCallback(
    (editor = textEditor) => {
      if (
        !editor ||
        committedTextSessionRef.current === editor.sessionId
      ) {
        return
      }
      committedTextSessionRef.current = editor.sessionId
      const value = editor.value
      if (value.trim()) {
        const existing = editor.objectId
          ? objects.find(
              (object): object is TextObject =>
                object.id === editor.objectId && object.type === 'text',
            )
          : null
        const nextObject: TextObject = existing
          ? { ...existing, text: value }
          : {
              id: crypto.randomUUID(),
              type: 'text',
              layerId: editor.layerId,
              position: editor.position,
              text: value,
              fontSizeMm: editor.fontSizeMm,
              rotation: editor.rotation,
            }
        if (existing) {
          onUpdateObjects([nextObject])
        } else {
          onAddObject(nextObject, true)
        }
      }
      setTextEditor((current) =>
        current?.sessionId === editor.sessionId ? null : current,
      )
    },
    [objects, onAddObject, onUpdateObjects, textEditor],
  )

  useEffect(() => {
    if (!textEditor) return

    const handleClickAway = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          '[data-text-editor-target], [data-text-editor-drag], .canvas-text-input',
        )
      ) {
        return
      }
      commitTextEditor(textEditor)
    }

    document.addEventListener('pointerdown', handleClickAway, true)
    return () =>
      document.removeEventListener('pointerdown', handleClickAway, true)
  }, [commitTextEditor, textEditor])

  useEffect(() => {
    cancelInteractions()
    setTrackPointer(null)
    setTrackAttachmentIndex(null)
    setHoveredObjectId(null)
    setTextEditor(null)
  }, [activeLayer.id, activeToolId, cancelInteractions])

  useEffect(() => {
    setTrackAttachmentIndex(null)
  }, [trackSettings.definitionId])

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
      if (event.key === 'Shift') {
        setIsShiftPressed(true)
      }

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
          setTrackAttachmentIndex(null)
          onTrackSettingsChange({
            ...trackSettings,
            rotation: normalizeRotation(
              trackSettings.rotation +
                (event.key === '['
                  ? -TRACK_ROTATION_STEP
                  : TRACK_ROTATION_STEP),
            ),
          })
          return
        }

        if (event.key.toLowerCase() === 'r') {
          event.preventDefault()
          if (trackPreview?.snapped) {
            const connectors = getTrackLocalGeometry(
              trackPreview.object,
            ).connectors
            if (connectors.length === 0) {
              return
            }
            const currentIndex = connectors.findIndex(
              (connector) =>
                connector.id === trackPreview.sourceConnectorId,
            )
            setTrackAttachmentIndex(
              (currentIndex + 1 + connectors.length) %
                connectors.length,
            )
          } else {
            setTrackAttachmentIndex(null)
            onTrackSettingsChange({
              ...trackSettings,
              rotation: normalizeRotation(
                trackSettings.rotation + TRACK_ROTATION_STEP,
              ),
            })
          }
          return
        }

        if (
          event.key.toLowerCase() === 'f' &&
          getTrackDefinition(trackSettings.definitionId).kind === 'curve' &&
          !getTrackDefinition(trackSettings.definitionId).handedness
        ) {
          event.preventDefault()
          setTrackAttachmentIndex(null)
          onTrackSettingsChange({
            ...trackSettings,
            direction:
              trackSettings.direction === 'left' ? 'right' : 'left',
          })
          return
        }
      }

      if (
        event.key.toLowerCase() === 'r' &&
        !isTextEntryTarget(event.target) &&
        activeToolId !== 'track'
      ) {
        const rotatedObjects = selectedObjects.flatMap((object) => {
          if (object.type !== 'track-piece') {
            return []
          }
          const layer = layers.find(
            (candidate) => candidate.id === object.layerId,
          )
          if (
            !layer ||
            !isObjectVisible(object, layers) ||
            isObjectLocked(object, layers)
          ) {
            return []
          }
          const rotated = {
            ...object,
            rotation: normalizeRotation(
              object.rotation + TRACK_ROTATION_STEP,
            ),
          }
          const bounds = getTrackBounds(rotated)
          return bounds.minX >= -0.001 && bounds.minY >= -0.001
            ? [rotated]
            : []
        })
        if (rotatedObjects.length > 0) {
          event.preventDefault()
          onUpdateObjects(rotatedObjects)
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
      if (event.key === 'Shift') {
        setIsShiftPressed(false)
      }

      if (event.code === 'Space') {
        spacePressedRef.current = false
      }
    }
    const handleBlur = () => {
      setIsShiftPressed(false)
      spacePressedRef.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [
    activeToolId,
    cancelInteractions,
    onRemoveObjects,
    onTrackSettingsChange,
    onUpdateObjects,
    layers,
    selectedObjects,
    selectedObjectIds,
    trackPreview,
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

    if (isHorizontalWheelGesture(event.deltaX, event.deltaY)) {
      setCamera({
        ...cameraRef.current,
        x: getCanvasRelativeWheelCameraOffset(
          cameraRef.current.x,
          event.deltaX,
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

  const getTargetObject = (event: { target: EventTarget | null }) => {
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
    bypassSnapping: boolean,
  ): MovementDraft => {
    const snappedDelta = resolveDeltaSnapping(
      {
        x: pointerPosition.x - draft.startPointer.x,
        y: pointerPosition.y - draft.startPointer.y,
      },
      bypassSnapping,
    )
    const delta = clampGroupTranslationToOrigin(
      draft.originals,
      snappedDelta,
    )

    return {
      ...draft,
      delta,
      previews: draft.originals.map((object) =>
        translateObject(object, delta, objects),
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
    if (isTextEntryTarget(event.target)) {
      return
    }

    if (textEditor && event.target instanceof Element) {
      const dragTarget = event.target.closest('[data-text-editor-drag]')
      if (dragTarget) {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        textEditorDragRef.current = {
          pointerId: event.pointerId,
          startClient: { x: event.clientX, y: event.clientY },
          startPosition: textEditor.position,
        }
        return
      }
      const editorTarget = event.target.closest('[data-text-editor-target]')
      if (editorTarget) {
        event.preventDefault()
        event.stopPropagation()
        const editorObject: TextObject = {
          id: textEditor.objectId ?? 'text-editor-draft',
          type: 'text',
          layerId: activeLayer.id,
          position: textEditor.position,
          text: textEditor.value,
          fontSizeMm: textEditor.fontSizeMm,
          rotation: textEditor.rotation,
        }
        const caretIndex = getTextCaretIndexAtPoint(
          editorObject,
          getPointerPosition(event),
        )
        setTextEditor({
          ...textEditor,
          selectionStart: caretIndex,
          selectionEnd: caretIndex,
        })
        requestAnimationFrame(() => {
          textEditorRef.current?.focus()
          textEditorRef.current?.setSelectionRange(caretIndex, caretIndex)
        })
        return
      }
    }

    if (textEditor) {
      commitTextEditor(textEditor)
    }

    const targetObject = getTargetObject(event)
    const targetLayer = layers.find(
      (layer) => layer.id === targetObject?.layerId,
    )

    if (
      targetObject?.type === 'measurement' &&
      targetLayer &&
      !isObjectLocked(targetObject, layers) &&
      event.target instanceof Element
    ) {
      const handle = event.target.getAttribute('data-measurement-handle')
      if (handle === 'start' || handle === 'end' || handle === 'offset') {
        event.currentTarget.setPointerCapture(event.pointerId)
        setMeasurementEditDraft({
          handle,
          object: targetObject,
          preview: targetObject,
          pointerId: event.pointerId,
        })
        return
      }
    }

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
        return Boolean(
          object.type !== 'measurement' &&
            isObjectVisible(object, layers) &&
            !isObjectLocked(object, layers),
        )
      })
      if (movableObjects.length === 0 || isObjectLocked(targetObject, layers)) {
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
      if (!isObjectLocked(targetObject, layers)) {
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

    if (activeToolId === 'text') {
      if (!canDrawOnLayer(activeLayer)) return
      event.preventDefault()
      if (targetObject?.type === 'text' && !targetLayer?.locked) {
        setTextEditor({
          sessionId: crypto.randomUUID(),
          objectId: targetObject.id,
          layerId: targetObject.layerId,
          position: targetObject.position,
          value: targetObject.text,
          fontSizeMm: targetObject.fontSizeMm,
          rotation: targetObject.rotation,
          selectionStart: targetObject.text.length,
          selectionEnd: targetObject.text.length,
        })
        return
      }
      const position = resolvePointSnapping(
        getPointerPosition(event),
        shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
      )
      setTextEditor({
        sessionId: crypto.randomUUID(),
        objectId: null,
        layerId: activeLayer.id,
        position,
        value: '',
        fontSizeMm: DEFAULT_TEXT_SIZE_MM,
        rotation: 0,
        selectionStart: 0,
        selectionEnd: 0,
      })
      return
    }

    if (activeToolId === 'measurement') {
      if (!canDrawOnLayer(activeLayer)) return
      const point = getPointerPosition(event)
      const anchor = resolveMeasurementInputAnchor(
        point,
        shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
      )
      event.currentTarget.setPointerCapture(event.pointerId)
      setMeasurementDraft({
        start: anchor,
        end: anchor,
        pointerId: event.pointerId,
      })
      return
    }

    if (!isDrawingTool(activeToolId) || !canDrawOnLayer(activeLayer)) {
      return
    }

    const start = resolvePointSnapping(
      getPointerPosition(event),
      shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
    )
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
    const textDrag = textEditorDragRef.current
    if (textDrag?.pointerId === event.pointerId) {
      setTextEditor((current) =>
        current
          ? {
              ...current,
              position: {
                x: Math.max(
                  0,
                  textDrag.startPosition.x +
                    screenPixelsToMillimetres(
                      event.clientX - textDrag.startClient.x,
                      zoom,
                    ),
                ),
                y: Math.max(
                  0,
                  textDrag.startPosition.y +
                    screenPixelsToMillimetres(
                      event.clientY - textDrag.startClient.y,
                      zoom,
                    ),
                ),
              },
            }
          : current,
      )
      return
    }

    if (panDraft?.pointerId === event.pointerId) {
      setHoveredObjectId(null)
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
    const pointerObject = getTargetObject(event)
    setHoveredObjectId(
      pointerObject?.type === 'track-piece' ? pointerObject.id : null,
    )

    if (activeToolId === 'track') {
      setTrackPointer(pointerPosition)
    }

    if (
      measurementEditDraft &&
      measurementEditDraft.pointerId === event.pointerId
    ) {
      let preview = measurementEditDraft.preview
      if (
        measurementEditDraft.handle === 'start' ||
        measurementEditDraft.handle === 'end'
      ) {
        preview = {
          ...measurementEditDraft.object,
          [measurementEditDraft.handle]: resolveMeasurementInputAnchor(
            pointerPosition,
            shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
          ),
        }
      } else {
        const layout = getMeasurementLayout(
          measurementEditDraft.object,
          objects,
        )
        preview = {
          ...measurementEditDraft.object,
          offset:
            (pointerPosition.x - layout.start.x) * layout.normal.x +
            (pointerPosition.y - layout.start.y) * layout.normal.y,
        }
      }
      setMeasurementEditDraft({ ...measurementEditDraft, preview })
      return
    }

    if (measurementDraft?.pointerId === event.pointerId) {
      const nextDraft = {
        ...measurementDraft,
        end: resolveMeasurementInputAnchor(
          pointerPosition,
          shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
        ),
      }
      setMeasurementDraft(nextDraft)
      const start = resolveMeasurementAnchor(nextDraft.start, objects)
      const end = resolveMeasurementAnchor(nextDraft.end, objects)
      onDraftMeasurementChange({
        type: 'measurement',
        lengthMm: lineLength(start, end),
        startAttached: nextDraft.start.kind === 'object',
        endAttached: nextDraft.end.kind === 'object',
        offsetMm: DEFAULT_MEASUREMENT_OFFSET_MM,
      })
      return
    }

    if (
      movementDraft &&
      movementDraft.pointerId === event.pointerId
    ) {
      const nextDraft = getMovementPreview(
        movementDraft,
        pointerPosition,
        shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
      )
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
        end: resolvePointSnapping(
          pointerPosition,
          shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
        ),
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
    if (textEditorDragRef.current?.pointerId === event.pointerId) {
      releasePointer(event)
      textEditorDragRef.current = null
      textEditorRef.current?.focus()
      return
    }

    if (
      measurementEditDraft &&
      measurementEditDraft.pointerId === event.pointerId
    ) {
      releasePointer(event)
      if (
        getMeasurementLayout(measurementEditDraft.preview, objects).length > 0
      ) {
        onUpdateObjects([measurementEditDraft.preview])
      }
      setMeasurementEditDraft(null)
      return
    }

    if (measurementDraft?.pointerId === event.pointerId) {
      releasePointer(event)
      const start = resolveMeasurementAnchor(measurementDraft.start, objects)
      const end = resolveMeasurementAnchor(measurementDraft.end, objects)
      if (isNonZeroLine(start, end)) {
        onAddObject(
          {
            id: crypto.randomUUID(),
            type: 'measurement',
            layerId: activeLayer.id,
            start: measurementDraft.start,
            end: measurementDraft.end,
            offset: DEFAULT_MEASUREMENT_OFFSET_MM,
          },
          true,
        )
      }
      setMeasurementDraft(null)
      onDraftMeasurementChange(null)
      return
    }

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
        shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
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
            boundsIntersect(getObjectBounds(object, objects), marqueeBounds),
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
      end: resolvePointSnapping(
        getPointerPosition(event),
        shouldBypassSnapping(isSnappingEnabled, event.shiftKey),
      ),
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
    if (textEditorDragRef.current?.pointerId === event.pointerId) {
      textEditorDragRef.current = null
      return
    }

    if (panDraft?.pointerId === event.pointerId) {
      setPanDraft(null)
      return
    }
    if (
      drawingDraft?.pointerId === event.pointerId ||
      measurementDraft?.pointerId === event.pointerId ||
      measurementEditDraft?.pointerId === event.pointerId ||
      movementDraft?.pointerId === event.pointerId ||
      areaSelectionDraft?.pointerId === event.pointerId
    ) {
      cancelInteractions()
    }
  }

  const handlePointerLeave = () => {
    setHoveredObjectId(null)
    if (
      !drawingDraft &&
      !measurementDraft &&
      !measurementEditDraft &&
      !movementDraft &&
      !areaSelectionDraft &&
      !panDraft
    ) {
      setTrackPointer(null)
    }
  }

  const renderGeometry = (
    object: CanvasObject,
    className: string,
    dataObjectId?: string,
  ) => {
    if (
      object.type === 'track-piece' ||
      object.type === 'measurement' ||
      object.type === 'text'
    ) {
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
    if (object.type === 'text' && textEditor?.objectId === object.id) {
      return null
    }
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
          } ${
            hoveredObjectId === object.id ? 'is-hovered' : ''
          } ${isMoving ? 'is-moving' : ''}`.trim()}
          dataObjectId={object.id}
          object={renderedObject}
          showRadiusLabel={isSelected && activeToolId !== 'track'}
        />
      )
    }
    if (renderedObject.type === 'measurement') {
      const measurement =
        measurementEditDraft?.object.id === object.id
          ? measurementEditDraft.preview
          : renderedObject
      return (
        <MeasurementGeometry
          key={object.id}
          measurementSystem={measurementSystem}
          object={measurement}
          objects={objects}
          selected={isSelected}
          zoom={zoom}
        />
      )
    }
    if (renderedObject.type === 'text') {
      return (
        <TextGeometry
          key={object.id}
          object={renderedObject}
          selected={isSelected}
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
    isDrawingTool(activeToolId) ||
    activeToolId === 'track' ||
    activeToolId === 'measurement' ||
    activeToolId === 'text'
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
  const textEditorObject: TextObject | null = textEditor
    ? {
        id: textEditor.objectId ?? 'text-editor-draft',
        type: 'text',
        layerId: textEditor.layerId,
        position: textEditor.position,
        text: textEditor.value,
        fontSizeMm: textEditor.fontSizeMm,
        rotation: textEditor.rotation,
      }
    : null
  return (
    <section
      ref={viewportRef}
      className={workspaceClassName}
      aria-label="Layout workspace"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      onDoubleClick={(event) => {
        const object = getTargetObject(event)
        if (object?.type !== 'text') return
        const layer = layers.find((candidate) => candidate.id === object.layerId)
        if (!layer || isObjectLocked(object, layers)) return
        setTextEditor({
          sessionId: crypto.randomUUID(),
          objectId: object.id,
          layerId: object.layerId,
          position: object.position,
          value: object.text,
          fontSizeMm: object.fontSizeMm,
          rotation: object.rotation,
          selectionStart: object.text.length,
          selectionEnd: object.text.length,
        })
      }}
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
          {renderObjects.map(renderObject)}
          {textEditorObject && (
            <TextGeometry
              object={textEditorObject}
              selected
              zoom={zoom}
              editing={{
                caretIndex: textEditor?.selectionStart ?? 0,
                selectionEnd: textEditor?.selectionEnd ?? 0,
              }}
            />
          )}
          {measurementDraft && (() => {
            const preview: MeasurementObject = {
              id: 'measurement-preview',
              type: 'measurement',
              layerId: activeLayer.id,
              start: measurementDraft.start,
              end: measurementDraft.end,
              offset: DEFAULT_MEASUREMENT_OFFSET_MM,
            }
            return (
              <g className="is-draft">
                <MeasurementGeometry
                  measurementSystem={measurementSystem}
                  object={preview}
                  objects={objects}
                  selected={false}
                  zoom={zoom}
                />
              </g>
            )
          })()}
        {activeToolId === 'track' &&
          nearbyTrackConnectors.map((connector) => (
            <circle
              className={`track-connector is-existing ${
                trackPreview?.targetConnector?.objectId ===
                  connector.objectId &&
                trackPreview.targetConnector.connectorId ===
                  connector.connectorId
                  ? 'is-snap-target'
                  : ''
              }`.trim()}
              key={`${connector.objectId}-${connector.connectorId}`}
              cx={millimetresToPixels(connector.position.x)}
              cy={millimetresToPixels(connector.position.y)}
              r={4 / zoom}
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
        {trackPreview &&
          previewConnectors.map((connector) => (
            <circle
              className={`track-connector is-preview-connector ${
                connector.connectorId === trackPreview.sourceConnectorId
                  ? 'is-snap-source'
                  : ''
              }`.trim()}
              key={`${connector.objectId}-${connector.connectorId}`}
              cx={millimetresToPixels(connector.position.x)}
              cy={millimetresToPixels(connector.position.y)}
              r={4 / zoom}
            />
          ))}
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
        {textEditor && (
          <textarea
            ref={textEditorRef}
            className="canvas-text-input"
            aria-label="Label text"
            value={textEditor.value}
            onChange={(event) => {
              const { value, selectionStart, selectionEnd } =
                event.currentTarget
              setTextEditor((current) =>
                current
                  ? {
                      ...current,
                      value,
                      selectionStart,
                      selectionEnd,
                    }
                  : current,
              )
            }}
            onSelect={(event) => {
              const { selectionStart, selectionEnd } = event.currentTarget
              setTextEditor((current) => {
                if (
                  !current ||
                  (current.selectionStart === selectionStart &&
                    current.selectionEnd === selectionEnd)
                ) {
                  return current
                }

                return {
                  ...current,
                  selectionStart,
                  selectionEnd,
                }
              })
            }}
            onBlur={() => commitTextEditor()}
            onScroll={(event) => {
              event.currentTarget.scrollLeft = 0
              event.currentTarget.scrollTop = 0
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setTextEditor(null)
              } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                commitTextEditor()
              }
            }}
          />
        )}
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
