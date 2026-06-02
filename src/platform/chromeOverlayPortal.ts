/** Portal mount for viewport-fixed chrome overlays (study hub menu focus, etc.). */
export const CHROME_OVERLAY_PORTAL_ID = 'cutline-chrome-overlays'

export function chromeOverlayPortalRoot(): HTMLElement {
  return (
    document.getElementById(CHROME_OVERLAY_PORTAL_ID) ??
    document.body
  )
}
