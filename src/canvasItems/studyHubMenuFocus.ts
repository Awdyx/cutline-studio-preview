import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  animateCameraToTarget,
  focusItemOnCanvas,
  readCameraFromRef,
  studyHubMenuFocusFitOptions,
} from '../canvas/canvasCamera'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { playSubmenuTap } from '../sound/submenuSound'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { StudyHubCanvasItem } from './types'

export function isStudyHubMenuFocusActive(): boolean {
  return useCanvasItemsStore.getState().menuFocusReturnCamera != null
}

export function isStudyHubMenuFocusEngaged(): boolean {
  const store = useCanvasItemsStore.getState()
  return store.menuFocusReturnCamera != null || store.menuFocusDismissing
}

export function isPointerOnStudyHubMenuFocusPortal(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('.study-hub-menu-focus-portal') != null
}

export function isPointerOnCanvasViewport(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('.cutline-canvas-viewport') != null
}

/** Block canvas zoom when menu focus is active and the pointer is not over the portal. */
export function shouldBlockCanvasZoomForStudyHubMenuFocus(
  target: EventTarget | null,
): boolean {
  if (!isStudyHubMenuFocusActive()) return false
  return !isPointerOnStudyHubMenuFocusPortal(target)
}

/** Zoom into a study hub with menu-focus chrome (left-click / menu re-open). */
export function focusStudyHubOnCanvas(
  transformRef: ReactZoomPanPinchContentRef | null,
  itemId: string,
): boolean {
  const store = useCanvasItemsStore.getState()
  if (store.menuFocusDismissing) return false
  if (
    store.menuFocusReturnCamera != null &&
    store.zMenuSuppressedItemId === itemId
  ) {
    return false
  }

  const item = store.items.find(
    (entry): entry is StudyHubCanvasItem =>
      entry.id === itemId && entry.type === 'study_hub',
  )
  if (!item) return false

  const returnCamera = readCameraFromRef(transformRef)
  useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
  store.selectItem(itemId, false, {
    allowFrozen: true,
    suppressZMenu: true,
    menuFocusReturnCamera: returnCamera,
  })
  focusItemOnCanvas(transformRef, item, studyHubMenuFocusFitOptions())
  return true
}

/** Zoom back to the saved camera — same path as the portal dismiss button. */
export function dismissStudyHubMenuFocus(
  transformRef: ReactZoomPanPinchContentRef | null,
  opts?: { playSound?: boolean },
): boolean {
  const store = useCanvasItemsStore.getState()
  if (!store.menuFocusReturnCamera || store.menuFocusDismissing) return false

  if (opts?.playSound !== false) playSubmenuTap()

  const dismissItemId = store.zMenuSuppressedItemId
  const returnCamera = store.takeMenuFocusReturnCamera()
  if (!returnCamera) return false

  useCanvasItemsStore.setState({
    menuFocusDismissing: true,
    menuFocusDismissItemId: dismissItemId,
  })
  animateCameraToTarget(transformRef, returnCamera, {
    curved: true,
    restoreTransformMaxScale: true,
    onComplete: () => {
      useCanvasItemsStore.setState({
        menuFocusDismissing: false,
        menuFocusDismissItemId: null,
      })
    },
  })
  return true
}
