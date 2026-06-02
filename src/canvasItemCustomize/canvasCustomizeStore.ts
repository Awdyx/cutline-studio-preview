import { create } from 'zustand'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { canvasItemUiAnchorId } from '../uiCustomization/types'
import type { CanvasItemLiftRecord } from './captureCanvasItemSnapshot'
import { refreshLiftReturnFromDom, refreshLiftTarget } from './captureCanvasItemSnapshot'
import {
  cancelCanvasCustomizeBlurRelease,
  scheduleCanvasCustomizeBlurRelease,
} from './canvasCustomizeBlurRelease'
import { flushCanvasItemRichTextFromDom } from './flushCanvasItemRichText'
import { retainStickyEmbeddedMediaForHandoff } from './stickyCustomizeMediaRetain'

/** Keep embedded sticky media stable through portal → canvas remount after lift exit. */
const HANDOFF_SETTLE_MS = 320

let handoffSettleTimer: ReturnType<typeof setTimeout> | null = null

function cancelHandoffSettle(): void {
  if (handoffSettleTimer == null) return
  clearTimeout(handoffSettleTimer)
  handoffSettleTimer = null
}

function syncHandoffDocumentAttr(itemId: string | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (itemId) {
    root.setAttribute('data-ui-canvas-item-customize-handoff', '')
    root.setAttribute('data-ui-canvas-item-customize-handoff-id', itemId)
  } else {
    root.removeAttribute('data-ui-canvas-item-customize-handoff')
    root.removeAttribute('data-ui-canvas-item-customize-handoff-id')
  }
}

function scheduleHandoffSettle(itemId: string): void {
  cancelHandoffSettle()
  handoffSettleTimer = setTimeout(() => {
    handoffSettleTimer = null
    if (useCanvasCustomizeStore.getState().handoffItemId === itemId) {
      useCanvasCustomizeStore.setState({ handoffItemId: null })
      syncHandoffDocumentAttr(null)
    }
  }, HANDOFF_SETTLE_MS)
}

export type CanvasCustomizeEnterPhase = 'idle' | 'staging' | 'lifting' | 'live'

type CanvasCustomizeState = {
  active: boolean
  exiting: boolean
  enterPhase: CanvasCustomizeEnterPhase
  /** Keeps selection blur mounted while opacity eases out after dismiss. */
  blurReleasing: boolean
  /** Canvas copy may hide once the portaled duplicate has painted at the lift origin. */
  enterCanvasHideReady: boolean
  itemId: string | null
  /** Sticky/item id kept in media handoff briefly after portal lands on canvas. */
  handoffItemId: string | null
  lift: CanvasItemLiftRecord | null

  open: (itemId: string, lift: CanvasItemLiftRecord) => void
  close: () => void
  advanceEnterToLift: () => void
  completeEnterLift: () => void
  dismiss: () => boolean
  finishDismiss: () => void
}

