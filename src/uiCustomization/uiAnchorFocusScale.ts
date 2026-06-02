import { useCanvasCustomizeStore } from '../canvasItemCustomize/canvasCustomizeStore'
import { isCanvasItemUiAnchorId, parseCanvasItemIdFromUiAnchor } from './types'
import { UI_FOCUS_SCALE } from './uiCustomizationStore'

/** Screen scale from an anchor's layout box to its transformed screen box. */
export function readUiAnchorVisualScale(anchorEl: HTMLElement | null): number {
  if (!anchorEl) return 1
  const logicalW = anchorEl.offsetWidth
  if (logicalW <= 0) return 1
  const visualW = anchorEl.getBoundingClientRect().width
  const scale = visualW / logicalW
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

export function uiAnchorElement(anchorId: string): HTMLElement | null {
  const focused = document.querySelector<HTMLElement>(
    `[data-ui-anchor='${anchorId}'][data-ui-anchor-focused='1']`,
  )
  if (focused) return focused

  if (isCanvasItemUiAnchorId(anchorId)) {
    const liftedShell = document.querySelector<HTMLElement>(
      `[data-ui-canvas-item-customize-lift][data-item-id='${parseCanvasItemIdFromUiAnchor(anchorId)}']`,
    )
    if (liftedShell) return liftedShell
  }

  const matches = document.querySelectorAll<HTMLElement>(
    `[data-ui-anchor='${anchorId}']`,
  )
  for (const el of matches) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return el
  }
  return matches[0] ?? null
}

/** Screen-pixel drag deltas → anchor-local pin offsets. */
export function uiAnchorFocusScale(anchorId: string): number {
  if (isCanvasItemUiAnchorId(anchorId)) {
    const itemId = parseCanvasItemIdFromUiAnchor(anchorId)
    const lift = useCanvasCustomizeStore.getState().lift
    if (lift?.itemId === itemId && lift.screenWidth > 0) {
      const el = uiAnchorElement(anchorId)
      const logicalW = el?.offsetWidth ?? 0
      if (logicalW > 0) return lift.screenWidth / logicalW
    }
  }

  const el = uiAnchorElement(anchorId)
  if (el) return readUiAnchorVisualScale(el)
  return isCanvasItemUiAnchorId(anchorId) ? 1 : UI_FOCUS_SCALE
}
