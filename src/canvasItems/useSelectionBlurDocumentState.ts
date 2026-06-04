import { useEffect } from 'react'

/**
 * Drives `data-selection-blur-active` + a one-frame blur reset so
 * `--selection-depth-blur` eases in via CSS (see `.ui-selection-depth`).
 */
export function useSelectionBlurDocumentState(active: boolean) {
  useEffect(() => {
    const root = document.documentElement
    if (!active) {
      root.removeAttribute('data-selection-blur-active')
      root.style.removeProperty('--selection-depth-blur')
      return
    }

    let cancelled = false
    root.removeAttribute('data-selection-blur-active')
    root.style.setProperty('--selection-depth-blur', '0px')
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        root.style.removeProperty('--selection-depth-blur')
        root.setAttribute('data-selection-blur-active', '')
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      root.removeAttribute('data-selection-blur-active')
      root.style.removeProperty('--selection-depth-blur')
    }
  }, [active])
}
