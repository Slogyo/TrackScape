export type Theme = 'light' | 'dark'

export type MeasurementSystem = 'metric' | 'imperial'

export type MetricUnit = 'mm' | 'cm' | 'm'

export type ImperialUnit = 'in' | 'ft'

export type DisplayUnit = MetricUnit | ImperialUnit

export type ToolId =
  | 'select'
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

export type RectangularCanvasObject =
  | RectangleObject
  | RoomObject
  | TabletopObject

export type RectangularObjectType = RectangularCanvasObject['type']

export type CanvasObject = LineObject | RectangularCanvasObject

export interface ProjectMetadata {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSettings {
  measurementSystem: MeasurementSystem
}

export interface ProjectDocumentV1 {
  schemaVersion: 1
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
