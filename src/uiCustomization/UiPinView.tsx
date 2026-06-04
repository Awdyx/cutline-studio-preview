import { memo, useEffect, useRef, useState } from 'react'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { resolveKlipyPinUrl } from './klipyApi'
import { readPinDimensions, type UiPin } from './types'
import {
  shouldPlayPinEnterAnimation,
  markPinEnterAnimationDone,
} from './uiPinEnterAnimation'
import { playSound } from '../sound/playSound'
import {
  UI_PIN_ENTER_DURATION_MS,
  useUiCustomizationStore,
} from './uiCustomizationStore'
import { uiAnchorElement, readUiAnchorVisualScale } from './uiAnchorFocusScale'
import { DrawingStrokesSvg } from './DrawingStrokesSvg'
import {
  beginPinPointerDown,
  endPinGesture,
  getPinGestureSession,
  UI_PIN_DISMISS_MARGIN_PX,
} from './uiPinGesture'

/** Anchor-local distance from pin centre to the nearest point outside bounds. */
function pinDistanceBeyondAnchorBounds(
  anchorId: string,
  offsetX: number,
  offsetY: number,
): number | null {
  const el = uiAnchorElement(anchorId)
  if (!el) return null
  const halfW = el.offsetWidth / 2
  const halfH = el.offsetHeight / 2
  const beyondX = Math.max(0, Math.abs(offsetX) - halfW)
  const beyondY = Math.max(0, Math.abs(offsetY) - halfH)
  const logicalBeyond = Math.hypot(beyondX, beyondY)
  const visualScale = readUiAnchorVisualScale(el)
  return logicalBeyond * visualScale
}

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
    return (
      <RasterPinAsset
        url={resolveKlipyPinUrl(pin.asset.url, pin.asset.previewUrl)}
        filter="saturate(0.8)"
      />
    )
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

function UiPinViewInner({ pin, editing, selected, anchorId }: UiPinViewProps) {
  const exiting = useUiCustomizationStore((s) => s.deletingPinIds.has(pin.id))
  const setSelectedPinId = useUiCustomizationStore((s) => s.setSelectedPinId)
  const bringPinToFront = useUiCustomizationStore((s) => s.bringPinToFront)
  const deletePin = useUiCustomizationStore((s) => s.deletePin)

  const pinRef = useRef(pin)
  pinRef.current = pin
  const anchorIdRef = useRef(anchorId)
  anchorIdRef.current = anchorId

  const { width: w, height: h } = readPinDimensions(pin)

  const [entering, setEntering] = useState(() =>
    shouldPlayPinEnterAnimation(pin.id),
  )
  useEffect(() => {
    if (!entering) return
    const t = setTimeout(() => {
      setEntering(false)
      markPinEnterAnimationDone(pin.id)
    }, UI_PIN_ENTER_DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [entering, pin.id])

  useEffect(() => {
    return () => {
      if (getPinGestureSession()?.pinId === pin.id) {
        endPinGesture()
      }
    }
  }, [pin.id])

  // Dismiss pins that are already placed beyond the anchor edge.
  // Skipped while a drag is active — deletion is handled on pointer-up instead.
  useEffect(() => {
    if (getPinGestureSession()?.pinId === pin.id) return
    const beyond = pinDistanceBeyondAnchorBounds(anchorId, pin.offsetX, pin.offsetY)
    if (beyond != null && beyond > UI_PIN_DISMISS_MARGIN_PX) {
      deletePin(pin.id)
    }
  }, [pin.id, pin.offsetX, pin.offsetY, anchorId, deletePin])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editing) return
    e.stopPropagation()
    e.preventDefault()

    const currentlySelected =
      useUiCustomizationStore.getState().selectedPinId === pin.id

    if (!currentlySelected) {
      setSelectedPinId(pin.id)
      bringPinToFront(pin.id)
      playSound('itemSelect')
    }

    beginPinPointerDown({
      pinId: pinRef.current.id,
      anchorId: anchorIdRef.current,
      captureEl: e.currentTarget,
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      wasSelected: currentlySelected,
    })
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w,
        height: h,
        transform: `translate3d(calc(-50% + ${pin.offsetX}px), calc(-50% + ${pin.offsetY}px), 0)`,
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
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${pin.rotation}deg)`,
            // Pointer events are driven by CSS: inert while editing unfocused
            // anchors; interactive on focused anchors and in normal (live) mode.
            // touchAction: 'none' is required so pointer capture works correctly
            // for both single-finger drag and two-finger pinch on iPad.
            touchAction: editing ? 'none' : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: selected ? 'grab' : undefined,
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
