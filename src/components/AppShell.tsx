import { useEffect, useState } from 'react'
import { useAppState } from '../state/appState'
import type {
  DraftMeasurement,
  MovementDelta,
  ProjectFeedback,
} from '../types'
import {
  getProjectFilename,
  parseProjectDocument,
  serializeProjectDocument,
} from '../utils/projectDocument'
import { createLocalProjectStorage } from '../utils/projectStorage'
import CanvasWorkspace from './CanvasWorkspace'
import HeaderBar from './HeaderBar'
import LayersPanel from './LayersPanel'
import LeftToolbar from './LeftToolbar'
import StatusBar from './StatusBar'

const projectStorage = createLocalProjectStorage(() => window.localStorage)

function AppShell() {
  const [initialLoad] = useState(() => projectStorage.load())
  const appState = useAppState(initialLoad.ok ? initialLoad.project : null)
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
  const activeLayer =
    appState.layers.find((layer) => layer.id === appState.activeLayerId) ??
    appState.layers[0]
  const selectedObject =
    appState.objects.find(
      (object) => object.id === appState.selectedObjectId,
    ) ?? null
  const selectedLayer =
    appState.layers.find((layer) => layer.id === selectedObject?.layerId) ??
    null

  useEffect(() => {
    document.documentElement.dataset.theme = appState.theme
    document.documentElement.style.colorScheme = appState.theme
  }, [appState.theme])

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

  return (
    <div className="app-shell">
      <HeaderBar
        measurementSystem={appState.measurementSystem}
        projectFeedback={projectFeedback}
        projectName={appState.metadata.name}
        theme={appState.theme}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        onSaveProject={handleSaveProject}
        onUpdateProjectName={(name) => {
          appState.updateProjectName(name)
          setProjectFeedback(null)
        }}
        onToggleMeasurementSystem={appState.toggleMeasurementSystem}
        onToggleTheme={appState.toggleTheme}
      />

      <main className="app-main">
        <LeftToolbar
          activeToolId={appState.activeToolId}
          onSelectTool={appState.setActiveToolId}
        />
        <CanvasWorkspace
          activeLayer={activeLayer}
          activeToolId={appState.activeToolId}
          layers={appState.layers}
          objects={appState.objects}
          selectedObjectId={appState.selectedObjectId}
          onAddObject={appState.addCanvasObject}
          onCursorMove={appState.setCursorPositionMm}
          onDraftMeasurementChange={setDraftMeasurement}
          onMovementDeltaChange={setMovementDelta}
          onRemoveObject={appState.removeCanvasObject}
          onSelectObject={appState.setSelectedObjectId}
          onUpdateObject={appState.updateCanvasObject}
        />
        <LayersPanel
          activeLayerId={appState.activeLayerId}
          layers={appState.layers}
          measurementSystem={appState.measurementSystem}
          selectedLayer={selectedLayer}
          selectedObject={selectedObject}
          onSelectLayer={appState.setActiveLayerId}
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
        measurementSystem={appState.measurementSystem}
        movementDelta={movementDelta}
        selectedLayer={selectedLayer}
        selectedObject={selectedObject}
      />
    </div>
  )
}

export default AppShell
