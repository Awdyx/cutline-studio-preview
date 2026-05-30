import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  forceClearCanvasBarrelWarp,
  updateCanvasBarrelAfterCamera,
} from '../canvas/canvasBarrelPostProcess'
import {
  canvasMinimapFeaturePlateRect,
  canvasMinimapStudioRect,
} from '../canvas/canvasMinimapGeometry'
import { panCanvasMinimapToItem } from '../canvas/canvasMinimapPanToItem'
import {
  animateCameraToTarget,
  focusItemOnCanvas,
  readCameraFromRef,
  type FocusItemOptions,
} from '../canvas/canvasCamera'
import { resetCanvasMinimapUiState } from '../canvas/canvasMinimapOpen'
import {
  isFeaturePlateDestination,
  type FeaturePlateDestination,
} from '../canvas/canvasPlate'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { playSubmenuTap } from '../sound/submenuSound'
import { useAppDestinationFocusStore } from './appDestinationFocusStore'
import { useAppDestinationStore } from './appDestinationStore'
import type { AppDestination } from './appDestinationStore'

const PLATE_FOCUS_MS = 720

/** Edge-to-edge fit — top chrome floats over the space, no inset. */
function appDestinationPlateFitOptions(
  animationMs = PLATE_FOCUS_MS,
): FocusItemOptions {
  return {
    fit: true,
    curved: true,
    mainCanvasPlate: true,
    animationMs,
    bypassMaxScale: true,
    bypassPanBounds: true,
    fitPaddingX: 0,
    fitPaddingTop: 0,
    fitPaddingBottom: 0,
  }
}

export function isAppDestinationFocusActive(): boolean {
  return useAppDestinationFocusStore.getState().panLocked
}

export function isAppDestinationFocusEngaged(): boolean {
  const store = useAppDestinationFocusStore.getState()
  return store.panLocked || store.dismissing
}

export function shouldBlockCanvasZoomForAppDestinationFocus(
  _target: EventTarget | null,
): boolean {
  return isAppDestinationFocusActive()
}

function clearFisheyeForPlateFocus(): void {
  resetCanvasMinimapUiState()
  forceClearCanvasBarrelWarp()
}

/** Fit a feature plate to the viewport and lock pan until Esc. */
export function focusAppDestinationPlate(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: FeaturePlateDestination,
): void {
  const ref = transformRef.current
  if (!ref) return

  const focusStore = useAppDestinationFocusStore.getState()
  if (focusStore.panLocked && focusStore.activeDestination === destination) {
    return
  }

  clearFisheyeForPlateFocus()

  const returnCamera = readCameraFromRef(ref)
  if (!returnCamera) return

  useAppDestinationStore.getState().setDestination(destination)
  focusStore.armFocus(destination, returnCamera)

  const rect = canvasMinimapFeaturePlateRect(destination)
  focusItemOnCanvas(ref, rect, {
    ...appDestinationPlateFitOptions(),
    onComplete: () => {
      if (transformRef.current !== ref) return
      useAppDestinationFocusStore.getState().revealFocus()
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
      updateCanvasBarrelAfterCamera(ref, { silent: true })
    },
  })
}

/** Re-fit the active plate when the viewport aspect changes during focus. */
export function refitAppDestinationFocusPlate(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  const store = useAppDestinationFocusStore.getState()
  if (
    !store.panLocked ||
    store.dismissing ||
    !store.activeDestination ||
    !isFeaturePlateDestination(store.activeDestination)
  ) {
    return
  }

  const ref = transformRef.current
  if (!ref) return

  const rect = canvasMinimapFeaturePlateRect(store.activeDestination)
  focusItemOnCanvas(ref, rect, {
    ...appDestinationPlateFitOptions(0),
    onComplete: () => {
      if (transformRef.current !== ref) return
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
      updateCanvasBarrelAfterCamera(ref, { silent: true })
    },
  })
}

/** Zoom back to the saved camera — Esc while a feature plate is focused. */
export function dismissAppDestinationFocus(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  opts?: { playSound?: boolean; onComplete?: () => void },
): boolean {
  const store = useAppDestinationFocusStore.getState()
  if (!store.panLocked || !store.returnCamera || store.dismissing) return false

  if (opts?.playSound !== false) playSubmenuTap()

  const returnCamera = store.returnCamera
  store.setDismissing(true)

  animateCameraToTarget(transformRef.current, returnCamera, {
    curved: true,
    animationMs: PLATE_FOCUS_MS,
    restoreTransformMaxScale: true,
    onComplete: () => {
      useAppDestinationFocusStore.getState().clearFocus()
      const ref = transformRef.current
      if (ref) {
        useCanvasWorkspaceStore.getState().syncMainCamera(ref)
        updateCanvasBarrelAfterCamera(ref, { silent: true })
      }
      opts?.onComplete?.()
    },
  })
  return true
}

/** Pan/fit the main canvas to an app destination plate. */
export function panToAppDestination(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: AppDestination,
): void {
  if (isFeaturePlateDestination(destination)) {
    focusAppDestinationPlate(transformRef, destination)
    return
  }

  const rect = canvasMinimapStudioRect()
  const focusStore = useAppDestinationFocusStore.getState()
  if (focusStore.panLocked) {
    dismissAppDestinationFocus(transformRef, {
      playSound: false,
      onComplete: () => panCanvasMinimapToItem(transformRef, rect),
    })
    return
  }

  focusStore.clearFocus()
  panCanvasMinimapToItem(transformRef, rect)
}
