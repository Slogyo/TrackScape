# Track System Audit

## Current Data Flow

1. `trackCatalog.ts` normalizes PECO source data into brand-neutral
   `TrackDefinition` records.
2. `CanvasWorkspace.tsx` owns transient pointer, camera, drawing, movement, and
   track-placement state.
3. `trackGeometry.ts` derives routes, SVG path data, bounds, and connectors
   from a persisted `TrackPieceObject`.
4. `TrackGeometry.tsx` renders those routes into the shared SVG workspace.
5. Projects persist only the definition ID, position, rotation, and curve
   direction. All visual and connection geometry is derived.

## Invariants To Preserve

- Project geometry remains stored in millimetres.
- One SVG workspace pixel represents 10 mm before camera zoom.
- Camera position and zoom remain transient and are not persisted.
- A track object's stored position is a stable local origin.
- Track objects remain serialisable with the existing project schema.
- Selection, dragging, panning, unit conversion, and catalog loading continue
  to use the existing React state architecture.
- The renderer and snap engine consume normalized `TrackDefinition` data and
  must not branch on PECO as a manufacturer.

## Defects Found

- Turnout routes each emit their own start connector, creating duplicate
  physical connectors at the common toe.
- Placement can only attach the preview's origin connector. Other valid
  preview endpoints cannot be used to join a piece.
- The 150 mm snap tolerance is measured in model space, so its screen size
  changes at every zoom level.
- Connector circles use a fixed SVG radius, so their visible size changes with
  zoom.
- Existing connectors are always shown during Track placement, while preview
  connectors and nearby-state emphasis are absent.
- Track hover is not represented in state and there is no hover-only outline.
- Keyboard rotation is limited to bracket keys during placement. Selected
  track pieces cannot be rotated from the workspace.
- Bounds include route centerlines only, not track gauge, sleepers, or details.
- The current visual is a wide centerline with an inner gap. It does not model
  rails, sleepers, switches, frogs, crossings, or special-piece details.
- Crossing and turnout topology is inferred from names and coarse envelope
  dimensions. PECO does not publish every construction dimension needed for a
  fully exact visual.

## Overhaul Contract

- Build one brand-neutral procedural geometry result containing:
  routes, unique physical connectors, rails, sleepers, special details, and
  bounds.
- Give each route endpoint a stable identity and merge coincident endpoints
  belonging to the same physical connection.
- Solve placement by pairing any preview connector with any available existing
  connector, then rotate and translate the preview so positions coincide and
  outward headings oppose.
- Convert a fixed screen-pixel snap radius to millimetres using the current
  zoom. Render connector markers at a fixed screen-pixel radius.
- Use published catalog dimensions where available. Keep documented geometric
  fallbacks generic and mark missing manufacturer dimensions with focused
  TODOs.
- Render interaction borders only for preview, hover, selection, and movement.
  Borders must not participate in hit testing.

## PECO Data Coverage

- Straights, curves, standard turnouts, curved turnouts, Y turnouts, three-way
  turnouts, crossings, slips, scissors crossings, and an inspection pit are
  present in the normalized source catalog.
- Length, gauge, radius, route lengths, and frog angle are available for many
  products.
- Exact sleeper dimensions, sleeper spacing, switch blade length, frog nose
  position, check-rail length, and pit width are generally absent. The
  procedural renderer therefore needs gauge-scaled defaults until richer
  manufacturer geometry is added.
