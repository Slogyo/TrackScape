import { useEffect, useMemo, useState } from 'react'
import {
  getDefaultTrackDefinitionId,
  getTrackDefinition,
  layoutScaleToTrackGauge,
  trackCatalog,
} from '../data/trackCatalog'
import type {
  LayoutScaleId,
  MeasurementSystem,
  TrackDefinition,
  TrackGaugeId,
  TrackManufacturer,
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

const gaugeLabels: Record<Exclude<TrackGaugeId, 'generic'>, string> = {
  'ho-oo': 'HO / OO (16.5 mm)',
  n: 'N (9 mm)',
  o: 'O (32 mm)',
}

type TrackLibraryManufacturer = Exclude<TrackManufacturer, 'Generic'>

const manufacturerLabels: Record<TrackLibraryManufacturer, string> = {
  PECO: 'PECO',
}

const directionForDefinition = (
  definition: TrackDefinition,
  current: TrackPlacementSettings['direction'],
) =>
  definition.handedness === 'left' ||
  definition.handedness === 'right'
    ? definition.handedness
    : current

function TrackPalette({
  layoutScaleId,
  measurementSystem,
  settings,
  onChange,
}: TrackPaletteProps) {
  const definition = getTrackDefinition(settings.definitionId)
  const [manufacturer, setManufacturer] =
    useState<TrackLibraryManufacturer>(
      definition.manufacturer === 'Generic'
        ? 'PECO'
        : definition.manufacturer,
    )
  const [gaugeId, setGaugeId] = useState<
    Exclude<TrackGaugeId, 'generic'>
  >(
    definition.gaugeId === 'generic'
      ? layoutScaleToTrackGauge(layoutScaleId)
      : definition.gaugeId,
  )
  const [range, setRange] = useState('all')
  const [query, setQuery] = useState('')
  const displayUnit = defaultUnitForSystem(measurementSystem)
  const manufacturerDefinitions = useMemo(
    () =>
      trackCatalog.filter(
        (candidate) => candidate.manufacturer === manufacturer,
      ),
    [manufacturer],
  )
  const availableGaugeIds = useMemo(
    () =>
      [...new Set(
        manufacturerDefinitions
          .map((candidate) => candidate.gaugeId)
          .filter(
            (
              candidate,
            ): candidate is Exclude<TrackGaugeId, 'generic'> =>
              candidate !== 'generic',
          ),
      )],
    [manufacturerDefinitions],
  )
  const gaugeDefinitions = useMemo(
    () =>
      manufacturerDefinitions.filter(
        (candidate) => candidate.gaugeId === gaugeId,
      ),
    [gaugeId, manufacturerDefinitions],
  )
  const ranges = useMemo(
    () =>
      [...new Set(
        gaugeDefinitions.map(
          (candidate) => candidate.productRange ?? 'Other',
        ),
      )].sort(),
    [gaugeDefinitions],
  )
  const filteredDefinitions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return gaugeDefinitions.filter(
      (candidate) =>
        (range === 'all' ||
          (candidate.productRange ?? 'Other') === range) &&
        (!normalizedQuery ||
          `${candidate.productCode} ${candidate.name}`
            .toLowerCase()
            .includes(normalizedQuery)),
    )
  }, [gaugeDefinitions, query, range])
  const previewObject = {
    id: 'palette-preview',
    type: 'track-piece' as const,
    layerId: 'track' as const,
    definitionId: definition.id,
    position: { x: 0, y: 0 },
    rotation: settings.rotation,
    direction: settings.direction,
  }
  const radii = definition.radiiMm ?? (
    definition.radiusMm ? [definition.radiusMm] : []
  )

  useEffect(() => {
    if (
      definition.manufacturer !== 'Generic' &&
      definition.gaugeId !== 'generic' &&
      (definition.manufacturer !== manufacturer ||
        definition.gaugeId !== gaugeId)
    ) {
      setManufacturer(definition.manufacturer)
      setGaugeId(definition.gaugeId)
      setRange('all')
      setQuery('')
    }
  }, [
    definition.gaugeId,
    definition.manufacturer,
    gaugeId,
    manufacturer,
  ])

  const chooseDefinition = (candidate: TrackDefinition) => {
    if (!candidate.isPlaceable) {
      return
    }
    onChange({
      ...settings,
      definitionId: candidate.id,
      direction: directionForDefinition(candidate, settings.direction),
    })
  }

  const chooseGauge = (nextGauge: Exclude<TrackGaugeId, 'generic'>) => {
    setGaugeId(nextGauge)
    setRange('all')
    setQuery('')
    const preferredDefinition = getTrackDefinition(
      getDefaultTrackDefinitionId(nextGauge),
    )
    const nextDefinition =
      preferredDefinition.manufacturer === manufacturer
        ? preferredDefinition
        : manufacturerDefinitions.find(
            (candidate) =>
              candidate.gaugeId === nextGauge &&
              candidate.isPlaceable,
          )

    if (nextDefinition) {
      chooseDefinition(nextDefinition)
    }
  }

  const chooseManufacturer = (
    nextManufacturer: TrackLibraryManufacturer,
  ) => {
    setManufacturer(nextManufacturer)
    setRange('all')
    setQuery('')

    const nextDefinition =
      trackCatalog.find(
        (candidate) =>
          candidate.manufacturer === nextManufacturer &&
          candidate.gaugeId === gaugeId &&
          candidate.isPlaceable,
      ) ??
      trackCatalog.find(
        (candidate) =>
          candidate.manufacturer === nextManufacturer &&
          candidate.isPlaceable,
      )

    if (
      nextDefinition &&
      nextDefinition.gaugeId !== 'generic'
    ) {
      setGaugeId(nextDefinition.gaugeId)
      chooseDefinition(nextDefinition)
    }
  }

  return (
    <section
      className="object-properties track-palette"
      aria-labelledby="track-palette-heading"
    >
      <div className="properties-heading">
        <div>
          <span className="eyebrow">Track Library</span>
          <h2 id="track-palette-heading">Track Pieces</h2>
        </div>
      </div>
      <div className="track-palette-content">
        <div className="track-library-filters">
          <label className="track-brand-field">
            <span className="status-label">Brand</span>
            <select
              value={manufacturer}
              onChange={(event) =>
                chooseManufacturer(
                  event.target.value as TrackLibraryManufacturer,
                )
              }
            >
              {Object.entries(manufacturerLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="status-label">Gauge</span>
            <select
              value={gaugeId}
              onChange={(event) =>
                chooseGauge(
                  event.target.value as Exclude<TrackGaugeId, 'generic'>,
                )
              }
            >
              {availableGaugeIds.map((id) => (
                <option key={id} value={id}>
                  {gaugeLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="status-label">Range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="all">All ranges</option>
              {ranges.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
          <label className="track-search-field">
            <span className="status-label">Find product</span>
            <input
              type="search"
              value={query}
              placeholder="Code or name"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="track-piece-list">
          {filteredDefinitions.map((candidate) => {
            const candidateRadii = candidate.radiiMm ?? (
              candidate.radiusMm ? [candidate.radiusMm] : []
            )
            return (
              <button
                className={`track-piece-button ${
                  candidate.id === settings.definitionId ? 'is-active' : ''
                }`}
                key={candidate.id}
                type="button"
                aria-pressed={candidate.id === settings.definitionId}
                disabled={!candidate.isPlaceable}
                title={
                  candidate.isPlaceable
                    ? candidate.name
                    : `${manufacturer} does not publish enough geometry to place this item.`
                }
                onClick={() => chooseDefinition(candidate)}
              >
                <strong>{candidate.name}</strong>
                <span>
                  {candidateRadii.length > 0
                    ? `R${candidateRadii.join('/')} mm`
                    : candidate.lengthMm
                      ? formatMillimetres(
                          candidate.lengthMm,
                          displayUnit,
                        )
                      : 'Specification unavailable'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="track-library-count">
          {filteredDefinitions.length} {manufacturer} products
        </p>
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
          {definition.kind === 'curve' &&
            !definition.handedness && (
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
            <dt>Product</dt>
            <dd>{definition.productCode ?? definition.name}</dd>
          </div>
          <div>
            <dt>
              {definition.routeLengthsMm?.length
                ? 'Max length'
                : 'Length'}
            </dt>
            <dd>
              {formatMillimetres(getTrackLength(previewObject), displayUnit)}
            </dd>
          </div>
          {definition.routeLengthsMm?.length && (
            <div>
              <dt>Route lengths</dt>
              <dd>
                {definition.routeLengthsMm
                  .map((length) =>
                    formatMillimetres(length, displayUnit),
                  )
                  .join(' / ')}
              </dd>
            </div>
          )}
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
          {radii.length > 0 && (
            <>
              <div>
                <dt>Radius</dt>
                <dd>R{radii.join('/')} mm</dd>
              </div>
              <div>
                <dt>Prototype radius</dt>
                <dd>
                  {radii
                    .map((radius) =>
                      formatPrototypeLength(
                        radius,
                        layoutScaleId,
                        measurementSystem,
                      ),
                    )
                    .join(' / ')}
                </dd>
              </div>
            </>
          )}
          {definition.angleDegrees && (
            <div>
              <dt>Angle</dt>
              <dd>{definition.angleDegrees}°</dd>
            </div>
          )}
          {definition.railCode && (
            <div>
              <dt>Rail</dt>
              <dd>Code {definition.railCode}</dd>
            </div>
          )}
          {definition.frogType && (
            <div>
              <dt>Frog</dt>
              <dd>{definition.frogType}</dd>
            </div>
          )}
        </dl>
        {definition.sourceUrl && (
          <a
            className="track-source-link"
            href={definition.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            View official PECO product
          </a>
        )}
        <p className="properties-notice">
          R or [ / ] rotate · R cycles the joined end · Shift places freely
        </p>
      </div>
    </section>
  )
}

export default TrackPalette
