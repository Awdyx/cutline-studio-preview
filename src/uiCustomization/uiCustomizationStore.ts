import { create } from 'zustand'
import { generateItemId } from '../canvasItems/itemId'
import { pushUndoSnapshot } from '../canvasHistory/canvasHistory'
import { scheduleMediaBlobGc } from '../media/mediaBlobGc'
import {
  loadUiCustomizationFromStorage,
  saveUiCustomizationToStorage,
} from './uiCustomizationPersistence'
import {
  UI_PIN_DEFAULT_EMOJI_SIZE,
  UI_PIN_DEFAULT_SIZE,
  clampPinSize,
  isFreeFormPinAsset,
  pinRectFromSize,
  type UiAnchorId,
  type UiPin,
  type UiPinAsset,
} from './types'

export const DRAW_TOOL_DARK_COLOR = '#464a4e'
export const DRAW_TOOL_LIGHT_COLOR = '#eceef1'

export const DRAW_TOOL_COLORS: readonly string[] = [
  '#d89292',
  '#e8aa78',
  '#dfc878',
  '#84c4a8',
  '#8fa4c4',
  '#aca0c4',
  DRAW_TOOL_LIGHT_COLOR,
  DRAW_TOOL_DARK_COLOR,
]

/** Lightest swatch — needs a hairline so it reads on pale chrome. */

export const DRAW_TOOL_SIZE_MIN = 3
export const DRAW_TOOL_SIZE_MAX = 16
export const DRAW_TOOL_SIZE_DEFAULT = 6

export type DrawTool = { color: string; size: number }

/** Visual scale applied to the chrome anchor in focus. */
export const UI_FOCUS_SCALE = 1.6

/** Pin exit fade-out — keep in sync with `ui-pin-exit` keyframes. */
export const UI_PIN_EXIT_DURATION_MS = 180
/** Pin enter spawn animation — keep in sync with `ui-pin-enter` keyframes. */
export const UI_PIN_ENTER_DURATION_MS = 200

export type PinDrag = {
  asset: UiPinAsset
  /** Blob / object URL for image or gif preview while dragging. */
  previewUrl?: string
  startX: number
  startY: number
}

type UiCustomizationState = {
  hydrated: boolean
  editing: boolean
  pins: UiPin[]
  selectedPinId: string | null
  focusedAnchorId: UiAnchorId | null
  drawing: boolean
  drawTool: DrawTool
  clippedAnchorIds: ReadonlySet<UiAnchorId>
  /** Pins playing their exit animation — still rendered until removed. */
  deletingPinIds: ReadonlySet<string>
  /** Active drag-from-tray gesture, or null when idle. */
  pinDrag: PinDrag | null

  hydrate: () => void
  setEditing: (editing: boolean) => void
  setFocusedAnchorId: (id: UiAnchorId | null) => void
  setDrawing: (drawing: boolean) => void
  setDrawTool: (tool: Partial<DrawTool>) => void
  toggleAnchorClipping: (anchorId: UiAnchorId) => void

  addPin: (input: {
    anchorId: UiAnchorId
    offsetX: number
    offsetY: number
    asset: UiPinAsset
    size?: number
    rotation?: number
  }) => string

  movePin: (id: string, anchorId: UiAnchorId, offsetX: number, offsetY: number) => void
  resizePinUniform: (id: string, size: number) => void
  resizePinRect: (id: string, width: number, height: number) => void
  rotatePin: (id: string, rotation: number) => void
  deletePin: (id: string) => void
  bringPinToFront: (id: string) => void
  setSelectedPinId: (id: string | null) => void

  startPinDrag: (asset: UiPinAsset, startX: number, startY: number, previewUrl?: string) => void
  endPinDrag: () => void
}

let persistEnabled = false

function persist(
  pins: readonly UiPin[],
  clippedAnchorIds: ReadonlySet<UiAnchorId>,
): void {
  if (!persistEnabled) return
  saveUiCustomizationToStorage({
    pins: pins as UiPin[],
    clippedAnchorIds: Array.from(clippedAnchorIds),
  })
}

