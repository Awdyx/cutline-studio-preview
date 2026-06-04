import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { Check, Crop, Pencil } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import { font } from '../styles/tokens'
import type { UiPinAsset } from './types'
import UiPinTray from './UiPinTray'
import UiPinToolbar from './UiPinToolbar'
import {
  UI_FOCUS_SCALE,
  useUiCustomizationStore,
} from './uiCustomizationStore'
import {
  UI_ANCHOR_IDS,
  canvasItemUiAnchorId,
  isCanvasItemUiAnchorId,
  type UiAnchorId,
} from './types'
import { queryUiPinElement } from './uiPinDom'
import { uiAnchorElement, uiAnchorFocusScale } from './uiAnchorFocusScale'
import {
  UI_CUSTOMIZE_BACKDROP_BLUR_OFF,
  UI_CUSTOMIZE_BACKDROP_ENTER,
  UI_CUSTOMIZE_BACKDROP_EXIT,
  UI_CUSTOMIZE_CHROME_BACKDROP_BLUR,
  UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_ENTER_MS,
  UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_EXIT_MS,
  UI_CUSTOMIZE_EASE_OUT,
  UI_CUSTOMIZE_VIGNETTE_ENTER,
  UI_CUSTOMIZE_VIGNETTE_EXIT,
} from './canvasItemCustomizeLayout'

import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { DrawingStrokesSvg } from './DrawingStrokesSvg'
import { useCanvasCustomizeActive, useCanvasCustomizeStore } from '../canvasItemCustomize/canvasCustomizeStore'
import { pulseUiAnchorMotionBlur } from './uiAnchorMotionBlur'
import { UiCustomizeFocusButton } from './UiCustomizeFocusButton'

const ANCHOR_SELECTOR = [
  ...UI_ANCHOR_IDS.map((id) => `[data-ui-anchor='${id}']`),
  '[data-ui-anchor^="canvas-item:"]',
].join(', ')

const GHOST_SIZE = 72
/** Tray stack sits this far below the focused anchor's viewport centre. */
const CHROME_FOCUS_TRAY_CENTER_OFFSET = 72
const FOCUS_TOOLBAR_ROW_HEIGHT = 38
const FOCUS_TOOLBAR_MIN_TOP = 72
const FOCUS_TOOLBAR_ENTER = {
  opacity: { duration: 0.78, ease: UI_CUSTOMIZE_EASE_OUT },
  filter: { duration: 0.82, ease: UI_CUSTOMIZE_EASE_OUT },
} as const
const FOCUS_TOOLBAR_EXIT = {
  opacity: { duration: 0.45, ease: UI_CUSTOMIZE_EASE_OUT },
  filter: { duration: 0.45, ease: UI_CUSTOMIZE_EASE_OUT },
} as const
const FOCUS_TOOLBAR_EXIT_MS = 450

/** Resting toolbar top once the anchor is centred — keeps buttons from riding the focus move. */
function focusedToolbarTopForCenteredAnchor(el: HTMLElement): number {
  const centerY = window.innerHeight / 2
  const trayTop = centerY + CHROME_FOCUS_TRAY_CENTER_OFFSET
  const visualH = el.offsetHeight * UI_FOCUS_SCALE
  const anchorTop = centerY - visualH / 2
  const gap = trayTop - (anchorTop + visualH)
  return Math.max(
    FOCUS_TOOLBAR_MIN_TOP,
    anchorTop - gap - FOCUS_TOOLBAR_ROW_HEIGHT,
  )
}

/**
 * Translate a chrome anchor to viewport centre via CSS variables.
 */
