import {
  isCanvasItemUiAnchorId,
  UI_PIN_DEFAULT_EMOJI_SIZE,
  UI_PIN_DEFAULT_SIZE,
  clampPinSize,
  type UiAnchorId,
  type UiPinAsset,
} from './types'
import { uiAnchorElement } from './uiAnchorFocusScale'

/** Canvas widgets are larger than chrome — allow bigger pins. */
export const CANVAS_ITEM_PIN_MIN_SIZE = 36
export const CANVAS_ITEM_PIN_MAX_SIZE = 128

/** Longest-edge size as a fraction of the anchor's smaller layout dimension. */
const CANVAS_ITEM_EMOJI_FRACTION = 0.15
const CANVAS_ITEM_MEDIA_FRACTION = 0.22
const CANVAS_ITEM_DRAWING_FRACTION = 0.38

export function clampCanvasItemPinSize(value: number): number {
  return Math.min(
    CANVAS_ITEM_PIN_MAX_SIZE,
    Math.max(CANVAS_ITEM_PIN_MIN_SIZE, value),
  )
}

export function clampPinSizeForAnchor(anchorId: UiAnchorId, value: number): number {
  if (isCanvasItemUiAnchorId(anchorId)) return clampCanvasItemPinSize(value)
  return clampPinSize(value)
}

function canvasItemAnchorFootprint(anchorId: UiAnchorId): number {
  const el = uiAnchorElement(anchorId)
  if (!el) return 280
  return Math.max(1, Math.min(el.offsetWidth, el.offsetHeight))
}

/** Default spawn size — chrome uses fixed px; canvas scales to element footprint. */
export function defaultPinSizeForAnchor(
  anchorId: UiAnchorId,
  asset: UiPinAsset,
): number {
  if (!isCanvasItemUiAnchorId(anchorId)) {
    if (asset.kind === 'emoji') return UI_PIN_DEFAULT_EMOJI_SIZE
    if (asset.kind === 'drawing') return Math.round(UI_PIN_DEFAULT_SIZE * 3)
    return UI_PIN_DEFAULT_SIZE
  }

  const footprint = canvasItemAnchorFootprint(anchorId)
  const fraction =
    asset.kind === 'emoji'
      ? CANVAS_ITEM_EMOJI_FRACTION
      : asset.kind === 'drawing'
        ? CANVAS_ITEM_DRAWING_FRACTION
        : CANVAS_ITEM_MEDIA_FRACTION

  return clampCanvasItemPinSize(Math.round(footprint * fraction))
}
