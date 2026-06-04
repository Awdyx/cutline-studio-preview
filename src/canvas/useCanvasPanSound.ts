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
      const moving = Math.hypot(s.vx, s.vy) > MOVE_EPS

      if (!s.canvasPanActive) {
        if (playing) {
          stopCanvasPanSound()
          playing = false
        }
        return
      }

      if (moving) {
        if (!playing) {
          startCanvasPanSound()
          playing = true
        }
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