function syncEditingAttribute(editing: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (editing) root.setAttribute('data-ui-customize', '1')
  else root.removeAttribute('data-ui-customize')
}

export const useUiCustomizationStore = create<UiCustomizationState>(
  (set, get) => ({
    hydrated: false,
    editing: false,
    pins: [],
    selectedPinId: null,
    focusedAnchorId: null,
    drawing: false,
    drawTool: { color: DRAW_TOOL_DARK_COLOR, size: DRAW_TOOL_SIZE_DEFAULT },
    clippedAnchorIds: new Set<UiAnchorId>(),
    deletingPinIds: new Set<string>(),
    pinDrag: null,

    hydrate: () => {
      const loaded = loadUiCustomizationFromStorage()
      set({
        pins: loaded.pins,
        clippedAnchorIds: new Set(loaded.clippedAnchorIds),
        hydrated: true,
      })
      persistEnabled = true
    },

    setEditing: (editing) => {
      set((s) => ({
        editing,
        drawing: editing ? s.drawing : false,
        focusedAnchorId: editing ? s.focusedAnchorId : null,
        selectedPinId: editing ? s.selectedPinId : null,
      }))
      syncEditingAttribute(editing)
    },

    setFocusedAnchorId: (id) => {
      set((s) => ({
        focusedAnchorId: id,
        selectedPinId: id === s.focusedAnchorId ? s.selectedPinId : null,
      }))
    },

    setDrawing: (drawing) => {
      set((s) => ({
        drawing,
        selectedPinId: drawing ? null : s.selectedPinId,
      }))
    },

    setDrawTool: (tool) => {
      set((s) => ({
        drawTool: {
          color: tool.color ?? s.drawTool.color,
          size: Math.min(
            DRAW_TOOL_SIZE_MAX,
            Math.max(
              DRAW_TOOL_SIZE_MIN,
              tool.size ?? s.drawTool.size,
            ),
          ),
        },
      }))
    },

    toggleAnchorClipping: (anchorId) => {
      set((s) => {
        const next = new Set(s.clippedAnchorIds)
        if (next.has(anchorId)) next.delete(anchorId)
        else next.add(anchorId)
        return { clippedAnchorIds: next }
      })
      persist(get().pins, get().clippedAnchorIds)
    },

    addPin: ({ anchorId, offsetX, offsetY, asset, size, rotation }) => {
      pushUndoSnapshot()
      const id = generateItemId()
      const defaultSize =
        asset.kind === 'emoji' ? UI_PIN_DEFAULT_EMOJI_SIZE : UI_PIN_DEFAULT_SIZE
      const clamped = clampPinSize(size ?? defaultSize)
      const pin: UiPin = {
        id,
        anchorId,
        offsetX,
        offsetY,
        size: clamped,
        rotation: rotation ?? 0,
        asset,
      }
      if (isFreeFormPinAsset(asset)) {
        const rect = pinRectFromSize(clamped, asset.aspect)
        pin.width = rect.width
        pin.height = rect.height
      }
      set((s) => ({ pins: [...s.pins, pin], selectedPinId: id }))
      persist(get().pins, get().clippedAnchorIds)
      return id
    },

    movePin: (id, anchorId, offsetX, offsetY) => {
      let changed = false
      set((s) => {
        const pins = s.pins.map((p) => {
          if (p.id !== id) return p
          if (
            p.anchorId === anchorId &&
            p.offsetX === offsetX &&
            p.offsetY === offsetY
          ) {
            return p
          }
          changed = true
          return { ...p, anchorId, offsetX, offsetY }
        })
        return changed ? { pins } : s
      })
      if (changed) persist(get().pins, get().clippedAnchorIds)
    },

    resizePinUniform: (id, size) => {
      const clamped = clampPinSize(size)
      let changed = false
      set((s) => {
        const pins = s.pins.map((p) => {
          if (p.id !== id || p.size === clamped) return p
          changed = true
          return { ...p, size: clamped }
        })
        return changed ? { pins } : s
      })
      if (changed) persist(get().pins, get().clippedAnchorIds)
    },

    resizePinRect: (id, width, height) => {
      const w = clampPinSize(width)
      const h = clampPinSize(height)
      let changed = false
      set((s) => {
        const pins = s.pins.map((p) => {
          if (p.id !== id) return p
          if (p.width === w && p.height === h && p.size === Math.max(w, h)) {
            return p
          }
          changed = true
          const { aspectOverride: _drop, ...rest } = p
          void _drop
          return { ...rest, size: Math.max(w, h), width: w, height: h }
        })
        return changed ? { pins } : s
      })
      if (changed) persist(get().pins, get().clippedAnchorIds)
    },

    rotatePin: (id, rotation) => {
      let changed = false
      set((s) => {
        const pins = s.pins.map((p) => {
          if (p.id !== id || p.rotation === rotation) return p
          changed = true
          return { ...p, rotation }
        })
        return changed ? { pins } : s
      })
      if (changed) persist(get().pins, get().clippedAnchorIds)
    },

    deletePin: (id) => {
      if (!get().pins.some((p) => p.id === id)) return
      if (get().deletingPinIds.has(id)) return
      set((s) => {
        const next = new Set(s.deletingPinIds)
        next.add(id)
        return {
          deletingPinIds: next,
          selectedPinId: s.selectedPinId === id ? null : s.selectedPinId,
        }
      })
      window.setTimeout(() => {
        if (!get().deletingPinIds.has(id)) return
        pushUndoSnapshot()
        set((s) => {
          const next = new Set(s.deletingPinIds)
          next.delete(id)
          return {
            pins: s.pins.filter((p) => p.id !== id),
            deletingPinIds: next,
          }
        })
        persist(get().pins, get().clippedAnchorIds)
        scheduleMediaBlobGc()
      }, UI_PIN_EXIT_DURATION_MS)
    },

    bringPinToFront: (id) => {
      let changed = false
      set((s) => {
        const idx = s.pins.findIndex((p) => p.id === id)
        if (idx < 0 || idx === s.pins.length - 1) return s
        const next = s.pins.slice()
        const [pin] = next.splice(idx, 1)
        next.push(pin)
        changed = true
        return { pins: next }
      })
      if (changed) persist(get().pins, get().clippedAnchorIds)
    },

    setSelectedPinId: (id) => set({ selectedPinId: id }),

    startPinDrag: (asset, startX, startY, previewUrl) => {
      set({ pinDrag: { asset, startX, startY, previewUrl } })
    },
    endPinDrag: () => {
      set({ pinDrag: null })
    },
  }),
)

