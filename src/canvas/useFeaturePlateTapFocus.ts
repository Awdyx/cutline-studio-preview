import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { focusAppDestinationPlate } from '../navigation/appDestinationFocus'
import { useAppDestinationFocusStore } from '../navigation/appDestinationFocusStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import type { FeaturePlateDestination } from './canvasPlate'
import { watchPendingTouchTap } from './pointerTapGesture'

function isFocusChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.feature-plate-drag-handle-wrapper') != null ||
    target.closest('.canvas-plate-reposition-btn') != null
  )
}

/** Tap a feature plate on the main canvas to frame it (menu focus mode). */
export function useFeaturePlateTapFocus(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: FeaturePlateDestination,
) {
  const tapCancelRef = useRef<(() => void) | null>(null)

  const onPlatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'pen') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (useUiCustomizationStore.getState().editing) return
      if (isFocusChromeTarget(event.target)) return
      if (useStudioCentreDragStore.getState().featurePlateDragging === destination) {
        return
      }

      const focus = useAppDestinationFocusStore.getState()
      if (focus.panLocked && focus.activeDestination === destination) return

      event.preventDefault()
      event.stopPropagation()

      tapCancelRef.current?.()
      tapCancelRef.current = watchPendingTouchTap({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        onComplete: () => {
          tapCancelRef.current = null
          focusAppDestinationPlate(transformRef, destination)
        },
        onCancel: () => {
          tapCancelRef.current = null
        },
      })
    },
    [destination, transformRef],
  )

  return { onPlatePointerDown }
}
