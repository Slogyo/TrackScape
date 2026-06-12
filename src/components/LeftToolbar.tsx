import { tools } from '../data/tools'
import type { ToolId } from '../types'

interface LeftToolbarProps {
  activeToolId: ToolId
  onSelectTool: (toolId: ToolId) => void
}

function LeftToolbar({ activeToolId, onSelectTool }: LeftToolbarProps) {
  return (
    <nav className="left-toolbar" aria-label="Drawing tools">
      {tools.map((tool, index) => (
        <button
          className={`tool-button ${
            activeToolId === tool.id ? 'is-active' : ''
          } ${index === 2 ? 'tool-group-start' : ''}`}
          key={tool.id}
          type="button"
          aria-pressed={activeToolId === tool.id}
          aria-label={tool.label}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          onClick={() => onSelectTool(tool.id)}
        >
          <span className="tool-symbol" aria-hidden="true">
            {tool.shortLabel}
          </span>
          <span className="tool-label">{tool.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default LeftToolbar
