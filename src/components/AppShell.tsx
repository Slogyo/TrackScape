import { useEffect, useState } from 'react'
import { useAppState } from '../state/appState'
import type {
  DraftMeasurement,
  MovementDelta,
  ProjectFeedback,
  ToolId,
  TrackPlacementSettings,
  TrackPreviewStatus,
} from '../types'
import type { ThemePreference } from '../utils/themePreference'
import {
  getProjectFilename,
  parseProjectDocument,
  serializeProjectDocument,
} from '../utils/projectDocument'
import { createLocalProjectStorage } from '../utils/projectStorage'
import {
  getSystemTheme,
  saveThemePreference,
} from '../utils/themePreference'
import { DEFAULT_WORKSPACE_ZOOM } from '../utils/viewport'
import {
  getDefaultTrackDefinitionId,
  getTrackDefinition,
  layoutScaleToTrackGauge,
} from '../data/trackCatalog'
import CanvasWorkspace from './CanvasWorkspace'
import HeaderBar from './HeaderBar'
import LayersPanel from './LayersPanel'
import LeftToolbar from './LeftToolbar'
import StatusBar from './StatusBar'

const projectStorage = createLocalProjectStorage(() => window.localStorage)

interface AppShellProps {
  initialThemePreference: ThemePreference
}

