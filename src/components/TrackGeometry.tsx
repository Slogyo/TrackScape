import type { TrackConnector, TrackPieceObject } from '../types'
import { millimetresToPixels } from '../utils/canvas'
import { getTrackPathData } from '../utils/trackGeometry'

interface TrackGeometryProps {
  className: string
  connectors?: TrackConnector[]
  dataObjectId?: string
  object: TrackPieceObject
  showConnectors?: boolean
}

function TrackGeometry({
  className,
  connectors = [],
  dataObjectId,
  object,
  showConnectors = false,
}: TrackGeometryProps) {
  const path = getTrackPathData(object)

  return (
    <g className={className}>
      <path
        className="track-bed"
        d={path}
        transform="scale(0.1)"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="track-gap"
        d={path}
        transform="scale(0.1)"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="track-hit-target"
        d={path}
        data-object-id={dataObjectId}
        transform="scale(0.1)"
        vectorEffect="non-scaling-stroke"
      />
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