export const useCanvasCustomizeStore = create<CanvasCustomizeState>((set, get) => ({
  active: false,
  exiting: false,
  enterPhase: 'idle',
  blurReleasing: false,
  enterCanvasHideReady: false,
  itemId: null,
  handoffItemId: null,
  lift: null,

  open: (itemId, lift) => {
    const anchorId = canvasItemUiAnchorId(itemId)
    useUiCustomizationStore.setState({
      editing: true,
      focusedAnchorId: anchorId,
      selectedPinId: null,
      drawing: false,
    })
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-ui-customize', '1')
      document.documentElement.setAttribute('data-ui-canvas-item-customize-focused', '1')
    }
    cancelCanvasCustomizeBlurRelease()
    cancelHandoffSettle()
    syncHandoffDocumentAttr(null)
    const item = useCanvasItemsStore.getState().items.find((i) => i.id === itemId)
    if (item?.type === 'sticky') {
      retainStickyEmbeddedMediaForHandoff(itemId)
    }
    set({
      active: true,
      exiting: false,
      enterPhase: 'staging',
      blurReleasing: false,
      enterCanvasHideReady: false,
      handoffItemId: null,
      itemId,
      lift,
    })
  },

  close: () => {
    cancelCanvasCustomizeBlurRelease()
    cancelHandoffSettle()
    syncHandoffDocumentAttr(null)
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-ui-canvas-item-customize-focused')
    }
    set({
      active: false,
      exiting: false,
      enterPhase: 'idle',
      blurReleasing: false,
      enterCanvasHideReady: false,
      itemId: null,
      handoffItemId: null,
      lift: null,
    })
  },

  advanceEnterToLift: () => {
    const state = get()
    if (!state.active || state.exiting || state.enterPhase !== 'staging') return
    if (state.itemId) {
      flushCanvasItemRichTextFromDom(state.itemId)
    }
    const item = state.itemId
      ? useCanvasItemsStore.getState().items.find((i) => i.id === state.itemId)
      : null
    const lift =
      item && state.lift
        ? refreshLiftTarget(state.lift, item.width, item.height, item.type)
        : state.lift
    set({ enterPhase: 'lifting', lift })
  },

  completeEnterLift: () => {
    const state = get()
    if (!state.active || state.exiting || state.enterPhase !== 'lifting') return
    set({ enterPhase: 'live' })
  },

  dismiss: () => {
    const state = get()
    if (!state.active || state.exiting) return false
    if (state.enterPhase === 'staging') return false

    const itemId = state.itemId
    const lift = state.lift
    if (!itemId || !lift) return false

    flushCanvasItemRichTextFromDom(itemId)

    const item = useCanvasItemsStore.getState().items.find((i) => i.id === itemId)
    const refreshedLift =
      item != null
        ? refreshLiftReturnFromDom(
            itemId,
            item.type,
            item.width,
            item.height,
            lift,
          )
        : lift

    if (item?.type === 'sticky') {
      retainStickyEmbeddedMediaForHandoff(itemId)
    }

    set({ exiting: true, blurReleasing: true, lift: refreshedLift })
    scheduleCanvasCustomizeBlurRelease()
    return true
  },

  finishDismiss: () => {
    const state = get()
    if (!state.active && !state.exiting) return

    const handoffItemId = state.itemId
    if (handoffItemId) {
      flushCanvasItemRichTextFromDom(handoffItemId)
    }

    useCanvasItemsStore.getState().clearSelection({ silent: true })
    set({
      active: false,
      exiting: false,
      enterPhase: 'idle',
      itemId: null,
      lift: null,
      handoffItemId,
      enterCanvasHideReady: false,
    })
    useUiCustomizationStore.getState().setEditing(false)
    if (handoffItemId) {
      syncHandoffDocumentAttr(handoffItemId)
      scheduleHandoffSettle(handoffItemId)
    }
  },
}))

/** Canvas widget customize session is active (including exit animation). */
export function useCanvasCustomizeActive(): boolean {
  return useCanvasCustomizeStore(
    (s) => s.active && s.itemId != null && s.lift != null,
  )
}

export function useCanvasCustomizeEnterPhase(): CanvasCustomizeEnterPhase {
  return useCanvasCustomizeStore((s) => s.enterPhase)
}

/** Portal should mount (staging through exit). */
export function useCanvasCustomizePortalVisible(itemId: string): boolean {
  return useCanvasCustomizeStore(
    (s) =>
      s.itemId === itemId &&
      s.lift != null &&
      s.active &&
      s.enterPhase !== 'idle',
  )
}

export function isCanvasCustomizeTarget(itemId: string): boolean {
  const s = useCanvasCustomizeStore.getState()
  return (
    s.active &&
    s.itemId === itemId &&
    s.lift != null &&
    s.enterPhase !== 'idle'
  )
}

export function useCanvasCustomizeExiting(itemId: string): boolean {
  return useCanvasCustomizeStore(
    (s) => s.exiting && s.itemId === itemId,
  )
}

/** Sticky (or any item) in customize enter, exit lift, or portal handoff. */
export function useCanvasCustomizeItemHandoff(itemId: string): boolean {
  return useCanvasCustomizeStore(
    (s) =>
      ((s.active || s.exiting) &&
        s.itemId === itemId &&
        s.enterPhase !== 'idle') ||
      s.handoffItemId === itemId,
  )
}

/** Drag/resize handles and font-size chrome hide while this item (or its sticky parent) is customizing. */
export function useCanvasCustomizeHidesItemChrome(
  itemId: string,
  parentStickyId?: string | null,
): boolean {
  return useCanvasCustomizeStore((s) => {
    if (s.handoffItemId === itemId) return true
    if (parentStickyId != null && s.handoffItemId === parentStickyId) return true
    if (!s.itemId || (!s.active && !s.exiting)) return false
    if (s.enterPhase === 'staging') return false
    if (s.itemId === itemId) return true
    if (parentStickyId != null && s.itemId === parentStickyId) return true
    return false
  })
}

export function useCanvasCustomizeLift(
  itemId: string,
): CanvasItemLiftRecord | null {
  return useCanvasCustomizeStore((s) =>
    s.itemId === itemId ? s.lift : null,
  )
}