function applyAnchorFocus(anchorId: UiAnchorId | null) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  document
    .querySelectorAll<HTMLElement>('[data-ui-anchor-focused="1"]')
    .forEach((el) => {
      const anchorId = el.getAttribute('data-ui-anchor')
      // Canvas-item anchors own focus via React — don't strip the attribute.
      if (anchorId && isCanvasItemUiAnchorId(anchorId)) return
      el.removeAttribute('data-ui-anchor-focused')
      el.style.removeProperty('--ui-focus-tx')
      el.style.removeProperty('--ui-focus-ty')
      el.style.removeProperty('--ui-focus-scale')
      pulseUiAnchorMotionBlur(el)
    })

  if (!anchorId) {
    root.removeAttribute('data-ui-focused')
    return
  }

  if (isCanvasItemUiAnchorId(anchorId)) {
    root.setAttribute('data-ui-focused', '1')
    return
  }

  const el = document.querySelector<HTMLElement>(
    `[data-ui-anchor='${anchorId}']`,
  )
  if (!el) {
    root.removeAttribute('data-ui-focused')
    return
  }

  el.style.transition = 'none'
  el.style.removeProperty('--ui-focus-tx')
  el.style.removeProperty('--ui-focus-ty')
  el.style.removeProperty('--ui-focus-scale')
  void el.offsetWidth
  const rect = el.getBoundingClientRect()
  // Drop inline transition so the stylesheet focus animation (transform 380ms)
  // wins over any component hover-lift shorthand.
  el.style.removeProperty('transition')
  void el.offsetWidth

  const tx = window.innerWidth / 2 - (rect.left + rect.width / 2)
  const ty = window.innerHeight / 2 - (rect.top + rect.height / 2)
  el.style.setProperty('--ui-focus-tx', `${tx}px`)
  el.style.setProperty('--ui-focus-ty', `${ty}px`)
  el.style.setProperty('--ui-focus-scale', `${UI_FOCUS_SCALE}`)
  el.setAttribute('data-ui-anchor-focused', '1')
  root.setAttribute('data-ui-focused', '1')
  pulseUiAnchorMotionBlur(el)
}

/** True when the pointer event target lies on a pin or its portaled toolbar. */
function isOnPinSurface(event: PointerEvent): boolean {
  const target = event.target
  if (
    target instanceof Element &&
    target.closest('[data-ui-pin], [data-ui-pin-toolbar]')
  ) {
    return true
  }
  for (const node of event.composedPath()) {
    if (
      node instanceof Element &&
      node.closest('[data-ui-pin], [data-ui-pin-toolbar]')
    ) {
      return true
    }
  }
  return false
}

/**
 * Extra padding (px) added around the selected pin's bounding rect so that
 * fingers slightly outside a small pin (e.g. a tiny emoji) don't trigger a
 * deselect mid-pinch. Large enough to cover a finger tip reliably.
 */
const SELECTED_PIN_GESTURE_PAD = 200

/**
 * True when (x, y) is within the padded bounding rect of the currently
 * selected pin. Used to protect multi-touch gestures on small pins.
 *
 * Reads the selected pin ID from the Zustand store (synchronous) rather than
 * querying [data-ui-pin-selected], which only appears after React re-renders
 * and would miss touches arriving immediately after selection.
 */
function isNearSelectedPin(x: number, y: number): boolean {
  const selectedPinId = useUiCustomizationStore.getState().selectedPinId
  if (!selectedPinId) return false
  // [data-ui-pin] is always present in the DOM while the pin exists, regardless
  // of render cycle, so this lookup is always current.
  const pinEl = queryUiPinElement(selectedPinId)
  if (!pinEl) return false
  const r = pinEl.getBoundingClientRect()
  return (
    x >= r.left - SELECTED_PIN_GESTURE_PAD &&
    x <= r.right + SELECTED_PIN_GESTURE_PAD &&
    y >= r.top - SELECTED_PIN_GESTURE_PAD &&
    y <= r.bottom + SELECTED_PIN_GESTURE_PAD
  )
}

/** Returns true if (x, y) is within the bounds of the currently focused anchor. */
function isPointerOverFocusedAnchor(x: number, y: number): boolean {
  const focusedAnchorId = useUiCustomizationStore.getState().focusedAnchorId
  if (!focusedAnchorId) return false
  const el = uiAnchorElement(focusedAnchorId)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const pad = 12
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  )
}

function focusedAnchorElement(): HTMLElement | null {
  const focusedAnchorId = useUiCustomizationStore.getState().focusedAnchorId
  if (!focusedAnchorId) return null
  const focused = document.querySelector<HTMLElement>(
    `[data-ui-anchor='${focusedAnchorId}'][data-ui-anchor-focused='1']`,
  )
  if (focused) return focused
  return uiAnchorElement(focusedAnchorId)
}

// ─── Drag ghost content ──────────────────────────────────────────────────────

function GhostImageAsset({ mediaId }: { mediaId: string }) {
  const { url } = useMediaBlobUrl(mediaId, 'ghost')
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, pointerEvents: 'none' }}
    />
  )
}

