import { useEffect } from 'react'
import { usePanMotionStore } from '../panMotionStore'
import {
  startCanvasZoomSound,
  stopCanvasZoomSound,
  updateCanvasZoomSound,
} from '../sound/canvasZoomSound'

/** Min per-frame scale delta before the zoom lens engages. */
const ZOOM_EPS = 0.000004

/** Drives the direction-aware canvas zoom bed from live scale velocity. */
export function useCanvasZoomSound() {
  useEffect(() => {
    let playing = false

    const unsub = usePanMotionStore.subscribe((s) => {
      const moving = Math.abs(s.vz) > ZOOM_EPS

      if (!s.zoomActive) {
        if (playing) {
          stopCanvasZoomSound()
          playing = false
        }
        return
      }

      if (moving) {
        if (!playing) {
          startCanvasZoomSound()
          playing = true
        }
        updateCanvasZoomSound(Math.abs(s.vz), s.vz)
      } else if (playing) {
        stopCanvasZoomSound()
        playing = false
      }
    })

    return () => {
      unsub()
      stopCanvasZoomSound()
    }
  }, [])
}
