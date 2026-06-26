import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  CanvasObject,
  Layer,
  LayoutScaleId,
  MeasurementSystem,
  ToolId,
  TrackPlacementSettings,
} from '../types'
import {
  getObjectName,
  isObjectLocked,
  isObjectVisible,
} from '../utils/outliner'
import ObjectProperties from './ObjectProperties'
import TrackPalette from './TrackPalette'
import MultiSelectionProperties from './MultiSelectionProperties'
import arrowDropDownIcon from '../../SVG/ArrowDropDown.svg?url'
import arrowRightIcon from '../../SVG/ArrowRight.svg?url'
import invisibleIcon from '../../SVG/Invisible.svg?url'
import lockLineIcon from '../../SVG/LockLine.svg?url'
import lockSolidIcon from '../../SVG/LockSolid.svg?url'
import unlockLineIcon from '../../SVG/UnlockLine.svg?url'
import unlockSolidIcon from '../../SVG/UnlockSolid.svg?url'
import visibleIcon from '../../SVG/Visible.svg?url'

interface LayersPanelProps {
  activeLayerId: string
  activeToolId: ToolId
  layers: Layer[]
  layoutScaleId: LayoutScaleId
  measurementSystem: MeasurementSystem
  objects: CanvasObject[]
  selectedLayer: Layer | null
  selectedObject: CanvasObject | null
  selectedObjectIds: string[]
  selectedObjects: CanvasObject[]
  trackSettings: TrackPlacementSettings
  onAddLayer: () => Layer
  onDeleteLayer: (layerId: string) => void
  onRenameLayer: (layerId: string, name: string) => void
  onRenameObject: (objectId: string, name: string) => void
  onReorderLayer: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => void
  onReorderObjects: (
    objectIds: string[],
    targetLayerId: string,
    targetIndex: number,
  ) => void
  onSelectLayer: (layerId: string) => void
  onSelectObjects: (objectIds: string[]) => void
  onSetLayerExpanded: (layerId: string, expanded: boolean) => void
  onTrackSettingsChange: (settings: TrackPlacementSettings) => void
  onToggleLock: (layerId: string) => void
  onToggleObjectLock: (objectId: string) => void
  onToggleObjectVisibility: (objectId: string) => void
  onToggleVisibility: (layerId: string) => void
  onUpdateObject: (object: CanvasObject) => void
}

interface RenameDraft {
  type: 'layer' | 'object'
  id: string
  value: string
}

type DragDraft =
  | { type: 'layer'; layerId: string }
  | { type: 'objects'; objectIds: string[] }

type DropTarget =
  | {
      type: 'layer'
      layerId: string
      position: 'before' | 'after'
    }
  | {
      type: 'objects'
      layerId: string
      index: number
    }

const MIN_SECTION_HEIGHT = 140
const PANEL_FIXED_SPACE = 205
const SECTION_KEYBOARD_STEP = 16

