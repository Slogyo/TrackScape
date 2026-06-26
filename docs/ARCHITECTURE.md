# TrackScape Architecture

## Current Shape

TrackScape starts as a client-only Vite, React, and TypeScript application. React state owns the small amount of current interaction: theme, measurement system, selected tool, layers, active layer, and cursor position. CSS owns the application layout and visual themes.

There is no backend, account system, or drawing engine. The browser persistence layer stores one explicitly saved project document in local storage.

## Workspace Navigation

The workspace is a virtual, unbounded signed-coordinate surface centred on the world origin. New layouts open with 0,0 in the centre of the visible canvas, and users can draw, place, pan, and move objects into positive or negative X/Y space. The SVG remains the size of the visible viewport while a transient camera determines which model coordinates are shown. Screen-to-model conversion includes the camera position and zoom, so drawing and snapping use the same millimetre geometry anywhere in the workspace.

Camera position, zoom, panning state, marquee drafts, and single or multiple selection remain transient interface state. They are not written into project documents. Keeping the rendered surface viewport-sized also prevents zoom from resizing a very large DOM element.

## Interface Preferences

Theme preference is stored separately from project data under `trackscape.theme`. A saved manual choice wins; otherwise TrackScape follows the operating system colour scheme and reacts to system changes. Importing a project never changes the interface theme.

## Why Measurements Are Stored in Millimetres

All physical measurements should be stored as millimetres, even when the interface displays centimetres, metres, inches, or feet.

Millimetres provide a practical base unit for model railway work, avoid mixing unit systems in saved project data, and keep conversion at the display/input boundary. A length of `1000` always means the same real-world length in the object model. The functions in `src/utils/units.ts` convert values when they enter or leave the interface.

## Layout Scale

The project stores a scale preset ID separately from object geometry. HO, N, OO, and O presets map to fixed ratios, while every canvas coordinate and dimension remains an exact model measurement in millimetres.

Prototype-equivalent readouts are derived by multiplying model millimetres by the selected ratio. Scale changes therefore update labels and readouts only; they never resize objects, change snapping, or alter track connection geometry.

## Adding Tools

Tool metadata lives in `src/data/tools.ts`, while the allowed identifiers live in `src/types/index.ts`.

To add a tool:

1. Add its identifier to `ToolId`.
2. Add its label, short label, and optional shortcut to the `tools` array.
3. Add tool-specific attributes to the status or properties UI only when the tool needs them.
4. Implement its canvas behavior in a dedicated module rather than expanding `LeftToolbar`.

The toolbar should remain a renderer and selector. It should not become the drawing engine.

## Layers and Asset Outliner

The default top-level folders live in `src/data/defaultLayers.ts`. Folders are ordered, user-manageable project data with visibility, locking, naming, and persisted expansion state. Every canvas object is an individually named asset row and stores its own visibility and locking state.

An object's effective visibility is the combination of its own state and its parent folder's state. Effective locking works the same way: a locked folder prevents edits to every child without overwriting each child's retained lock setting.

The object array records sibling order within each folder. The top folder and top asset row are visually frontmost, so SVG rendering reverses the outliner order before painting. Reordering or reparenting assets changes only their project order and `layerId`; it does not alter geometry.

Folder selection chooses the destination for newly created objects. Asset selection remains separate transient interface state and supports click, Ctrl/Cmd toggle, and Shift range selection.

## Canvas Object Storage

Canvas objects use a serialisable discriminated union. Every object has a stable ID, object type, parent folder ID, geometry in millimetres, and shared outliner metadata.

For example:

```ts
type CanvasObject =
  | { id: string; type: 'line'; layerId: string; name: string; visible: boolean; locked: boolean; start: Point; end: Point }
  | { id: string; type: 'rectangle' | 'room' | 'tabletop'; layerId: string; name: string; visible: boolean; locked: boolean; x: number; y: number; width: number; height: number }
  | { id: string; type: 'track-piece'; layerId: string; name: string; visible: boolean; locked: boolean; definitionId: string; position: Point; rotation: number; direction: 'left' | 'right' }
  | { id: string; type: 'measurement'; layerId: string; start: MeasurementAnchor; end: MeasurementAnchor; offset: number }
  | { id: string; type: 'text'; layerId: string; position: Point; text: string; fontSizeMm: number; rotation: number }
```

Object data should be independent of React components and rendering technology. This will make undo/redo, JSON export, alternate renderers, and project migrations easier to add.

