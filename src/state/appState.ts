import { useReducer, useState } from 'react'
import { defaultLayers } from '../data/defaultLayers'
import type {
  CanvasObject,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
  Point,
  ProjectDocumentV5,
  ProjectMetadata,
  Theme,
  ToolId,
} from '../types'
import { createProjectMetadata } from '../utils/projectDocument'
import { detachMeasurementsForDeletedObjects } from '../utils/annotations'
import {
  isObjectLocked,
  isObjectVisible,
  LAYER_NAME_MAX_LENGTH,
  OBJECT_NAME_MAX_LENGTH,
  reorderLayers,
  reorderObjects,
  withLayerOutlinerDefaults,
  withObjectOutlinerDefaults,
} from '../utils/outliner'
import { canvasObjectsReducer } from './canvasObjects'

const initialLayers = () => defaultLayers.map(withLayerOutlinerDefaults)

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

export const getProjectHydration = (project: ProjectDocumentV5) => ({
  metadata: { ...project.metadata },
  measurementSystem: project.settings.measurementSystem,
  layoutScaleId: project.settings.layoutScaleId,
  layers: project.layers.map(withLayerOutlinerDefaults),
  objects: project.objects.map(cloneCanvasObject),
  activeLayerId: project.layers[0].id,
  activeToolId: 'select' as const,
  selectedObjectIds: [] as string[],
})

export function useAppState(
  initialProject: ProjectDocumentV5 | null = null,
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

  const setLayerExpanded = (layerId: string, expanded: boolean) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, expanded } : layer,
      ),
    )
  }

  const renameLayer = (layerId: string, name: string) => {
    const trimmedName = name.trim().slice(0, LAYER_NAME_MAX_LENGTH)
    if (!trimmedName) return
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, name: trimmedName } : layer,
      ),
    )
  }

  const addLayer = () => {
    const existingNames = new Set(layers.map((layer) => layer.name))
    let suffix = 1
    let name = 'New Folder'
    while (existingNames.has(name)) {
      suffix += 1
      name = `New Folder ${suffix}`
    }
    const layer: Layer = {
      id: crypto.randomUUID(),
      name,
      visible: true,
      locked: false,
      expanded: true,
    }
    setLayers((currentLayers) => [...currentLayers, layer])
    setActiveLayerId(layer.id)
    return layer
  }

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) return
    const layerIndex = layers.findIndex((layer) => layer.id === layerId)
    if (layerIndex < 0) return
    const deletedIds = new Set(
      objects
        .filter((object) => object.layerId === layerId)
        .map((object) => object.id),
    )
    dispatchObjects({
      type: 'replace',
      objects: detachMeasurementsForDeletedObjects(objects, deletedIds),
    })
    const remainingLayers = layers.filter((layer) => layer.id !== layerId)
    setLayers(remainingLayers)
    setSelectedObjectIds((currentIds) =>
      currentIds.filter((id) => !deletedIds.has(id)),
    )
    if (activeLayerId === layerId) {
      setActiveLayerId(
        remainingLayers[Math.min(layerIndex, remainingLayers.length - 1)].id,
      )
    }
  }

  const reorderLayer = (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => {
    setLayers((currentLayers) =>
      reorderLayers(currentLayers, sourceId, targetId, position),
    )
  }

  const toggleObjectVisibility = (objectId: string) => {
    const object = objects.find((candidate) => candidate.id === objectId)
    if (!object) return
    const nextVisible = object.visible === false
    dispatchObjects({
      type: 'update',
      object: { ...object, visible: nextVisible },
    })
    if (!nextVisible) {
      setSelectedObjectIds((currentIds) =>
        currentIds.filter((id) => id !== objectId),
      )
    }
  }

  const toggleObjectLock = (objectId: string) => {
    const object = objects.find((candidate) => candidate.id === objectId)
    if (!object) return
    dispatchObjects({
      type: 'update',
      object: { ...object, locked: !object.locked },
    })
  }

  const renameObject = (objectId: string, name: string) => {
    const object = objects.find((candidate) => candidate.id === objectId)
    const trimmedName = name.trim().slice(0, OBJECT_NAME_MAX_LENGTH)
    if (!object || !trimmedName || isObjectLocked(object, layers)) return
    dispatchObjects({
      type: 'update',
      object: { ...object, name: trimmedName },
    })
  }

  const reorderCanvasObjects = (
    objectIds: string[],
    targetLayerId: string,
    targetIndex: number,
  ) => {
    const targetLayer = layers.find((layer) => layer.id === targetLayerId)
    if (!targetLayer || targetLayer.locked) return
    const movableIds = objectIds.filter((id) => {
      const object = objects.find((candidate) => candidate.id === id)
      return Boolean(object && !isObjectLocked(object, layers))
    })
    if (movableIds.length === 0) return
    dispatchObjects({
      type: 'replace',
      objects: reorderObjects(
        layers,
        objects,
        movableIds,
        targetLayerId,
        targetIndex,
      ),
    })
  }

  const addCanvasObject = (object: CanvasObject, selectObject = false) => {
    const preparedObject = withObjectOutlinerDefaults(object, objects)
    dispatchObjects({ type: 'add', object: preparedObject })
    if (selectObject) {
      setSelectedObjectIds([preparedObject.id])
    }
  }

  const updateCanvasObject = (object: CanvasObject) => {
    const layer = layers.find((candidate) => candidate.id === object.layerId)
    if (
      !layer ||
      !isObjectVisible(object, layers) ||
      isObjectLocked(object, layers)
    ) {
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
          return Boolean(
            layer &&
              isObjectVisible(object, layers) &&
              !isObjectLocked(object, layers),
          )
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
    if (
      !object ||
      !layer ||
      !isObjectVisible(object, layers) ||
      isObjectLocked(object, layers)
    ) {
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
          return Boolean(
            layer &&
              isObjectVisible(object, layers) &&
              !isObjectLocked(object, layers),
          )
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

  const hydrateProject = (project: ProjectDocumentV5) => {
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
  ): ProjectDocumentV5 => ({
    schemaVersion: 5,
    metadata: {
      ...metadata,
      updatedAt,
    },
    settings: {
      measurementSystem,
      layoutScaleId,
    },
    layers: layers.map(withLayerOutlinerDefaults),
    objects: objects.map((object, index) =>
      withObjectOutlinerDefaults(cloneCanvasObject(object), objects.slice(0, index)),
    ),
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
    setLayerExpanded,
    renameLayer,
    addLayer,
    deleteLayer,
    reorderLayer,
    toggleObjectVisibility,
    toggleObjectLock,
    renameObject,
    reorderCanvasObjects,
  }
}

export type AppState = ReturnType<typeof useAppState>
