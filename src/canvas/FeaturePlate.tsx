import { useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { type FeaturePlateDestination } from './canvasPlate'
import FeaturePlateComingSoon from './FeaturePlateComingSoon'
import CanvasPlateBoundsOverlay from './CanvasPlateBoundsOverlay'
import CanvasPlateRepositionButton from './CanvasPlateRepositionButton'
import FeaturePlateDragHandle from './FeaturePlateDragHandle'
import FeaturePlateTitle from './FeaturePlateTitle'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'
import { registerFeaturePlateEl } from './featurePlateVisualDrag'

type Props = {
  destination: FeaturePlateDestination
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function FeaturePlate({ destination, transformRef }: Props) {
  const plateRef = useRef<HTMLDivElement>(null)
  const zoneActive = useAppDestinationActive(destination)

  useEffect(() => {
    registerFeaturePlateEl(destination, plateRef.current)
    return () => registerFeaturePlateEl(destination, null)
  }, [destination])

  return (
    <div
      ref={plateRef}
      className={[
        `canvas-feature-plate canvas-feature-plate--${destination}`,
        zoneActive ? 'canvas-feature-plate--zone-active' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      data-feature-plate={destination}
      data-feature-plate-position={destination}
    >
      <FeaturePlateTitle destination={destination} />
      <FeaturePlateDragHandle destination={destination} transformRef={transformRef} />
      <div className="canvas-feature-plate__surface">
        <FeaturePlateComingSoon destination={destination} />
      </div>
      <CanvasPlateBoundsOverlay destination={destination} />
      <CanvasPlateRepositionButton destination={destination} />
    </div>
  )
}
