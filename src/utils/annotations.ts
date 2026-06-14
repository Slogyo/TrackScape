import type {
  CanvasObject,
  MeasurementAnchor,
  MeasurementObject,
  Point,
  TextObject,
} from '../types'
import type { Bounds } from './canvas'
import { getTrackConnectors, screenPixelsToMillimetres } from './trackGeometry'

export const MEASUREMENT_SNAP_RADIUS_PX = 18
export const DEFAULT_MEASUREMENT_OFFSET_MM = 180
export const DEFAULT_TEXT_SIZE_MM = 120
export const TEXT_LINE_HEIGHT_FACTOR = 1.2
export const TEXT_WIDTH_FACTOR = 0.58
export const TEXT_EDITING_MIN_CHARACTERS = 2

export type TextWidthMeasure = (text: string, fontSizeMm: number) => number

export interface TextLayoutLine {
  text: string
  width: number
  startIndex: number
}

export interface TextLayout {
  lines: TextLayoutLine[]
  origin: Point
  width: number
  height: number
  fontSize: number
  lineHeight: number
  bounds: Bounds
}

let textMeasureCanvas: HTMLCanvasElement | null = null

export const measureTextLineWidth: TextWidthMeasure = (text, fontSizeMm) => {
  if (!text) return 0
  if (typeof document === 'undefined') {
    return text.length * fontSizeMm * TEXT_WIDTH_FACTOR
  }
  textMeasureCanvas ??= document.createElement('canvas')
  const context = textMeasureCanvas.getContext('2d')
  if (!context) {
    return text.length * fontSizeMm * TEXT_WIDTH_FACTOR
  }
  context.font = `${fontSizeMm / 10}px "Unica77", "Helvetica Neue", Arial, sans-serif`
  return context.measureText(text).width * 10
}

const rotatePoint = (point: Point, pivot: Point, radians: number): Point => {
  const x = point.x - pivot.x
  const y = point.y - pivot.y
  return {
    x: pivot.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: pivot.y + x * Math.sin(radians) + y * Math.cos(radians),
  }
}

export const getTextLayout = (
  object: TextObject,
  measure: TextWidthMeasure = measureTextLineWidth,
  minimumCharacters = 1,
): TextLayout => {
  const rawLines = object.text.split('\n')
  let startIndex = 0
  const lines = rawLines.map((text) => {
    const line = {
      text,
      width: measure(text, object.fontSizeMm),
      startIndex,
    }
    startIndex += text.length + 1
    return line
  })
  const minimumWidth = measure(
    'M'.repeat(Math.max(minimumCharacters, 1)),
    object.fontSizeMm,
  )
  const width = Math.max(...lines.map((line) => line.width), minimumWidth)
  const lineHeight = object.fontSizeMm * TEXT_LINE_HEIGHT_FACTOR
  const height = Math.max(lines.length, 1) * lineHeight
  const origin = {
    x: object.position.x,
    y: object.position.y - object.fontSizeMm,
  }
  const radians = (object.rotation * Math.PI) / 180
  const corners = [
    origin,
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + height },
    { x: origin.x, y: origin.y + height },
  ].map((point) => rotatePoint(point, object.position, radians))
  const bounds = {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  }
  return {
    lines,
    origin,
    width,
    height,
    fontSize: object.fontSizeMm,
    lineHeight,
    bounds,
  }
}

export const getTextCaretPosition = (
  object: TextObject,
  caretIndex: number,
  measure: TextWidthMeasure = measureTextLineWidth,
): Point => {
  const layout = getTextLayout(object, measure, TEXT_EDITING_MIN_CHARACTERS)
  const clampedIndex = Math.max(0, Math.min(caretIndex, object.text.length))
  const line =
    [...layout.lines]
      .reverse()
      .find((candidate) => candidate.startIndex <= clampedIndex) ??
    layout.lines[0]
  const column = Math.min(
    clampedIndex - line.startIndex,
    line.text.length,
  )
  const lineIndex = layout.lines.indexOf(line)
  return {
    x:
      layout.origin.x +
      measure(line.text.slice(0, column), object.fontSizeMm),
    y: layout.origin.y + lineIndex * layout.lineHeight,
  }
}

export const getTextCaretIndexAtPoint = (
  object: TextObject,
  point: Point,
  measure: TextWidthMeasure = measureTextLineWidth,
): number => {
  const layout = getTextLayout(object, measure, TEXT_EDITING_MIN_CHARACTERS)
  const radians = (-object.rotation * Math.PI) / 180
  const localPoint = rotatePoint(point, object.position, radians)
  const lineIndex = Math.max(
    0,
    Math.min(
      layout.lines.length - 1,
      Math.floor((localPoint.y - layout.origin.y) / layout.lineHeight),
    ),
  )
  const line = layout.lines[lineIndex]
  const localX = Math.max(0, localPoint.x - layout.origin.x)
  let bestColumn = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let column = 0; column <= line.text.length; column += 1) {
    const width = measure(
      line.text.slice(0, column),
      object.fontSizeMm,
    )
    const distance = Math.abs(localX - width)
    if (distance < bestDistance) {
      bestDistance = distance
      bestColumn = column
    }
  }
  return Math.min(line.startIndex + bestColumn, object.text.length)
}

const pointDistance = (first: Point, second: Point) =>
  Math.hypot(second.x - first.x, second.y - first.y)

export interface ObjectAnchor {
  objectId: string
  anchorId: string
  point: Point
}

