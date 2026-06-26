import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MeasurementObject, TextObject } from '../types'
import { MeasurementGeometry, TextGeometry } from './AnnotationGeometry'

describe('annotation SVG rendering', () => {
  it('renders a formatted measurement with stable selected handles', () => {
    const object: MeasurementObject = {
      id: 'measurement-1',
      type: 'measurement',
      layerId: 'room',
      start: { kind: 'fixed', point: { x: 100, y: 100 } },
      end: { kind: 'fixed', point: { x: 1100, y: 100 } },
      offset: 180,
    }
    const markup = renderToStaticMarkup(
      <svg>
        <MeasurementGeometry
          object={object}
          objects={[object]}
          measurementSystem="metric"
          selected
          zoom={2}
        />
      </svg>,
    )
    expect(markup).toContain('1000 mm')
    expect(markup.match(/data-measurement-handle/g)).toHaveLength(3)
    expect(markup).toContain('r="2"')
    expect(markup).toContain(
      '<rect class="annotation-handle annotation-offset-handle"',
    )
  })

  it('renders multiline labels with tspans and rotation', () => {
    const object: TextObject = {
      id: 'text-1',
      type: 'text',
      layerId: 'room',
      position: { x: 100, y: 200 },
      text: 'Station\nPlatform',
      fontSizeMm: 120,
      rotation: 30,
    }
    const markup = renderToStaticMarkup(
      <svg>
        <TextGeometry object={object} selected />
      </svg>,
    )
    expect(markup.match(/<tspan/g)).toHaveLength(2)
    expect(markup).toContain('rotate(30')
    expect(markup).toContain('is-selected')
  })

  it('renders SVG editing controls and caret with the same text geometry', () => {
    const object: TextObject = {
      id: 'text-draft',
      type: 'text',
      layerId: 'room',
      position: { x: 100, y: 200 },
      text: 'Long label',
      fontSizeMm: 120,
      rotation: 0,
    }
    const markup = renderToStaticMarkup(
      <svg>
        <TextGeometry
          object={object}
          selected
          zoom={2}
          editing={{
            caretIndex: object.text.length,
            selectionEnd: object.text.length,
          }}
        />
      </svg>,
    )
    expect(markup).toContain('is-editing')
    expect(markup).toContain('data-text-editor-target="true"')
    expect(markup).toContain('data-text-editor-drag="true"')
    expect(markup).toContain('text-edit-caret')
    expect(markup).toContain('width="3"')
  })

  it('renders an empty editor without placeholder text or a visible grip', () => {
    const object: TextObject = {
      id: 'text-draft',
      type: 'text',
      layerId: 'room',
      position: { x: 100, y: 200 },
      text: '',
      fontSizeMm: 120,
      rotation: 0,
    }
    const markup = renderToStaticMarkup(
      <svg>
        <TextGeometry
          object={object}
          selected
          zoom={2}
          editing={{ caretIndex: 0, selectionEnd: 0 }}
        />
      </svg>,
    )
    expect(markup).not.toContain('&nbsp;')
    expect(markup).toContain(
      '<line class="text-edit-caret" x1="10" y1="8" x2="10" y2="20">',
    )
  })
})
