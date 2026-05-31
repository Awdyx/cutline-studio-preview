import { useLayoutEffect, useState, type RefObject } from 'react'
import { readChromeEdgeInset } from '../platform/chromeLayout'

type SubmenuSide = 'left' | 'right'

export function useSubmenuPosition(
  anchorRef: RefObject<HTMLElement | null>,
  options?: {
    gapPx?: number
    side?: SubmenuSide
    widthPx?: number
    maxHeightPx?: number
    viewportPadPx?: number
    /** Align submenu bottom to this element's bottom instead of anchor top. */
    alignBottomToRef?: RefObject<HTMLElement | null>
    /** Vertically center submenu within this element (e.g. parent menu panel). */
    alignCenterToRef?: RefObject<HTMLElement | null>
    /** Measured flyout height — use when centering so shorter panels sit truly centered. */
    panelRef?: RefObject<HTMLElement | null>
    /** Use this element's horizontal edge for left/right placement (defaults to anchor). */
    horizontalAlignToRef?: RefObject<HTMLElement | null>
    enabled?: boolean
  },
): { top: number; left: number; maxHeight: number } {
  const gapPx = options?.gapPx ?? 8
  const side = options?.side ?? 'right'
  const widthPx = options?.widthPx ?? 0
  const maxHeightPx = options?.maxHeightPx ?? 0
  const viewportPadPx = options?.viewportPadPx ?? readChromeEdgeInset()
  const alignBottomToRef = options?.alignBottomToRef
  const alignCenterToRef = options?.alignCenterToRef
  const panelRef = options?.panelRef
  const horizontalAlignToRef = options?.horizontalAlignToRef
  const enabled = options?.enabled ?? true
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: maxHeightPx || 420 })

  useLayoutEffect(() => {
    if (!enabled) return
    const el = anchorRef.current
    if (!el) return

    function update() {
      const anchor = anchorRef.current
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const hRect = horizontalAlignToRef?.current?.getBoundingClientRect() ?? r
      const left =
        side === 'right' ? hRect.right + gapPx : hRect.left - gapPx - widthPx

      const centerRect = alignCenterToRef?.current?.getBoundingClientRect()
      const boundsEl = alignBottomToRef?.current
      const boundsRect = boundsEl?.getBoundingClientRect()

      const measuredHeight = panelRef?.current?.offsetHeight ?? 0
      let panelHeight = maxHeightPx > 0 ? maxHeightPx : window.innerHeight - viewportPadPx * 2
      if (measuredHeight > 0) {
        panelHeight = Math.min(measuredHeight, panelHeight)
      }
      if (boundsRect && !centerRect) {
        panelHeight = Math.min(panelHeight, boundsRect.height, window.innerHeight - viewportPadPx * 2)
      }
      if (centerRect) {
        panelHeight = Math.min(panelHeight, centerRect.height, window.innerHeight - viewportPadPx * 2)
      }

      let top: number
      if (centerRect) {
        top = centerRect.top + (centerRect.height - panelHeight) / 2
      } else if (boundsRect) {
        top = boundsRect.bottom - panelHeight
      } else {
        top = r.top
      }

      const heightForClamp =
        measuredHeight > 0
          ? measuredHeight
          : maxHeightPx > 0
            ? maxHeightPx
            : centerRect || boundsRect
              ? panelHeight
              : 0
      if (heightForClamp > 0) {
        top = Math.max(
          viewportPadPx,
          Math.min(top, window.innerHeight - heightForClamp - viewportPadPx),
        )
      }

      setPos({ top, left, maxHeight: panelHeight })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    const panelEl = panelRef?.current
    const ro = panelEl ? new ResizeObserver(update) : null
    ro?.observe(panelEl!)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      ro?.disconnect()
    }
  }, [
    alignBottomToRef,
    alignCenterToRef,
    anchorRef,
    gapPx,
    horizontalAlignToRef,
    maxHeightPx,
    panelRef,
    side,
    enabled,
    viewportPadPx,
    widthPx,
  ])

  return pos
}
