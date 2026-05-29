import type { Transition } from 'framer-motion'
import { animate, useMotionValue, type MotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Shared bottom-right FAB row geometry — pen sits left of + when both are visible. */
export const BOTTOM_RIGHT_FAB_MARGIN_PX = 16
export const BOTTOM_RIGHT_FAB_SIZE_PX = 52
export const BOTTOM_RIGHT_FAB_GAP_PX = 12
export const BOTTOM_RIGHT_FAB_SLOT_SHIFT_PX =
  BOTTOM_RIGHT_FAB_SIZE_PX + BOTTOM_RIGHT_FAB_GAP_PX

/** Squash-and-stretch peaks while the pen FAB slides between slots. */
export const PEN_FAB_STRETCH_PEAK_X = 1.18
export const PEN_FAB_STRETCH_PEAK_Y = 0.87
export const PEN_FAB_SOLO_REST_SCALE_X = 1.03

export const bottomRightFabRightCss = (marginPx = BOTTOM_RIGHT_FAB_MARGIN_PX) =>
  `calc(${marginPx}px + env(safe-area-inset-right, 0px))`

const FAB_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.72,
}

const FAB_ENTER_EASE = [0.22, 1, 0.36, 1] as const
const FAB_EXIT_EASE = [0.4, 0, 0.72, 0.35] as const
const PEN_FAB_STRETCH_EASE = [0.22, 1, 0.34, 1] as const

/** Pen slides into the + slot after + clears; yields space slightly before + returns. */
export function bottomRightFabPenSlideTransition(
  plusSlotOccupied: boolean,
  reduceMotion: boolean | null,
): Transition {
  if (reduceMotion) return { duration: 0.12 }
  const delay = plusSlotOccupied ? 0.04 : 0.1
  return { x: { ...FAB_SPRING, delay } }
}

export type PenFabSlideStretch = {
  scaleX: MotionValue<number>
  scaleY: MotionValue<number>
  transformOrigin: string
}

/** Rubber-band stretch on the pen trigger while it glides to the next slot. */
export function usePenFabSlideStretch(
  plusSlotOccupied: boolean,
  reduceMotion: boolean | null,
): PenFabSlideStretch {
  const scaleX = useMotionValue(plusSlotOccupied ? 1 : PEN_FAB_SOLO_REST_SCALE_X)
  const scaleY = useMotionValue(1)
  const [transformOrigin, setTransformOrigin] = useState('50% 50%')
  const skipStretchRef = useRef(true)

  useEffect(() => {
    const restX = plusSlotOccupied ? 1 : PEN_FAB_SOLO_REST_SCALE_X

    if (skipStretchRef.current) {
      skipStretchRef.current = false
      scaleX.set(restX)
      scaleY.set(1)
      return
    }

    if (reduceMotion) {
      scaleX.set(restX)
      scaleY.set(1)
      return
    }

    // Slide right into the solo slot — stretch leads the motion; slide left — anchor on the right.
    setTransformOrigin(plusSlotOccupied ? '72% 50%' : '28% 50%')

    const stretchMs = 0.58
    void animate(scaleX, [scaleX.get(), PEN_FAB_STRETCH_PEAK_X, restX], {
      duration: stretchMs,
      times: [0, 0.36, 1],
      ease: ['easeOut', PEN_FAB_STRETCH_EASE],
    })
    void animate(scaleY, [scaleY.get(), PEN_FAB_STRETCH_PEAK_Y, 1], {
      duration: stretchMs,
      times: [0, 0.36, 1],
      ease: ['easeOut', PEN_FAB_STRETCH_EASE],
    })
  }, [plusSlotOccupied, reduceMotion, scaleX, scaleY])

  return { scaleX, scaleY, transformOrigin }
}

/** + fades/scales out quickly; pen leads on exit, + trails in on return. */
export function bottomRightFabPlusTransition(
  chromeVisible: boolean,
  reduceMotion: boolean | null,
): Transition {
  if (reduceMotion) return { duration: 0.12 }

  if (chromeVisible) {
    return {
      opacity: { duration: 0.36, ease: FAB_ENTER_EASE, delay: 0.08 },
      scale: { ...FAB_SPRING, stiffness: 420, damping: 28, mass: 0.62, delay: 0.06 },
      filter: { duration: 0.3, ease: 'easeOut', delay: 0.06 },
      y: { ...FAB_SPRING, stiffness: 400, damping: 30, mass: 0.68, delay: 0.06 },
    }
  }

  return {
    opacity: { duration: 0.24, ease: FAB_EXIT_EASE },
    scale: { duration: 0.24, ease: FAB_EXIT_EASE },
    filter: { duration: 0.2, ease: 'easeIn' },
    y: { duration: 0.24, ease: FAB_EXIT_EASE },
  }
}

export function bottomRightFabPlusAnimate(
  chromeVisible: boolean,
  reduceMotion: boolean | null,
) {
  if (reduceMotion) {
    return { opacity: chromeVisible ? 1 : 0 }
  }
  return {
    opacity: chromeVisible ? 1 : 0,
    scale: chromeVisible ? 1 : 0.88,
    filter: chromeVisible ? 'blur(0px)' : 'blur(6px)',
    y: chromeVisible ? 0 : 8,
  }
}
