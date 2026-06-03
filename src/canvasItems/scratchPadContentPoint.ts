import type { StrokePoint } from '../drawing/types'

/** Map screen coords to scratch-pad content space (includes scroll offset). */
export function scratchPadContentPoint(
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement,
  contentEl: HTMLElement,
  pressure = 0.5,
): StrokePoint | null {
  const viewRect = scrollEl.getBoundingClientRect()
  const contentW = contentEl.offsetWidth
  const contentH = contentEl.offsetHeight
  if (viewRect.width <= 0 || viewRect.height <= 0 || contentW <= 0 || contentH <= 0) {
    return null
  }

  const x = clientX - viewRect.left
  const y = clientY - viewRect.top + scrollEl.scrollTop
  if (x < 0 || x > contentW || y < 0 || y > contentH) return null
  return { x, y, pressure }
}

export function isPointerOverScratchPadContent(
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement,
  contentEl: HTMLElement,
): boolean {
  return scratchPadContentPoint(clientX, clientY, scrollEl, contentEl) != null
}
