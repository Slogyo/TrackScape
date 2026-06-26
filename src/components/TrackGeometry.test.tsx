import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TrackPieceObject } from '../types'
import TrackGeometry from './TrackGeometry'

describe('TrackGeometry', () => {
  it('renders published PECO radius text with the SVG geometry', () => {
    const object: TrackPieceObject = {
      id: 'track-o-turnout',
      type: 'track-piece',
      layerId: 'track',
      definitionId: 'peco-o-sl-e791bh',
      position: { x: 1000, y: 1000 },
      rotation: 0,
      direction: 'right',
    }

    const markup = renderToStaticMarkup(
      <svg>
        <TrackGeometry
          className="track-object is-selected"
          dataObjectId={object.id}
          object={object}
        />
      </svg>,
    )

    expect(markup).toContain('class="track-radius-label"')
    expect(markup).toContain('R1828 mm')
    expect(markup).toContain('data-object-id="track-o-turnout"')
    expect(markup).toContain('class="track-stock-rail"')
    expect(markup).toContain('class="track-closure-rail"')
    expect(markup).toContain('class="track-sleeper"')
    expect(markup).toContain('class="track-interaction-border"')
    expect(markup).not.toContain('track-bed')
  })
})
