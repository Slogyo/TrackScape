import { describe, expect, it } from 'vitest'
import type { TrackPieceObject } from '../types'
import { trackCatalog } from '../data/trackCatalog'
import { buildProceduralTrackGeometry } from './proceduralTrack'
import {
  getTrackConnectors,
  getTrackLocalGeometry,
} from './trackGeometry'

const piece = (
  definitionId: string,
  direction: TrackPieceObject['direction'] = 'right',
): TrackPieceObject => ({
  id: definitionId,
  type: 'track-piece',
  layerId: 'track',
  definitionId,
  position: { x: 0, y: 0 },
  rotation: 0,
  direction,
})

describe('procedural track rendering', () => {
  it('generates gauge-spaced rails and sleepers for a straight', () => {
    const geometry = buildProceduralTrackGeometry(piece('straight-200'))

    expect(geometry.rails).toHaveLength(2)
    expect(geometry.sleepers.length).toBeGreaterThan(10)
    expect(geometry.gaugeMm).toBe(16.5)
    expect(geometry.bounds.minY).toBeLessThan(0)
    expect(geometry.bounds.maxY).toBeGreaterThan(0)
  })

  it('generates stock routes, switch rails, frogs, and guards for turnouts', () => {
    const geometry = buildProceduralTrackGeometry(
      piece('peco-o-sl-e791bh'),
    )

    expect(geometry.routes).toHaveLength(2)
    expect(geometry.rails).toHaveLength(4)
    expect(
      geometry.rails.filter((rail) => rail.kind === 'stock-rail'),
    ).toHaveLength(2)
    expect(
      geometry.rails.filter((rail) => rail.kind === 'closure-rail'),
    ).toHaveLength(2)
    expect(geometry.sleepers.length).toBeLessThan(35)
    expect(
      geometry.details.some((detail) => detail.kind === 'switch-rail'),
    ).toBe(true)
    expect(
      geometry.details.some((detail) => detail.kind === 'frog'),
    ).toBe(true)
    expect(
      geometry.details.some((detail) => detail.kind === 'guard-rail'),
    ).toBe(true)
  })

  it('generates both routes and check rails for crossings', () => {
    const geometry = buildProceduralTrackGeometry(
      piece('peco-ho-oo-sl-93'),
    )

    expect(geometry.routes).toHaveLength(2)
    expect(geometry.rails).toHaveLength(4)
    expect(geometry.details).toHaveLength(4)
  })

  it('adds one or two procedural slip routes without extra connectors', () => {
    const single = buildProceduralTrackGeometry(
      piece('peco-ho-oo-sl-80'),
    )
    const double = buildProceduralTrackGeometry(
      piece('peco-ho-oo-sl-90'),
    )

    expect(
      single.details.filter(
        (detail) => detail.kind === 'switch-rail',
      ),
    ).toHaveLength(2)
    expect(
      double.details.filter(
        (detail) => detail.kind === 'switch-rail',
      ),
    ).toHaveLength(4)
  })

  it('generates four route paths for a scissors crossing', () => {
    const geometry = buildProceduralTrackGeometry(
      piece('peco-n-sl-e383f'),
    )

    expect(geometry.routes).toHaveLength(4)
    expect(geometry.rails).toHaveLength(8)
  })

  it('generates inspection-pit edges and transverse steps', () => {
    const geometry = buildProceduralTrackGeometry(
      piece('peco-ho-oo-sl-8356'),
    )

    expect(
      geometry.details.filter((detail) => detail.kind === 'pit-edge')
        .length,
    ).toBeGreaterThan(10)
    expect(geometry.sleepers).toHaveLength(0)
    expect(geometry.areas).toEqual([
      expect.objectContaining({ kind: 'inspection-pit-floor' }),
    ])
  })

  it('adds a procedural deck to straight and curved level crossings', () => {
    const straight = buildProceduralTrackGeometry(
      piece('peco-ho-oo-st-268'),
    )
    const curved = buildProceduralTrackGeometry(
      piece('peco-ho-oo-st-261'),
    )

    expect(straight.areas).toEqual([
      expect.objectContaining({ kind: 'level-crossing-deck' }),
    ])
    expect(curved.areas).toEqual([
      expect.objectContaining({ kind: 'level-crossing-deck' }),
    ])
    expect(straight.bounds.minY).toBeLessThan(
      -straight.gaugeMm * 1.35,
    )
    expect(straight.bounds.maxY).toBeGreaterThan(
      straight.gaugeMm * 1.35,
    )
  })

  it('produces valid topology and geometry for every placeable catalog item', () => {
    const placeable = trackCatalog.filter(
      (definition) => definition.isPlaceable,
    )

    for (const definition of placeable) {
      const object = piece(definition.id)
      const local = getTrackLocalGeometry(object)
      const connectors = getTrackConnectors(object)
      const procedural = buildProceduralTrackGeometry(object)
      const expectedConnectorCount =
        definition.kind === 'turnout'
          ? definition.topology === 'catch-turnout'
            ? 2
            : definition.topology === 'three-way-turnout' ||
                definition.topology === 'three-way-asymmetric-turnout'
              ? 4
              : 3
          : definition.kind === 'crossing'
            ? 4
            : 2

      expect(
        local.routes.length,
        `${definition.id} should expose routes`,
      ).toBeGreaterThan(0)
      expect(
        connectors.length,
        `${definition.id} connector count`,
      ).toBe(expectedConnectorCount)
      expect(
        procedural.rails.length,
        `${definition.id} should render rails`,
      ).toBeGreaterThanOrEqual(2)
      if (definition.detailType !== 'inspection-pit') {
        expect(
          procedural.sleepers.length,
          `${definition.id} should render sleepers`,
        ).toBeGreaterThan(0)
      }

      for (const route of local.routes) {
        expect(
          route.lengthMm,
          `${definition.id}/${route.id} route length`,
        ).toBeGreaterThan(0)
        for (const point of route.points) {
          expect(Number.isFinite(point.x)).toBe(true)
          expect(Number.isFinite(point.y)).toBe(true)
        }
      }
      for (const connector of connectors) {
        expect(Number.isFinite(connector.position.x)).toBe(true)
        expect(Number.isFinite(connector.position.y)).toBe(true)
        expect(Number.isFinite(connector.heading)).toBe(true)
      }
      for (const path of [
        ...procedural.areas,
        ...procedural.rails,
        ...procedural.details,
      ]) {
        expect(path.path).not.toMatch(/NaN|Infinity/)
      }
      for (const value of Object.values(procedural.bounds)) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(procedural.bounds.maxX).toBeGreaterThan(
        procedural.bounds.minX,
      )
      expect(procedural.bounds.maxY).toBeGreaterThan(
        procedural.bounds.minY,
      )
    }
  })
})
