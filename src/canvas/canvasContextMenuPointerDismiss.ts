const APPROACH_PAD = 56
const MIN_AWAY_MOVE_PX = 10

function pointInRect(
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function inflateRect(rect: DOMRect, pad: number) {
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  }
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function menuPanelRect(panel: HTMLElement | null): DOMRect | null {
  if (!panel) return null
  const rect = panel.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function widgetsSubmenuRect(): DOMRect | null {
  const el = document.querySelector('[data-plus-fab-submenu="widgets"]')
  if (!(el instanceof HTMLElement)) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function isInsideMenuOrWidgets(
  x: number,
  y: number,
  panel: HTMLElement | null,
) {
  const panelRect = menuPanelRect(panel)
  if (panelRect && pointInRect(x, y, panelRect)) return true
  const widgetsRect = widgetsSubmenuRect()
  if (widgetsRect && pointInRect(x, y, widgetsRect)) return true
  return false
}

function isInApproachZone(
  x: number,
  y: number,
  panel: HTMLElement | null,
  openX: number,
  openY: number,
) {
  const panelRect = menuPanelRect(panel)
  if (!panelRect) return true

  if (pointInRect(x, y, inflateRect(panelRect, APPROACH_PAD))) return true

  const widgetsRect = widgetsSubmenuRect()
  if (widgetsRect && pointInRect(x, y, inflateRect(widgetsRect, APPROACH_PAD))) {
    return true
  }

  const cx = panelRect.left + panelRect.width / 2
  const cy = panelRect.top + panelRect.height / 2
  if (distanceToSegment(x, y, openX, openY, cx, cy) <= APPROACH_PAD) {
    return true
  }

  if (widgetsRect) {
    const wx = widgetsRect.left + widgetsRect.width / 2
    const wy = widgetsRect.top + widgetsRect.height / 2
    if (distanceToSegment(x, y, openX, openY, wx, wy) <= APPROACH_PAD) {
      return true
    }
  }

  return false
}

/** Dismiss when the pointer leaves the menu, or moves away without entering the approach zone. */
export function watchCanvasContextMenuPointerDismiss(options: {
  openX: number
  openY: number
  getPanel: () => HTMLElement | null
  onDismiss: () => void
}): () => void {
  let enteredMenu = false

  function onPointerMove(event: PointerEvent) {
    const x = event.clientX
    const y = event.clientY
    const panel = options.getPanel()

    if (isInsideMenuOrWidgets(x, y, panel)) {
      enteredMenu = true
      return
    }

    if (enteredMenu) {
      options.onDismiss()
      return
    }

    if (
      !isInApproachZone(x, y, panel, options.openX, options.openY) &&
      Math.hypot(x - options.openX, y - options.openY) > MIN_AWAY_MOVE_PX
    ) {
      options.onDismiss()
    }
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  return () => window.removeEventListener('pointermove', onPointerMove)
}
