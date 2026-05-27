import { useEffect } from 'react'
import { usePanMotionStore } from '../panMotionStore'

const MAX_PAN_BLUR = 0.75 // px at intensity = 1.0 (fastest possible pan)
const ZOOM_BLUR = 0.3     // px fixed during zoom gesture

export function useCanvasMotionBlur() {
  useEffect(() => {
    return usePanMotionStore.subscribe((s) => {
      let blur = 0
      if (s.active) {
        blur = s.intensity * MAX_PAN_BLUR
      } else if (s.zoomActive) {
        blur = ZOOM_BLUR
      }
      document.documentElement.style.setProperty(
        '--canvas-motion-blur',
        blur > 0.02 ? `${blur.toFixed(2)}px` : '0px',
      )
    })
  }, [])
}