function LayersPanel({
  activeLayerId,
  activeToolId,
  layers,
  layoutScaleId,
  measurementSystem,
  objects,
  selectedLayer,
  selectedObject,
  selectedObjectIds,
  selectedObjects,
  trackSettings,
  onAddLayer,
  onDeleteLayer,
  onRenameLayer,
  onRenameObject,
  onReorderLayer,
  onReorderObjects,
  onSelectLayer,
  onSelectObjects,
  onSetLayerExpanded,
  onTrackSettingsChange,
  onToggleLock,
  onToggleObjectLock,
  onToggleObjectVisibility,
  onToggleVisibility,
  onUpdateObject,
}: LayersPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const propertiesRef = useRef<HTMLDivElement>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const objectRowRefs = useRef(new Map<string, HTMLDivElement>())
  const [propertiesHeight, setPropertiesHeight] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState<RenameDraft | null>(null)
  const [dragDraft, setDragDraft] = useState<DragDraft | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const objectsByLayer = useMemo(() => {
    const grouped = new Map<string, CanvasObject[]>()
    for (const layer of layers) grouped.set(layer.id, [])
    for (const object of objects) grouped.get(object.layerId)?.push(object)
    return grouped
  }, [layers, objects])
  const displayedObjectIds = useMemo(
    () =>
      layers.flatMap((layer) =>
        layer.expanded === false
          ? []
          : (objectsByLayer.get(layer.id) ?? []).map((object) => object.id),
      ),
    [layers, objectsByLayer],
  )

  useEffect(() => {
    if (selectedObjectIds.length !== 1) return
    objectRowRefs.current
      .get(selectedObjectIds[0])
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedObjectIds])

  const clampPropertiesHeight = (height: number) => {
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
    return Math.min(
      Math.max(MIN_SECTION_HEIGHT, height),
      Math.max(MIN_SECTION_HEIGHT, panelHeight - PANEL_FIXED_SPACE),
    )
  }

  const handleSectionResizeStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight =
      propertiesRef.current?.getBoundingClientRect().height ??
      MIN_SECTION_HEIGHT
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      setPropertiesHeight(
        clampPropertiesHeight(startHeight + startY - pointerEvent.clientY),
      )
    }
    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing-panel-section')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
    document.body.classList.add('is-resizing-panel-section')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const handleSectionResizeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const currentHeight =
      propertiesRef.current?.getBoundingClientRect().height ??
      MIN_SECTION_HEIGHT
    setPropertiesHeight(
      clampPropertiesHeight(
        currentHeight +
          (event.key === 'ArrowUp'
            ? SECTION_KEYBOARD_STEP
            : -SECTION_KEYBOARD_STEP),
      ),
    )
  }

  const beginRename = (
    type: RenameDraft['type'],
    id: string,
    value: string,
  ) => setRenameDraft({ type, id, value })

  const commitRename = () => {
    if (!renameDraft) return
    const name = renameDraft.value.trim()
    if (name) {
      if (renameDraft.type === 'layer') {
        onRenameLayer(renameDraft.id, name)
      } else {
        onRenameObject(renameDraft.id, name)
      }
    }
    setRenameDraft(null)
  }

  const handleObjectSelection = (
    event: MouseEvent,
    objectId: string,
  ) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = displayedObjectIds.indexOf(selectionAnchorRef.current)
      const targetIndex = displayedObjectIds.indexOf(objectId)
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const range = displayedObjectIds.slice(
          Math.min(anchorIndex, targetIndex),
          Math.max(anchorIndex, targetIndex) + 1,
        )
        onSelectObjects(
          event.ctrlKey || event.metaKey
            ? [...new Set([...selectedObjectIds, ...range])]
            : range,
        )
        return
      }
    }

    selectionAnchorRef.current = objectId
    if (event.ctrlKey || event.metaKey) {
      onSelectObjects(
        selectedObjectIds.includes(objectId)
          ? selectedObjectIds.filter((id) => id !== objectId)
          : [...selectedObjectIds, objectId],
      )
      return
    }
    onSelectObjects([objectId])
  }

  const getDragObjectIds = (object: CanvasObject) =>
    selectedObjectIds.includes(object.id)
      ? objects
          .filter(
            (candidate) =>
              selectedObjectIds.includes(candidate.id) &&
              !isObjectLocked(candidate, layers),
          )
          .map((candidate) => candidate.id)
      : [object.id]

  const handleObjectDragStart = (
    event: DragEvent,
    object: CanvasObject,
  ) => {
    event.stopPropagation()
    if (isObjectLocked(object, layers)) {
      event.preventDefault()
      return
    }
    const objectIds = getDragObjectIds(object)
    if (!selectedObjectIds.includes(object.id)) onSelectObjects([object.id])
    setDragDraft({ type: 'objects', objectIds })
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', object.id)
  }

  const handleLayerDrop = (layer: Layer) => {
    if (!dragDraft) return
    if (dragDraft.type === 'objects') {
      onReorderObjects(
        dragDraft.objectIds,
        layer.id,
        (objectsByLayer.get(layer.id) ?? []).length,
      )
    } else if (dropTarget?.type === 'layer') {
      onReorderLayer(
        dragDraft.layerId,
        layer.id,
        dropTarget.position,
      )
    }
    setDragDraft(null)
    setDropTarget(null)
  }

  const handleObjectDrop = (layerId: string, index: number) => {
    if (dragDraft?.type !== 'objects') return
    onReorderObjects(dragDraft.objectIds, layerId, index)
    setDragDraft(null)
    setDropTarget(null)
  }

  const handleObjectKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    object: CanvasObject,
  ) => {
    if (event.key === 'F2' && !isObjectLocked(object, layers)) {
      event.preventDefault()
      beginRename('object', object.id, getObjectName(object))
      return
    }
    if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return
    }
    event.preventDefault()
    if (isObjectLocked(object, layers)) return
    const sourceLayerIndex = layers.findIndex(
      (layer) => layer.id === object.layerId,
    )
    const selectedIds = getDragObjectIds(object)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      const targetLayer = layers[sourceLayerIndex + direction]
      if (targetLayer) {
        onReorderObjects(
          selectedIds,
          targetLayer.id,
          (objectsByLayer.get(targetLayer.id) ?? []).length,
        )
      }
      return
    }
    const siblings = objectsByLayer.get(object.layerId) ?? []
    const currentIndex = siblings.findIndex(
      (candidate) => candidate.id === object.id,
    )
    const targetIndex =
      event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1
    onReorderObjects(selectedIds, object.layerId, targetIndex)
  }

  return (
    <aside
      className="layers-panel"
      ref={panelRef}
      style={
        propertiesHeight === null
          ? undefined
          : ({
              '--properties-panel-height': `${propertiesHeight}px`,
            } as CSSProperties)
      }
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>Layers</h2>
        </div>
        <button
          className="panel-action tooltip-control"
          type="button"
          aria-label="Add folder"
          data-tooltip="Add a new folder"
          title="Add folder"
          onClick={() => {
            const layer = onAddLayer()
            beginRename('layer', layer.id, layer.name)
          }}
        >
          +
        </button>
      </div>

      <div className="layer-list outliner-tree" role="tree" aria-label="Project layers">
        {layers.map((layer, layerIndex) => {
          const isActive = layer.id === activeLayerId
          const layerObjects = objectsByLayer.get(layer.id) ?? []
          const isLayerDrop =
            dropTarget?.type === 'layer' && dropTarget.layerId === layer.id

          return (
            <div
              className="outliner-folder"
              key={layer.id}
              role="treeitem"
              aria-expanded={layer.expanded !== false}
              aria-selected={isActive}
              onDragEnd={() => {
                setDragDraft(null)
                setDropTarget(null)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (dragDraft?.type === 'layer') {
                  const folderRow =
                    event.currentTarget.querySelector('.outliner-folder-row')
                  const bounds =
                    folderRow?.getBoundingClientRect() ??
                    event.currentTarget.getBoundingClientRect()
                  setDropTarget({
                    type: 'layer',
                    layerId: layer.id,
                    position:
                      event.clientY < bounds.top + bounds.height / 2
                        ? 'before'
                        : 'after',
                  })
                } else if (dragDraft?.type === 'objects') {
                  setDropTarget({
                    type: 'objects',
                    layerId: layer.id,
                    index: layerObjects.length,
                  })
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                handleLayerDrop(layer)
              }}
            >
              <div
                className={`outliner-folder-row ${
                  isActive ? 'is-active' : ''
                } ${
                  isLayerDrop
                    ? `is-drop-${dropTarget.position}`
                    : ''
                }`.trim()}
                draggable
                onDragStart={(event) => {
                  setDragDraft({ type: 'layer', layerId: layer.id })
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', layer.id)
                }}
              >
                <button
                  className="outliner-disclosure tooltip-control"
                  type="button"
                  aria-label={`${layer.expanded === false ? 'Expand' : 'Collapse'} ${layer.name}`}
                  data-tooltip={`${layer.expanded === false ? 'Expand' : 'Collapse'} folder`}
                  data-tooltip-side="left"
                  onClick={() =>
                    onSetLayerExpanded(layer.id, layer.expanded === false)
                  }
                >
                  <span
                    className="outliner-disclosure-icon"
                    aria-hidden="true"
                    style={{
                      '--disclosure-icon': `url("${
                        layer.expanded === false
                          ? arrowRightIcon
                          : arrowDropDownIcon
                      }")`,
                    } as CSSProperties}
                  />
                </button>
                <button
                  className="layer-state-button tooltip-control"
                  type="button"
                  aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                  aria-pressed={layer.visible}
                  data-tooltip={`${layer.visible ? 'Hide' : 'Show'} folder`}
                  data-tooltip-side="left"
                  onClick={() => onToggleVisibility(layer.id)}
                >
                  <span
                    className="layer-visibility-icon"
                    aria-hidden="true"
                    style={{
                      '--visibility-icon': `url("${
                        layer.visible ? visibleIcon : invisibleIcon
                      }")`,
                    } as CSSProperties}
                  />
                </button>
                {renameDraft?.type === 'layer' &&
                renameDraft.id === layer.id ? (
                  <input
                    className="outliner-rename-input"
                    aria-label={`Rename ${layer.name}`}
                    autoFocus
                    maxLength={80}
                    value={renameDraft.value}
                    onBlur={commitRename}
                    onChange={(event) =>
                      setRenameDraft({
                        ...renameDraft,
                        value: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename()
                      if (event.key === 'Escape') setRenameDraft(null)
                    }}
                  />
                ) : (
                  <button
                    className="outliner-name-button tooltip-control"
                    type="button"
                    data-tooltip="Set active folder; double-click to rename"
                    onClick={() => onSelectLayer(layer.id)}
                    onDoubleClick={() =>
                      beginRename('layer', layer.id, layer.name)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'F2') {
                        event.preventDefault()
                        beginRename('layer', layer.id, layer.name)
                      } else if (
                        event.altKey &&
                        (event.key === 'ArrowUp' ||
                          event.key === 'ArrowDown')
                      ) {
                        event.preventDefault()
                        const target =
                          layers[
                            layerIndex +
                              (event.key === 'ArrowUp' ? -1 : 1)
                          ]
                        if (target) {
                          onReorderLayer(
                            layer.id,
                            target.id,
                            event.key === 'ArrowUp' ? 'before' : 'after',
                          )
                        }
                      }
                    }}
                  >
                    <span className="layer-folder" aria-hidden="true" />
                    <span className="outliner-name">{layer.name}</span>
                    <span className="outliner-count">{layerObjects.length}</span>
                  </button>
                )}
                <button
                  className="layer-state-button tooltip-control"
                  type="button"
                  aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                  aria-pressed={layer.locked}
                  data-tooltip={`${layer.locked ? 'Unlock' : 'Lock'} folder`}
                  data-tooltip-side="right"
                  onClick={() => onToggleLock(layer.id)}
                >
                  <span
                    className="layer-lock-icon"
                    aria-hidden="true"
                    style={{
                      '--lock-icon': `url("${
                        layer.locked ? lockSolidIcon : unlockSolidIcon
                      }")`,
                    } as CSSProperties}
                  />
                </button>
                <button
                  className="outliner-delete-button tooltip-control"
                  type="button"
                  aria-label={`Delete ${layer.name}`}
                  data-tooltip={
                    layers.length === 1
                      ? 'Last folder cannot be deleted'
                      : 'Delete folder and assets'
                  }
                  data-tooltip-side="right"
                  disabled={layers.length === 1}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${layer.name} and its ${layerObjects.length} asset${
                          layerObjects.length === 1 ? '' : 's'
                        }?`,
                      )
                    ) {
                      onDeleteLayer(layer.id)
                    }
                  }}
                >
                  x
                </button>
              </div>

              {layer.expanded !== false && (
                <div role="group" className="outliner-children">
                  {layerObjects.map((object, objectIndex) => {
                    const selected = selectedObjectIds.includes(object.id)
                    const effectiveVisible = isObjectVisible(object, layers)
                    const effectiveLocked = isObjectLocked(object, layers)
                    const isObjectDrop =
                      dropTarget?.type === 'objects' &&
                      dropTarget.layerId === layer.id &&
                      (dropTarget.index === objectIndex ||
                        dropTarget.index === objectIndex + 1)

                    return (
                      <div
                        className={`outliner-object-row ${
                          selected ? 'is-selected' : ''
                        } ${effectiveVisible ? '' : 'is-hidden'} ${
                          effectiveLocked ? 'is-locked' : ''
                        } ${
                          isObjectDrop
                            ? dropTarget.index === objectIndex
                              ? 'is-drop-before'
                              : 'is-drop-after'
                            : ''
                        }`.trim()}
                        key={object.id}
                        role="treeitem"
                        aria-selected={selected}
                        draggable={!effectiveLocked}
                        ref={(node) => {
                          if (node) objectRowRefs.current.set(object.id, node)
                          else objectRowRefs.current.delete(object.id)
                        }}
                        onDragEnd={() => {
                          setDragDraft(null)
                          setDropTarget(null)
                        }}
                        onDragStart={(event) =>
                          handleObjectDragStart(event, object)
                        }
                        onDragOver={(event) => {
                          if (dragDraft?.type !== 'objects') return
                          event.preventDefault()
                          event.stopPropagation()
                          const bounds =
                            event.currentTarget.getBoundingClientRect()
                          setDropTarget({
                            type: 'objects',
                            layerId: layer.id,
                            index:
                              event.clientY < bounds.top + bounds.height / 2
                                ? objectIndex
                                : objectIndex + 1,
                          })
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (dropTarget?.type === 'objects') {
                            handleObjectDrop(
                              dropTarget.layerId,
                              dropTarget.index,
                            )
                          }
                        }}
                      >
                        <span className="outliner-indent" aria-hidden="true" />
                        <button
                          className="layer-state-button tooltip-control"
                          type="button"
                          aria-label={`${object.visible === false ? 'Show' : 'Hide'} ${getObjectName(object)}`}
                          aria-pressed={object.visible !== false}
                          data-tooltip={`${object.visible === false ? 'Show' : 'Hide'} asset`}
                          data-tooltip-side="left"
                          onClick={() => onToggleObjectVisibility(object.id)}
                        >
                          <span
                            className="layer-visibility-icon"
                            aria-hidden="true"
                            style={{
                              '--visibility-icon': `url("${
                                object.visible === false
                                  ? invisibleIcon
                                  : visibleIcon
                              }")`,
                            } as CSSProperties}
                          />
                        </button>
                        {renameDraft?.type === 'object' &&
                        renameDraft.id === object.id ? (
                          <input
                            className="outliner-rename-input"
                            aria-label={`Rename ${getObjectName(object)}`}
                            autoFocus
                            maxLength={80}
                            value={renameDraft.value}
                            onBlur={commitRename}
                            onChange={(event) =>
                              setRenameDraft({
                                ...renameDraft,
                                value: event.target.value,
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') commitRename()
                              if (event.key === 'Escape') setRenameDraft(null)
                            }}
                          />
                        ) : (
                          <button
                            className="outliner-name-button tooltip-control"
                            type="button"
                            data-tooltip={
                              effectiveLocked
                                ? 'Select locked asset'
                                : 'Select asset; double-click to rename'
                            }
                            onClick={(event) =>
                              handleObjectSelection(event, object.id)
                            }
                            onDoubleClick={() => {
                              if (!effectiveLocked) {
                                beginRename(
                                  'object',
                                  object.id,
                                  getObjectName(object),
                                )
                              }
                            }}
                            onKeyDown={(event) =>
                              handleObjectKeyDown(event, object)
                            }
                          >
                            <span
                              className={`outliner-object-icon is-${object.type}`}
                              aria-hidden="true"
                            />
                            <span className="outliner-name">
                              {getObjectName(object)}
                            </span>
                          </button>
                        )}
                        <button
                          className="layer-state-button tooltip-control"
                          type="button"
                          aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${getObjectName(object)}`}
                          aria-pressed={object.locked === true}
                          data-tooltip={`${object.locked ? 'Unlock' : 'Lock'} asset`}
                          data-tooltip-side="right"
                          onClick={() => onToggleObjectLock(object.id)}
                        >
                          <span
                            className="layer-lock-icon"
                            aria-hidden="true"
                            style={{
                              '--lock-icon': `url("${
                                object.locked ? lockLineIcon : unlockLineIcon
                              }")`,
                            } as CSSProperties}
                          />
                        </button>
                        <span className="outliner-row-spacer" />
                      </div>
                    )
                  })}
                  {layerObjects.length === 0 &&
                    dragDraft?.type === 'objects' && (
                    <div
                      className={`outliner-empty-folder ${
                        dropTarget?.type === 'objects' &&
                        dropTarget.layerId === layer.id
                          ? 'is-drop-target'
                          : ''
                      }`}
                      onDragOver={(event) => {
                        if (dragDraft?.type !== 'objects') return
                        event.preventDefault()
                        event.stopPropagation()
                        setDropTarget({
                          type: 'objects',
                          layerId: layer.id,
                          index: 0,
                        })
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleObjectDrop(layer.id, 0)
                      }}
                    >
                      Empty folder
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="panel-footer">
        <span>{layers.length} folders</span>
        <span>{objects.length} assets</span>
      </div>
      <div
        className="panel-section-resize-handle"
        role="separator"
        aria-label="Resize Layers and Properties sections"
        aria-orientation="horizontal"
        aria-valuemin={MIN_SECTION_HEIGHT}
        aria-valuenow={Math.round(
          propertiesHeight ??
            propertiesRef.current?.getBoundingClientRect().height ??
            MIN_SECTION_HEIGHT,
        )}
        tabIndex={0}
        onKeyDown={handleSectionResizeKeyDown}
        onPointerDown={handleSectionResizeStart}
      />
      <div className="properties-panel-slot" ref={propertiesRef}>
        {activeToolId === 'track' ? (
          <TrackPalette
            layoutScaleId={layoutScaleId}
            measurementSystem={measurementSystem}
            settings={trackSettings}
            onChange={onTrackSettingsChange}
          />
        ) : selectedObjects.length > 1 ? (
          <MultiSelectionProperties
            layers={layers}
            measurementSystem={measurementSystem}
            objects={selectedObjects}
          />
        ) : (
          <ObjectProperties
            layer={selectedLayer}
            layoutScaleId={layoutScaleId}
            measurementSystem={measurementSystem}
            object={selectedObject}
            objects={objects}
            onUpdateObject={onUpdateObject}
          />
        )}
      </div>
    </aside>
  )
}

export default LayersPanel