function GhostContent({ asset, previewUrl }: { asset: UiPinAsset; previewUrl?: string }) {
  if (!asset) return null

  if (asset.kind === 'emoji') {
    return (
      <span style={{
        fontSize: 40,
        lineHeight: 1,
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji',
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'block',
      }}>
        {asset.char}
      </span>
    )
  }
  if (asset.kind === 'image') {
    if (previewUrl) {
      return (
        <img src={previewUrl} alt="" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, pointerEvents: 'none' }} />
      )
    }
    return <GhostImageAsset mediaId={asset.mediaId} />
  }
  if (asset.kind === 'gif') {
    const url = previewUrl ?? asset.previewUrl ?? asset.url
    return (
      <img src={url} alt="" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, pointerEvents: 'none' }} />
    )
  }
  if (asset.kind === 'drawing') {
    return (
      <DrawingStrokesSvg
        viewBox={`0 0 ${asset.viewBoxWidth} ${asset.viewBoxHeight}`}
        width="100%"
        height="100%"
        strokes={asset.strokes}
        style={{ display: 'block', pointerEvents: 'none' }}
      />
    )
  }
  return null
}

function FocusedToolbarRow({
  focusedAnchorId,
  focusedAnchorClipped,
  onDone,
  onToggleClipping,
}: {
  focusedAnchorId: UiAnchorId | null
  focusedAnchorClipped: boolean
  onDone: () => void
  onToggleClipping: () => void
}) {
  return (
    <>
      <UiCustomizeFocusButton
        ariaLabel="Back to element selection"
        icon={<Check size={14} strokeWidth={2.4} />}
        label="done"
        onClick={onDone}
      />
      {focusedAnchorId && (
        <UiCustomizeFocusButton
          ariaLabel={
            focusedAnchorClipped
              ? 'Disable clipping for this element'
              : 'Enable clipping for this element'
          }
          ariaPressed={focusedAnchorClipped}
          icon={<Crop size={14} strokeWidth={2.2} />}
          label="clipping"
          active={focusedAnchorClipped}
          onClick={onToggleClipping}
        />
      )}
    </>
  )
}

// ─── Main layer ──────────────────────────────────────────────────────────────

