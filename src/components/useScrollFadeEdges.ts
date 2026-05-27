import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useScrollFadeEdges(enabled = true, deps: unknown[] = []) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 6
    setCanScrollUp(el.scrollTop > threshold)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - threshold)
  }, [])

  useLayoutEffect(() => {
    if (!enabled) return
    updateScrollEdges()
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', updateScrollEdges, { passive: true })
    const ro = new ResizeObserver(updateScrollEdges)
    ro.observe(el)
    // Also observe inner content — `scrollHeight` only changes when children
    // resize, and the scroll wrapper itself often has a fixed height (so its
    // bounding box wouldn't trigger ResizeObserver on its own).
    for (const child of Array.from(el.children)) {
      ro.observe(child)
    }
    const mo = new MutationObserver(() => {
      updateScrollEdges()
      for (const child of Array.from(el.children)) {
        try {
          ro.observe(child)
        } catch {
          /* noop */
        }
      }
    })
    mo.observe(el, { childList: true, subtree: true })
    // Re-check on the next animation frame too — covers async content (e.g.
    // image / emoji data) that lays out after the initial layout pass.
    const raf = requestAnimationFrame(updateScrollEdges)
    return () => {
      el.removeEventListener('scroll', updateScrollEdges)
      ro.disconnect()
      mo.disconnect()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deps refresh fade when content changes
  }, [enabled, updateScrollEdges, ...deps])

  return { scrollRef, canScrollUp, canScrollDown, onScroll: updateScrollEdges }
}
