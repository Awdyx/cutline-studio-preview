import { useLayoutEffect, useState, type RefObject } from 'react'

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
      setLayout({
        top: r.top,
        left: r.left - gap - width,
        height: r.height,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [panelRef, width, gap])

  return layout
}
