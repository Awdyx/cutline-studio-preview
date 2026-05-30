import { useEffect } from 'react'
import { isTouchFirstDevice } from '../platform/compositor'
import { usePanMotionStore } from '../panMotionStore'

const MAX_PAN_BLUR = 0.75 // px at intensity = 1.0 (fastest possible pan)
const MAX_FOCUS_ANIM_BLUR = 3.5 // px during menu / plate camera fly-to
const ZOOM_BLUR = 0.3     // px fixed during zoom gesture

export function useCanvasMotionBlur() {
  useEffect(() => {
    if (isTouchFirstDevice()) return
    return usePanMotionStore.subscribe((s) => {
      const focusAnim = document.documentElement.hasAttribute(
        'data-camera-focus-anim',
      )
      let blur = 0
      if (s.active) {
        blur =
          s.intensity *
          (focusAnim ? MAX_FOCUS_ANIM_BLUR : MAX_PAN_BLUR)
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
