import { useLayoutEffect, useState, type RefObject } from 'react'
import { readLayoutViewport } from '../platform/viewportSize'

const EDGE_MARGIN = 8

export function usePanelAlignedSubmenuLayout(
  panelRef: RefObject<HTMLElement | null>,
  width: number,
  gap = 10,
) {
  const [layout, setLayout] = useState({ top: 0, left: 0, height: 0 })

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    function update() {
      const el = panelRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vp = readLayoutViewport()

      let top = r.top
      let left = r.left - gap - width
      let height = r.height

      const minTop = vp.top + EDGE_MARGIN
      const maxBottom = vp.top + vp.height - EDGE_MARGIN
      top = Math.max(minTop, top)
      height = Math.min(height, Math.max(0, maxBottom - top))

      const minLeft = vp.left + EDGE_MARGIN
      const maxLeft = vp.left + vp.width - width - EDGE_MARGIN
      left = Math.max(minLeft, Math.min(left, maxLeft))

      setLayout({ top, left, height })
    }

    update()
    window.addEventListener('resize', update)
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [panelRef, width, gap])

  return layout
}
