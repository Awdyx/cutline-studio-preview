/** Stable IDs for the chrome anchors that pins can attach to. */
export const UI_ANCHOR_IDS = [
  'brand-pill',
  'search-bar',
  'news',
  'notifications',
  'profile',
  'pen-fab',
  'plus-fab',
] as const

export type UiAnchorId = (typeof UI_ANCHOR_IDS)[number]

export type UiPinAsset =
  | { kind: 'emoji'; char: string }
  | { kind: 'image'; mediaId: string; aspect: number }
  | { kind: 'gif'; url: string; previewUrl?: string; aspect: number }
  | {
      kind: 'drawing'
      /** Strokes composing the drawing, each with its own path + colour. */
      strokes: Array<{ path: string; color: string; tool?: 'pen' | 'highlighter'; opacity?: number }>
      /**
       * SVG viewBox parameters in stroke-local coordinates. minX/minY let the
       * viewBox be offset so it tightly wraps only the drawn content — this
       * ensures rotation happens around the content centre, not the full canvas
       * centre (which could be mostly empty space).
       */
      viewBoxWidth: number
      viewBoxHeight: number
      /** Left edge of the tight content bounding box (default 0). */
      viewBoxMinX?: number
      /** Top edge of the tight content bounding box (default 0). */
      viewBoxMinY?: number
    }

export type UiPin = {
  id: string
  anchorId: UiAnchorId
  /** Pin centre offset from the anchor's centre, in CSS pixels (anchor-local). */
  offsetX: number
  offsetY: number
  /** Pin display size (longest edge), in CSS pixels. */
  size: number
  /** Rotation in degrees. */
  rotation: number
  asset: UiPinAsset
  /**
   * Explicit render width / height for image + gif pins (independent axes, no
   * aspect lock). Emoji + drawing pins derive size from `size` only.
   */
  width?: number
  height?: number
  /**
   * @deprecated Legacy free-form aspect — migrated to width/height on load.
   */
  aspectOverride?: number
}

export const UI_PIN_DEFAULT_SIZE = 48
/** Smaller initial size for emoji pins — they read as stickers, so the default
 *  longest-edge is tighter than the generic image / gif default. */
export const UI_PIN_DEFAULT_EMOJI_SIZE = 30
export const UI_PIN_MIN_SIZE = 20
export const UI_PIN_MAX_SIZE = 96

export type FreeFormPinAsset = Extract<UiPinAsset, { kind: 'image' | 'gif' }>

export function isFreeFormPinAsset(
  asset: UiPinAsset,
): asset is FreeFormPinAsset {
  return asset.kind === 'image' || asset.kind === 'gif'
}

export function isFreeFormPin(pin: UiPin): pin is UiPin & { asset: FreeFormPinAsset } {
  return isFreeFormPinAsset(pin.asset)
}

export function clampPinSize(value: number): number {
  return Math.min(UI_PIN_MAX_SIZE, Math.max(UI_PIN_MIN_SIZE, value))
}

/** Derive a width/height rect from longest-edge size + aspect (width / height). */
export function pinRectFromSize(
  size: number,
  aspect: number,
): { width: number; height: number } {
  const clamped = clampPinSize(size)
  const safeAspect = Math.max(0.05, aspect)
  if (safeAspect >= 1) {
    return { width: clamped, height: clamped / safeAspect }
  }
  return { width: clamped * safeAspect, height: clamped }
}

/** Resolved render dimensions for a pin (handles legacy aspectOverride). */
export function readPinDimensions(pin: UiPin): { width: number; height: number } {
  if (isFreeFormPin(pin)) {
    if (pin.width != null && pin.height != null) {
      return {
        width: clampPinSize(pin.width),
        height: clampPinSize(pin.height),
      }
    }
    if (pin.aspectOverride != null) {
      return pinRectFromSize(pin.size, pin.aspectOverride)
    }
    return pinRectFromSize(pin.size, pin.asset.aspect)
  }
  if (pin.asset.kind === 'drawing') {
    return pinRectFromSize(
      pin.size,
      pin.asset.viewBoxWidth / pin.asset.viewBoxHeight,
    )
  }
  return { width: pin.size, height: pin.size }
}
