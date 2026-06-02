import { createPortal, flushSync } from 'react-dom'
import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  liftFromTransformCss,
  liftToTransformCss,
  type CanvasItemLiftRecord,
} from './captureCanvasItemSnapshot'
import {
  CANVAS_CUSTOMIZE_LIFT_CSS_TRANSITION,
  CANVAS_CUSTOMIZE_LIFT_TRANSITION,
} from '../uiCustomization/canvasItemCustomizeLayout'
import {
  useCanvasCustomizeStore,
  type CanvasCustomizeEnterPhase,
} from './canvasCustomizeStore'

const LIFT_MS = Math.round(CANVAS_CUSTOMIZE_LIFT_TRANSITION.duration * 1000)

/**
 * Portals widget content to document.body with a single CSS transform.
 * React tree stays connected — sticky text / pins survive.
 */
export default function CanvasItemCustomizePortalStage({
  lift,
  itemId,
  layoutWidth,
  layoutHeight,
  clipOverflow,
  enterPhase,
  exiting,
  onExitComplete: _onExitComplete,
  children,
}: {
  lift: CanvasItemLiftRecord
  itemId: string
  layoutWidth: number
  layoutHeight: number
  clipOverflow: boolean
  enterPhase: CanvasCustomizeEnterPhase
  exiting: boolean
  /** Unused — exit lands on the canvas shell for correct z-order. */
  onExitComplete?: () => void
  children: ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const stagingAdvanceRef = useRef(false)
  const enterLiftStartedRef = useRef(false)

  // Staging: mount hidden at from-position, then advance to lifting after paint.
  useLayoutEffect(() => {
    if (enterPhase !== 'staging' || exiting) {
      stagingAdvanceRef.current = false
      return
    }
    if (stagingAdvanceRef.current) return
    stagingAdvanceRef.current = true

    const el = stageRef.current
    if (!el) return

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const rect = stageRef.current?.getBoundingClientRect()
        if (!rect || rect.width <= 0) {
          stagingAdvanceRef.current = false
          return
        }
        useCanvasCustomizeStore.getState().advanceEnterToLift()
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      stagingAdvanceRef.current = false
    }
  }, [enterPhase, exiting])

  // Enter lift: mirror exit — sync transition kickoff in useLayoutEffect.
  useLayoutEffect(() => {
    if (exiting || enterPhase !== 'lifting') return
    if (enterLiftStartedRef.current) return

    const el = stageRef.current
    if (!el) return

    const from = liftFromTransformCss(lift)
    const to = liftToTransformCss(lift)

    const complete = () => {
      useCanvasCustomizeStore.getState().completeEnterLift()
    }

    if (reduceMotion) {
      el.style.transition = 'none'
      el.style.transform = to
      el.style.opacity = '1'
      enterLiftStartedRef.current = true
      flushSync(() => {
        useCanvasCustomizeStore.setState({ enterCanvasHideReady: true })
      })
      complete()
      return
    }

    el.style.opacity = '1'
    el.style.transition = 'none'
    el.style.transform = from
    void el.offsetWidth
    flushSync(() => {
      useCanvasCustomizeStore.setState({ enterCanvasHideReady: true })
    })
    el.style.transition = CANVAS_CUSTOMIZE_LIFT_CSS_TRANSITION
    el.style.transform = to
    enterLiftStartedRef.current = true

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
  }, [enterPhase, exiting, lift, reduceMotion])

  useLayoutEffect(() => {
    if (enterPhase === 'idle' && !exiting) {
      enterLiftStartedRef.current = false
      stagingAdvanceRef.current = false
    }
  }, [enterPhase, exiting])

  const staging = enterPhase === 'staging' && !exiting
  const stageTransform =
    exiting || enterPhase === 'live'
      ? liftToTransformCss(lift)
      : liftFromTransformCss(lift)

  const stageStyle: CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: layoutWidth,
    height: layoutHeight,
    zIndex: 53,
    transform: stageTransform,
    transformOrigin: 'top left',
    transition: 'none',
    opacity: staging ? 0 : 1,
    overflow: clipOverflow ? 'hidden' : 'visible',
    pointerEvents: staging || exiting ? 'none' : 'auto',
    willChange: 'transform, opacity',
  }

  return createPortal(
    <div
      ref={stageRef}
      data-ui-canvas-item-customize-lift=""
      data-item-id={itemId}
      data-canvas-item-customize-stage=""
      data-canvas-item-customize-enter-phase={enterPhase}
      style={stageStyle}
    >
      {children}
    </div>,
    document.body,
  )
}
