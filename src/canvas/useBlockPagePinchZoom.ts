import { useEffect } from 'react'

/** Roots that handle trackpad pinch locally — everywhere else blocks browser page zoom. */
const PINCH_ZOOM_ALLOWED_ROOTS = [
  '.cutline-canvas-viewport',
  '.profile-media-frame-editor',
] as const

function allowsLocalPinchZoom(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return PINCH_ZOOM_ALLOWED_ROOTS.some((sel) => target.closest(sel) != null)
}

function isTrackpadPinchWheel(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}

/** Stop trackpad pinch from zooming the whole page over chrome UI (search bar, FABs, etc.). */
export function useBlockPagePinchZoom(): void {
  useEffect(() => {
    const capture = { capture: true, passive: false } as const

    function onWheel(event: WheelEvent) {
      if (!isTrackpadPinchWheel(event)) return
      if (allowsLocalPinchZoom(event.target)) return
      event.preventDefault()
    }

    function onGesture(event: Event) {
      if (allowsLocalPinchZoom(event.target)) return
      event.preventDefault()
    }

    window.addEventListener('wheel', onWheel, capture)
    window.addEventListener('gesturestart', onGesture, capture)
    window.addEventListener('gesturechange', onGesture, capture)
    window.addEventListener('gestureend', onGesture, capture)

    return () => {
      window.removeEventListener('wheel', onWheel, capture)
      window.removeEventListener('gesturestart', onGesture, capture)
      window.removeEventListener('gesturechange', onGesture, capture)
      window.removeEventListener('gestureend', onGesture, capture)
    }
  }, [])
}
