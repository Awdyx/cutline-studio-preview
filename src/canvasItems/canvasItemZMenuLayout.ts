import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { readLayoutViewport } from '../platform/viewportSize'
import { isPhoneLayout } from '../platform/layoutProfile'
import { PHONE_Z_ORDER_MENU_SCALE } from '../styles/phoneChrome'
import {
  Z_MENU_GAP,
  Z_MENU_MIN_WIDTH,
  Z_MENU_MIN_WIDTH_PHONE,
} from './grabZone'

const VIEWPORT_PADDING = 8
/** Conservative height before the menu mounts and measures. */
const Z_MENU_HEIGHT_ESTIMATE = 220

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

function fitsHorizontally(
  leftEdge: number,
  rightEdge: number,
  viewportLeft: number,
  viewportRight: number,
): boolean {
  return (
    leftEdge >= viewportLeft + VIEWPORT_PADDING &&
    rightEdge <= viewportRight - VIEWPORT_PADDING
  )
}

function clampHorizontalAnchor(
  anchorLeft: number,
  side: ZMenuSide,
  menuWidth: number,
  viewportLeft: number,
  viewportRight: number,
): number {
  const minLeft = viewportLeft + VIEWPORT_PADDING
  const maxRight = viewportRight - VIEWPORT_PADDING

  if (side === 'left') {
    const minAnchor = minLeft + menuWidth
    const maxAnchor = maxRight
    return Math.min(Math.max(anchorLeft, minAnchor), maxAnchor)
  }

  const minAnchor = minLeft
  const maxAnchor = maxRight - menuWidth
  return Math.min(Math.max(anchorLeft, minAnchor), maxAnchor)
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
  const paddedLeft = viewportLeft + VIEWPORT_PADDING
  const paddedRight = viewportRight - VIEWPORT_PADDING

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

  const leftFits = fitsHorizontally(
    leftPlacement.leftEdge,
    leftPlacement.rightEdge,
    viewportLeft,
    viewportRight,
  )
  const rightFits = fitsHorizontally(
    rightPlacement.leftEdge,
    rightPlacement.rightEdge,
    viewportLeft,
    viewportRight,
  )

  const spaceLeft = bounds.left - paddedLeft
  const spaceRight = paddedRight - bounds.right

  let placement: typeof leftPlacement | typeof rightPlacement
  if (leftFits && rightFits) {
    // Prefer the side with more room — stay away from the nearest window edge.
    placement = spaceRight >= spaceLeft ? rightPlacement : leftPlacement
  } else if (rightFits) {
    placement = rightPlacement
  } else if (leftFits) {
    placement = leftPlacement
  } else {
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
    placement =
      leftOverflow <= rightOverflow ? leftPlacement : rightPlacement
  }

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
    left: clampHorizontalAnchor(
      placement.left,
      placement.side,
      menuWidth,
      viewportLeft,
      viewportRight,
    ),
    top,
    translateX: placement.translateX,
    side: placement.side,
    transformOrigin: placement.transformOrigin,
  }
}

function estimatedMenuWidth(): number {
  return isPhoneLayout() ? Z_MENU_MIN_WIDTH_PHONE : Z_MENU_MIN_WIDTH
}

/** Union screen bounds for every shell/preview node sharing this item id. */
export function readCanvasItemScreenBounds(itemId: string): ElementBounds | null {
  const nodes = document.querySelectorAll(
    `[data-item-id="${CSS.escape(itemId)}"]`,
  )
  if (nodes.length === 0) return null

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue
    const rect = node.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) continue
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  if (!Number.isFinite(left)) return null

  return { left, top, right, bottom }
}

function readItemBounds(itemId: string): ElementBounds | null {
  return readCanvasItemScreenBounds(itemId)
}

function readMenuDimensions(menuEl: HTMLElement): { width: number; height: number } {
  const rect = menuEl.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height }
  }

  const layoutScale = isPhoneLayout() ? PHONE_Z_ORDER_MENU_SCALE : 1
  const width = menuEl.offsetWidth * layoutScale
  const height = menuEl.offsetHeight * layoutScale

  return {
    width: width > 0 ? width : estimatedMenuWidth(),
    height: height > 0 ? height : Z_MENU_HEIGHT_ESTIMATE,
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

      const menuSize = menuEl
        ? readMenuDimensions(menuEl)
        : { width: estimatedMenuWidth(), height: Z_MENU_HEIGHT_ESTIMATE }
      const next = computeZMenuLayoutFromBounds(
        bounds,
        menuSize.width,
        menuSize.height,
      )

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
