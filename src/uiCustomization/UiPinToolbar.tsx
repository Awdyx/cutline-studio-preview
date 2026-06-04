import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { RotateCcw, Trash2 } from 'lucide-react'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import {
  startItemResizeSound,
  stopItemResizeSound,
  updateItemResizeSound,
} from '../sound/itemResizeSound'
import { uiPinScreenRect } from './uiPinDom'
import { font } from '../styles/tokens'
import { isFreeFormPin, readPinDimensions, clampPinSize, type UiPin } from './types'
import { useCanvasCustomizeActive } from '../canvasItemCustomize/canvasCustomizeStore'
import { useUiCustomizationStore } from './uiCustomizationStore'

const PIN_TOOLBAR_FADE = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const }

// ─── Drag-control hook ───────────────────────────────────────────────────────

function useDragControl({
  onDelta,
  onEnd,
  onGestureStart,
  onGestureMove,
  onGestureEnd,
}: {
  onDelta: (dx: number) => void
  onEnd?: () => void
  onGestureStart?: (clientX: number, clientY: number) => void
  onGestureMove?: (clientX: number, clientY: number) => void
  onGestureEnd?: () => void
}) {
  const startXRef = useRef<number | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      startXRef.current = e.clientX
      onGestureStart?.(e.clientX, e.clientY)
    },
    [onGestureStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (startXRef.current === null) return
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onDelta(delta)
      onGestureMove?.(e.clientX, e.clientY)
    },
    [onDelta, onGestureMove],
  )

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (startXRef.current === null) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      startXRef.current = null
      onGestureEnd?.()
      onEnd?.()
    },
    [onEnd, onGestureEnd],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
  }
}

const PIN_ROTATE_DRAG_SFX = {
  onGestureStart: () => startItemDragSound(),
  onGestureMove: (x: number, y: number) => updateItemDragSound(x, y),
  onGestureEnd: () => stopItemDragSound(),
} as const

function usePinResizeDragSfx(readLiveSize: () => number) {
  const startSizeRef = useRef(1)
  return {
    onGestureStart: useCallback(
      (x: number, y: number) => {
        startSizeRef.current = readLiveSize()
        startItemResizeSound(x, y)
      },
      [readLiveSize],
    ),
    onGestureMove: useCallback(
      (x: number, y: number) => {
        const ratio =
          startSizeRef.current > 0 ? readLiveSize() / startSizeRef.current : 1
        updateItemResizeSound(x, y, ratio)
      },
      [readLiveSize],
    ),
    onGestureEnd: useCallback(() => stopItemResizeSound(), []),
  }
}

// ─── Sub-controls ────────────────────────────────────────────────────────────

function RotateControl({ pin }: { pin: UiPin }) {
  const rotatePin = useUiCustomizationStore((s) => s.rotatePin)
  const [dragging, setDragging] = useState(false)

  const rotDrag = useDragControl({
    onDelta: (dx) => {
      const next = ((pin.rotation - dx * 0.8) % 360 + 360) % 360
      const signed = next > 180 ? next - 360 : next
      rotatePin(pin.id, Math.round(signed))
    },
    onEnd: () => setDragging(false),
    ...PIN_ROTATE_DRAG_SFX,
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      setDragging(true)
      rotDrag.onPointerDown(e)
    },
    [rotDrag],
  )

  const displayRot = Math.round(pin.rotation)

  return (
    <div
      data-ui-pin-toolbar-ctrl="rotate"
      onPointerDown={onPointerDown}
      onPointerMove={rotDrag.onPointerMove}
      onPointerUp={rotDrag.onPointerUp}
      onPointerCancel={rotDrag.onPointerCancel}
      title="drag to rotate"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 10px',
        height: '100%',
        cursor: dragging ? 'ew-resize' : 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
        flexShrink: 0,
        minWidth: 64,
      }}
    >
      <RotateCcw size={12} strokeWidth={2.2} style={{ opacity: 0.55, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: font.family,
          fontSize: 12,
          fontWeight: 500,
          color: font.colorPrimary,
          opacity: dragging ? 1 : 0.75,
          minWidth: 36,
          textAlign: 'right',
          letterSpacing: '-0.01em',
          transition: 'opacity 100ms',
        }}
      >
        {displayRot > 0 ? `+${displayRot}°` : `${displayRot}°`}
      </span>
    </div>
  )
}

