import type { TrackConnector, TrackPieceObject } from '../types'
import { millimetresToPixels } from '../utils/canvas'
import {
  getTrackLabelPosition,
  getTrackPathDataList,
} from '../utils/trackGeometry'
import { getTrackDefinition } from '../data/trackCatalog'

interface TrackGeometryProps {
  className: string
  connectors?: TrackConnector[]
  dataObjectId?: string
  object: TrackPieceObject
  showConnectors?: boolean
  showRadiusLabel?: boolean
}

function TrackGeometry({
  className,
  connectors = [],
  dataObjectId,
  object,
  showConnectors = false,
  showRadiusLabel = true,
}: TrackGeometryProps) {
  const paths = getTrackPathDataList(object)
  const definition = getTrackDefinition(object.definitionId)
  const labelPosition = getTrackLabelPosition(object)
  const radii = definition.radiiMm ?? (
    definition.radiusMm ? [definition.radiusMm] : []
  )
  const transform = `translate(${millimetresToPixels(
    object.position.x,
  )} ${millimetresToPixels(object.position.y)}) rotate(${
    object.rotation
  }) scale(0.1)`

  return (
    <g className={className}>
      {paths.map((path, index) => (
        <g key={`${object.id}-route-${index}`}>
          <path
            className="track-bed"
            d={path}
            transform={transform}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="track-gap"
            d={path}
            transform={transform}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="track-hit-target"
            d={path}
            data-object-id={dataObjectId}
            transform={transform}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
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
      {showConnectors &&
        connectors.map((connector) => (
          <circle
            className="track-connector"
            key={`${connector.objectId}-${connector.end}`}
            cx={millimetresToPixels(connector.position.x)}
            cy={millimetresToPixels(connector.position.y)}
            r="4"
          />
        ))}
    </g>
  )
}

export default TrackGeometry
