# TrackScape Architecture

## Current Shape

TrackScape starts as a client-only Vite, React, and TypeScript application. React state owns the small amount of current interaction: theme, measurement system, selected tool, layers, active layer, and cursor position. CSS owns the application layout and visual themes.

There is no backend, account system, or drawing engine. The browser persistence layer stores one explicitly saved project document in local storage.

## Workspace Navigation

The workspace is a virtual, unbounded positive-coordinate surface with an upper-left origin. The SVG remains the size of the visible viewport while a transient camera determines which model coordinates are shown. Screen-to-model conversion includes the camera position and zoom, so drawing and snapping use the same millimetre geometry anywhere in the workspace.

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

## Extending Layers

The default layer definitions live in `src/data/defaultLayers.ts`. Layer runtime state is held in `useAppState`.

Future layer features can extend the `Layer` type with properties such as colour, order, parent group, or object count. Operations such as add, remove, rename, reorder, and group should eventually move into a focused layer state module or reducer once the interactions become more complex.

## Future Canvas Object Storage

Canvas objects should eventually use a serialisable discriminated union. Every object should have a stable ID, object type, layer ID, geometry in millimetres, and shared metadata.

For example:

```ts
type CanvasObject =
  | { id: string; type: 'line'; layerId: string; start: Point; end: Point }
  | { id: string; type: 'rectangle' | 'room' | 'tabletop'; layerId: string; x: number; y: number; width: number; height: number }
  | { id: string; type: 'track-piece'; layerId: 'track'; definitionId: string; position: Point; rotation: number; direction: 'left' | 'right' }
```

Object data should be independent of React components and rendering technology. This will make undo/redo, JSON export, alternate renderers, and project migrations easier to add.

Room and tabletop objects share rectangular geometry but retain semantic object types. This keeps selection and measurement behavior reusable while allowing dedicated rendering, validation, and future domain-specific properties.

When drawing begins, a reducer is a sensible next state step because object edits are explicit actions. A specialist canvas library should only be introduced after native SVG or Canvas prototypes reveal a concrete need.

## Project Documents and Browser Storage

Saved projects use a versioned `ProjectDocumentV3` JSON structure. The document contains project metadata, measurement and layout-scale settings, ordered layers, and ordered canvas objects. Geometry remains in millimetres. Theme, cursor position, selected tool, active layer, selection, and drawing drafts are interface state and are not persisted.

Unknown JSON is validated before it reaches React state. A failed import or restore leaves the current project untouched. Version 1 and version 2 documents are migrated in memory to version 3 with HO as the default scale, while new saves and exports always use version 3.

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