function AppShell({ initialThemePreference }: AppShellProps) {
  const [initialLoad] = useState(() => projectStorage.load())
  const appState = useAppState(
    initialLoad.ok ? initialLoad.project : null,
    initialThemePreference.theme,
  )
  const [hasManualTheme, setHasManualTheme] = useState(
    initialThemePreference.hasManualPreference,
  )
  const [draftMeasurement, setDraftMeasurement] =
    useState<DraftMeasurement | null>(null)
  const [movementDelta, setMovementDelta] = useState<MovementDelta | null>(
    null,
  )
  const [projectFeedback, setProjectFeedback] =
    useState<ProjectFeedback | null>(() => {
      if (!initialLoad.ok) {
        return { type: 'error', message: initialLoad.error }
      }

      return initialLoad.project
        ? { type: 'success', message: 'Saved project restored.' }
        : null
    })
  const [trackSettings, setTrackSettings] =
    useState<TrackPlacementSettings>({
      definitionId: getDefaultTrackDefinitionId(
        layoutScaleToTrackGauge(appState.layoutScaleId),
      ),
      rotation: 0,
      direction: 'right',
    })
  const [trackPreviewStatus, setTrackPreviewStatus] =
    useState<TrackPreviewStatus | null>(null)
  const [preferredSelectionToolId, setPreferredSelectionToolId] =
    useState<'select' | 'area-select'>('select')
  const [workspaceZoom, setWorkspaceZoom] = useState(
    DEFAULT_WORKSPACE_ZOOM,
  )
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true)
  const [resetViewToken, setResetViewToken] = useState(0)
  const activeLayer =
    appState.layers.find((layer) => layer.id === appState.activeLayerId) ??
    appState.layers[0]
  const selectedObjects = appState.objects.filter((object) =>
    appState.selectedObjectIds.includes(object.id),
  )
  const selectedObject =
    selectedObjects.length === 1 ? selectedObjects[0] : null
  const selectedLayer =
    appState.layers.find((layer) => layer.id === selectedObject?.layerId) ??
    null
  const trackLayer =
    appState.layers.find((layer) => layer.id === 'track') ?? null

  useEffect(() => {
    document.documentElement.dataset.theme = appState.theme
    document.documentElement.style.colorScheme = appState.theme
  }, [appState.theme])

  useEffect(() => {
    if (hasManualTheme || !window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      appState.setTheme(getSystemTheme(window.matchMedia.bind(window)))
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [appState, hasManualTheme])

  const handleToggleTheme = () => {
    const nextTheme = appState.theme === 'light' ? 'dark' : 'light'
    appState.setTheme(nextTheme)
    saveThemePreference(nextTheme, () => window.localStorage)
    setHasManualTheme(true)
  }

  const handleSaveProject = (projectName: string) => {
    const updatedAt = new Date().toISOString()
    const project = appState.getProjectDocument(updatedAt)
    project.metadata.name = projectName
    const result = projectStorage.save(project)

    if (!result.ok) {
      setProjectFeedback({ type: 'error', message: result.error })
      return
    }

    appState.markProjectSaved(updatedAt)
    setProjectFeedback({
      type: 'success',
      message: 'Project saved in this browser.',
    })
  }

  const handleImportProject = async (file: File) => {
    let contents: string

    try {
      contents = await file.text()
    } catch {
      setProjectFeedback({
        type: 'error',
        message: 'The selected project file could not be read.',
      })
      return
    }

    const result = parseProjectDocument(contents)
    if (!result.ok) {
      setProjectFeedback({ type: 'error', message: result.error })
      return
    }

    if (
      appState.objects.length > 0 &&
      !window.confirm(
        'Importing this project will replace the current unsaved workspace. Continue?',
      )
    ) {
      return
    }

    setDraftMeasurement(null)
    setMovementDelta(null)
    appState.hydrateProject(result.project)
    setProjectFeedback({
      type: 'success',
      message: `Imported ${result.project.metadata.name}. Save to keep it in this browser.`,
    })
  }

  const handleExportProject = (projectName: string) => {
    try {
      const project = appState.getProjectDocument()
      project.metadata.name = projectName
      const blob = new Blob([serializeProjectDocument(project)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = getProjectFilename(project.metadata.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setProjectFeedback({
        type: 'success',
        message: 'Project JSON exported.',
      })
    } catch {
      setProjectFeedback({
        type: 'error',
        message: 'The project could not be exported.',
      })
    }
  }

  const handleSelectTool = (toolId: ToolId) => {
    appState.setActiveToolId(toolId)
    if (toolId === 'track' && trackLayer) {
      appState.setActiveLayerId(trackLayer.id)
    }
  }

  return (
    <div className="app-shell">
      <HeaderBar
        layoutScaleId={appState.layoutScaleId}
        measurementSystem={appState.measurementSystem}
        projectFeedback={projectFeedback}
        projectName={appState.metadata.name}
        theme={appState.theme}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        onSaveProject={handleSaveProject}
        onSelectLayoutScale={(layoutScaleId) => {
          appState.setLayoutScaleId(layoutScaleId)
          const definitionId = getDefaultTrackDefinitionId(
            layoutScaleToTrackGauge(layoutScaleId),
          )
          const definition = getTrackDefinition(definitionId)
          setTrackSettings((settings) => ({
            ...settings,
            definitionId,
            direction:
              definition.handedness === 'left' ||
              definition.handedness === 'right'
                ? definition.handedness
                : settings.direction,
          }))
        }}
        onUpdateProjectName={(name) => {
          appState.updateProjectName(name)
          setProjectFeedback(null)
        }}
        onToggleMeasurementSystem={appState.toggleMeasurementSystem}
        onToggleTheme={handleToggleTheme}
      />

      <main className="app-main">
        <LeftToolbar
          activeToolId={appState.activeToolId}
          preferredSelectionToolId={preferredSelectionToolId}
          onSelectTool={handleSelectTool}
          onSelectPreferredSelectionTool={setPreferredSelectionToolId}
        />
        <CanvasWorkspace
          activeLayer={activeLayer}
          activeToolId={appState.activeToolId}
          layers={appState.layers}
          objects={appState.objects}
          projectId={appState.metadata.id}
          resetViewToken={resetViewToken}
          selectedObjectIds={appState.selectedObjectIds}
          isSnappingEnabled={isSnappingEnabled}
          measurementSystem={appState.measurementSystem}
          trackSettings={trackSettings}
          zoom={workspaceZoom}
          onAddObject={appState.addCanvasObject}
          onCursorMove={appState.setCursorPositionMm}
          onDraftMeasurementChange={setDraftMeasurement}
          onMovementDeltaChange={setMovementDelta}
          onRemoveObject={appState.removeCanvasObject}
          onRemoveObjects={appState.removeCanvasObjects}
          onSelectObjects={appState.setSelectedObjectIds}
          onTrackPreviewChange={setTrackPreviewStatus}
          onTrackSettingsChange={setTrackSettings}
          onUpdateObjects={appState.updateCanvasObjects}
          onZoomChange={setWorkspaceZoom}
        />
        <LayersPanel
          activeLayerId={appState.activeLayerId}
          activeToolId={appState.activeToolId}
          layers={appState.layers}
          layoutScaleId={appState.layoutScaleId}
          measurementSystem={appState.measurementSystem}
          objects={appState.objects}
          selectedLayer={selectedLayer}
          selectedObject={selectedObject}
          selectedObjects={selectedObjects}
          trackSettings={trackSettings}
          onSelectLayer={appState.setActiveLayerId}
          onTrackSettingsChange={setTrackSettings}
          onToggleLock={appState.toggleLayerLock}
          onToggleVisibility={appState.toggleLayerVisibility}
          onUpdateObject={appState.updateCanvasObject}
        />
      </main>

      <StatusBar
        activeLayer={activeLayer}
        activeToolId={appState.activeToolId}
        cursorPositionMm={appState.cursorPositionMm}
        draftMeasurement={draftMeasurement}
        layoutScaleId={appState.layoutScaleId}
        measurementSystem={appState.measurementSystem}
        movementDelta={movementDelta}
        selectedLayer={selectedLayer}
        selectedObject={selectedObject}
        selectedObjectCount={selectedObjects.length}
        selectedLockedCount={selectedObjects.filter((object) =>
          appState.layers.find((layer) => layer.id === object.layerId)
            ?.locked,
        ).length}
        isSnappingEnabled={isSnappingEnabled}
        trackLayer={trackLayer}
        trackPreviewStatus={trackPreviewStatus}
        workspaceZoom={workspaceZoom}
        onToggleSnapping={() =>
          setIsSnappingEnabled((isEnabled) => !isEnabled)
        }
        onResetView={() => setResetViewToken((token) => token + 1)}
      />
    </div>
  )
}

export default AppShell
