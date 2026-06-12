# TrackScape Architecture

## Current Shape

TrackScape starts as a client-only Vite, React, and TypeScript application. React state owns the small amount of current interaction: theme, measurement system, selected tool, layers, active layer, and cursor position. CSS owns the application layout and visual themes.

There is no backend, account system, or drawing engine. The browser persistence layer stores one explicitly saved project document in local storage.

## Why Measurements Are Stored in Millimetres

All physical measurements should be stored as millimetres, even when the interface displays centimetres, metres, inches, or feet.

Millimetres provide a practical base unit for model railway work, avoid mixing unit systems in saved project data, and keep conversion at the display/input boundary. A length of `1000` always means the same real-world length in the object model. The functions in `src/utils/units.ts` convert values when they enter or leave the interface.

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
```

Object data should be independent of React components and rendering technology. This will make undo/redo, JSON export, alternate renderers, and project migrations easier to add.

Room and tabletop objects share rectangular geometry but retain semantic object types. This keeps selection and measurement behavior reusable while allowing dedicated rendering, validation, and future domain-specific properties.

When drawing begins, a reducer is a sensible next state step because object edits are explicit actions. A specialist canvas library should only be introduced after native SVG or Canvas prototypes reveal a concrete need.

## Project Documents and Browser Storage

Saved projects use a versioned `ProjectDocumentV1` JSON structure. The document contains project metadata, measurement settings, ordered layers, and ordered canvas objects. Geometry remains in millimetres. Theme, cursor position, selected tool, active layer, selection, and drawing drafts are interface state and are not persisted.

Unknown JSON is validated before it reaches React state. A failed import or restore leaves the current project untouched. Schema version checks provide a clear point for future migrations without adding migration machinery before a second version exists.

Browser storage sits behind a small adapter with load, save, and clear operations. The current adapter uses the `trackscape.project.v1` local storage key. JSON import and export use the same project document format, while imports remain unsaved until the user explicitly chooses Save.

## Desktop App Path

Because TrackScape is a static client application with portable project data, it can later be packaged as a desktop app with Tauri or Electron. The React interface and core measurement/object modules can remain unchanged.

Desktop-specific file access should sit behind a small storage interface. The browser implementation can use downloads and local storage or IndexedDB, while a desktop implementation can use native open/save dialogs and the filesystem.