export default function UiCustomizationLayer({
  transformRef,
}: {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}) {
  const editing = useUiCustomizationStore((s) => s.editing)
  const focusedAnchorId = useUiCustomizationStore((s) => s.focusedAnchorId)
  const canvasCustomizeActive = useCanvasCustomizeActive()
  const dismissCanvasCustomize = useCanvasCustomizeStore((s) => s.dismiss)
  const reduceMotion = useReducedMotion()
  const setEditing = useUiCustomizationStore((s) => s.setEditing)
  const setFocusedAnchorId = useUiCustomizationStore((s) => s.setFocusedAnchorId)
  const setSelectedPinId = useUiCustomizationStore((s) => s.setSelectedPinId)
  const selectedPinId = useUiCustomizationStore((s) => s.selectedPinId)
  const toggleAnchorClipping = useUiCustomizationStore(
    (s) => s.toggleAnchorClipping,
  )
  const pinDrag = useUiCustomizationStore((s) => s.pinDrag)
  const addPin = useUiCustomizationStore((s) => s.addPin)
  const endPinDrag = useUiCustomizationStore((s) => s.endPinDrag)

  // Refs for drag state that don't need re-renders
  const focusedAnchorIdRef = useRef(focusedAnchorId)
  const ghostHasMovedRef = useRef(false)
  const overAnchorRef = useRef(false)
  const [overAnchor, setOverAnchor] = useState(false)
  const [ghostDismissing, setGhostDismissing] = useState(false)
  const pinDragRef = useRef(pinDrag)

  useEffect(() => { focusedAnchorIdRef.current = focusedAnchorId }, [focusedAnchorId])
  useEffect(() => { pinDragRef.current = pinDrag }, [pinDrag])

  // Ghost motion values — updated imperatively for perf
  const ghostX = useMotionValue(0)
  const ghostY = useMotionValue(0)
  const ghostScale = useMotionValue(0)
  const ghostOpacity = useMotionValue(0)

  // Whether the ghost is visible (hasMoved threshold crossed)
  const [ghostVisible, setGhostVisible] = useState(false)
  const [focusedToolbarTop, setFocusedToolbarTop] = useState<number | null>(null)
  const toolbarAnchorRef = useRef<UiAnchorId | null>(null)
  if (focusedAnchorId) toolbarAnchorRef.current = focusedAnchorId
  if (focusedToolbarTop == null) toolbarAnchorRef.current = null
  const toolbarAnchorId = focusedAnchorId ?? toolbarAnchorRef.current
  const focusedAnchorClipped = useUiCustomizationStore((s) =>
    toolbarAnchorId ? s.clippedAnchorIds.has(toolbarAnchorId) : false,
  )

  // Drive the focus transform whenever the focused anchor changes.
  useEffect(() => {
    applyAnchorFocus(editing ? focusedAnchorId : null)
  }, [editing, focusedAnchorId])

  useEffect(() => {
    if (!editing || canvasCustomizeActive) {
      setFocusedToolbarTop(null)
      return
    }

    if (!focusedAnchorId) {
      const t = window.setTimeout(
        () => setFocusedToolbarTop(null),
        FOCUS_TOOLBAR_EXIT_MS,
      )
      return () => window.clearTimeout(t)
    }

    const sync = () => {
      const el = uiAnchorElement(focusedAnchorId)
      if (el && el.offsetHeight > 0) {
        setFocusedToolbarTop(focusedToolbarTopForCenteredAnchor(el))
      }
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [editing, focusedAnchorId, canvasCustomizeActive])

  // Defensive: clear any inline focus styling if the layer unmounts mid-focus.
  useEffect(() => () => applyAnchorFocus(null), [])

  // Drop focus on viewport resize so the centred anchor doesn't drift.
  useEffect(() => {
    if (!focusedAnchorId) return
    const onResize = () => {
      if (useCanvasCustomizeStore.getState().active) return
      setFocusedAnchorId(null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [focusedAnchorId, setFocusedAnchorId])

  // Deselect on tap outside pin / toolbar / tray.
  useEffect(() => {
    if (!editing) return

    // Prevent iOS/iPadOS Safari from intercepting two-finger touches as a
    // page zoom while the customization editor is open.
    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('touchstart', preventPinchZoom, { passive: false })

    // Track active pointer count so we can detect multi-touch pinch gestures.
    let activePointers = 0
    const countDown = () => { activePointers++ }
    const countUp = () => { activePointers = Math.max(0, activePointers - 1) }
    document.addEventListener('pointerdown', countDown, true)
    document.addEventListener('pointerup', countUp, true)
    document.addEventListener('pointercancel', countUp, true)

    // Pending deselect: we defer the deselect by a short window so that when
    // a pinch gesture starts, the second finger can arrive and cancel it before
    // it fires. Without this, the first finger of a pinch landing slightly
    // outside the pin would immediately kill the selection.
    let pendingDeselect: ReturnType<typeof setTimeout> | null = null
    const cancelPendingDeselect = () => {
      if (pendingDeselect !== null) { clearTimeout(pendingDeselect); pendingDeselect = null }
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (useCanvasCustomizeStore.getState().active) return

      // Second (or later) finger arrived — this is a multi-touch gesture.
      // Cancel any deselect that was scheduled by the first finger.
      if (activePointers > 1) {
        cancelPendingDeselect()
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-ui-customization-backdrop]')) return
      if (target.closest('[data-ui-customization-toolbar]')) return
      if (target.closest('[data-ui-pin-toolbar]')) return
      if (isOnPinSurface(event)) return
      // Immediate bail-out when the finger is right on/near the selected pin.
      if (isNearSelectedPin(event.clientX, event.clientY)) return
      if (isPointerOverFocusedAnchor(event.clientX, event.clientY)) return

      // If there is a selected pin, defer the deselect by 120 ms so a second
      // finger arriving for a pinch gesture can cancel it in time.
      if (useUiCustomizationStore.getState().selectedPinId) {
        cancelPendingDeselect()
        pendingDeselect = setTimeout(() => {
          pendingDeselect = null
          // Only fire if we still have at most one pointer down (i.e. the user
          // didn't start a pinch during the window).
          if (activePointers < 2) setSelectedPinId(null)
        }, 120)
      } else {
        setSelectedPinId(null)
      }
    }
    document.addEventListener('pointerdown', onDown, true)

    return () => {
      document.removeEventListener('touchstart', preventPinchZoom)
      document.removeEventListener('pointerdown', countDown, true)
      document.removeEventListener('pointerup', countUp, true)
      document.removeEventListener('pointercancel', countUp, true)
      document.removeEventListener('pointerdown', onDown, true)
      cancelPendingDeselect()
    }
  }, [editing, setSelectedPinId])

  // Capture taps on chrome anchors to switch focus while in edit mode.
  useEffect(() => {
    if (!editing) return
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (isOnPinSurface(event)) return
      if (target.closest('[data-ui-customization-tray]')) return
      if (target.closest('[data-ui-customization-toolbar]')) return
      if (target.closest('[data-ui-pin-toolbar]')) return

      const anchor = target.closest<HTMLElement>(ANCHOR_SELECTOR)
      if (!anchor) return
      const id = anchor.getAttribute('data-ui-anchor') as UiAnchorId | null
      if (!id) return

      const canvasCustomize = useCanvasCustomizeStore.getState()
      if (canvasCustomize.active && !canvasCustomize.exiting) {
        const ownAnchor =
          canvasCustomize.itemId != null
            ? canvasItemUiAnchorId(canvasCustomize.itemId)
            : null
        if (id === ownAnchor) return

        event.preventDefault()
        event.stopPropagation()
        if (canvasCustomize.dismiss()) playSound('menuClose')
        return
      }

      event.preventDefault()
      event.stopPropagation()
      if (useUiCustomizationStore.getState().focusedAnchorId === id) return
      setFocusedAnchorId(id)
      playSound('menuOpen')
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [editing, setFocusedAnchorId])

  // Esc: clear selection → clear focus → exit editor.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable || /input|textarea/i.test(target.tagName))
      ) {
        return
      }
      const state = useUiCustomizationStore.getState()
      if (state.selectedPinId) {
        setSelectedPinId(null)
        return
      }
      if (useCanvasCustomizeStore.getState().active) {
        if (dismissCanvasCustomize()) playSound('menuClose')
        return
      }
      if (state.focusedAnchorId) {
        setFocusedAnchorId(null)
        return
      }
      setEditing(false)
      playSound('menuClose')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, setEditing, setFocusedAnchorId, setSelectedPinId])

  // ─── Drag-from-tray global handlers ───────────────────────────────────────

  useEffect(() => {
    if (!pinDrag || !editing) {
      focusedAnchorElement()?.removeAttribute('data-ui-anchor-drag-hover')
      return
    }

    ghostHasMovedRef.current = false
    overAnchorRef.current = false
    ghostX.set(pinDrag.startX - GHOST_SIZE / 2)
    ghostY.set(pinDrag.startY - GHOST_SIZE / 2)
    ghostScale.set(0)
    ghostOpacity.set(0)
    setGhostVisible(false)
    setOverAnchor(false)
    setGhostDismissing(false)

    const drag = pinDrag

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const dist = Math.hypot(dx, dy)

      // Show ghost once movement threshold crossed
      if (!ghostHasMovedRef.current && dist > 6) {
        ghostHasMovedRef.current = true
        playSound('itemGrab')
        startItemDragSound()
        setGhostVisible(true)
        animate(ghostScale, 1, { type: 'spring', stiffness: 380, damping: 22, mass: 0.6 })
        animate(ghostOpacity, 1, { duration: 0.14 })
      }

      if (ghostHasMovedRef.current) updateItemDragSound(e.clientX, e.clientY)

      ghostX.set(e.clientX - GHOST_SIZE / 2)
      ghostY.set(e.clientY - GHOST_SIZE / 2)

      const over = isPointerOverFocusedAnchor(e.clientX, e.clientY)
      if (over !== overAnchorRef.current) {
        overAnchorRef.current = over
        setOverAnchor(over)
        const anchorEl = focusedAnchorElement()
        if (anchorEl) {
          if (over) anchorEl.setAttribute('data-ui-anchor-drag-hover', '1')
          else anchorEl.removeAttribute('data-ui-anchor-drag-hover')
        }
      }
    }

    const onUp = async (e: PointerEvent) => {
      const hasMoved = ghostHasMovedRef.current
      stopItemDragSound()
      const anchorId = focusedAnchorIdRef.current
      // Re-evaluate position at the exact moment of release so that dragging
      // back to the source area (tray) and releasing correctly dismisses even
      // if overAnchorRef was not yet updated by a final pointermove.
      const over = hasMoved && isPointerOverFocusedAnchor(e.clientX, e.clientY)
      overAnchorRef.current = over
      setOverAnchor(over)

      focusedAnchorElement()?.removeAttribute('data-ui-anchor-drag-hover')

      if (!hasMoved) {
        // Simple tap — tray cells handle their own tap feedback; just clean up drag state.
        endPinDrag()
        return
      }

      if (over && anchorId) {
        // Compute precise offset from anchor center
        const anchorEl = uiAnchorElement(anchorId)
        const rect = anchorEl?.getBoundingClientRect()
        let offsetX = 0
        let offsetY = 0
        if (rect) {
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const scale = anchorId ? uiAnchorFocusScale(anchorId) : UI_FOCUS_SCALE
          offsetX = (e.clientX - cx) / scale
          offsetY = (e.clientY - cy) / scale
        }

        // Landing animation: ghost pops up slightly then snaps away in place.
        await Promise.all([
          animate(ghostScale, 1.15, { duration: 0.08, ease: 'easeOut' }).then(() =>
            animate(ghostScale, 0, { duration: 0.13, ease: [0.4, 0, 1, 1] })
          ),
          animate(ghostOpacity, 0, { delay: 0.06, duration: 0.12 }),
        ])

        // Let addPin use its own default size logic (emoji vs other)
        addPin({ anchorId, offsetX, offsetY, asset: drag.asset })
        endPinDrag()
      } else {
        // Dismiss animation: ghost shrinks and fades in place
        setGhostDismissing(true)
        await Promise.all([
          animate(ghostScale, 0.2, { duration: 0.2, ease: [0.4, 0, 0.6, 1] }),
          animate(ghostOpacity, 0, { duration: 0.18 }),
        ])
        endPinDrag()
        setGhostDismissing(false)
        setGhostVisible(false)
      }
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onUp, true)
    return () => {
      stopItemDragSound()
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onUp, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinDrag != null, editing])

  // Clean up on edit end
  useEffect(() => {
    if (!editing) {
      endPinDrag()
      setGhostVisible(false)
      focusedAnchorElement()?.removeAttribute('data-ui-anchor-drag-hover')
    }
  }, [editing, endPinDrag])

  const handleDone = useCallback(() => {
    setEditing(false)
    playSound('menuClose')
  }, [setEditing])

  const exitFocusedAnchor = useCallback(() => {
    setFocusedAnchorId(null)
    playSound('menuClose')
  }, [setFocusedAnchorId])

  // Backdrop tap: same steps as Esc — pin → focus → exit.
  const onBackdropDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const state = useUiCustomizationStore.getState()
      if (state.selectedPinId) {
        setSelectedPinId(null)
        return
      }
      if (state.focusedAnchorId) {
        exitFocusedAnchor()
        return
      }
      handleDone()
    },
    [exitFocusedAnchor, handleDone, setSelectedPinId],
  )

  const [showTaunt, setShowTaunt] = useState(false)
  const tauntTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSelectPrompt =
    editing && !focusedAnchorId && !canvasCustomizeActive
  const showFocusedPanel =
    editing && !!focusedAnchorId && !canvasCustomizeActive
  const vignetteEnterTransition = reduceMotion
    ? { opacity: { duration: 0.01 } }
    : UI_CUSTOMIZE_VIGNETTE_ENTER
  const vignetteExitTransition = reduceMotion
    ? { opacity: { duration: 0.01 } }
    : UI_CUSTOMIZE_VIGNETTE_EXIT

  const showChromeCustomize = editing && !canvasCustomizeActive
  const chromeBackdropRef = useRef<HTMLDivElement>(null)
  const [chromeBackdropBlurred, setChromeBackdropBlurred] = useState(false)
  const [chromeBackdropBlurMs, setChromeBackdropBlurMs] = useState(
    UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_ENTER_MS,
  )
  const chromeBackdropMotionTransition = reduceMotion
    ? { duration: 0.01 }
    : {
        ...UI_CUSTOMIZE_BACKDROP_ENTER,
        exit: UI_CUSTOMIZE_BACKDROP_EXIT,
      }

  useLayoutEffect(() => {
    if (!showChromeCustomize) return
    setChromeBackdropBlurMs(UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_ENTER_MS)
    flushSync(() => setChromeBackdropBlurred(false))
    void chromeBackdropRef.current?.getBoundingClientRect()
    // Defer blur-on to the next frame so CSS sees blur(0) as the start state.
    const frame = requestAnimationFrame(() => {
      setChromeBackdropBlurred(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [showChromeCustomize])

  useLayoutEffect(() => {
    if (canvasCustomizeActive) return
    const root = document.documentElement
    if (editing) root.setAttribute('data-ui-customize', '1')
    else root.removeAttribute('data-ui-customize')
  }, [editing, canvasCustomizeActive])

  // Clean up prompt attributes when the prompt disappears
  useEffect(() => {
    if (!showSelectPrompt) {
      document.documentElement.removeAttribute('data-ui-prompt-hover')
      document.documentElement.removeAttribute('data-ui-prompt-nudge')
    }
  }, [showSelectPrompt])

  useEffect(() => {
    if (pinDrag && editing) {
      document.documentElement.setAttribute('data-ui-tray-pin-drag', '1')
      return () => document.documentElement.removeAttribute('data-ui-tray-pin-drag')
    }
    document.documentElement.removeAttribute('data-ui-tray-pin-drag')
  }, [pinDrag, editing])

  const pinDragGhostNode = pinDrag ? (
      <motion.div
        key="pin-drag-ghost"
        data-ui-customization-drag-ghost=""
        data-ui-ghost-asset={pinDrag.asset.kind}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          x: ghostX,
          y: ghostY,
          width: GHOST_SIZE,
          height: GHOST_SIZE,
          pointerEvents: 'none',
          scale: ghostScale,
          opacity: ghostOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          overflow: 'hidden',
          transformOrigin: 'center center',
        }}
        animate={{
          borderRadius: overAnchor ? '50%' : 14,
          boxShadow: overAnchor
            ? '0 0 0 2.5px rgba(20, 30, 50, 0.15), 0 8px 28px rgba(0,0,0,0.28)'
            : '0 4px 16px rgba(0,0,0,0.22)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        <motion.div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          animate={{ scale: overAnchor ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        >
          <GhostContent asset={pinDrag.asset} previewUrl={pinDrag.previewUrl} />
        </motion.div>
      </motion.div>
    ) : null

  return (
    <>
      <AnimatePresence>
        {showChromeCustomize && (
          <motion.div
            ref={chromeBackdropRef}
            key="chrome-customize-backdrop"
            data-ui-customization-backdrop=""
            data-ui-customize-backdrop-tone="chrome"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={chromeBackdropMotionTransition}
            onExitStart={() => {
              setChromeBackdropBlurMs(UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_EXIT_MS)
              // Keep one painted frame at full blur/dim so the CSS transition runs.
              requestAnimationFrame(() => {
                setChromeBackdropBlurred(false)
              })
            }}
            onExitComplete={() => {
              setChromeBackdropBlurred(false)
              setChromeBackdropBlurMs(UI_CUSTOMIZE_CHROME_BACKDROP_BLUR_ENTER_MS)
            }}
            onPointerDown={onBackdropDown}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              cursor: 'default',
              pointerEvents: 'auto',
              background: chromeBackdropBlurred
                ? 'var(--ui-customize-backdrop)'
                : 'transparent',
              backdropFilter: chromeBackdropBlurred
                ? UI_CUSTOMIZE_CHROME_BACKDROP_BLUR
                : UI_CUSTOMIZE_BACKDROP_BLUR_OFF,
              WebkitBackdropFilter: chromeBackdropBlurred
                ? UI_CUSTOMIZE_CHROME_BACKDROP_BLUR
                : UI_CUSTOMIZE_BACKDROP_BLUR_OFF,
              transition: !reduceMotion
                ? `backdrop-filter ${chromeBackdropBlurMs}ms cubic-bezier(0.16, 1, 0.3, 1), -webkit-backdrop-filter ${chromeBackdropBlurMs}ms cubic-bezier(0.16, 1, 0.3, 1), background ${chromeBackdropBlurMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
                : undefined,
            }}
          />
        )}
      </AnimatePresence>

      {editing && !canvasCustomizeActive && (
        <motion.div
          data-ui-customize-vignette=""
          initial={false}
          animate={{ opacity: showFocusedPanel ? 1 : 0 }}
          transition={
            reduceMotion
              ? { duration: 0.01 }
              : showFocusedPanel
                ? vignetteEnterTransition
                : vignetteExitTransition
          }
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 51,
            pointerEvents: 'none',
            background: 'var(--ui-customize-vignette)',
            willChange: 'opacity',
          }}
        />
      )}

      {editing && !canvasCustomizeActive && (
        <div
          data-ui-customization-toolbar=""
          style={{
            position: 'fixed',
            top: focusedToolbarTop ?? 0,
            left: 0,
            right: 0,
            zIndex: 56,
            pointerEvents: 'none',
            visibility: focusedToolbarTop != null ? 'visible' : 'hidden',
          }}
        >
          <motion.div
            initial={false}
            animate={{
              opacity: showFocusedPanel && focusedToolbarTop != null ? 1 : 0,
              filter:
                showFocusedPanel && focusedToolbarTop != null
                  ? 'blur(0px)'
                  : 'blur(8px)',
            }}
            transition={
              reduceMotion
                ? { duration: 0.01 }
                : showFocusedPanel && focusedToolbarTop != null
                  ? FOCUS_TOOLBAR_ENTER
                  : FOCUS_TOOLBAR_EXIT
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              willChange: 'opacity, filter',
            }}
          >
            <FocusedToolbarRow
              focusedAnchorId={toolbarAnchorId}
              focusedAnchorClipped={focusedAnchorClipped}
              onDone={exitFocusedAnchor}
              onToggleClipping={() => {
                if (!toolbarAnchorId) return
                toggleAnchorClipping(toolbarAnchorId)
                playSound('menuOpen')
              }}
            />
          </motion.div>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom:
            'max(28px, calc(env(safe-area-inset-bottom, 0px) + 28px))',
          zIndex: 55,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <AnimatePresence>
          {showSelectPrompt && (
            <motion.div
              key="select-prompt"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0.32, 1] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <AnimatePresence>
                {showTaunt && (
                  <motion.span
                    key="taunt"
                    initial={{ opacity: 0, y: 6, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{
                      fontFamily: font.family,
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--ui-text)',
                      opacity: 0.5,
                      letterSpacing: '-0.01em',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    not this one, idiot
                  </motion.span>
                )}
              </AnimatePresence>
              <div
                onPointerEnter={() => document.documentElement.setAttribute('data-ui-prompt-hover', '')}
                onPointerLeave={() => document.documentElement.removeAttribute('data-ui-prompt-hover')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  if (tauntTimerRef.current) clearTimeout(tauntTimerRef.current)
                  setShowTaunt(true)
                  tauntTimerRef.current = setTimeout(() => setShowTaunt(false), 2200)
                  document.documentElement.setAttribute('data-ui-prompt-nudge', '')
                  setTimeout(() => document.documentElement.removeAttribute('data-ui-prompt-nudge'), 520)
                }}
                style={{
                  padding: '32px 56px',
                  margin: '-32px -56px',
                  pointerEvents: 'auto',
                  display: 'inline-flex',
                  cursor: 'pointer',
                }}
              >
                <div
                  role="button"
                  data-ui-select-prompt=""
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 16px 9px 14px',
                    borderRadius: 999,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--card-shadow)',
                    backdropFilter: 'blur(22px) saturate(1.4)',
                    WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
                    fontFamily: font.family,
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: 'var(--ui-text)',
                    letterSpacing: '-0.003em',
                    pointerEvents: 'none',
                  }}
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden style={{ opacity: 0.7 }} />
                  <span>tap a menu element to start customizing</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showFocusedPanel && (
          <motion.div
            key="focused-stack"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 26,
              mass: 0.7,
            }}
            style={{
              position: 'fixed',
              top: `calc(50% + ${CHROME_FOCUS_TRAY_CENTER_OFFSET}px)`,
              left: 0,
              right: 0,
              zIndex: 55,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            <UiPinTray open={editing} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected pin toolbar */}
      <AnimatePresence>
        {editing && selectedPinId && focusedAnchorId && (
          <UiPinToolbar key={selectedPinId} pinId={selectedPinId} />
        )}
      </AnimatePresence>

      {pinDragGhostNode && createPortal(pinDragGhostNode, document.body)}
    </>
  )
}
