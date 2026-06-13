import pecoCatalogSource from './pecoCatalog.source.json'
import type {
  LayoutScaleId,
  TrackDefinition,
  TrackDefinitionId,
  TrackGaugeId,
  TrackHandedness,
  TrackKind,
} from '../types'

interface PecoSourceProduct {
  gauge: Exclude<TrackGaugeId, 'generic'>
  gaugeMm: number
  productCode: string
  name: string
  productType: string
  railCode: number | null
  lengthMm: number | null
  routeLengthsMm: number[]
  radiusMm: number | null
  radiiMm: number[]
  angleDegrees: number | null
  frogType: string | null
  sourceUrl: string
  technicalSpecifications: Record<string, string>
}

const legacyTrackCatalog: TrackDefinition[] = [
  {
    id: 'straight-100',
    name: 'Straight 100',
    kind: 'straight',
    manufacturer: 'Generic',
    gaugeId: 'generic',
    isPlaceable: true,
    lengthMm: 100,
  },
  {
    id: 'straight-200',
    name: 'Straight 200',
    kind: 'straight',
    manufacturer: 'Generic',
    gaugeId: 'generic',
    isPlaceable: true,
    lengthMm: 200,
  },
  {
    id: 'curve-r300-30',
    name: 'Curve R300 / 30°',
    kind: 'curve',
    manufacturer: 'Generic',
    gaugeId: 'generic',
    isPlaceable: true,
    radiusMm: 300,
    radiiMm: [300],
    angleDegrees: 30,
  },
  {
    id: 'curve-r450-30',
    name: 'Curve R450 / 30°',
    kind: 'curve',
    manufacturer: 'Generic',
    gaugeId: 'generic',
    isPlaceable: true,
    radiusMm: 450,
    radiiMm: [450],
    angleDegrees: 30,
  },
]

const sourceProducts = (
  pecoCatalogSource as unknown as { products: PecoSourceProduct[] }
).products

const normalizePackName = (name: string) =>
  name.replace(/\s*\(Pack of \d+\)\s*$/i, '').trim()

const baseProductsByName = new Map(
  sourceProducts
    .filter((product) => !/\(Pack of \d+\)/i.test(product.name))
    .map((product) => [
      `${product.gauge}:${normalizePackName(product.name)}`,
      product,
    ]),
)

const withPackGeometry = (
  product: PecoSourceProduct,
): PecoSourceProduct => {
  const base = baseProductsByName.get(
    `${product.gauge}:${normalizePackName(product.name)}`,
  )
  if (!base || base === product) {
    return product
  }

  return {
    ...product,
    lengthMm: product.lengthMm ?? base.lengthMm,
    routeLengthsMm:
      product.routeLengthsMm.length > 0
        ? product.routeLengthsMm
        : base.routeLengthsMm,
    radiusMm: product.radiusMm ?? base.radiusMm,
    radiiMm:
      product.radiiMm.length > 0 ? product.radiiMm : base.radiiMm,
    angleDegrees: product.angleDegrees ?? base.angleDegrees,
  }
}

const applyKnownOfficialFamilyGeometry = (
  product: PecoSourceProduct,
): PecoSourceProduct => {
  if (product.productCode === 'ST-244' || product.productCode === 'ST-245') {
    return {
      ...product,
      radiusMm: 438,
      radiiMm: [438, 505],
      angleDegrees: product.angleDegrees ?? 11.25,
    }
  }

  if (
    ['ST-261', 'ST-263', 'ST-266', 'ST-267', 'ST-269'].includes(
      product.productCode,
    )
  ) {
    return {
      ...product,
      angleDegrees: product.angleDegrees ?? 22.5,
    }
  }

  return product
}

const getKind = (product: PecoSourceProduct): TrackKind => {
  const { name } = product
  if (/flexible track/i.test(name)) {
    return 'flex'
  }
  if (/level crossing/i.test(name)) {
    return product.radiusMm || product.radiiMm.length > 0
      ? 'curve'
      : 'straight'
  }
  if (
    /turnout|point/i.test(name) ||
    /turnout/i.test(product.sourceUrl)
  ) {
    return 'turnout'
  }
  if (/crossing|slip/i.test(name)) {
    return 'crossing'
  }
  if (/curve/i.test(name)) {
    return 'curve'
  }
  return 'straight'
}

