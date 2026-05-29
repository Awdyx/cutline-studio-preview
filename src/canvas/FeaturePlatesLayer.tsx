import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { FEATURE_PLATE_DESTINATIONS } from './canvasPlate'
import FeaturePlate from './FeaturePlate'

type Props = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function FeaturePlatesLayer({ transformRef }: Props) {
  return (
    <>
      {FEATURE_PLATE_DESTINATIONS.map((dest) => (
        <FeaturePlate key={dest} destination={dest} transformRef={transformRef} />
      ))}
    </>
  )
}
