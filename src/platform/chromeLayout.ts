/** Base desktop inset from the window edge before Tauri / safe-area nudges. */
export const CHROME_EDGE_BASE_PX = 16

/** Top of dropdown panels below the fixed top bar row. */
export const CHROME_PANEL_TOP_PX = 64

export const desktopChromeEdgeLeft = 'var(--chrome-edge-left, 16px)'
export const desktopChromeEdgeRight = 'var(--chrome-edge-right, 16px)'
export const desktopChromeEdgeTop = 'var(--chrome-edge-top, 16px)'
export const desktopChromePanelTop = 'var(--chrome-panel-top, 64px)'

/** Align dropdown panels with top-bar triggers (edge inset + column padding). */
export const desktopChromePanelAnchorLeft = 'var(--chrome-panel-anchor-left, 16px)'
export const desktopChromePanelAnchorRight = 'var(--chrome-panel-anchor-right, 16px)'

/** Right-anchored chrome panel offset from the viewport edge (matches trigger column). */
export function chromePanelRight(offsetPx: number): string {
  return `calc(${offsetPx}px + 2 * var(--chrome-outer-nudge, 0px))`
}

/** Read effective horizontal inset for flyout clamping (edge + column padding). */
export function readChromeEdgeInset(): number {
  if (typeof document === 'undefined') return CHROME_EDGE_BASE_PX
  const nudge = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--chrome-outer-nudge'),
  )
  const outerNudge = Number.isFinite(nudge) ? nudge : 0
  return CHROME_EDGE_BASE_PX + outerNudge * 2
}
