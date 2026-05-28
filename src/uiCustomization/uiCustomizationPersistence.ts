import {
  UI_ANCHOR_IDS,
  UI_PIN_DEFAULT_SIZE,
  UI_PIN_MAX_SIZE,
  UI_PIN_MIN_SIZE,
  type UiAnchorId,
  type UiPin,
  type UiPinAsset,
  isFreeFormPinAsset,
  pinRectFromSize,
} from './types'

import { scopedStorageKey } from '../storage/storageScope'

export const UI_CUSTOMIZATION_STORAGE_KEY = scopedStorageKey('cutline-ui-customization-v1')

export type PersistedUiCustomization = {
  pins: UiPin[]
  /** Anchors that have "clip pins to my bounds" toggled on. Stored as an
   *  array (sets don't survive JSON.stringify) but conceptually a Set. */
  clippedAnchorIds: UiAnchorId[]
}

function defaultSettings(): PersistedUiCustomization {
  return { pins: [], clippedAnchorIds: [] }
}

function isAnchorId(value: unknown): value is UiAnchorId {
  return (
    typeof value === 'string' &&
    (UI_ANCHOR_IDS as readonly string[]).includes(value)
  )
}

function clampSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return UI_PIN_DEFAULT_SIZE
  return Math.min(UI_PIN_MAX_SIZE, Math.max(UI_PIN_MIN_SIZE, value))
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value
}

function parseAsset(raw: unknown): UiPinAsset | null {
  if (!raw || typeof raw !== 'object') return null
  const asset = raw as { kind?: unknown }
  if (asset.kind === 'emoji') {
    const char = (asset as { char?: unknown }).char
    if (typeof char === 'string' && char.length > 0 && char.length <= 8) {
      return { kind: 'emoji', char }
    }
    return null
  }
  if (asset.kind === 'image') {
    const mediaId = (asset as { mediaId?: unknown }).mediaId
    const aspect = (asset as { aspect?: unknown }).aspect
    if (typeof mediaId !== 'string' || mediaId.length === 0) return null
    return { kind: 'image', mediaId, aspect: safeNumber(aspect, 1) }
  }
  if (asset.kind === 'gif') {
    const url = (asset as { url?: unknown }).url
    const aspect = (asset as { aspect?: unknown }).aspect
    if (typeof url !== 'string' || url.length === 0) return null
    const previewUrlRaw = (asset as { previewUrl?: unknown }).previewUrl
    return {
      kind: 'gif',
      url,
      previewUrl: typeof previewUrlRaw === 'string' ? previewUrlRaw : undefined,
      aspect: safeNumber(aspect, 1),
    }
  }
  if (asset.kind === 'drawing') {
    const viewBoxWidth = (asset as { viewBoxWidth?: unknown }).viewBoxWidth
    const viewBoxHeight = (asset as { viewBoxHeight?: unknown }).viewBoxHeight
    const rawStrokes = (asset as { strokes?: unknown }).strokes

    let strokes: Array<{
      path: string
      color: string
      tool?: 'pen' | 'highlighter'
      opacity?: number
    }>

    if (Array.isArray(rawStrokes) && rawStrokes.length > 0) {
      strokes = rawStrokes
        .filter(
          (s: unknown) =>
            s != null &&
            typeof s === 'object' &&
            typeof (s as { path?: unknown }).path === 'string' &&
            (s as { path: string }).path.length > 0 &&
            typeof (s as { color?: unknown }).color === 'string' &&
            (s as { color: string }).color.length > 0,
        )
        .map((s: unknown) => {
          const stroke = s as {
            path: string
            color: string
            tool?: unknown
            opacity?: unknown
          }
          const tool =
            stroke.tool === 'pen' || stroke.tool === 'highlighter'
              ? stroke.tool
              : undefined
          return {
            path: stroke.path,
            color: stroke.color,
            tool,
            opacity:
              typeof stroke.opacity === 'number' && Number.isFinite(stroke.opacity)
                ? stroke.opacity
                : undefined,
          }
        })
    } else {
      // Legacy single-stroke format — migrate to strokes array
      const path = (asset as { path?: unknown }).path
      const color = (asset as { color?: unknown }).color
      if (typeof path !== 'string' || path.length === 0) return null
      if (typeof color !== 'string' || color.length === 0) return null
      strokes = [{ path, color }]
    }

    if (strokes.length === 0) return null

    const viewBoxMinX = (asset as { viewBoxMinX?: unknown }).viewBoxMinX
    const viewBoxMinY = (asset as { viewBoxMinY?: unknown }).viewBoxMinY

    return {
      kind: 'drawing',
      strokes,
      viewBoxWidth: Math.max(1, safeNumber(viewBoxWidth, 100)),
      viewBoxHeight: Math.max(1, safeNumber(viewBoxHeight, 100)),
      ...(typeof viewBoxMinX === 'number' && Number.isFinite(viewBoxMinX) && viewBoxMinX !== 0
        ? { viewBoxMinX }
        : {}),
      ...(typeof viewBoxMinY === 'number' && Number.isFinite(viewBoxMinY) && viewBoxMinY !== 0
        ? { viewBoxMinY }
        : {}),
    }
  }
  return null
}

