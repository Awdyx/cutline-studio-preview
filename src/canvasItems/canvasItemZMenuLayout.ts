import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { readLayoutViewport } from '../platform/viewportSize'
import { Z_MENU_GAP } from './grabZone'

const VIEWPORT_PADDING = 8

export function getSoleSelectedItemId(
  selectedIds: readonly string[],
): string | null {
  return selectedIds.length === 1 ? selectedIds[0] : null
}

export type ZMenuSide = 'left' | 'right'

export interface ElementBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ZMenuLayout {
  left: number
  top: number
  translateX: string
  side: ZMenuSide
  transformOrigin: string
}

function horizontalOverflow(
  leftEdge: number,
  rightEdge: number,
  viewportLeft: number,
  viewportRight: number,
): number {
  const leftClip = Math.max(0, viewportLeft + VIEWPORT_PADDING - leftEdge)
  const rightClip = Math.max(0, rightEdge - (viewportRight - VIEWPORT_PADDING))
  return leftClip + rightClip
}

export function computeZMenuLayoutFromBounds(
  bounds: ElementBounds,
  menuWidth: number,
  menuHeight: number,
): ZMenuLayout {
  const viewport = readLayoutViewport()
  const viewportLeft = viewport.left
  const viewportRight = viewport.left + viewport.width
  const viewportTop = viewport.top
  const viewportBottom = viewport.top + viewport.height

  const leftAnchor = bounds.left - Z_MENU_GAP
  const rightAnchor = bounds.right + Z_MENU_GAP

  const leftPlacement = {
    leftEdge: leftAnchor - menuWidth,
    rightEdge: leftAnchor,
    left: leftAnchor,
    translateX: '-100%',
    side: 'left' as const,
    transformOrigin: 'center right',
  }

  const rightPlacement = {
    leftEdge: rightAnchor,
    rightEdge: rightAnchor + menuWidth,
    left: rightAnchor,
    translateX: '0',
    side: 'right' as const,
    transformOrigin: 'center left',
  }

  const leftOverflow = horizontalOverflow(
    leftPlacement.leftEdge,
    leftPlacement.rightEdge,
    viewportLeft,
    viewportRight,
  )
  const rightOverflow = horizontalOverflow(
    rightPlacement.leftEdge,
    rightPlacement.rightEdge,
    viewportLeft,
    viewportRight,
  )

  const placement =
    leftOverflow === 0
      ? leftPlacement
      : rightOverflow === 0
        ? rightPlacement
        : leftOverflow <= rightOverflow
          ? leftPlacement
          : rightPlacement

  let top = bounds.top
  if (top < viewportTop + VIEWPORT_PADDING) {
    top = viewportTop + VIEWPORT_PADDING
  } else if (top + menuHeight > viewportBottom - VIEWPORT_PADDING) {
    top = Math.max(
      viewportTop + VIEWPORT_PADDING,
      viewportBottom - VIEWPORT_PADDING - menuHeight,
    )
  }

  return {
    left: placement.left,
    top,
    translateX: placement.translateX,
    side: placement.side,
    transformOrigin: placement.transformOrigin,
  }
}

function defaultLayoutFromBounds(bounds: ElementBounds): ZMenuLayout {
  return {
    left: bounds.left - Z_MENU_GAP,
    top: bounds.top,
    translateX: '-100%',
    side: 'left',
    transformOrigin: 'center right',
  }
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

function layoutsEqual(a: ZMenuLayout, b: ZMenuLayout): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.translateX === b.translateX &&
    a.side === b.side &&
    a.transformOrigin === b.transformOrigin
  )
}

export function useCanvasItemZMenuLayout(
  menuRef: RefObject<HTMLElement | null>,
  itemId: string | null,
  enabled: boolean,
): ZMenuLayout {
  const [layout, setLayout] = useState<ZMenuLayout>({
    left: 0,
    top: 0,
    translateX: '-100%',
    side: 'left',
    transformOrigin: 'center right',
  })

  const lastLayoutRef = useRef<ZMenuLayout | null>(null)

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
        ? computeZMenuLayoutFromBounds(
            bounds,
            menuEl.offsetWidth,
            menuEl.offsetHeight,
          )
        : defaultLayoutFromBounds(bounds)

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
