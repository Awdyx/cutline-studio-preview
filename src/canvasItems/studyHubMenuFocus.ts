import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  animateCameraToTarget,
  focusItemOnCanvas,
  readCameraFromRef,
  restoreTransformMaxScale,
  studyHubEphemeralSelectionBlurPx,
  studyHubMenuFocusFitOptions,
} from '../canvas/canvasCamera'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { playSound } from '../sound/playSound'
import { playSubmenuTap } from '../sound/submenuSound'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { applyPocketStripScrollNow } from '../spaces/usePocketStripScroll'
import { usePocketStripStore } from '../spaces/pocketStripStore'
import type { SpaceCamera } from '../spaces/types'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { StudyHubCanvasItem, StudySubjectId } from './types'
import { STUDY_HUB_SCRATCH_PAD_TRANSITION_MS } from './studyHubMenuFocusLayout'

/** In pockets, menuFocusReturnCamera.positionY stores strip scrollY. */
function pocketMenuFocusReturnScroll(camera: SpaceCamera): number {
  return camera.positionY
}

function scrollPocketStripToStudyHub(item: StudyHubCanvasItem): void {
  const { logicalWidth, viewportWidth, viewportHeight } = usePocketStripStore.getState()
  const targetScrollY = item.y + item.height / 2
  applyPocketStripScrollNow(targetScrollY, viewportWidth, viewportHeight, logicalWidth)
  usePocketStripStore.getState().setScrollY(targetScrollY)
  useCanvasWorkspaceStore
    .getState()
    .saveStripForActive({ logicalWidth, scrollY: targetScrollY })
}

function restorePocketStripScroll(scrollY: number): void {
  const { logicalWidth, viewportWidth, viewportHeight } = usePocketStripStore.getState()
  applyPocketStripScrollNow(scrollY, viewportWidth, viewportHeight, logicalWidth)
  usePocketStripStore.getState().setScrollY(scrollY)
  useCanvasWorkspaceStore
    .getState()
    .saveStripForActive({ logicalWidth, scrollY })
}

/** Fade duration — keep in sync with placed-hub menu-focus portal. */
export const STUDY_HUB_OVERLAY_TRANSITION_MS = 200

/** Shortcut/ephemeral overlay — panel opacity fade (blur eases via `--selection-depth-blur` in CSS). */
export const STUDY_HUB_EPHEMERAL_FADE_MS = 400

function applyStudyHubMenuFocusSelectionBlur(
  transformRef: ReactZoomPanPinchContentRef | null,
): void {
  document.documentElement.style.setProperty(
    '--selection-depth-blur',
    `${studyHubEphemeralSelectionBlurPx(transformRef)}px`,
  )
}

function clearStudyHubMenuFocusSelectionBlur(): void {
  document.documentElement.style.removeProperty('--selection-depth-blur')
}

function revealPlacedStudyHubMenuFocus(
  transformRef: ReactZoomPanPinchContentRef | null,
): void {
  applyStudyHubMenuFocusSelectionBlur(transformRef)
  useCanvasItemsStore.getState().revealMenuFocus()
}

export const STUDY_HUB_EPHEMERAL_FADE_EASE = [0.4, 0, 0.2, 1] as const

export function isStudyHubMenuFocusActive(): boolean {
  const store = useCanvasItemsStore.getState()
  return (
    store.menuFocusReturnCamera != null ||
    store.menuFocusEphemeralSubjectId != null
  )
}

export function isStudyHubMenuFocusEngaged(): boolean {
  const store = useCanvasItemsStore.getState()
  return (
    store.menuFocusReturnCamera != null ||
    store.menuFocusEphemeralSubjectId != null ||
    store.menuFocusDismissing
  )
}

export function isPointerOnStudyHubMenuFocusPortal(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('.study-hub-menu-focus-portal') != null
}

export function isStudyHubScratchPadTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest('[data-study-hub-scratch-pad]') != null ||
    target.closest('[data-study-hub-scratch-pad-viewport]') != null
  )
}

