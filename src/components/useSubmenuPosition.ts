import { useLayoutEffect, useState, type RefObject } from 'react'

type SubmenuSide = 'left' | 'right'

export function useSubmenuPosition(
  anchorRef: RefObject<HTMLElement | null>,
  options?: { gapPx?: number; side?: SubmenuSide; widthPx?: number },
): { top: number; left: number } {
  const gapPx = options?.gapPx ?? 8
  const side = options?.side ?? 'right'
  const widthPx = options?.widthPx ?? 0
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return

    function update() {
      const anchor = anchorRef.current
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const left =
        side === 'right' ? r.right + gapPx : r.left - gapPx - widthPx
      setPos({ top: r.top, left })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef, gapPx, side, widthPx])

  return pos
}
