import { useLayoutEffect, useRef } from 'react'
import type { CanvasItemLiftRecord } from './captureCanvasItemSnapshot'
import { CANVAS_CUSTOMIZE_LIFT_CSS_TRANSITION } from '../uiCustomization/canvasItemCustomizeLayout'
import { pulseUiAnchorMotionBlur } from '../uiCustomization/uiAnchorMotionBlur'

const LIFT_MS = 380

/** Canvas-local transform matching the portaled customize centre pose. */
export function canvasLocalLiftStartTransformCss(
  lift: CanvasItemLiftRecord,
): string {
  const localTx = (lift.x - lift.fromX) / lift.fromScale
  const localTy = (lift.y - lift.fromY) / lift.fromScale
  const scale = lift.scale / lift.fromScale
  return `translate3d(${localTx}px, ${localTy}px, 0) scale(${scale})`
}

const LANDED_TRANSFORM = 'translate3d(0, 0, 0) scale(1)'

/**
 * Animate the on-canvas shell from the customize centre pose back to its slot
 * so z-order matches the canvas stack during the whole exit (not just after land).
 */
export function useCanvasCustomizeExitLand(
  shellRef: React.RefObject<HTMLElement | null>,
  {
    enabled,
    lift,
    reduceMotion,
    onComplete,
  }: {
    enabled: boolean
    lift: CanvasItemLiftRecord | null
    reduceMotion: boolean | null
    onComplete: () => void
  },
): void {
  const startedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useLayoutEffect(() => {
    if (!enabled) {
      startedRef.current = false
      return
    }
    if (!lift || startedRef.current) return
    const el = shellRef.current
    if (!el) return
    startedRef.current = true

    const complete = () => {
      el.style.transition = ''
      el.style.transform = ''
      onCompleteRef.current()
    }

    if (reduceMotion) {
      el.style.transition = 'none'
      el.style.transform = LANDED_TRANSFORM
      complete()
      return
    }

    const lifted = canvasLocalLiftStartTransformCss(lift)
    el.style.transition = 'none'
    el.style.transform = lifted
    void el.offsetWidth
    el.style.transition = CANVAS_CUSTOMIZE_LIFT_CSS_TRANSITION
    el.style.transform = LANDED_TRANSFORM
    pulseUiAnchorMotionBlur(el)

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== 'transform') return
      el.removeEventListener('transitionend', onTransitionEnd)
      complete()
    }
    el.addEventListener('transitionend', onTransitionEnd)

    const fallback = window.setTimeout(() => {
      el.removeEventListener('transitionend', onTransitionEnd)
      complete()
    }, LIFT_MS + 80)

    return () => {
      window.clearTimeout(fallback)
      el.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [enabled, lift, reduceMotion, shellRef])
}
