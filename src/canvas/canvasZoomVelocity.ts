import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { usePanMotionStore } from '../panMotionStore'

let prevScale: number | null = null

/** Per zoom frame — scale delta for zoom-direction sfx. */
export function recordCanvasZoomFrame(ref: ReactZoomPanPinchContentRef): void {
  const scale = ref.state.scale
  if (!Number.isFinite(scale) || scale <= 0) return

  if (prevScale == null) {
    prevScale = scale
    usePanMotionStore.getState().clearZoomVelocity()
    return
  }

  const vz = scale - prevScale
  prevScale = scale
  if (Math.abs(vz) < 0.000001) return
  usePanMotionStore.getState().setZoomVelocity(vz)
}

export function resetCanvasZoomVelocityTracking(): void {
  prevScale = null
  usePanMotionStore.getState().clearZoomVelocity()
}
