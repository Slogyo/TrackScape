export type Theme = 'light' | 'dark'

export type MeasurementSystem = 'metric' | 'imperial'

export type LayoutScaleId = 'ho' | 'n' | 'oo' | 'o'

export interface LayoutScalePreset {
  id: LayoutScaleId
  name: string
  ratio: number
}

export type MetricUnit = 'mm' | 'cm' | 'm'

export type ImperialUnit = 'in' | 'ft'

export type DisplayUnit = MetricUnit | ImperialUnit

export type ToolId =
  | 'select'
  | 'area-select'
  | 'delete'
  | 'line'
  | 'shape'
  | 'track'
  | 'measurement'
  | 'text'

export interface Tool {
  id: ToolId
  label: string
  shortLabel: string
  shortcut?: string
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  expanded?: boolean
}

export interface Point {
  x: number
  y: number
}

interface BaseCanvasObject {
  id: string
  layerId: string
  name?: string
  visible?: boolean
  locked?: boolean
}

export interface LineObject extends BaseCanvasObject {
  type: 'line'
  start: Point
  end: Point
}

interface BaseRectangularObject extends BaseCanvasObject {
  x: number
  y: number
  width: number
  height: number
}

export interface RectangleObject extends BaseRectangularObject {
  type: 'rectangle'
}

export interface RoomObject extends BaseRectangularObject {
  type: 'room'
}

export interface TabletopObject extends BaseRectangularObject {
  type: 'tabletop'
}

export type TrackDefinitionId = string

export type TrackCurveDirection = 'left' | 'right'
export type TrackGaugeId = 'generic' | 'ho-oo' | 'n' | 'o'
export type TrackManufacturer = 'Generic' | 'PECO'
export type TrackKind =
  | 'straight'
  | 'curve'
  | 'flex'
  | 'turnout'
  | 'crossing'
export type TrackHandedness = TrackCurveDirection | 'symmetric' | null
export type TrackDetailType = 'inspection-pit' | 'level-crossing'
export type TrackTopology =
  | 'standard'
  | 'catch-turnout'
  | 'curved-turnout'
  | 'y-turnout'
  | 'three-way-turnout'
  | 'three-way-asymmetric-turnout'
  | 'crossing'
  | 'single-slip'
  | 'double-slip'
  | 'scissors-crossing'

export interface TrackPieceObject extends BaseCanvasObject {
  type: 'track-piece'
  definitionId: TrackDefinitionId
  position: Point
  rotation: number
  direction: TrackCurveDirection
}

export type MeasurementAnchor =
  | {
      kind: 'fixed'
      point: Point
    }
  | {
      kind: 'object'
      objectId: string
      anchorId: string
      point: Point
    }

export interface MeasurementObject extends BaseCanvasObject {
  type: 'measurement'
  start: MeasurementAnchor
  end: MeasurementAnchor
  offset: number
}

export interface TextObject extends BaseCanvasObject {
  type: 'text'
  position: Point
  text: string
  fontSizeMm: number
  rotation: number
}

export type RectangularCanvasObject =
  | RectangleObject
  | RoomObject
  | TabletopObject

export type RectangularObjectType = RectangularCanvasObject['type']

export type LegacyCanvasObject = LineObject | RectangularCanvasObject

export type TrackCanvasObject = LegacyCanvasObject | TrackPieceObject

export type CanvasObject =
  | TrackCanvasObject
  | MeasurementObject
  | TextObject

export interface TrackDefinition {
  id: TrackDefinitionId
  name: string
  kind: TrackKind
  manufacturer: TrackManufacturer
  productCode?: string
  gaugeId: TrackGaugeId
  gaugeMm?: number
  productRange?: string
  railCode?: number
  frogType?: string | null
  sourceUrl?: string
  technicalSpecifications?: Record<string, string>
  handedness?: TrackHandedness
  detailType?: TrackDetailType
  topology?: TrackTopology
  isPlaceable: boolean
  lengthMm?: number
  routeLengthsMm?: number[]
  radiusMm?: number
  radiiMm?: number[]
  angleDegrees?: number
}

export interface TrackConnector {
  objectId: string
  connectorId: string
  end: string
  position: Point
  heading: number
  routeIds: string[]
}

export interface TrackPlacementSettings {
  definitionId: TrackDefinitionId
  rotation: number
  direction: TrackCurveDirection
}

export interface TrackPreviewStatus {
  definitionId: TrackDefinitionId
  rotation: number
  direction: TrackCurveDirection
  snapped: boolean
}

export interface ProjectMetadata {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface LegacyProjectSettings {
  measurementSystem: MeasurementSystem
}

export interface ProjectSettings extends LegacyProjectSettings {
  layoutScaleId: LayoutScaleId
}

export interface ProjectDocumentV1 {
  schemaVersion: 1
  metadata: ProjectMetadata
  settings: LegacyProjectSettings
  layers: Layer[]
  objects: LegacyCanvasObject[]
}

export interface ProjectDocumentV2 {
  schemaVersion: 2
  metadata: ProjectMetadata
  settings: LegacyProjectSettings
  layers: Layer[]
  objects: TrackCanvasObject[]
}

export interface ProjectDocumentV3 {
  schemaVersion: 3
  metadata: ProjectMetadata
  settings: ProjectSettings
  layers: Layer[]
  objects: TrackCanvasObject[]
}

export interface ProjectDocumentV4 {
  schemaVersion: 4
  metadata: ProjectMetadata
  settings: ProjectSettings
  layers: Layer[]
  objects: CanvasObject[]
}

export interface ProjectDocumentV5 {
  schemaVersion: 5
  metadata: ProjectMetadata
  settings: ProjectSettings
  layers: Layer[]
  objects: CanvasObject[]
}

export interface ProjectFeedback {
  type: 'success' | 'error'
  message: string
}

export type DraftMeasurement =
  | { type: 'line'; lengthMm: number }
  | { type: 'rectangle'; widthMm: number; heightMm: number }
  | {
      type: 'measurement'
      lengthMm: number
      startAttached: boolean
      endAttached: boolean
      offsetMm: number
    }

export interface MovementDelta {
  x: number
  y: number
}

export type GeometryField =
  | 'x1'
  | 'y1'
  | 'x2'
  | 'y2'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'fontSize'
  | 'offset'
  | 'rotation'
