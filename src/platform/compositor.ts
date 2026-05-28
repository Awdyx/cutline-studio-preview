/** Touch-primary devices — used to reduce animated mesh load on the canvas. */
export function isTouchFirstDevice(): boolean {
  if (typeof window === 'undefined') return false

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const ios =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  return coarse || ios
}

/** Sync html[data-touch-first] for CSS/JS perf guards (iPad / iPhone / coarse pointer). */
export function syncTouchFirstAttribute(): boolean {
  const touchFirst = isTouchFirstDevice()
  if (typeof document !== 'undefined') {
    if (touchFirst) document.documentElement.dataset.touchFirst = ''
    else delete document.documentElement.dataset.touchFirst
  }
  return touchFirst
}

export function idleAfterFirstPaint(timeoutMs = 300): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: timeoutMs })
      return
    }
    globalThis.setTimeout(resolve, 0)
  })
}

/** @deprecated Use isTouchFirstDevice — same signal, clearer name for motion/velocity tuning. */
export function prefersSolidCompositorLayers(): boolean {
  return isTouchFirstDevice()
}
