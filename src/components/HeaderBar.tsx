import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  MeasurementSystem,
  ProjectFeedback,
  Theme,
} from '../types'
import {
  PROJECT_NAME_MAX_LENGTH,
  validateProjectName,
} from '../utils/projectDocument'

interface HeaderBarProps {
  measurementSystem: MeasurementSystem
  projectFeedback: ProjectFeedback | null
  projectName: string
  theme: Theme
  onExportProject: (projectName: string) => void
  onImportProject: (file: File) => void
  onSaveProject: (projectName: string) => void
  onUpdateProjectName: (name: string) => void
  onToggleMeasurementSystem: () => void
  onToggleTheme: () => void
}

function HeaderBar({
  measurementSystem,
  projectFeedback,
  projectName,
  theme,
  onExportProject,
  onImportProject,
  onSaveProject,
  onUpdateProjectName,
  onToggleMeasurementSystem,
  onToggleTheme,
}: HeaderBarProps) {
  const [nameDraft, setNameDraft] = useState(projectName)
  const [nameError, setNameError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNameDraft(projectName)
    setNameError(null)
  }, [projectName])

  const commitProjectName = (): string | null => {
    const error = validateProjectName(nameDraft)
    if (error) {
      setNameError(error)
      return null
    }

    const projectName = nameDraft.trim()
    setNameError(null)
    onUpdateProjectName(projectName)
    return projectName
  }

  const runProjectAction = (action: (projectName: string) => void) => {
    const projectName = commitProjectName()
    if (projectName) {
      action(projectName)
    }
  }

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }

    if (event.key === 'Escape') {
      setNameDraft(projectName)
      setNameError(null)
      event.currentTarget.blur()
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      onImportProject(file)
    }
  }

  return (
    <header className="header-bar">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true" />
        <strong className="brand-name">TrackScape</strong>
      </div>

      <div className="project-block">
        <label className="project-name-field">
          <span className="eyebrow">Project</span>
          <input
            aria-describedby={
              nameError
                ? 'project-name-error'
                : projectFeedback
                  ? 'project-feedback'
                  : undefined
            }
            aria-invalid={nameError ? true : undefined}
            aria-label="Project name"
            maxLength={PROJECT_NAME_MAX_LENGTH}
            value={nameDraft}
            onBlur={commitProjectName}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={handleNameKeyDown}
          />
        </label>
        {(nameError || projectFeedback) && (
          <span
            className={`project-feedback ${
              nameError || projectFeedback?.type === 'error'
                ? 'is-error'
                : 'is-success'
            }`}
            id={nameError ? 'project-name-error' : 'project-feedback'}
            role={nameError || projectFeedback?.type === 'error' ? 'alert' : 'status'}
          >
            {nameError ?? projectFeedback?.message}
          </span>
        )}
      </div>

      <div className="header-actions">
        <button
          className="header-button"
          type="button"
          onClick={onToggleMeasurementSystem}
          aria-label="Toggle measurement system"
        >
          <span className="button-label">Units</span>
          <strong>{measurementSystem === 'metric' ? 'Metric' : 'Imperial'}</strong>
        </button>
        <button
          className="header-button icon-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
        <button
          className="header-button"
          type="button"
          onClick={() => runProjectAction(onSaveProject)}
        >
          Save
        </button>
        <button
          className="header-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".trackscape.json,.json,application/json"
          onChange={handleFileChange}
        />
        <button
          className="header-button"
          type="button"
          onClick={() => runProjectAction(onExportProject)}
        >
          Export
        </button>
      </div>
    </header>
  )
}

export default HeaderBar
