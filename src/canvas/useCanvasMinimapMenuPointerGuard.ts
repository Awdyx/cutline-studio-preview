import { useEffect } from 'react'
import {
  canStartDrawingPointer,
  isPenDrawMode,
  isSpaceDrawHeld,
} from '../drawing/penInput'
import { shouldBlockCanvasDrawAt } from './canvasMinimapDrawBlock'

const STUDIO_PLATE = '.canvas-minimap-expanded-menu__plate'
const DRIFT_PX = 4

function isStudioPlate(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(STUDIO_PLATE) != null
}

function isMenuDrawSurface(clientX: number, clientY: number): boolean {
  return shouldBlockCanvasDrawAt(clientX, clientY)
}

/** Block canvas pointers while the expanded map is open; fire `onDrawAttempt` for draw easter egg. */
export function useCanvasMinimapMenuPointerGuard(
  open: boolean,
  onDrawAttempt?: () => void,
) {
  useEffect(() => {
    if (!open) return

    let tracking = false
    let originX = 0
    let originY = 0
    let lastX = 0
    let lastY = 0

    const stopTracking = () => {
      tracking = false
    }

    const startTracking = (x: number, y: number) => {
      tracking = true
      originX = x
      originY = y
    }

    const tryReveal = (x: number, y: number) => {
      if (!tracking) return
      if (Math.hypot(x - originX, y - originY) < DRIFT_PX) return
      stopTracking()
      onDrawAttempt?.()
    }

    const onPointerDown = (event: PointerEvent) => {
      lastX = event.clientX
      lastY = event.clientY
      if (!shouldBlockCanvasDrawAt(event.clientX, event.clientY, event.target)) return
      if (isStudioPlate(event.target)) return
      if (canStartDrawingPointer(event)) {
        startTracking(event.clientX, event.clientY)
      }
      event.preventDefault()
      event.stopPropagation()
    }

    const onPointerMove = (event: PointerEvent) => {
      lastX = event.clientX
      lastY = event.clientY
      if (tracking) tryReveal(event.clientX, event.clientY)
      if (
        isSpaceDrawHeld() &&
        !tracking &&
        isMenuDrawSurface(event.clientX, event.clientY)
      ) {
        startTracking(event.clientX, event.clientY)
      }
      if (!shouldBlockCanvasDrawAt(event.clientX, event.clientY, event.target)) return
      if (isStudioPlate(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    const onPointerEnd = () => {
      stopTracking()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if (!isPenDrawMode()) return
      if (!isMenuDrawSurface(lastX, lastY)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      startTracking(lastX, lastY)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') stopTracking()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerEnd, true)
    document.addEventListener('pointercancel', onPointerEnd, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerEnd, true)
      document.removeEventListener('pointercancel', onPointerEnd, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      stopTracking()
    }
  }, [open, onDrawAttempt])
}