export function isPointerOverOpenStudyHubScratchPad(
  clientX: number,
  clientY: number,
): boolean {
  if (!useCanvasItemsStore.getState().menuFocusScratchPadOpen) return false
  const el = document.elementFromPoint(clientX, clientY)
  return isStudyHubScratchPadTarget(el)
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

export function toggleStudyHubMenuFocusScratchPad(): void {
  playSubmenuTap()
  useCanvasItemsStore.getState().toggleMenuFocusScratchPad()
}

/** Open a shortcut-only overlay — no canvas item is created. */
export function openStudyHubEphemeralOverlay(
  subjectId: StudySubjectId,
): boolean {
  const store = useCanvasItemsStore.getState()
  if (store.menuFocusDismissing) return false
  if (
    store.menuFocusEphemeralSubjectId === subjectId &&
    store.menuFocusRevealed
  ) {
    return false
  }

  useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
  useCanvasItemsStore.setState({
    menuFocusEphemeralSubjectId: subjectId,
    menuFocusRevealed: false,
    menuFocusDismissing: false,
    menuFocusScratchPadOpen: false,
  })
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      useCanvasItemsStore.getState().revealMenuFocus()
    })
  })
  playSound('itemSelect')
  return true
}

/** Zoom into a placed study hub with menu-focus chrome. */
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

  if (useCanvasWorkspaceStore.getState().isInsideSpace()) {
    const returnScrollY = usePocketStripStore.getState().scrollY
    const returnCamera: SpaceCamera = {
      positionX: 0,
      positionY: returnScrollY,
      scale: 1,
    }
    useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
    store.selectItem(itemId, false, {
      allowFrozen: true,
      suppressZMenu: true,
      menuFocusReturnCamera: returnCamera,
    })
    scrollPocketStripToStudyHub(item)
    requestAnimationFrame(() => {
      revealPlacedStudyHubMenuFocus(transformRef)
    })
    return true
  }

  const returnCamera = readCameraFromRef(transformRef)
  useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
  store.selectItem(itemId, false, {
    allowFrozen: true,
    suppressZMenu: true,
    menuFocusReturnCamera: returnCamera,
  })

  focusItemOnCanvas(transformRef, item, {
    ...studyHubMenuFocusFitOptions(),
    onComplete: () => {
      revealPlacedStudyHubMenuFocus(transformRef)
    },
  })
  return true
}

function dismissStudyHubEphemeralOverlay(): boolean {
  const store = useCanvasItemsStore.getState()
  if (!store.menuFocusEphemeralSubjectId || store.menuFocusDismissing) {
    return false
  }

  useCanvasItemsStore.setState({
    menuFocusRevealed: false,
    menuFocusDismissing: true,
    menuFocusScratchPadOpen: false,
  })

  window.setTimeout(() => {
    clearStudyHubMenuFocusSelectionBlur()
    useCanvasItemsStore.setState({
      menuFocusDismissing: false,
      menuFocusEphemeralSubjectId: null,
    })
  }, STUDY_HUB_EPHEMERAL_FADE_MS)

  return true
}

/** Zoom back to the saved camera — same path as the portal dismiss button. */
export function dismissStudyHubMenuFocus(
  transformRef: ReactZoomPanPinchContentRef | null,
  opts?: { playSound?: boolean },
): boolean {
  const store = useCanvasItemsStore.getState()
  if (store.menuFocusDismissing) return false

  if (store.menuFocusEphemeralSubjectId) {
    if (opts?.playSound !== false) playSubmenuTap()
    return dismissStudyHubEphemeralOverlay()
  }

  if (!store.menuFocusReturnCamera) return false

  if (opts?.playSound !== false) playSubmenuTap()

  const dismissItemId = store.zMenuSuppressedItemId
  const scratchWasOpen = store.menuFocusScratchPadOpen
  const returnCamera = store.takeMenuFocusReturnCamera()
  if (!returnCamera) return false

  useCanvasItemsStore.setState({
    menuFocusRevealed: false,
    menuFocusDismissing: true,
    menuFocusDismissItemId: dismissItemId,
    menuFocusScratchPadOpen: false,
    menuFocusDismissScratchClosing: scratchWasOpen,
  })

  const startZoom = () => {
    if (scratchWasOpen) {
      useCanvasItemsStore.setState({ menuFocusDismissScratchClosing: false })
    }

    const finishDismiss = () => {
      clearStudyHubMenuFocusSelectionBlur()
      useCanvasItemsStore.setState({
        menuFocusDismissing: false,
        menuFocusDismissItemId: null,
        menuFocusDismissScratchClosing: false,
      })
    }

    if (useCanvasWorkspaceStore.getState().isInsideSpace()) {
      restorePocketStripScroll(pocketMenuFocusReturnScroll(returnCamera))
      finishDismiss()
      return
    }

    animateCameraToTarget(transformRef, returnCamera, {
      curved: true,
      restoreTransformMaxScale: true,
      onComplete: finishDismiss,
    })
  }

  if (scratchWasOpen) {
    window.setTimeout(startZoom, STUDY_HUB_SCRATCH_PAD_TRANSITION_MS)
  } else {
    startZoom()
  }
  return true
}
