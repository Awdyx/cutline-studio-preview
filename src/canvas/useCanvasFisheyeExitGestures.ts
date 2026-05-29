import { useCallback, useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CHROME_CONTEXT_MENU_ROOTS } from '../chrome/suppressChromeContextMenu'
import { runCanvasFisheyeExit } from './canvasBarrelPostProcess'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { watchPendingTouchTap } from './pointerTapGesture'

/** Interactive chrome — taps here should not leave fisheye overview. */
const FISHEYE_EXIT_CHROME_SELECTORS = [
  ...CHROME_CONTEXT_MENU_ROOTS,
  '[data-pen-fab-menu]',
  '[data-pen-fab-trigger]',
  '[data-panel-trigger]',
  '[data-phone-chrome-modal-scrim]',
  '[data-notifications-panel]',
  '[data-profile-panel]',
  '[data-space-back-pill]',
  '.action-toast',
  '.canvas-nav-minimap',
  '.canvas-minimap-expanded-menu__frame',
  '.canvas-minimap-expanded-scrim',
  '.studio-centre-drag-handle-wrapper',
  '.cutline-studio-centre-surface',
  '.canvas-plate-reposition-btn',
] as const

function isFisheyeExitChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return FISHEYE_EXIT_CHROME_SELECTORS.some((sel) => target.closest(sel) != null)
}

/**
 * While fisheye overview is engaged: a tap on the canvas exits; a drag pans.
 */
export function useCanvasFisheyeExitGestures(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)

  const exitFisheye = useCallback(
    (anchor: { x: number; y: number } | null) => {
      runCanvasFisheyeExit(transformRef.current, anchor)
    },
    [transformRef],
  )

  useEffect(() => {
    if (!engaged) return

    let tapWatchCleanup: (() => void) | null = null

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (isFisheyeExitChromeTarget(event.target)) return

      tapWatchCleanup?.()
      const anchor = { x: event.clientX, y: event.clientY }
      tapWatchCleanup = watchPendingTouchTap({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        onComplete: () => exitFisheye(anchor),
        onCancel: () => {
          tapWatchCleanup = null
        },
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      tapWatchCleanup?.()
      tapWatchCleanup = null
    }
  }, [engaged, exitFisheye])
}
