import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { readLayoutViewport } from '../platform/viewportSize'
import type { ElementBounds } from './canvasItemZMenuLayout'

const VIEWPORT_PADDING = 8
const INSET = 6

export type FontSizeMenuLayout = {
  left: number
  top: number
}

export function computeFontSizeMenuLayoutFromBounds(
  bounds: ElementBounds,
  menuWidth: number,
  menuHeight: number,
): FontSizeMenuLayout {
  const viewport = readLayoutViewport()
  const viewportLeft = viewport.left
  const viewportRight = viewport.left + viewport.width
  const viewportTop = viewport.top
  const viewportBottom = viewport.top + viewport.height

  let left = bounds.left + INSET
  let top = bounds.top - menuHeight - INSET

  if (left < viewportLeft + VIEWPORT_PADDING) {
    left = viewportLeft + VIEWPORT_PADDING
  }
  if (left + menuWidth > viewportRight - VIEWPORT_PADDING) {
    left = Math.max(
      viewportLeft + VIEWPORT_PADDING,
      viewportRight - VIEWPORT_PADDING - menuWidth,
    )
  }

  if (top < viewportTop + VIEWPORT_PADDING) {
    top = viewportTop + VIEWPORT_PADDING
  }
  if (top + menuHeight > viewportBottom - VIEWPORT_PADDING) {
    top = Math.max(
      viewportTop + VIEWPORT_PADDING,
      viewportBottom - VIEWPORT_PADDING - menuHeight,
    )
  }

  return { left, top }
}

function readItemBounds(itemId: string): ElementBounds | null {
  const el = document.querySelector(`[data-item-id="${itemId}"]`)
  if (!(el instanceof HTMLElement)) return null
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

function layoutsEqual(a: FontSizeMenuLayout, b: FontSizeMenuLayout): boolean {
  return a.left === b.left && a.top === b.top
}

export function useTextFontSizeMenuLayout(
  menuRef: RefObject<HTMLElement | null>,
  itemId: string | null,
  enabled: boolean,
): FontSizeMenuLayout {
  const [layout, setLayout] = useState<FontSizeMenuLayout>({ left: 0, top: 0 })
  const lastLayoutRef = useRef<FontSizeMenuLayout | null>(null)

  useLayoutEffect(() => {
    if (!enabled || !itemId) return

    const activeItemId = itemId
    let frame = 0
    lastLayoutRef.current = null

    function update() {
      const bounds = readItemBounds(activeItemId)
      const menuEl = menuRef.current
      if (!bounds) {
        frame = requestAnimationFrame(update)
        return
      }

      const next = menuEl
        ? computeFontSizeMenuLayoutFromBounds(
            bounds,
            menuEl.offsetWidth,
            menuEl.offsetHeight,
          )
        : { left: bounds.left + INSET, top: bounds.top - INSET }

      const prev = lastLayoutRef.current
      if (!prev || !layoutsEqual(prev, next)) {
        lastLayoutRef.current = next
        setLayout(next)
      }

      frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [menuRef, itemId, enabled])

  return layout
}