function ResizeUniformControl({ pin }: { pin: UiPin }) {
  const resizePinUniform = useUiCustomizationStore((s) => s.resizePinUniform)
  const [dragging, setDragging] = useState(false)
  const readSize = useCallback(() => {
    return (
      useUiCustomizationStore.getState().pins.find((p) => p.id === pin.id)?.size ??
      pin.size
    )
  }, [pin.id, pin.size])
  const resizeSfx = usePinResizeDragSfx(readSize)

  const sizeDrag = useDragControl({
    onDelta: (dx) => resizePinUniform(pin.id, pin.size + dx * 0.7),
    onEnd: () => setDragging(false),
    ...resizeSfx,
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      setDragging(true)
      sizeDrag.onPointerDown(e)
    },
    [sizeDrag],
  )

  return (
    <div
      data-ui-pin-toolbar-ctrl="size"
      onPointerDown={onPointerDown}
      onPointerMove={sizeDrag.onPointerMove}
      onPointerUp={sizeDrag.onPointerUp}
      onPointerCancel={sizeDrag.onPointerCancel}
      title="drag to resize"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 10px',
        height: '100%',
        cursor: dragging ? 'ew-resize' : 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
        flexShrink: 0,
        minWidth: 56,
      }}
    >
      <span
        style={{
          fontFamily: font.family,
          fontSize: 11,
          color: font.colorMuted,
          opacity: 0.7,
          flexShrink: 0,
        }}
      >
        ↔
      </span>
      <span
        style={{
          fontFamily: font.family,
          fontSize: 12,
          fontWeight: 500,
          color: font.colorPrimary,
          opacity: dragging ? 1 : 0.75,
          minWidth: 28,
          textAlign: 'right',
          letterSpacing: '-0.01em',
          transition: 'opacity 100ms',
        }}
      >
        {Math.round(pin.size)}
      </span>
    </div>
  )
}

function ResizeFreeControl({ pin }: { pin: UiPin }) {
  const resizePinRect = useUiCustomizationStore((s) => s.resizePinRect)
  const { width: w, height: h } = readPinDimensions(pin)
  const [draggingW, setDraggingW] = useState(false)
  const [draggingH, setDraggingH] = useState(false)
  const readWidth = useCallback(() => {
    const p = useUiCustomizationStore.getState().pins.find((x) => x.id === pin.id)
    return p ? readPinDimensions(p).width : w
  }, [pin.id, w])
  const readHeight = useCallback(() => {
    const p = useUiCustomizationStore.getState().pins.find((x) => x.id === pin.id)
    return p ? readPinDimensions(p).height : h
  }, [pin.id, h])
  const widthSfx = usePinResizeDragSfx(readWidth)
  const heightSfx = usePinResizeDragSfx(readHeight)

  const wDrag = useDragControl({
    onDelta: (dx) => resizePinRect(pin.id, clampPinSize(w + dx * 0.8), h),
    onEnd: () => setDraggingW(false),
    ...widthSfx,
  })
  const hDrag = useDragControl({
    onDelta: (dx) => resizePinRect(pin.id, w, clampPinSize(h + dx * 0.8)),
    onEnd: () => setDraggingH(false),
    ...heightSfx,
  })

  return (
    <>
      {/* Width */}
      <div
        data-ui-pin-toolbar-ctrl="width"
        onPointerDown={(e) => { setDraggingW(true); wDrag.onPointerDown(e) }}
        onPointerMove={wDrag.onPointerMove}
        onPointerUp={wDrag.onPointerUp}
        onPointerCancel={wDrag.onPointerCancel}
        title="drag to change width"
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '0 8px', height: '100%',
          cursor: draggingW ? 'ew-resize' : 'col-resize',
          touchAction: 'none', userSelect: 'none', flexShrink: 0, minWidth: 52,
        }}
      >
        <span style={{ fontFamily: font.family, fontSize: 10, color: font.colorMuted, opacity: 0.65, flexShrink: 0 }}>W</span>
        <span style={{
          fontFamily: font.family, fontSize: 12, fontWeight: 500,
          color: font.colorPrimary, opacity: draggingW ? 1 : 0.75,
          minWidth: 24, textAlign: 'right', letterSpacing: '-0.01em',
          transition: 'opacity 100ms',
        }}>
          {Math.round(w)}
        </span>
      </div>
      {/* Height */}
      <div
        data-ui-pin-toolbar-ctrl="height"
        onPointerDown={(e) => { setDraggingH(true); hDrag.onPointerDown(e) }}
        onPointerMove={hDrag.onPointerMove}
        onPointerUp={hDrag.onPointerUp}
        onPointerCancel={hDrag.onPointerCancel}
        title="drag to change height"
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '0 8px', height: '100%',
          cursor: draggingH ? 'ew-resize' : 'col-resize',
          touchAction: 'none', userSelect: 'none', flexShrink: 0, minWidth: 52,
        }}
      >
        <span style={{ fontFamily: font.family, fontSize: 10, color: font.colorMuted, opacity: 0.65, flexShrink: 0 }}>H</span>
        <span style={{
          fontFamily: font.family, fontSize: 12, fontWeight: 500,
          color: font.colorPrimary, opacity: draggingH ? 1 : 0.75,
          minWidth: 24, textAlign: 'right', letterSpacing: '-0.01em',
          transition: 'opacity 100ms',
        }}>
          {Math.round(h)}
        </span>
      </div>
    </>
  )
}