const rectangularAnchors = (
  object: Extract<CanvasObject, { type: 'rectangle' | 'room' | 'tabletop' }>,
): ObjectAnchor[] => {
  const x2 = object.x + object.width
  const y2 = object.y + object.height
  const cx = object.x + object.width / 2
  const cy = object.y + object.height / 2
  return [
    ['top-left', object.x, object.y],
    ['top', cx, object.y],
    ['top-right', x2, object.y],
    ['right', x2, cy],
    ['bottom-right', x2, y2],
    ['bottom', cx, y2],
    ['bottom-left', object.x, y2],
    ['left', object.x, cy],
  ].map(([anchorId, x, y]) => ({
    objectId: object.id,
    anchorId: String(anchorId),
    point: { x: Number(x), y: Number(y) },
  }))
}

export const getObjectAnchors = (object: CanvasObject): ObjectAnchor[] => {
  if (object.type === 'line') {
    return [
      { objectId: object.id, anchorId: 'start', point: object.start },
      { objectId: object.id, anchorId: 'end', point: object.end },
    ]
  }
  if (
    object.type === 'rectangle' ||
    object.type === 'room' ||
    object.type === 'tabletop'
  ) {
    return rectangularAnchors(object)
  }
  if (object.type === 'track-piece') {
    return getTrackConnectors(object).map((connector) => ({
      objectId: object.id,
      anchorId: connector.connectorId,
      point: connector.position,
    }))
  }
  return []
}

export const getAllObjectAnchors = (objects: CanvasObject[]): ObjectAnchor[] =>
  objects.flatMap(getObjectAnchors)

export const findNearestObjectAnchor = (
  point: Point,
  objects: CanvasObject[],
  zoom: number,
): ObjectAnchor | null => {
  const maximumDistance = screenPixelsToMillimetres(
    MEASUREMENT_SNAP_RADIUS_PX,
    zoom,
  )
  let nearest: ObjectAnchor | null = null
  let nearestDistance = maximumDistance
  for (const anchor of getAllObjectAnchors(objects)) {
    const distance = pointDistance(point, anchor.point)
    if (distance <= nearestDistance) {
      nearest = anchor
      nearestDistance = distance
    }
  }
  return nearest
}

export const createFixedAnchor = (point: Point): MeasurementAnchor => ({
  kind: 'fixed',
  point: { ...point },
})

export const createObjectAnchor = (anchor: ObjectAnchor): MeasurementAnchor => ({
  kind: 'object',
  objectId: anchor.objectId,
  anchorId: anchor.anchorId,
  point: { ...anchor.point },
})

export const resolveMeasurementAnchor = (
  anchor: MeasurementAnchor,
  objects: CanvasObject[],
): Point => {
  if (anchor.kind === 'fixed') return anchor.point
  const object = objects.find((candidate) => candidate.id === anchor.objectId)
  const resolved = object
    ? getObjectAnchors(object).find(
        (candidate) => candidate.anchorId === anchor.anchorId,
      )
    : null
  return resolved?.point ?? anchor.point
}

export const resolveMeasurement = (
  object: MeasurementObject,
  objects: CanvasObject[],
) => ({
  start: resolveMeasurementAnchor(object.start, objects),
  end: resolveMeasurementAnchor(object.end, objects),
})

export const getMeasurementLayout = (
  object: MeasurementObject,
  objects: CanvasObject[],
) => {
  const { start, end } = resolveMeasurement(object, objects)
  const length = pointDistance(start, end)
  const tangent =
    length === 0
      ? { x: 1, y: 0 }
      : { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
  const normal = { x: -tangent.y, y: tangent.x }
  const dimensionStart = {
    x: start.x + normal.x * object.offset,
    y: start.y + normal.y * object.offset,
  }
  const dimensionEnd = {
    x: end.x + normal.x * object.offset,
    y: end.y + normal.y * object.offset,
  }
  return {
    start,
    end,
    dimensionStart,
    dimensionEnd,
    label: {
      x: (dimensionStart.x + dimensionEnd.x) / 2,
      y: (dimensionStart.y + dimensionEnd.y) / 2,
    },
    length,
    normal,
  }
}

export const getMeasurementBounds = (
  object: MeasurementObject,
  objects: CanvasObject[],
): Bounds => {
  const layout = getMeasurementLayout(object, objects)
  const points = [
    layout.start,
    layout.end,
    layout.dimensionStart,
    layout.dimensionEnd,
  ]
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

export const getTextBounds = (object: TextObject): Bounds => {
  return getTextLayout(object).bounds
}

export const detachMeasurementsForDeletedObjects = (
  objects: CanvasObject[],
  deletedIds: Set<string>,
): CanvasObject[] =>
  objects
    .filter((object) => !deletedIds.has(object.id))
    .map((object) => {
      if (object.type !== 'measurement') return object
      const detach = (anchor: MeasurementAnchor): MeasurementAnchor =>
        anchor.kind === 'object' && deletedIds.has(anchor.objectId)
          ? createFixedAnchor(resolveMeasurementAnchor(anchor, objects))
          : anchor
      return { ...object, start: detach(object.start), end: detach(object.end) }
    })

export const translateMeasurement = (
  object: MeasurementObject,
  delta: Point,
  objects: CanvasObject[],
): MeasurementObject => {
  const translate = (anchor: MeasurementAnchor): MeasurementAnchor => {
    const point = resolveMeasurementAnchor(anchor, objects)
    return createFixedAnchor({ x: point.x + delta.x, y: point.y + delta.y })
  }
  return { ...object, start: translate(object.start), end: translate(object.end) }
}
