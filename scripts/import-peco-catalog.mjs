import { writeFile } from 'node:fs/promises'

const gauges = [
  { id: 'ho-oo', tag: 'oo-ho-16-5mm', gaugeMm: 16.5 },
  { id: 'n', tag: 'n-9mm', gaugeMm: 9 },
  { id: 'o', tag: 'o-32mm', gaugeMm: 32 },
]
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const parseTagValue = (tags, prefix) => {
  const tag = tags.find((candidate) => candidate.startsWith(prefix))
  return tag ? tag.slice(prefix.length).trim() : null
}

const toNumber = (value) => {
  if (value === null || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const decodeHtml = (value) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&deg;', '°')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')

const stripHtml = (value) =>
  decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

const extractTechnicalSpecifications = (html) => {
  const section = html.match(
    /Technical Specification:<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i,
  )?.[1]
  if (!section) {
    return {}
  }

  return Object.fromEntries(
    [...section.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
      .map((match) => stripHtml(match[1]))
      .map((line) => {
        const separator = line.indexOf(':')
        return separator === -1
          ? null
          : [
              line.slice(0, separator).trim(),
              line.slice(separator + 1).trim(),
            ]
      })
      .filter(Boolean),
  )
}

const numbersFromSpecification = (specifications, keyPattern) => {
  const entry = Object.entries(specifications).find(([key]) =>
    keyPattern.test(key),
  )
  return entry
    ? [...entry[1].matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      )
    : []
}

const numbersFromSpecifications = (specifications, keyPattern) =>
  Object.entries(specifications)
    .filter(([key]) => keyPattern.test(key))
    .flatMap(([, value]) =>
      [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      ),
    )

const isPlaceableTrack = (product) => {
  const tags = product.tags.map((tag) => tag.toLowerCase())
  const sku = product.variants?.[0]?.sku ?? ''

  return (
    tags.includes('track') &&
    /^S[LT]-/i.test(sku) &&
    !/(ballast inlay|decoupler|way gauge|joiner|pin|nail|rail only|tracksetta|switch|motor|wiring|terminal|buffer stop|uncoupler|aws ramp|power connecting|re-railer|starter track set)/i.test(
      product.title,
    ) &&
    !/(TPWS Grid|Hayes Bumper|Platform)/i.test(product.title)
  )
}

const normalizeProduct = (product, gauge) => {
  const tags = product.tags
  const sku = product.variants?.[0]?.sku ?? ''

  return {
    gauge: gauge.id,
    gaugeMm: gauge.gaugeMm,
    productCode: sku,
    name: product.title,
    handle: product.handle,
    productType: product.product_type,
    railCode: toNumber(
      tags.find((tag) => /^\d+$/.test(tag)) ?? null,
    ),
    lengthMm: toNumber(parseTagValue(tags, 'Dimension L mm:')),
    radiusMm: toNumber(parseTagValue(tags, 'Radius:')),
    radiiMm: [],
    angleDegrees: toNumber(parseTagValue(tags, 'Angle:')),
    frogType:
      tags.find((tag) =>
        ['electrofrog', 'insulfrog', 'unifrog'].includes(
          tag.toLowerCase(),
        ),
      ) ?? null,
    sourceUrl: `https://peco-uk.com/products/${product.handle}`,
  }
}

const enrichFromProductPage = async (product) => {
  let response
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(product.sourceUrl, {
      headers: { 'user-agent': 'TrackScape catalog importer' },
    })
    if (response.status !== 429) {
      break
    }
    await sleep(1000 * 2 ** attempt)
  }

  if (!response?.ok) {
    throw new Error(
      `PECO product request failed: ${response?.status} ${product.sourceUrl}`,
    )
  }

  const specifications = extractTechnicalSpecifications(
    await response.text(),
  )
  const lengths = numbersFromSpecification(specifications, /^Length$/i)
  const routeLengths = numbersFromSpecifications(
    specifications,
    /^(Length|Outer)$/i,
  )
  const radii = numbersFromSpecification(specifications, /Radius/i)
  const angles = numbersFromSpecification(specifications, /Angle/i)

  return {
    ...product,
    lengthMm: lengths[0] ?? product.lengthMm,
    routeLengthsMm:
      routeLengths.length > 1
        ? [...new Set(routeLengths)]
        : [],
    radiusMm:
      radii[0] ??
      (product.radiusMm && product.radiusMm < 100_000
        ? product.radiusMm
        : null),
    radiiMm:
      radii.length > 0
        ? radii
        : product.radiusMm && product.radiusMm < 100_000
          ? [product.radiusMm]
          : [],
    angleDegrees: angles[0] ?? product.angleDegrees,
    technicalSpecifications: specifications,
  }
}

const products = []

for (let page = 1; ; page += 1) {
  const url = `https://peco-uk.com/collections/track/products.json?limit=250&page=${page}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `PECO catalog request failed: ${response.status} ${url}`,
    )
  }

  const data = await response.json()
  for (const product of data.products.filter(isPlaceableTrack)) {
    const normalizedTags = product.tags.map((tag) => tag.toLowerCase())
    for (const gauge of gauges.filter((candidate) =>
      normalizedTags.includes(candidate.tag),
    )) {
      products.push(normalizeProduct(product, gauge))
    }
  }

  if (data.products.length < 250) {
    break
  }
}

products.sort((first, second) =>
  `${first.gauge}-${first.productCode}`.localeCompare(
    `${second.gauge}-${second.productCode}`,
    'en',
    { numeric: true },
  ),
)

const enrichedProducts = []
for (const product of products) {
  enrichedProducts.push(await enrichFromProductPage(product))
  await sleep(250)
}

await writeFile(
  new URL('../src/data/pecoCatalog.source.json', import.meta.url),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'https://peco-uk.com/pages/peco-products',
      products: enrichedProducts,
    },
    null,
    2,
  )}\n`,
)

console.log(`Imported ${enrichedProducts.length} PECO track products.`)