const getHandedness = (name: string): TrackHandedness => {
  if (/left hand|\blh\b/i.test(name)) {
    return 'left'
  }
  if (/right hand|\brh\b/i.test(name)) {
    return 'right'
  }
  if (/\b(?:y|wye) turnout\b|3 way/i.test(name)) {
    return 'symmetric'
  }
  return null
}

const getDefinitionId = (product: PecoSourceProduct) =>
  `peco-${product.gauge}-${product.productCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`

const canPlace = (
  product: PecoSourceProduct,
  kind: TrackKind,
): boolean => {
  if (kind === 'curve') {
    return Boolean(product.radiusMm && product.angleDegrees)
  }
  if (kind === 'turnout') {
    return Boolean(
      product.lengthMm ||
        (product.radiiMm.length > 0 && product.angleDegrees),
    )
  }
  return Boolean(product.lengthMm)
}

const getRouteLengths = (
  product: PecoSourceProduct,
): number[] | undefined => {
  const values = Object.entries(product.technicalSpecifications)
    .filter(([label]) => /^(Length|Outer)$/i.test(label))
    .flatMap(([, value]) =>
      [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      ),
    )
    .filter((value) => Number.isFinite(value) && value > 0)

  return values.length > 1 ? [...new Set(values)] : undefined
}

const isTrackLibraryProduct = (product: PecoSourceProduct): boolean =>
  !/TPWS Grid|Way Gauge|Hayes Bumper|Platform/i.test(product.name)

const pecoTrackCatalog: TrackDefinition[] = sourceProducts
  .filter(isTrackLibraryProduct)
  .map(withPackGeometry)
  .map(applyKnownOfficialFamilyGeometry)
  .map((product) => {
    const kind = getKind(product)
    return {
      id: getDefinitionId(product),
      name: `${product.productCode} ${product.name}`,
      kind,
      manufacturer: 'PECO',
      productCode: product.productCode,
      gaugeId: product.gauge,
      gaugeMm: product.gaugeMm,
      productRange: product.productType,
      railCode: product.railCode ?? undefined,
      frogType: product.frogType,
      sourceUrl: product.sourceUrl,
      technicalSpecifications: product.technicalSpecifications,
      handedness: getHandedness(product.name),
      isPlaceable: canPlace(product, kind),
      lengthMm: product.lengthMm ?? undefined,
      routeLengthsMm:
        product.routeLengthsMm.length > 1
          ? product.routeLengthsMm
          : getRouteLengths(product),
      radiusMm: product.radiusMm ?? undefined,
      radiiMm:
        product.radiiMm.length > 0 ? product.radiiMm : undefined,
      angleDegrees: product.angleDegrees ?? undefined,
    } satisfies TrackDefinition
  })

export const trackCatalog: TrackDefinition[] = [
  ...pecoTrackCatalog,
  ...legacyTrackCatalog,
]

const trackCatalogById = new Map(
  trackCatalog.map((definition) => [definition.id, definition]),
)

export const getTrackDefinition = (
  definitionId: TrackDefinitionId,
): TrackDefinition =>
  trackCatalogById.get(definitionId) ?? legacyTrackCatalog[0]

export const isTrackDefinitionId = (
  value: unknown,
): value is TrackDefinitionId =>
  typeof value === 'string' && trackCatalogById.has(value)

export const layoutScaleToTrackGauge = (
  scale: LayoutScaleId,
): Exclude<TrackGaugeId, 'generic'> =>
  scale === 'n' ? 'n' : scale === 'o' ? 'o' : 'ho-oo'

export const getDefaultTrackDefinitionId = (
  gaugeId: Exclude<TrackGaugeId, 'generic'> = 'ho-oo',
): TrackDefinitionId => {
  const preferredCodes: Record<typeof gaugeId, string> = {
    'ho-oo': 'ST-200',
    n: 'ST-1',
    o: 'ST-700',
  }
  return (
    pecoTrackCatalog.find(
      (definition) =>
        definition.gaugeId === gaugeId &&
        definition.productCode === preferredCodes[gaugeId] &&
        definition.isPlaceable,
    ) ??
    pecoTrackCatalog.find(
      (definition) =>
        definition.gaugeId === gaugeId && definition.isPlaceable,
    ) ??
    legacyTrackCatalog[0]
  ).id
}
