/** Extra drawable / scrollable area below the visible scratch-pad viewport. */
export const STUDY_HUB_SCRATCH_PAD_SCROLL_EXTRA = 12_000

export function studyHubScratchPadContentHeight(viewportHeight: number): number {
  const viewH = Math.max(1, viewportHeight)
  return viewH + STUDY_HUB_SCRATCH_PAD_SCROLL_EXTRA
}

export function applyScratchPadScrollDelta(host: HTMLElement, deltaY: number): boolean {
  const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight)
  if (maxScroll <= 0 || deltaY === 0) return false
  const nextTop = Math.max(0, Math.min(maxScroll, host.scrollTop + deltaY))
  if (nextTop === host.scrollTop) return false
  host.scrollTop = nextTop
  return true
}
