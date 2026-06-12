import { getTrackDefinition, trackCatalog } from '../data/trackCatalog'
import type {
  LayoutScaleId,
  MeasurementSystem,
  TrackPlacementSettings,
} from '../types'
import { formatPrototypeLength } from '../utils/layoutScale'
import { getTrackLength } from '../utils/trackGeometry'
import { defaultUnitForSystem, formatMillimetres } from '../utils/units'

interface TrackPaletteProps {
  layoutScaleId: LayoutScaleId
  measurementSystem: MeasurementSystem
  settings: TrackPlacementSettings
  onChange: (settings: TrackPlacementSettings) => void
}

function TrackPalette({
  layoutScaleId,
  measurementSystem,
  settings,
  onChange,
}: TrackPaletteProps) {
  const definition = getTrackDefinition(settings.definitionId)
  const displayUnit = defaultUnitForSystem(measurementSystem)
  const previewObject = {
    id: 'palette-preview',
    type: 'track-piece' as const,
    layerId: 'track' as const,
    definitionId: definition.id,
    position: { x: 0, y: 0 },
    rotation: settings.rotation,
    direction: settings.direction,
  }

  return (
    <section
      className="object-properties track-palette"
      aria-labelledby="track-palette-heading"
    >
      <div className="properties-heading">
        <div>
          <span className="eyebrow">Track Tool</span>
          <h2 id="track-palette-heading">Track Pieces</h2>
        </div>
      </div>
      <div className="track-palette-content">
        <div className="track-piece-list">
          {trackCatalog.map((candidate) => (
            <button
              className={`track-piece-button ${
                candidate.id === settings.definitionId ? 'is-active' : ''
              }`}
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === settings.definitionId}
              onClick={() =>
                onChange({ ...settings, definitionId: candidate.id })
              }
            >
              <strong>{candidate.name}</strong>
              <span>
                {candidate.kind === 'straight'
                  ? formatMillimetres(candidate.lengthMm ?? 0, displayUnit)
                  : `${formatMillimetres(
                      candidate.radiusMm ?? 0,
                      displayUnit,
                    )} radius`}
              </span>
            </button>
          ))}
        </div>
        <div className="track-palette-controls">
          <span className="status-label">Rotation</span>
          <div className="track-control-row">
            <button
              type="button"
              aria-label="Rotate track left 15 degrees"
              onClick={() =>
                onChange({
                  ...settings,
                  rotation: (settings.rotation + 345) % 360,
                })
              }
            >
              -15°
            </button>
            <strong>{settings.rotation}°</strong>
            <button
              type="button"
              aria-label="Rotate track right 15 degrees"
              onClick={() =>
                onChange({
                  ...settings,
                  rotation: (settings.rotation + 15) % 360,
                })
              }
            >
              +15°
            </button>
          </div>
          {definition.kind === 'curve' && (
            <button
              className="track-flip-button"
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  direction:
                    settings.direction === 'left' ? 'right' : 'left',
                })
              }
            >
              Flip curve: {settings.direction}
            </button>
          )}
        </div>
        <dl className="properties-summary track-palette-summary">
          <div>
            <dt>Length</dt>
            <dd>
              {formatMillimetres(getTrackLength(previewObject), displayUnit)}
            </dd>
          </div>
          <div>
            <dt>Prototype length</dt>
            <dd>
              {formatPrototypeLength(
                getTrackLength(previewObject),
                layoutScaleId,
                measurementSystem,
              )}
            </dd>
          </div>
          {definition.kind === 'curve' && (
            <>
              <div>
                <dt>Radius</dt>
                <dd>
                  {formatMillimetres(
                    definition.radiusMm ?? 0,
                    displayUnit,
                  )}
                </dd>
              </div>
              <div>
                <dt>Prototype radius</dt>
                <dd>
                  {formatPrototypeLength(
                    definition.radiusMm ?? 0,
                    layoutScaleId,
                    measurementSystem,
                  )}
                </dd>
              </div>
              <div>
                <dt>Angle</dt>
                <dd>{definition.angleDegrees}°</dd>
              </div>
            </>
          )}
        </dl>
        <p className="properties-notice">
          [ / ] rotate · F flips curves · Esc clears preview
        </p>
      </div>
    </section>
  )
}

export default TrackPalette
