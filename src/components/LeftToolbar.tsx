import { useEffect, useRef, useState } from 'react'
import addShapeIcon from '../../SVG/Addshape.svg?url'
import areaSelectIcon from '../../SVG/AreaSelect.svg?url'
import binIcon from '../../SVG/Bin.svg?url'
import measureIcon from '../../SVG/Measure.svg?url'
import selectIcon from '../../SVG/Select.svg?url'
import textIcon from '../../SVG/Textadd.svg?url'
import trackIcon from '../../SVG/Track.svg?url'
import { areaSelectTool, tools } from '../data/tools'
import type { Tool, ToolId } from '../types'

interface LeftToolbarProps {
  activeToolId: ToolId
  preferredSelectionToolId: Extract<ToolId, 'select' | 'area-select'>
  onSelectTool: (toolId: ToolId) => void
  onSelectPreferredSelectionTool: (
    toolId: Extract<ToolId, 'select' | 'area-select'>,
  ) => void
}

const toolIcons: Partial<Record<ToolId, string>> = {
  select: selectIcon,
  'area-select': areaSelectIcon,
  delete: binIcon,
  shape: addShapeIcon,
  track: trackIcon,
  measurement: measureIcon,
  text: textIcon,
}

const isTextEntryTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

function ToolIcon({ tool }: { tool: Tool }) {
  const icon = toolIcons[tool.id]

  return icon ? (
    <span
      className="tool-icon"
      aria-hidden="true"
      style={{ '--tool-icon': `url("${icon}")` } as React.CSSProperties}
    />
  ) : (
    <span className="tool-symbol" aria-hidden="true">
      {tool.shortLabel}
    </span>
  )
}

function LeftToolbar({
  activeToolId,
  preferredSelectionToolId,
  onSelectTool,
  onSelectPreferredSelectionTool,
}: LeftToolbarProps) {
  const [isSelectionMenuOpen, setIsSelectionMenuOpen] = useState(false)
  const selectionControlRef = useRef<HTMLDivElement>(null)
  const selectionTool =
    preferredSelectionToolId === 'area-select'
      ? areaSelectTool
      : tools[0]

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        isSelectionMenuOpen &&
        !selectionControlRef.current?.contains(event.target as Node)
      ) {
        setIsSelectionMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSelectionMenuOpen(false)
      }
      if (
        event.key.toLowerCase() === 'v' &&
        !isTextEntryTarget(event.target)
      ) {
        event.preventDefault()
        onSelectTool(preferredSelectionToolId)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isSelectionMenuOpen,
    onSelectTool,
    preferredSelectionToolId,
  ])

  const chooseSelectionTool = (
    toolId: Extract<ToolId, 'select' | 'area-select'>,
  ) => {
    onSelectPreferredSelectionTool(toolId)
    onSelectTool(toolId)
    setIsSelectionMenuOpen(false)
  }

  return (
    <nav className="left-toolbar" aria-label="Drawing tools">
      <div className="selection-tool-control" ref={selectionControlRef}>
        <button
          className={`tool-button ${
            activeToolId === 'select' || activeToolId === 'area-select'
              ? 'is-active'
              : ''
          }`}
          type="button"
          aria-pressed={
            activeToolId === 'select' || activeToolId === 'area-select'
          }
          aria-label={selectionTool.label}
          title={`${selectionTool.label} (V)`}
          onClick={() => onSelectTool(preferredSelectionToolId)}
        >
          <ToolIcon tool={selectionTool} />
          <span className="tool-label">{selectionTool.label}</span>
        </button>
        <button
          className="selection-menu-trigger"
          type="button"
          aria-expanded={isSelectionMenuOpen}
          aria-haspopup="menu"
          aria-label="Choose selection tool"
          onClick={() => setIsSelectionMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
        </button>
        {isSelectionMenuOpen && (
          <div className="selection-tool-menu" role="menu">
            {[tools[0], areaSelectTool].map((tool) => (
              <button
                key={tool.id}
                type="button"
                role="menuitemradio"
                aria-checked={preferredSelectionToolId === tool.id}
                onClick={() =>
                  chooseSelectionTool(
                    tool.id as Extract<ToolId, 'select' | 'area-select'>,
                  )
                }
              >
                <ToolIcon tool={tool} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {tools.slice(1).map((tool, index) => (
        <button
          className={`tool-button ${
            activeToolId === tool.id ? 'is-active' : ''
          } ${index === 1 ? 'tool-group-start' : ''}`}
          key={tool.id}
          type="button"
          aria-pressed={activeToolId === tool.id}
          aria-label={tool.label}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          onClick={() => onSelectTool(tool.id)}
        >
          <ToolIcon tool={tool} />
          <span className="tool-label">{tool.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default LeftToolbar
