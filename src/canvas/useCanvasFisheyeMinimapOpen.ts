import { useEffect } from 'react'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import {
  closeCanvasMinimap,
  openCanvasMinimapFromFisheye,
} from './canvasMinimapOpen'
import { useCanvasMinimapStore } from './canvasMinimapStore'

/** Chrome that should never toggle the expanded map via right-click. */
const FISHEYE_MINIMAP_CHROME_EXCLUDED = [
  '[data-pen-fab-menu]',
  '[data-pen-fab-trigger]',
  '[data-panel-trigger]',
  '[data-phone-chrome-modal-scrim]',
  '[data-notifications-panel]',
  '[data-profile-panel]',
  '[data-space-back-pill]',
  '.action-toast',
  '.canvas-nav-minimap',
  '.studio-centre-drag-handle-wrapper',
  '.canvas-plate-reposition-btn',
] as const

/** Extra exclusions while opening — not while closing. */
const FISHEYE_MINIMAP_OPEN_ONLY_EXCLUDED = [
  ...FISHEYE_MINIMAP_CHROME_EXCLUDED,
  '.canvas-minimap-expanded-menu',
  '.canvas-minimap-expanded-scrim',
] as const

function isChromeExcluded(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return FISHEYE_MINIMAP_CHROME_EXCLUDED.some((sel) => target.closest(sel) != null)
}

function isOpenOnlyExcluded(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return FISHEYE_MINIMAP_OPEN_ONLY_EXCLUDED.some((sel) => target.closest(sel) != null)
}

/** Right-click the fisheye void opens the expanded canvas map; repeat to dismiss. */
export function useCanvasFisheyeMinimapOpen() {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)

  useEffect(() => {
    if (!engaged) return

    function onContextMenu(event: MouseEvent) {
      const expandedOpen = useCanvasMinimapStore.getState().expandedOpen

      if (expandedOpen) {
        if (isChromeExcluded(event.target)) return
        event.preventDefault()
        event.stopPropagation()
        closeCanvasMinimap()
        return
      }

      if (isOpenOnlyExcluded(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      openCanvasMinimapFromFisheye()
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [engaged])
}