// ─── Main toolbar ────────────────────────────────────────────────────────────

interface UiPinToolbarProps {
  pinId: string
}

function UiPinToolbarInner({ pinId }: UiPinToolbarProps) {
  const pin = useUiCustomizationStore((s) => s.pins.find((p) => p.id === pinId))
  const deletePin = useUiCustomizationStore((s) => s.deletePin)
  const canvasItemCustomize = useCanvasCustomizeActive()

  useEffect(() => {
    return () => {
      stopItemDragSound()
      stopItemResizeSound()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      deletePin(pinId)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pinId, deletePin])

  // Position: read the pin element's screen rect and place the toolbar below it
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number | null>(null)

  const updatePos = useCallback(() => {
    const rect = uiPinScreenRect(pinId)
    if (!rect) return
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 14,
    })
  }, [pinId])

  useLayoutEffect(() => {
    updatePos()
    let raf = 0
    const tick = () => {
      updatePos()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [updatePos])

  // Clean up raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (!pin || !pos) return null

  const free = isFreeFormPin(pin)

  const toolbar = (
    <motion.div
      data-ui-pin-toolbar=""
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={PIN_TOOLBAR_FADE}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${pos.x}px, ${pos.y}px) translateX(-50%)`,
        zIndex: 90,
        pointerEvents: 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: 36,
          borderRadius: 999,
          background: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--card-shadow)',
          backdropFilter: 'blur(22px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
      {/* Rotate */}
      <RotateControl pin={pin} />

      {/* Divider */}
      <div style={{ width: 1, background: 'var(--glass-border)', alignSelf: 'stretch', margin: '6px 0', flexShrink: 0 }} />

      {/* Resize */}
      {free ? <ResizeFreeControl pin={pin} /> : <ResizeUniformControl pin={pin} />}

      {/* Divider */}
      <div style={{ width: 1, background: 'var(--glass-border)', alignSelf: 'stretch', margin: '6px 0', flexShrink: 0 }} />

      {/* Delete */}
      <button
        type="button"
        aria-label="Delete pin"
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        onPointerUp={(e) => {
          // Fire on pointerUp so iOS doesn't require two taps (first tap
          // "activates" a button inside position:fixed on iPad Safari).
          e.stopPropagation()
          deletePin(pin.id)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: '100%',
          border: 'none',
          background: 'transparent',
          color: 'oklch(55% 0.18 22)',
          cursor: 'pointer',
          flexShrink: 0,
          borderRadius: '0 999px 999px 0',
          transition: 'background 140ms ease',
          touchAction: 'manipulation',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(220, 60, 40, 0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Trash2 size={13} strokeWidth={2.2} />
      </button>
      </div>
    </motion.div>
  )

  if (canvasItemCustomize && typeof document !== 'undefined') {
    return createPortal(toolbar, document.body)
  }
  return toolbar
}

export default function UiPinToolbar({ pinId }: UiPinToolbarProps) {
  return <UiPinToolbarInner pinId={pinId} />
}
