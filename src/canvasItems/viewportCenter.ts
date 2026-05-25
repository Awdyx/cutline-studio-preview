import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToCanvas } from '../drawing/canvasCoords'
import { PHONE_HEADER_BLOCK_HEIGHT } from '../styles/phoneChrome'
import { readEditablePlacementRect } from '../platform/viewportSize'

/** Upper-middle spawn on desktop — matches reference screenshot. */
export const EDITABLE_SPAWN_VERTICAL_RATIO = 0.38

/** Touch spawn centred in the keyboard-safe band (top half of screen). */
const EDITABLE_SPAWN_TOUCH_VERTICAL_RATIO = 0.5

/** Room for the arrangement menu beside a newly spawned text item. */
const Z_MENU_HEIGHT_ESTIMATE = 220

const PLACEMENT_PADDING = 12

/** Clearance above the phone FAB row (52px row + 12px gap + safe area). */
const PHONE_SPAWN_BOTTOM_INSET = 76

/** Safe area below the phone header block. */
const PHONE_SPAWN_TOP_EXTRA = 12

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

/** Center spawn in the visible canvas band — clears top chrome and bottom FAB. */
export function viewportBalancedSpawnCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost: HTMLElement | null | undefined,
  canvasEl: HTMLElement | null | undefined,
): { x: number; y: number } | null {
  const host =
    viewportHost ?? transformRef.current?.instance.wrapperComponent ?? null
  if (!host) return null

  const rect = host.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const isTouch = window.matchMedia('(pointer: coarse)').matches
  const topInset = isTouch
    ? PHONE_HEADER_BLOCK_HEIGHT + PHONE_SPAWN_TOP_EXTRA
    : 52
  const bottomInset = isTouch ? PHONE_SPAWN_BOTTOM_INSET : 88
  const screenX = rect.left + rect.width / 2
  const bandHeight = Math.max(0, rect.height - topInset - bottomInset)
  const screenY = rect.top + topInset + bandHeight / 2

  return clientToCanvas(screenX, screenY, transformRef, canvasEl ?? null)
}

/** Default spawn point — balanced on touch, centered (or editable) on desktop. */
export function viewportItemSpawnCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost: HTMLElement | null | undefined,
  canvasEl: HTMLElement | null | undefined,
  options?: { editableTextHeight?: number },
): { x: number; y: number } | null {
  if (options?.editableTextHeight != null) {
    return viewportEditableSpawnCanvas(
      transformRef,
      viewportHost,
      canvasEl,
      options.editableTextHeight,
    )
  }
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (isTouch) {
    return viewportBalancedSpawnCanvas(transformRef, viewportHost, canvasEl)
  }
  return viewportCenterCanvas(transformRef, viewportHost, canvasEl)
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
