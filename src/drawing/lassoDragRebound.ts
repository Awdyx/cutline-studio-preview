import { showStudioCentreBoundsToast } from '../canvas/studioCentre'
import { useLassoStore } from './useLassoStore'

const LASSO_REBOUND_MS = 420

function easeOutBack(t: number): number {
  const c1 = 1.12
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

let reboundRaf: number | null = null

export function animateLassoDragRebound(strokeIds: readonly string[]): void {
  if (reboundRaf != null) {
    cancelAnimationFrame(reboundRaf)
    reboundRaf = null
  }

  const cur = useLassoStore.getState().dragOffset
  const fromDx = cur?.canvasDx ?? 0
  const fromDy = cur?.canvasDy ?? 0
  if (fromDx === 0 && fromDy === 0) {
    useLassoStore.getState().setDragOffset(null)
    showStudioCentreBoundsToast()
    return
  }

  const started = performance.now()

  const tick = (now: number) => {
    const t = Math.min(1, (now - started) / LASSO_REBOUND_MS)
    const eased = easeOutBack(t)

    useLassoStore.getState().setDragOffset({
      canvasDx: fromDx * (1 - eased),
      canvasDy: fromDy * (1 - eased),
      ids: [...strokeIds],
    })

    if (t < 1) {
      reboundRaf = requestAnimationFrame(tick)
      return
    }

    reboundRaf = null
    useLassoStore.getState().setDragOffset(null)
    showStudioCentreBoundsToast()
  }

  reboundRaf = requestAnimationFrame(tick)
}
