import { useCallback, useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CHROME_CONTEXT_MENU_ROOTS } from '../chrome/suppressChromeContextMenu'
import { runCanvasOverviewExit } from './canvasOverviewCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { watchPendingTouchTap } from './pointerTapGesture'

/** Interactive chrome — taps here should not leave canvas overview. */
const OVERVIEW_EXIT_CHROME_SELECTORS = [
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

function isOverviewExitChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return OVERVIEW_EXIT_CHROME_SELECTORS.some((sel) => target.closest(sel) != null)
}

/** While canvas overview is engaged: a tap on the canvas exits; a drag pans. */
export function useCanvasOverviewExitGestures(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const engaged = useCanvasOverviewStore((s) => s.engaged)

  const exitOverview = useCallback(
    (anchor: { x: number; y: number } | null) => {
      runCanvasOverviewExit(transformRef.current, anchor)
    },
    [transformRef],
  )

  useEffect(() => {
    if (!engaged) return

    let tapWatchCleanup: (() => void) | null = null

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (isOverviewExitChromeTarget(event.target)) return

      tapWatchCleanup?.()
      const anchor = { x: event.clientX, y: event.clientY }
      tapWatchCleanup = watchPendingTouchTap({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        onComplete: () => exitOverview(anchor),
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
  }, [engaged, exitOverview])
}

