import { useEffect, useState, type RefObject } from 'react'

function isElementInteractive(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  const style = window.getComputedStyle(el)
  if (style.pointerEvents === 'none') return false
  if (style.visibility === 'hidden' || style.display === 'none') return false
  return true
}

function isIgnorableOccluder(el: Element): boolean {
  if (el.closest('[data-canvas-item-z-menu]')) return true
  if (el.closest('.ui-selection-depth')) return true
  return false
}

/** True when another interactive layer sits above this handle (e.g. transparent image). */
export function isCanvasHandleOccluded(handleEl: HTMLElement | null): boolean {
  if (!handleEl) return false

  const rect = handleEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const stack = document.elementsFromPoint(x, y)
  const handleRoot =
    handleEl.closest('.canvas-item-drag-handle, .canvas-item-resize-handle') ??
    handleEl

  for (const hit of stack) {
    if (!(hit instanceof Element)) continue
    if (isIgnorableOccluder(hit)) continue
    if (!isElementInteractive(hit)) continue
    return !(handleRoot === hit || handleRoot.contains(hit))
  }

  return false
}

export function useCanvasHandleOccluded(
  handleRef: RefObject<HTMLElement | null>,
  active = true,
  revisionKey = '',
): boolean {
  const [occluded, setOccluded] = useState(false)

  useEffect(() => {
    if (!active) {
      setOccluded(false)
      return
    }

    let raf = 0
    const check = () => {
      const next = isCanvasHandleOccluded(handleRef.current)
      setOccluded((prev) => (prev === next ? prev : next))
    }

    const scheduleCheck = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(check)
    }

    check()
    const interval = window.setInterval(check, 280)
    window.addEventListener('scroll', scheduleCheck, true)
    window.addEventListener('resize', scheduleCheck)
    window.addEventListener('pointermove', scheduleCheck, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(interval)
      window.removeEventListener('scroll', scheduleCheck, true)
      window.removeEventListener('resize', scheduleCheck)
      window.removeEventListener('pointermove', scheduleCheck)
    }
  }, [active, handleRef, revisionKey])

  return occluded
}
