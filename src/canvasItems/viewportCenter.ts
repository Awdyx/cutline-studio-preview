import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToCanvas } from '../drawing/canvasCoords'
import { readEditablePlacementRect } from '../platform/viewportSize'

/** Upper-middle spawn on desktop — matches reference screenshot. */
export const EDITABLE_SPAWN_VERTICAL_RATIO = 0.38

/** Touch spawn within the keyboard-safe band. */
const EDITABLE_SPAWN_TOUCH_VERTICAL_RATIO = 0.26

/** Room for the arrangement menu beside a newly spawned text item. */
const Z_MENU_HEIGHT_ESTIMATE = 220

const PLACEMENT_PADDING = 12

/** Horizontal center; verticalRatio 0.5 = viewport center. */
export function viewportPointCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost?: HTMLElement | null,
  verticalRatio = 0.5,
  horizontalRatio = 0.5,
  canvasEl?: HTMLElement | null,
): { x: number; y: number } | null {
  const clampedVertical = Math.min(1, Math.max(0, verticalRatio))
  const clampedHorizontal = Math.min(1, Math.max(0, horizontalRatio))

  const host =
    viewportHost ?? transformRef.current?.instance.wrapperComponent ?? null
  if (!host) return null

  const rect = host.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  return clientToCanvas(
    rect.left + rect.width * clampedHorizontal,
    rect.top + rect.height * clampedVertical,
    transformRef,
    canvasEl,
  )
}

export function viewportCenterCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost?: HTMLElement | null,
  canvasEl?: HTMLElement | null,
): { x: number; y: number } | null {
  return viewportPointCanvas(transformRef, viewportHost, 0.5, 0.5, canvasEl)
}

export function viewportEditableSpawnCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost: HTMLElement | null | undefined,
  canvasEl: HTMLElement | null | undefined,
  itemHeight: number,
): { x: number; y: number } | null {
  const host =
    viewportHost ?? transformRef.current?.instance.wrapperComponent ?? null

  const placement = readEditablePlacementRect(host)
  const isTouch = window.matchMedia('(pointer: coarse)').matches

  const screenX = placement.left + placement.width / 2

  const verticalRatio = isTouch
    ? EDITABLE_SPAWN_TOUCH_VERTICAL_RATIO
    : EDITABLE_SPAWN_VERTICAL_RATIO

  let itemTop =
    placement.top + placement.height * verticalRatio - itemHeight / 2
  const maxItemTop =
    placement.top +
    placement.height -
    PLACEMENT_PADDING -
    Z_MENU_HEIGHT_ESTIMATE -
    itemHeight
  itemTop = Math.min(itemTop, maxItemTop)
  itemTop = Math.max(placement.top + PLACEMENT_PADDING, itemTop)
  const screenY = itemTop + itemHeight / 2

  return clientToCanvas(screenX, screenY, transformRef, canvasEl ?? null)
}
