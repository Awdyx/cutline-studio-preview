import { useCanvasMinimapStore } from './canvasMinimapStore'

const MENU_FRAME = '.canvas-minimap-expanded-menu__frame'
const MENU_SCRIM = '.canvas-minimap-expanded-scrim'

function isMenuSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest(MENU_FRAME) != null ||
    target.closest(MENU_SCRIM) != null
  )
}

export function isExpandedCanvasMapOpen(): boolean {
  return useCanvasMinimapStore.getState().expandedOpen
}

/** True when ink should not reach the canvas (expanded map owns this screen region). */
export function shouldBlockCanvasDrawAt(
  clientX: number,
  clientY: number,
  target?: EventTarget | null,
): boolean {
  if (!isExpandedCanvasMapOpen()) return false
  if (target != null && isMenuSurface(target)) return true
  return isMenuSurface(document.elementFromPoint(clientX, clientY))
}