// ─── Per-anchor selector with reference-stable caching ─────────────────────
//
// Pin mutations always produce a new pins array. Re-deriving the per-anchor
// slice off the array reference keeps each anchor's pins[] referentially
// stable across unrelated re-renders.

const EMPTY_PINS: readonly UiPin[] = Object.freeze([])

let lastPinsRef: readonly UiPin[] | null = null
let cachedPinsByAnchor: ReadonlyMap<UiAnchorId, readonly UiPin[]> = new Map()

function derivePinsByAnchor(
  pins: readonly UiPin[],
): ReadonlyMap<UiAnchorId, readonly UiPin[]> {
  if (pins === lastPinsRef) return cachedPinsByAnchor
  const next = new Map<UiAnchorId, UiPin[]>()
  for (const pin of pins) {
    const list = next.get(pin.anchorId)
    if (list) list.push(pin)
    else next.set(pin.anchorId, [pin])
  }
  lastPinsRef = pins
  cachedPinsByAnchor = next as ReadonlyMap<UiAnchorId, readonly UiPin[]>
  return cachedPinsByAnchor
}

export function usePinsForAnchor(anchorId: UiAnchorId): readonly UiPin[] {
  return useUiCustomizationStore(
    (s) => derivePinsByAnchor(s.pins).get(anchorId) ?? EMPTY_PINS,
  )
}
