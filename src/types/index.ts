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
}

export interface Point {
  x: number
  y: number
}

interface BaseCanvasObject {
  id: string
  layerId: string
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
  layerId: 'room'
}

export interface TabletopObject extends BaseRectangularObject {
  type: 'tabletop'
  layerId: 'tabletop'
}

export type TrackDefinitionId =
  | 'straight-100'
  | 'straight-200'
  | 'curve-r300-30'
  | 'curve-r450-30'

export type TrackCurveDirection = 'left' | 'right'

export interface TrackPieceObject extends BaseCanvasObject {
  type: 'track-piece'
  layerId: 'track'
  definitionId: TrackDefinitionId
  position: Point
  rotation: number
  direction: TrackCurveDirection
}

export type RectangularCanvasObject =
  | RectangleObject
  | RoomObject
  | TabletopObject

export type RectangularObjectType = RectangularCanvasObject['type']

export type LegacyCanvasObject = LineObject | RectangularCanvasObject

export type CanvasObject = LegacyCanvasObject | TrackPieceObject

export interface TrackDefinition {
  id: TrackDefinitionId
  name: string
  kind: 'straight' | 'curve'
  lengthMm?: number
  radiusMm?: number
  angleDegrees?: number
}

export interface TrackConnector {
  objectId: string
  end: 'start' | 'end'
  position: Point
  heading: number
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
  objects: CanvasObject[]
}

export interface ProjectDocumentV3 {
  schemaVersion: 3
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
  | 'rotation'
