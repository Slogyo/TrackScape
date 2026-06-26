import { describe, expect, it } from 'vitest'
import {
  getDefaultTrackDefinitionId,
  getTrackDefinition,
  isTrackDefinitionId,
  trackCatalog,
} from './trackCatalog'

describe('PECO track catalog', () => {
  it('includes official HO/OO, N, and O product families', () => {
    const peco = trackCatalog.filter(
      (definition) => definition.manufacturer === 'PECO',
    )

    expect(peco).toHaveLength(229)
    expect(new Set(peco.map((definition) => definition.gaugeId))).toEqual(
      new Set(['ho-oo', 'n', 'o']),
    )
    expect(
      peco.filter((definition) => definition.gaugeId === 'ho-oo'),
    ).toHaveLength(137)
    expect(
      peco.filter((definition) => definition.gaugeId === 'n'),
    ).toHaveLength(73)
    expect(
      peco.filter((definition) => definition.gaugeId === 'o'),
    ).toHaveLength(19)
  })

  it('preserves PECO product codes and technical geometry', () => {
    const mediumO = getTrackDefinition('peco-o-sl-e791bh')

    expect(mediumO).toMatchObject({
      productCode: 'SL-E791BH',
      gaugeId: 'o',
      railCode: 124,
      kind: 'turnout',
      lengthMm: 416,
      radiusMm: 1828,
      angleDegrees: 8,
      handedness: 'right',
      isPlaceable: true,
      technicalSpecifications: {
        Length: '416mm',
        'Frog Angle': '8 Degrees',
        Radius: '1828mm',
      },
    })
  })

  it('keeps official products visible when PECO omits placement geometry', () => {
    const unavailable = trackCatalog.filter(
      (definition) =>
        definition.manufacturer === 'PECO' && !definition.isPlaceable,
    )

    expect(unavailable).toEqual([
      expect.objectContaining({
        productCode: 'SL-113',
        name: expect.stringContaining('Transition Tracks'),
      }),
    ])
  })

  it('uses matching Setrack geometry for curved level crossings', () => {
    expect(getTrackDefinition('peco-ho-oo-st-261')).toMatchObject({
      kind: 'curve',
      radiusMm: 438,
      angleDegrees: 22.5,
      isPlaceable: true,
    })
  })

  it('preserves separate official route lengths', () => {
    expect(getTrackDefinition('peco-n-st-44')).toMatchObject({
      lengthMm: 138.5,
      routeLengthsMm: [138.5, 156],
      isPlaceable: true,
    })
  })

  it('recognizes turnout products whose title omits the type', () => {
    expect(getTrackDefinition('peco-n-sl-u395f')).toMatchObject({
      kind: 'turnout',
      lengthMm: 137,
      radiusMm: 457,
      angleDegrees: 10,
      handedness: 'right',
    })
  })

  it('treats both Y and Wye turnout names as symmetric', () => {
    expect(getTrackDefinition('peco-ho-oo-sl-98')).toMatchObject({
      handedness: 'symmetric',
    })
    expect(getTrackDefinition('peco-ho-oo-sl-8348')).toMatchObject({
      handedness: 'symmetric',
    })
  })

  it('normalizes complex product topology before geometry rendering', () => {
    expect(getTrackDefinition('peco-ho-oo-sl-86').topology).toBe(
      'curved-turnout',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-99').topology).toBe(
      'three-way-turnout',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-80').topology).toBe(
      'single-slip',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-90').topology).toBe(
      'double-slip',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-u1180').topology).toBe(
      'single-slip',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-u1190').topology).toBe(
      'double-slip',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-84').topology).toBe(
      'catch-turnout',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-e199').topology).toBe(
      'three-way-asymmetric-turnout',
    )
    expect(getTrackDefinition('peco-n-sl-e383f').topology).toBe(
      'scissors-crossing',
    )
    expect(getTrackDefinition('peco-ho-oo-sl-8356').detailType).toBe(
      'inspection-pit',
    )
  })

  it('keeps legacy IDs valid and chooses gauge-specific defaults', () => {
    expect(isTrackDefinitionId('straight-100')).toBe(true)
    expect(getDefaultTrackDefinitionId('ho-oo')).toContain('peco-ho-oo-')
    expect(getDefaultTrackDefinitionId('n')).toContain('peco-n-')
    expect(getDefaultTrackDefinitionId('o')).toBe('peco-o-st-700')
  })

  it('gives every PECO definition stable provenance and valid geometry', () => {
    const peco = trackCatalog.filter(
      (definition) => definition.manufacturer === 'PECO',
    )
    const ids = peco.map((definition) => definition.id)
    const gaugeProductCodes = peco.map(
      (definition) =>
        `${definition.gaugeId}:${definition.productCode}`,
    )

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(gaugeProductCodes).size).toBe(
      gaugeProductCodes.length,
    )

    for (const definition of peco) {
      expect(definition.id).toMatch(/^peco-(ho-oo|n|o)-/)
      expect(definition.productCode).toBeTruthy()
      expect(definition.sourceUrl).toMatch(
        /^https:\/\/peco-uk\.com\/products\//,
      )
      expect(definition.technicalSpecifications).toBeDefined()

      for (const value of [
        definition.lengthMm,
        definition.radiusMm,
        definition.angleDegrees,
        ...(definition.routeLengthsMm ?? []),
        ...(definition.radiiMm ?? []),
      ]) {
        if (value !== undefined) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThan(0)
        }
      }

      if (!definition.isPlaceable) {
        continue
      }

      if (definition.kind === 'curve') {
        expect(definition.radiusMm).toBeGreaterThan(0)
        expect(definition.angleDegrees).toBeGreaterThan(0)
      } else if (definition.kind !== 'turnout') {
        expect(definition.lengthMm).toBeGreaterThan(0)
      } else {
        expect(
          Boolean(definition.lengthMm) ||
            Boolean(
              definition.radiiMm?.length &&
                definition.angleDegrees,
            ),
        ).toBe(true)
      }
    }
  })
})
