/** Match react-zoom-pan-pinch wheelStopEventTime — gap ends a trackpad pan burst. */
export const CANVAS_PAN_SESSION_GAP_MS = 160
/** @deprecated Use CANVAS_PAN_SESSION_GAP_MS */
export const TRACKPAD_PAN_SESSION_GAP_MS = CANVAS_PAN_SESSION_GAP_MS

export function isStudyHubWidgetTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest('[data-canvas-item="study_hub"]') != null ||
    target.closest('.study-hub-menu-focus-portal') != null
  )
}

/** Point under a single-finger touch — used when the touch target is the canvas wrapper. */
export function isStudyHubWidgetPoint(clientX: number, clientY: number): boolean {
  const hit = document.elementFromPoint(clientX, clientY)
  return isStudyHubWidgetTarget(hit)
}

/** Two-finger trackpad scroll / iPad scroll — not pinch-zoom (ctrl/meta wheel). */
export function isTrackpadPanWheel(event: WheelEvent): boolean {
  if (event.ctrlKey) return false
  return event.deltaX !== 0 || event.deltaY !== 0
}

export function isSingleTouchPan(event: TouchEvent): boolean {
  return event.touches.length === 1
}

export function isMultiTouchGesture(event: TouchEvent): boolean {
  return event.touches.length >= 2
}
