import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'

/** Bumps when the menu-focus viewport changes size (window resize, wrapper layout). */
export function useStudyHubMenuFocusViewportTick(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  active: boolean,
): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return

    let raf = 0
    const bump = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setTick((value) => value + 1)
      })
    }

    window.addEventListener('resize', bump, { passive: true })
    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', bump, { passive: true })
    visualViewport?.addEventListener('scroll', bump, { passive: true })
    const wrapper = transformRef.current?.instance?.wrapperComponent
    const observer = wrapper ? new ResizeObserver(bump) : null
    if (wrapper && observer) observer.observe(wrapper)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', bump)
      visualViewport?.removeEventListener('resize', bump)
      visualViewport?.removeEventListener('scroll', bump)
      observer?.disconnect()
    }
  }, [active, transformRef])

  return tick
}
