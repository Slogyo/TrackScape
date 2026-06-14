import { useReducer, useState } from 'react'
import { defaultLayers } from '../data/defaultLayers'
import type {
  CanvasObject,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
  Point,
  ProjectDocumentV4,
  ProjectMetadata,
  Theme,
  ToolId,
} from '../types'
import { createProjectMetadata } from '../utils/projectDocument'
import { detachMeasurementsForDeletedObjects } from '../utils/annotations'
import { canvasObjectsReducer } from './canvasObjects'

const initialLayers = () => defaultLayers.map((layer) => ({ ...layer }))

const cloneCanvasObject = (object: CanvasObject): CanvasObject =>
  object.type === 'track-piece'
    ? {
        ...object,
        position: { ...object.position },
      }
    : object.type === 'text'
    ? { ...object, position: { ...object.position } }
    : object.type === 'measurement'
    ? {
        ...object,
        start: { ...object.start, point: { ...object.start.point } },
        end: { ...object.end, point: { ...object.end.point } },
      }
    : object.type === 'line'
    ? {
        ...object,
        start: { ...object.start },
        end: { ...object.end },
      }
    : { ...object }

export const getProjectHydration = (project: ProjectDocumentV4) => ({
  metadata: { ...project.metadata },
  measurementSystem: project.settings.measurementSystem,
  layoutScaleId: project.settings.layoutScaleId,
  layers: project.layers.map((layer) => ({ ...layer })),
  objects: project.objects.map(cloneCanvasObject),
  activeLayerId: project.layers[0].id,
  activeToolId: 'select' as const,
  selectedObjectIds: [] as string[],
})

export function useAppState(
  initialProject: ProjectDocumentV4 | null = null,
  initialTheme: Theme = 'light',
) {
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
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [measurementSystem, setMeasurementSystem] =
    useState<MeasurementSystem>(
      initialHydration?.measurementSystem ?? 'metric',
    )
  const [layoutScaleId, setLayoutScaleId] = useState<LayoutScaleId>(
    initialHydration?.layoutScaleId ?? 'ho',
  )
  const [activeToolId, setActiveToolId] = useState<ToolId>('select')
  const [layers, setLayers] = useState<Layer[]>(
    initialHydration?.layers ?? initialLayers,
  )
  const [activeLayerId, setActiveLayerId] = useState(
    initialHydration?.activeLayerId ?? defaultLayers[0].id,
  )
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([])
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
    if (layer?.visible) {
      const objectIdsOnLayer = new Set(
        objects
          .filter((object) => object.layerId === layerId)
          .map((object) => object.id),
      )
      setSelectedObjectIds((currentIds) =>
        currentIds.filter((id) => !objectIdsOnLayer.has(id)),
      )
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
      setSelectedObjectIds([object.id])
    }
  }

  const updateCanvasObject = (object: CanvasObject) => {
    const layer = layers.find((candidate) => candidate.id === object.layerId)
    if (!layer?.visible || layer.locked) {
      return
    }

    dispatchObjects({ type: 'update', object })
  }

  const updateCanvasObjects = (updatedObjects: CanvasObject[]) => {
    const updatesById = new Map(
      updatedObjects
        .filter((object) => {
          const layer = layers.find(
            (candidate) => candidate.id === object.layerId,
          )
          return Boolean(layer?.visible && !layer.locked)
        })
        .map((object) => [object.id, object]),
    )

    if (updatesById.size === 0) {
      return
    }

    dispatchObjects({
      type: 'replace',
      objects: objects.map(
        (object) => updatesById.get(object.id) ?? object,
      ),
    })
  }

  const removeCanvasObject = (objectId: string) => {
    const object = objects.find((candidate) => candidate.id === objectId)
    const layer = layers.find((candidate) => candidate.id === object?.layerId)
    if (!object || !layer?.visible || layer.locked) {
      return
    }

    dispatchObjects({
      type: 'replace',
      objects: detachMeasurementsForDeletedObjects(objects, new Set([objectId])),
    })
    setSelectedObjectIds((currentIds) =>
      currentIds.filter((id) => id !== objectId),
    )
  }

  const removeCanvasObjects = (objectIds: string[]) => {
    const requestedIds = new Set(objectIds)
    const removableIds = new Set(
      objects
        .filter((object) => {
          if (!requestedIds.has(object.id)) {
            return false
          }
          const layer = layers.find(
            (candidate) => candidate.id === object.layerId,
          )
          return Boolean(layer?.visible && !layer.locked)
        })
        .map((object) => object.id),
    )

    if (removableIds.size === 0) {
      return
    }

    dispatchObjects({
      type: 'replace',
      objects: detachMeasurementsForDeletedObjects(objects, removableIds),
    })
    setSelectedObjectIds((currentIds) =>
      currentIds.filter((id) => !removableIds.has(id)),
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

  const hydrateProject = (project: ProjectDocumentV4) => {
    const hydration = getProjectHydration(project)

    setMetadata(hydration.metadata)
    setMeasurementSystem(hydration.measurementSystem)
    setLayoutScaleId(hydration.layoutScaleId)
    setLayers(hydration.layers)
    dispatchObjects({ type: 'replace', objects: hydration.objects })
    setActiveLayerId(hydration.activeLayerId)
    setActiveToolId(hydration.activeToolId)
    setSelectedObjectIds(hydration.selectedObjectIds)
    setCursorPositionMm({ x: 0, y: 0 })
  }

  const getProjectDocument = (
    updatedAt = metadata.updatedAt,
  ): ProjectDocumentV4 => ({
    schemaVersion: 4,
    metadata: {
      ...metadata,
      updatedAt,
    },
    settings: {
      measurementSystem,
      layoutScaleId,
    },
    layers: layers.map((layer) => ({ ...layer })),
    objects: objects.map(cloneCanvasObject),
  })

  return {
    objects,
    metadata,
    theme,
    measurementSystem,
    layoutScaleId,
    activeToolId,
    layers,
    activeLayerId,
    selectedObjectIds,
    cursorPositionMm,
    setActiveToolId,
    setActiveLayerId,
    setSelectedObjectIds,
    setCursorPositionMm,
    setLayoutScaleId,
    setTheme,
    addCanvasObject,
    updateCanvasObject,
    updateCanvasObjects,
    removeCanvasObject,
    removeCanvasObjects,
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