Room and tabletop objects share rectangular geometry but retain semantic object types. This keeps selection and measurement behavior reusable while allowing dedicated rendering, validation, and future domain-specific properties.

Object edits remain explicit reducer operations. A specialist canvas library should only be introduced after native SVG prototypes reveal a concrete need.

## Project Documents and Browser Storage

Saved projects use a versioned `ProjectDocumentV5` JSON structure. The document contains project metadata, measurement and layout-scale settings, ordered folders, and ordered canvas objects. V5 adds folder expansion plus object names, visibility, and locking. Geometry remains in millimetres. Theme, cursor position, selected tool, active folder, selection, and drawing drafts are interface state and are not persisted.

Unknown JSON is validated before it reaches React state. A failed import or restore leaves the current project untouched. Versions 1 through 4 are migrated in memory to version 5. Legacy objects receive stable generated names and default to visible and unlocked; legacy folders default to expanded. HO remains the fallback when a legacy document has no scale setting. New saves and exports always use version 5.

Measurement annotations store fixed points or references to stable object anchors. Anchor resolution is derived from the current source geometry, so dimensions follow later object movement, resizing, and rotation. Deleting referenced geometry first converts dependent anchors to fixed coordinates, preventing dangling project references.

Browser storage sits behind a small adapter with load, save, and clear operations. The adapter retains the `trackscape.project.v1` local storage key so existing browser saves remain discoverable. JSON import and export use the same project document format, while imports remain unsaved until the user explicitly chooses Save.

## Track Catalogues and Geometry

Track pieces reference catalogue definitions rather than copying product dimensions into every object. Each placed piece stores a stable definition ID, local origin, rotation, and curve direction. Project geometry remains in millimetres and degrees.

The PECO source snapshot lives in `src/data/pecoCatalog.source.json`. It is generated from PECO's official track collection and each official product page by `scripts/import-peco-catalog.mjs`. The importer records:

- Gauge, catalogue product code, range, and rail code.
- Published length, route lengths, radius or radii, and angle.
- Frog type and the complete Technical Specification table.
- The official PECO product URL for provenance.

The runtime catalogue in `src/data/trackCatalog.ts` converts that source data into stable definitions for HO/OO (16.5 mm), N (9 mm), and O (32 mm). Pack products inherit the geometry of their corresponding individual piece when PECO's pack page omits dimensions. A small number of Setrack family relationships are filled from the matching published curve family, and those rules remain explicit in the catalogue module.

Scenic accessories that happen to be tagged as track, such as platforms and way gauges, are not exposed as placeable track. A genuine track product remains visible but disabled when PECO publishes insufficient geometry; TrackScape does not invent a length.

The runtime catalogue normalizes manufacturer naming into brand-neutral topology and detail metadata such as curved turnout, three-way turnout, slip, scissors crossing, inspection pit, and level crossing. Canvas and renderer modules do not inspect PECO product names.

Pure helpers in `src/utils/trackGeometry.ts` derive route topology, lengths, bounds, and unique physical connectors. Coincident route endpoints at a turnout toe merge into one connector, while every external route end remains available. Placement can pair any preview connector with any available connector and solves translation and rotation so their positions coincide and outward headings oppose.

Snap tolerance is defined in screen pixels and converted to millimetres at the current zoom. Connector markers use the inverse zoom for their SVG radius, which keeps both interaction and visual size stable while zooming.

`src/utils/proceduralTrack.ts` converts the same routes into gauge-spaced rails, sleepers, interaction bounds, and piece details. It provides generic turnout switch rails, closure routes, frogs, guard rails, crossing check rails, slip paths, scissors routes, and inspection-pit edges and steps. Published length, gauge, radius, route length, and angle remain authoritative. Gauge-scaled sleeper, blade, frog, and pit dimensions are documented fallbacks until a catalogue supplies those fields explicitly.

`src/components/TrackGeometry.tsx` only renders that procedural result. It does not own product geometry or snapping logic. This keeps alternate SVG, Canvas, print, and future 3D renderers possible without changing persisted objects or connection behavior.

The original generic definitions remain available so older saved projects continue to load. New manufacturer catalogue IDs are string-based and validated against the bundled catalogue during project import.

## Desktop App Path

Because TrackScape is a static client application with portable project data, it can later be packaged as a desktop app with Tauri or Electron. The React interface and core measurement/object modules can remain unchanged.

Desktop-specific file access should sit behind a small storage interface. The browser implementation can use downloads and local storage or IndexedDB, while a desktop implementation can use native open/save dialogs and the filesystem.
