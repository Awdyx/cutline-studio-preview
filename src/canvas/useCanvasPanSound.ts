import { useEffect } from 'react'
import { usePanMotionStore } from '../panMotionStore'
import {
  startCanvasPanSound,
  stopCanvasPanSound,
  updateCanvasPanSound,
} from '../sound/canvasPanSound'

/** Min per-frame pan delta (px) before the whoosh engages — ignores micro-jitter. */
const MOVE_EPS = 0.6

/** Drives the speed-reactive canvas pan whoosh from live pan velocity. */
export function useCanvasPanSound() {
  useEffect(() => {
    let playing = false

    const unsub = usePanMotionStore.subscribe((s) => {
      const moving = s.active && Math.abs(s.vx) + Math.abs(s.vy) > MOVE_EPS
      if (moving) {
        if (!playing) {
          startCanvasPanSound()
          playing = true
        }
        // Raw per-frame velocity (not the vignette's early-saturating intensity)
        // so the sound's own high ceiling controls how fast you must fling.
        updateCanvasPanSound(Math.hypot(s.vx, s.vy))
      } else if (playing) {
        stopCanvasPanSound()
        playing = false
      }
    })

    return () => {
      unsub()
      stopCanvasPanSound()
    }
  }, [])
}
