import { getTrackDefinition } from '../data/trackCatalog'
import type { CanvasObject, Layer } from '../types'
import { getObjectTypeLabel } from './shapeMode'

export const OBJECT_NAME_MAX_LENGTH = 80
export const LAYER_NAME_MAX_LENGTH = 80

const truncateName = (value: string) =>
  value.trim().slice(0, OBJECT_NAME_MAX_LENGTH)

const appendNameSuffix = (baseName: string, suffix: number) => {
  const suffixText = ` ${suffix}`
  return `${baseName.slice(
    0,
    OBJECT_NAME_MAX_LENGTH - suffixText.length,
  )}${suffixText}`
}

export const getObjectName = (object: CanvasObject): string => {
  if (object.name?.trim()) return object.name.trim()
  if (object.type === 'text') {
    const text = object.text.split('\n')[0]?.trim()
    return text ? truncateName(`Text: ${text}`) : 'Text'
  }
  if (object.type === 'track-piece') {
    const definition = getTrackDefinition(object.definitionId)
    return truncateName(
      [definition.productCode, definition.name].filter(Boolean).join(' '),
    )
  }
  return getObjectTypeLabel(object.type)
}

export const getUniqueObjectName = (
  object: CanvasObject,
  objects: CanvasObject[],
): string => {
  const baseName = getObjectName(object)
  const existing = new Set(objects.map(getObjectName))
  if (!existing.has(baseName)) return baseName

  let suffix = 2
  while (existing.has(appendNameSuffix(baseName, suffix))) suffix += 1
  return appendNameSuffix(baseName, suffix)
}

export const withObjectOutlinerDefaults = (
  object: CanvasObject,
  objects: CanvasObject[] = [],
): CanvasObject => ({
  ...object,
  name: object.name?.trim()
    ? truncateName(object.name)
    : getUniqueObjectName(object, objects),
  visible: object.visible !== false,
  locked: object.locked === true,
})

export const withLayerOutlinerDefaults = (layer: Layer): Layer => ({
  ...layer,
  expanded: layer.expanded !== false,
})

export const isObjectVisible = (
  object: CanvasObject,
  layers: Layer[],
): boolean => {
  const layer = layers.find((candidate) => candidate.id === object.layerId)
  return Boolean(layer?.visible && object.visible !== false)
}

export const isObjectLocked = (
  object: CanvasObject,
  layers: Layer[],
): boolean => {
  const layer = layers.find((candidate) => candidate.id === object.layerId)
  return Boolean(layer?.locked || object.locked)
}

export const getObjectsInRenderOrder = (
  layers: Layer[],
  objects: CanvasObject[],
): CanvasObject[] => {
  const objectsByLayer = new Map<string, CanvasObject[]>()
  for (const object of objects) {
    const siblings = objectsByLayer.get(object.layerId) ?? []
    siblings.push(object)
    objectsByLayer.set(object.layerId, siblings)
  }

  return [...layers]
    .reverse()
    .flatMap((layer) => [...(objectsByLayer.get(layer.id) ?? [])].reverse())
}

export const reorderLayers = (
  layers: Layer[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after',
): Layer[] => {
  if (sourceId === targetId) return layers
  const source = layers.find((layer) => layer.id === sourceId)
  if (!source) return layers
  const remaining = layers.filter((layer) => layer.id !== sourceId)
  const targetIndex = remaining.findIndex((layer) => layer.id === targetId)
  if (targetIndex < 0) return layers
  const insertionIndex = targetIndex + (position === 'after' ? 1 : 0)
  return [
    ...remaining.slice(0, insertionIndex),
    source,
    ...remaining.slice(insertionIndex),
  ]
}

export const reorderObjects = (
  layers: Layer[],
  objects: CanvasObject[],
  objectIds: string[],
  targetLayerId: string,
  targetIndex: number,
): CanvasObject[] => {
  const requestedIds = new Set(objectIds)
  const moving = objects.filter((object) => requestedIds.has(object.id))
  if (moving.length === 0) return objects

  const originalTargetSiblings = objects.filter(
    (object) => object.layerId === targetLayerId,
  )
  const removedBeforeTarget = originalTargetSiblings
    .slice(0, Math.max(0, targetIndex))
    .filter((object) => requestedIds.has(object.id)).length
  const remaining = objects.filter((object) => !requestedIds.has(object.id))
  const grouped = new Map<string, CanvasObject[]>()
  for (const layer of layers) grouped.set(layer.id, [])
  for (const object of remaining) {
    grouped.get(object.layerId)?.push(object)
  }

  const targetSiblings = grouped.get(targetLayerId)
  if (!targetSiblings) return objects
  const insertionIndex = Math.max(
    0,
    Math.min(targetIndex - removedBeforeTarget, targetSiblings.length),
  )
  targetSiblings.splice(
    insertionIndex,
    0,
    ...moving.map((object) => ({ ...object, layerId: targetLayerId })),
  )

  return layers.flatMap((layer) => grouped.get(layer.id) ?? [])
}