function parseAspectOverride(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0.05, value)
}

function parsePin(raw: unknown): UiPin | null {
  if (!raw || typeof raw !== 'object') return null
  const pin = raw as Record<string, unknown>
  if (typeof pin.id !== 'string' || pin.id.length === 0) return null
  if (!isAnchorId(pin.anchorId)) return null
  const asset = parseAsset(pin.asset)
  if (!asset) return null
  const size = clampSize(pin.size)
  const aspectOverride = parseAspectOverride(pin.aspectOverride)
  const parsedWidth =
    typeof pin.width === 'number' && Number.isFinite(pin.width)
      ? clampSize(pin.width)
      : undefined
  const parsedHeight =
    typeof pin.height === 'number' && Number.isFinite(pin.height)
      ? clampSize(pin.height)
      : undefined

  let width = parsedWidth
  let height = parsedHeight
  if (isFreeFormPinAsset(asset) && (width === undefined || height === undefined)) {
    const aspect =
      aspectOverride ??
      (asset.kind === 'image' || asset.kind === 'gif' ? asset.aspect : 1)
    const rect = pinRectFromSize(size, aspect)
    width = rect.width
    height = rect.height
  }

  return {
    id: pin.id,
    anchorId: pin.anchorId,
    offsetX: safeNumber(pin.offsetX, 0),
    offsetY: safeNumber(pin.offsetY, 0),
    size,
    rotation: safeNumber(pin.rotation, 0),
    asset,
    ...(width !== undefined && height !== undefined ? { width, height } : {}),
  }
}

export function loadUiCustomizationFromStorage(): PersistedUiCustomization {
  try {
    const raw = localStorage.getItem(UI_CUSTOMIZATION_STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as {
      pins?: unknown
      clippedAnchorIds?: unknown
    }
    const pins = Array.isArray(parsed.pins)
      ? (parsed.pins
          .map((entry) => parsePin(entry))
          .filter((entry): entry is UiPin => entry !== null))
      : []
    const clippedAnchorIds = Array.isArray(parsed.clippedAnchorIds)
      ? parsed.clippedAnchorIds.filter((id): id is UiAnchorId => isAnchorId(id))
      : []
    return { pins, clippedAnchorIds }
  } catch {
    return defaultSettings()
  }
}

export function saveUiCustomizationToStorage(
  settings: PersistedUiCustomization,
): void {
  try {
    localStorage.setItem(
      UI_CUSTOMIZATION_STORAGE_KEY,
      JSON.stringify(settings satisfies PersistedUiCustomization),
    )
  } catch (err) {
    console.warn('[ui-customization] failed to save settings', err)
  }
}
