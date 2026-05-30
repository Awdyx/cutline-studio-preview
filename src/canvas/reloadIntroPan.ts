import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { isReloadIntroArmed, useReloadIntroStore } from './reloadIntroStore'

const PAN_REVEAL_THRESHOLD_PX = 14

let prevX: number | null = null
let prevY: number | null = null
let accumulated = 0
let lastDirX = 0
let lastDirY = -1

export function resetReloadIntroPanTracking(): void {
  prevX = null
  prevY = null
  accumulated = 0
  lastDirX = 0
  lastDirY = -1
}

/** Call from canvas pan handlers while the reload intro is armed. */
export function trackReloadIntroPan(ref: ReactZoomPanPinchRef): void {
  if (!isReloadIntroArmed()) return

  const { positionX, positionY } = ref.state
  if (prevX === null || prevY === null) {
    prevX = positionX
    prevY = positionY
    return
  }

  const dx = positionX - prevX
  const dy = positionY - prevY
  prevX = positionX
  prevY = positionY

  const step = Math.hypot(dx, dy)
  if (step > 0.001) {
    lastDirX = dx
    lastDirY = dy
  }

  accumulated += step
  if (accumulated >= PAN_REVEAL_THRESHOLD_PX) {
    useReloadIntroStore.getState().reveal(lastDirX, lastDirY)
  }
}
