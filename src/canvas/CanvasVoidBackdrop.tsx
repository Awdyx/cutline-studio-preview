import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { virtualCameraFromLibrary } from './canvasVirtualPan'

const VOID_GRID_BASE_PX = 900

let lastVoidSync: { step: string; ox: string; oy: string } | null = null

function syncVoidBackdropCss(
  positionX: number,
  positionY: number,
  scale: number,
): void {
  const step = VOID_GRID_BASE_PX * scale
  const safeStep = step > 1 ? step : VOID_GRID_BASE_PX
  const mod = (value: number, size: number) => {
    const m = value % size
    return m < 0 ? m + size : m
  }

  const stepPx = `${safeStep}px`
  const offsetX = `${mod(positionX, safeStep)}px`
  const offsetY = `${mod(positionY, safeStep)}px`

  if (
    lastVoidSync?.step === stepPx &&
    lastVoidSync.ox === offsetX &&
    lastVoidSync.oy === offsetY
  ) {
    return
  }

  lastVoidSync = { step: stepPx, ox: offsetX, oy: offsetY }
  const root = document.documentElement
  root.style.setProperty('--canvas-void-grid-step', stepPx)
  root.style.setProperty('--canvas-void-grid-offset-x', offsetX)
  root.style.setProperty('--canvas-void-grid-offset-y', offsetY)
}

function syncFromTransformRef(
  ref: ReactZoomPanPinchContentRef | null,
): void {
  if (!ref?.state) return
  const { positionX, positionY, scale } = ref.state
  if (!Number.isFinite(scale) || scale <= 0) return
  const virtual = virtualCameraFromLibrary({ positionX, positionY, scale })
  syncVoidBackdropCss(virtual.positionX, virtual.positionY, virtual.scale)
}

export function useCanvasVoidBackdropSync(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) {
      lastVoidSync = null
      return
    }

    const ref = transformRef.current
    syncFromTransformRef(ref)

    const wrapper = ref?.instance?.wrapperComponent
    if (!wrapper) return

    const observer = new MutationObserver(() => {
      syncFromTransformRef(transformRef.current)
    })
    observer.observe(wrapper, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    })

    return () => {
      observer.disconnect()
      lastVoidSync = null
    }
  }, [active, transformRef])
}

type Props = {
  visible: boolean
}

/** Viewport-fixed void fill + grid — synced from virtual pan while overview hyper mode is active. */
export default function CanvasVoidBackdrop({ visible }: Props) {
  if (!visible) return null

  return (
    <div className="cutline-canvas-void-backdrop" aria-hidden>
      <div className="cutline-canvas-void-backdrop__grid" />
      <div className="cutline-canvas-void-backdrop__dim" />
    </div>
  )
}
