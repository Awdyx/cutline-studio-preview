import { useEffect, useRef, type CSSProperties } from 'react'
import type { Transition } from 'framer-motion'
import { idleAfterFirstPaint, isTouchFirstDevice } from './compositor'
import { CHROME_MENU_TRANSITION } from '../styles/tokens'
import {
  phoneSubmenuSlideMotion,
  phoneTopPanelSlideMotion,
} from '../styles/phoneChrome'

export const CHROME_TOP_PANEL_SELECTOR = '[data-top-chrome-panel]'

const PROFILE_PANEL_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const

function nudgeBackdropFilterOnPanel(node: HTMLElement): void {
  node.style.setProperty('-webkit-backdrop-filter', 'none')
  node.style.setProperty('backdrop-filter', 'none')
  void node.offsetHeight
  node.style.removeProperty('-webkit-backdrop-filter')
  node.style.removeProperty('backdrop-filter')
}

/** One-time frost compositor warmup after top panels mount (mirrors canvas warmup). */
export function refreshChromeTopPanelsWarmup(root: ParentNode = document): void {
  if (isTouchFirstDevice()) return
  root.querySelectorAll(CHROME_TOP_PANEL_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (!node.classList.contains('plus-fab-menu-glass')) return
    nudgeBackdropFilterOnPanel(node)
  })
}

export function useChromePanelsPreload(ready: boolean): void {
  const doneRef = useRef(false)

  useEffect(() => {
    if (!ready || doneRef.current) return

    let cancelled = false
    void idleAfterFirstPaint(350).then(() => {
      if (cancelled) return
      doneRef.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) refreshChromeTopPanelsWarmup()
        })
      })
    })

    return () => {
      cancelled = true
    }
  }, [ready])
}

export type ChromeTopPanelMotionVariant = 'default' | 'profile' | 'cutline-phone'

export function chromeTopPanelMotionProps(
  isOpen: boolean,
  isPhone: boolean,
  variant: ChromeTopPanelMotionVariant = 'default',
): {
  initial: false
  animate: Record<string, number>
  transition: Transition
} {
  if (isPhone) {
    const phone =
      variant === 'cutline-phone' ? phoneSubmenuSlideMotion : phoneTopPanelSlideMotion
    return {
      initial: false,
      animate: (isOpen ? phone.animate : phone.initial) as Record<string, number>,
      transition: phone.transition,
    }
  }

  if (variant === 'profile') {
    return {
      initial: false,
      animate: isOpen
        ? { opacity: 1, scale: 1, y: 0 }
        : { opacity: 0, scale: 0.98, y: -2 },
      transition: PROFILE_PANEL_TRANSITION,
    }
  }

  return {
    initial: false,
    animate: isOpen
      ? { opacity: 1, scale: 1, y: 0 }
      : { opacity: 0, scale: 0.96, y: -4 },
    transition: CHROME_MENU_TRANSITION,
  }
}

export function chromeTopPanelClosedStyle(isOpen: boolean): CSSProperties {
  return {
    pointerEvents: isOpen ? 'auto' : 'none',
    visibility: isOpen ? 'visible' : 'hidden',
  }
}
