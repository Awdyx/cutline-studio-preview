import { memo, useEffect, useRef, useState } from 'react'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { isFreeFormPin, readPinDimensions, type UiPin } from './types'
import {
  UI_FOCUS_SCALE,
  UI_PIN_ENTER_DURATION_MS,
  useUiCustomizationStore,
} from './uiCustomizationStore'
import { DrawingStrokesSvg } from './DrawingStrokesSvg'

interface UiPinViewProps {
  pin: UiPin
  editing: boolean
  selected: boolean
  anchorId: string
}

function PinAsset({ pin }: { pin: UiPin }) {
  if (pin.asset.kind === 'emoji') {
    return (
      <span
        aria-hidden
        style={{
          fontSize: pin.size * 0.84,
          lineHeight: 1,
          display: 'inline-block',
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {pin.asset.char}
      </span>
    )
  }
  if (pin.asset.kind === 'image') {
    return <ImagePinAsset mediaId={pin.asset.mediaId} pinId={pin.id} />
  }
  if (pin.asset.kind === 'gif') {
    return <RasterPinAsset url={pin.asset.url} filter="saturate(0.8)" />
  }
  // Drawing: render all strokes, using the tight content viewBox so rotation
  // happens around the actual drawn content centre rather than the full canvas.
  {
    const minX = pin.asset.viewBoxMinX ?? 0
    const minY = pin.asset.viewBoxMinY ?? 0
    return (
      <DrawingStrokesSvg
        viewBox={`${minX} ${minY} ${pin.asset.viewBoxWidth} ${pin.asset.viewBoxHeight}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        strokes={pin.asset.strokes}
        style={{
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      />
    )
  }
}

function ImagePinAsset({ mediaId, pinId }: { mediaId: string; pinId: string }) {
  const { url } = useMediaBlobUrl(mediaId, pinId)
  if (!url) return null
  return <RasterPinAsset url={url} />
}

function RasterPinAsset({ url, filter }: { url: string; filter?: string }) {
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        display: 'block',
        userSelect: 'none',
        pointerEvents: 'none',
        WebkitUserDrag: 'none',
        filter,
      } as React.CSSProperties}
    />
  )
}

function getPinchProps(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    dist: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

function UiPinViewInner({ pin, editing, selected, anchorId }: UiPinViewProps) {
  const exiting = useUiCustomizationStore((s) => s.deletingPinIds.has(pin.id))
  const setSelectedPinId = useUiCustomizationStore((s) => s.setSelectedPinId)
  const bringPinToFront = useUiCustomizationStore((s) => s.bringPinToFront)
  const movePin = useUiCustomizationStore((s) => s.movePin)
  const resizePinUniform = useUiCustomizationStore((s) => s.resizePinUniform)
  const resizePinRect = useUiCustomizationStore((s) => s.resizePinRect)
  const rotatePin = useUiCustomizationStore((s) => s.rotatePin)

  const { width: w, height: h } = readPinDimensions(pin)

  // Entry animation: set data-ui-pin-enter for the first render cycle
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), UI_PIN_ENTER_DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [])

  // Active pointer tracking for drag-to-move and pinch-to-scale/rotate
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragRef = useRef<{
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    moved: boolean
  } | null>(null)
  const pinchRef = useRef<{
    dist: number
    angle: number
    size: number
    width: number
    height: number
    rotation: number
    free: boolean
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editing) return
    e.stopPropagation()

    // Read directly from store — the `selected` prop can be stale on iOS when
    // a second finger arrives before React has re-rendered after selection.
    const currentlySelected =
      useUiCustomizationStore.getState().selectedPinId === pin.id

    if (!currentlySelected) {
      // First tap: select the pin
      setSelectedPinId(pin.id)
      bringPinToFront(pin.id)
      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = [...activePointers.current.values()]

    if (pts.length >= 2) {
      // Second finger arrived — switch from drag to pinch
      dragRef.current = null
      const [a, b] = pts
      const props = getPinchProps(a, b)
      const free = isFreeFormPin(pin)
      const { width: pw, height: ph } = readPinDimensions(pin)
      pinchRef.current = {
        ...props,
        size: pin.size,
        width: pw,
        height: ph,
        rotation: pin.rotation,
        free,
      }
    } else {
      // Single finger: drag-to-move
      pinchRef.current = null
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: pin.offsetX,
        startOffsetY: pin.offsetY,
        moved: false,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = [...activePointers.current.values()]

    if (pts.length >= 2 && pinchRef.current) {
      // Pinch: simultaneous scale + rotate
      const [a, b] = pts
      const props = getPinchProps(a, b)
      const scaleFactor = pinchRef.current.dist > 0
        ? props.dist / pinchRef.current.dist
        : 1
      const angleDelta = props.angle - pinchRef.current.angle
      const rawRotation = pinchRef.current.rotation + angleDelta
      const newRotation = ((rawRotation % 360) + 360) % 360
      const signed = newRotation > 180 ? newRotation - 360 : newRotation
      rotatePin(pin.id, Math.round(signed))
      if (pinchRef.current.free) {
        resizePinRect(
          pin.id,
          pinchRef.current.width * scaleFactor,
          pinchRef.current.height * scaleFactor,
        )
      } else {
        resizePinUniform(pin.id, pinchRef.current.size * scaleFactor)
      }
      return
    }

    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.moved && Math.hypot(dx, dy) < 3) return
    dragRef.current.moved = true
    movePin(
      pin.id,
      anchorId as Parameters<typeof movePin>[1],
      dragRef.current.startOffsetX + dx / UI_FOCUS_SCALE,
      dragRef.current.startOffsetY + dy / UI_FOCUS_SCALE,
    )
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (activePointers.current.size < 2) {
      pinchRef.current = null
    }
    if (activePointers.current.size === 0) {
      dragRef.current = null
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w,
        height: h,
        transform: `translate(calc(-50% + ${pin.offsetX}px), calc(-50% + ${pin.offsetY}px))`,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: selected ? 2 : 1,
      }}
    >
      <div
        data-ui-pin-anim=""
        data-ui-pin-enter={entering ? '1' : undefined}
        data-ui-pin-exit={exiting ? '1' : undefined}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center',
        }}
      >
        <div
          data-ui-pin={pin.id}
          data-ui-pin-selected={selected ? '' : undefined}
          data-ui-pin-kind={pin.asset.kind}
          onPointerDown={editing ? onPointerDown : undefined}
          onPointerMove={editing ? onPointerMove : undefined}
          onPointerUp={editing ? onPointerUp : undefined}
          onPointerCancel={editing ? (e) => {
            activePointers.current.delete(e.pointerId)
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
            if (activePointers.current.size === 0) {
              dragRef.current = null
              pinchRef.current = null
            }
          } : undefined}
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${pin.rotation}deg)`,
            pointerEvents: editing ? 'auto' : 'none',
            // touchAction: 'none' is required so pointer capture works correctly
            // for both single-finger drag and two-finger pinch on iPad.
            touchAction: editing ? 'none' : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: selected ? 'grab' : 'pointer',
          }}
        >
          <div
            data-ui-pin-asset=""
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PinAsset pin={pin} />
          </div>
        </div>
      </div>
    </div>
  )
}

const UiPinView = memo(UiPinViewInner)
export default UiPinView
