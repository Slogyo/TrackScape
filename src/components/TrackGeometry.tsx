import { getTrackDefinition } from '../data/trackCatalog'
import type { TrackPieceObject } from '../types'
import { millimetresToPixels } from '../utils/canvas'
import { buildProceduralTrackGeometry } from '../utils/proceduralTrack'
import { getTrackLabelPosition } from '../utils/trackGeometry'

interface TrackGeometryProps {
  className: string
  dataObjectId?: string
  object: TrackPieceObject
  showRadiusLabel?: boolean
}

function TrackGeometry({
  className,
  dataObjectId,
  object,
  showRadiusLabel = true,
}: TrackGeometryProps) {
  const geometry = buildProceduralTrackGeometry(object)
  const definition = getTrackDefinition(object.definitionId)
  const labelPosition = getTrackLabelPosition(object)
  const radii =
    definition.radiiMm ??
    (definition.radiusMm ? [definition.radiusMm] : [])
  const transform = `translate(${millimetresToPixels(
    object.position.x,
  )} ${millimetresToPixels(object.position.y)}) rotate(${
    object.rotation
  }) scale(0.1)`
  const borderWidth = geometry.bounds.maxX - geometry.bounds.minX
  const borderHeight = geometry.bounds.maxY - geometry.bounds.minY

  return (
    <g className={className}>
      <g transform={transform}>
        {geometry.areas.map((area) => (
          <path
            className={`track-area track-${area.kind}`}
            d={area.path}
            key={area.id}
          />
        ))}
        {geometry.sleepers.map((sleeper) => (
          <line
            className="track-sleeper"
            key={sleeper.id}
            x1={sleeper.start.x}
            x2={sleeper.end.x}
            y1={sleeper.start.y}
            y2={sleeper.end.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geometry.rails.map((rail) => (
          <path
            className={`track-${rail.kind}`}
            d={rail.path}
            key={rail.id}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geometry.details.map((detail) => (
          <path
            className={`track-detail track-${detail.kind}`}
            d={detail.path}
            key={detail.id}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geometry.routes.map((route) => (
          <path
            className="track-hit-target"
            d={route.path}
            data-object-id={dataObjectId}
            key={`${route.id}-hit-target`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <rect
          className="track-interaction-border"
          x={geometry.bounds.minX}
          y={geometry.bounds.minY}
          width={borderWidth}
          height={borderHeight}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {showRadiusLabel && radii.length > 0 && (
        <text
          className="track-radius-label"
          x={millimetresToPixels(labelPosition.x)}
          y={millimetresToPixels(labelPosition.y)}
          textAnchor="middle"
        >
          R{radii.join('/')} mm
        </text>
      )}
    </g>
  )
}

export default TrackGeometry
