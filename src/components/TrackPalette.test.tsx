import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TrackPalette from './TrackPalette'

describe('TrackPalette', () => {
  it('shows the brand selector above gauge and range filters', () => {
    const markup = renderToStaticMarkup(
      <TrackPalette
        layoutScaleId="ho"
        measurementSystem="metric"
        settings={{
          definitionId: 'peco-ho-oo-st-200',
          rotation: 0,
          direction: 'right',
        }}
        onChange={() => undefined}
      />,
    )

    const brandIndex = markup.indexOf('>Brand<')
    const gaugeIndex = markup.indexOf('>Gauge<')
    const rangeIndex = markup.indexOf('>Range<')

    expect(markup).toContain('<option value="PECO" selected="">PECO</option>')
    expect(brandIndex).toBeGreaterThan(-1)
    expect(brandIndex).toBeLessThan(gaugeIndex)
    expect(gaugeIndex).toBeLessThan(rangeIndex)
  })
})
