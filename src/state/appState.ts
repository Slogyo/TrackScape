import { useReducer, useState } from 'react'
import { defaultLayers } from '../data/defaultLayers'
import type {
  CanvasObject,
  Layer,
  MeasurementSystem,
  Point,
  ProjectDocumentV1,
  ProjectMetadata,
  Theme,
  ToolId,
} from '../types'
import { createProjectMetadata } from '../utils/projectDocument'
import { canvasObjectsReducer } from './canvasObjects'

const initialLayers = () => defaultLayers.map((layer) => ({ ...layer }))

const cloneCanvasObject = (object: CanvasObject): CanvasObject =>
  object.type === 'line'
    ? {
        ...object,
        start: { ...object.start },
        end: { ...object.end },
      }
    : { ...object }

export const getProjectHydration = (project: ProjectDocumentV1) => ({
  metadata: { ...project.metadata },
  measurementSystem: project.settings.measurementSystem,
  layers: project.layers.map((layer) => ({ ...layer })),
  objects: project.objects.map(cloneCanvasObject),
  activeLayerId: project.layers[0].id,
  activeToolId: 'select' as const,
  selectedObjectId: null,
})

export function useAppState(initialProject: ProjectDocumentV1 | null = null) {
  const initialHydration = initialProject
    ? getProjectHydration(initialProject)
    : null
  const [objects, dispatchObjects] = useReducer(
    canvasObjectsReducer,
    initialHydration?.objects ?? [],
  )
  const [metadata, setMetadata] = useState<ProjectMetadata>(() =>
    initialHydration
      ? initialHydration.metadata
      : createProjectMetadata(
          crypto.randomUUID(),
          new Date().toISOString(),
        ),
  )
  const [theme, setTheme] = useState<Theme>('light')
  const [measurementSystem, setMeasurementSystem] =
    useState<MeasurementSystem>(
      initialHydration?.measurementSystem ?? 'metric',
    )
  const [activeToolId, setActiveToolId] = useState<ToolId>('select')
  const [layers, setLayers] = useState<Layer[]>(
    initialHydration?.layers ?? initialLayers,
  )
  const [activeLayerId, setActiveLayerId] = useState(
    initialHydration?.activeLayerId ?? defaultLayers[0].id,
  )
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [cursorPositionMm, setCursorPositionMm] = useState<Point>({
    x: 0,
    y: 0,
  })

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === 'light' ? 'dark' : 'light',
    )
  }

  const toggleMeasurementSystem = () => {
    setMeasurementSystem((currentSystem) =>
      currentSystem === 'metric' ? 'imperial' : 'metric',
    )
  }

  const toggleLayerVisibility = (layerId: string) => {
    const layer = layers.find((candidate) => candidate.id === layerId)
    const selectedObject = objects.find(
      (object) => object.id === selectedObjectId,
    )

    if (
      layer?.visible &&
      selectedObject?.layerId === layerId
    ) {
      setSelectedObjectId(null)
    }

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    )
  }

  const toggleLayerLock = (layerId: string) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
      ),
    )
  }

  const addCanvasObject = (object: CanvasObject, selectObject = false) => {
    dispatchObjects({ type: 'add', object })
    if (selectObject) {
      setSelectedObjectId(object.id)
    }
  }

  const updateCanvasObject = (object: CanvasObject) => {
    const layer = layers.find((candidate) => candidate.id === object.layerId)
    if (!layer?.visible || layer.locked) {
      return
    }

    dispatchObjects({ type: 'update', object })
  }

  const removeCanvasObject = (objectId: string) => {
    const object = objects.find((candidate) => candidate.id === objectId)
    const layer = layers.find((candidate) => candidate.id === object?.layerId)
    if (!object || !layer?.visible || layer.locked) {
      return
    }

    dispatchObjects({ type: 'remove', id: objectId })
    setSelectedObjectId((currentId) =>
      currentId === objectId ? null : currentId,
    )
  }

  const updateProjectName = (name: string) => {
    setMetadata((currentMetadata) => ({
      ...currentMetadata,
      name,
    }))
  }

  const markProjectSaved = (updatedAt: string) => {
    setMetadata((currentMetadata) => ({
      ...currentMetadata,
      updatedAt,
    }))
  }

  const hydrateProject = (project: ProjectDocumentV1) => {
    const hydration = getProjectHydration(project)

    setMetadata(hydration.metadata)
    setMeasurementSystem(hydration.measurementSystem)
    setLayers(hydration.layers)
    dispatchObjects({ type: 'replace', objects: hydration.objects })
    setActiveLayerId(hydration.activeLayerId)
    setActiveToolId(hydration.activeToolId)
    setSelectedObjectId(hydration.selectedObjectId)
    setCursorPositionMm({ x: 0, y: 0 })
  }

  const getProjectDocument = (
    updatedAt = metadata.updatedAt,
  ): ProjectDocumentV1 => ({
    schemaVersion: 1,
    metadata: {
      ...metadata,
      updatedAt,
    },
    settings: {
      measurementSystem,
    },
    layers: layers.map((layer) => ({ ...layer })),
    objects: objects.map(cloneCanvasObject),
  })

  return {
    objects,
    metadata,
    theme,
    measurementSystem,
    activeToolId,
    layers,
    activeLayerId,
    selectedObjectId,
    cursorPositionMm,
    setActiveToolId,
    setActiveLayerId,
    setSelectedObjectId,
    setCursorPositionMm,
    addCanvasObject,
    updateCanvasObject,
    removeCanvasObject,
    updateProjectName,
    markProjectSaved,
    hydrateProject,
    getProjectDocument,
    toggleTheme,
    toggleMeasurementSystem,
    toggleLayerVisibility,
    toggleLayerLock,
  }
}

export type AppState = ReturnType<typeof useAppState>
