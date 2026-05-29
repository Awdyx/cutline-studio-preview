import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import { clientToCanvas } from './canvasCoords'
import { isPenInput, isPenMenuPointer, isPhoneFingerDrawMode, noteStylusInput } from './penInput'
import {
  hitTestPenToolPill,
  isUiDrawCanvasTarget,
  PEN_TOOL_ORDER,
  UI_DRAW_PEN_TOOL_ORDER,
} from './penToolMenuLayout'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useStrokesStore } from './strokesStore'
import { useToolStore, type ToolMode } from './toolStore'
import { useLassoStore } from './useLassoStore'

/** Hold this long with no UI — pill swoops in once threshold is met. */
export const HOLD_MS = 700

/** Stylus stillness radius (screen px) — any drift beyond this cancels the hold. */
export const PEN_MOVE_CANCEL_PX = 1

/** Mouse / space-bar stillness radius (screen px). */
const POINTER_MOVE_CANCEL_PX = 20

/** Mouse / space-bar wobble grace before drift checks apply. */
const POINTER_MOVE_GRACE_MS = 80

type CancelFn = () => void
const cancelDrawRegistry: Set<CancelFn> = new Set()
export function registerPenMenuCancelDraw(fn: CancelFn): () => void {
  cancelDrawRegistry.add(fn)
  return () => cancelDrawRegistry.delete(fn)
}

export type PenToolMenuPhase = 'idle' | 'open'

export type PenToolMenuState = {
  phase: PenToolMenuPhase
  anchorX: number
  anchorY: number
  hoveredTool: ToolMode | null
  toolOrder: ToolMode[]
}

const idleUi: PenToolMenuState = {
  phase: 'idle',
  anchorX: 0,
  anchorY: 0,
  hoveredTool: null,
  toolOrder: PEN_TOOL_ORDER,
}

type HoldPhase = 'idle' | 'pending' | 'open'
type HoldSource = 'none' | 'pointer' | 'space'

export type PenToolMenuBridge = {
  isActive: () => boolean
  isMenuOpen: () => boolean
  isPending: () => boolean
  onPointerDown: (e: PointerEvent) => boolean
  onPointerMove: (e: PointerEvent) => boolean
  onPointerUp: (e: PointerEvent) => boolean
  /** Feed screen position from pointer or touch paths while a hold is live. */
  trackPointer: (clientX: number, clientY: number, pointerId?: number | null) => void
  /** End a pointer-sourced hold (pointerup / touchend / touchcancel). */
  releasePointer: (clientX: number, clientY: number, pointerId?: number | null) => boolean
  beginSpaceHold: (clientX: number, clientY: number) => void
  moveSpaceHold: (clientX: number, clientY: number) => boolean
  endSpaceHold: (clientX: number, clientY: number) => boolean
  cancelSpaceHold: () => void
  /** Hard-cancel a pending hold (finger draw, palette close, etc.). */
  cancelPendingHold: () => void
  resetHold: () => void
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function isCanvasViewportTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.cutline-canvas-viewport') != null
}

function isStrictStylusHold(event: PointerEvent): boolean {
  return (
    event.pointerType === 'pen' ||
    isPenInput(event) ||
    (event.pointerType === 'touch' && !isPhoneFingerDrawMode())
  )
}

type HoldController = {
  phase: HoldPhase
  source: HoldSource
  pointerId: number | null
  anchorX: number
  anchorY: number
  strict: boolean
  peakDriftPx: number
  graceUntilMs: number
  generation: number
  toolOrder: ToolMode[]
  timer: ReturnType<typeof setTimeout> | null
}

function freshHoldController(): HoldController {
  return {
    phase: 'idle',
    source: 'none',
    pointerId: null,
    anchorX: 0,
    anchorY: 0,
    strict: false,
    peakDriftPx: 0,
    graceUntilMs: 0,
    generation: 0,
    toolOrder: PEN_TOOL_ORDER,
    timer: null,
  }
}

export function usePenToolMenu(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): {
  state: PenToolMenuState
  bridgeRef: RefObject<PenToolMenuBridge>
} {
  const [state, setState] = useState<PenToolMenuState>(idleUi)
  const holdRef = useRef<HoldController>(freshHoldController())
  const bridgeRef = useRef<PenToolMenuBridge>(null!)

  const driftLimitPx = (hold: HoldController) =>
    hold.strict ? PEN_MOVE_CANCEL_PX : POINTER_MOVE_CANCEL_PX

  const clearHoldTimer = (hold: HoldController) => {
    if (hold.timer !== null) {
      clearTimeout(hold.timer)
      hold.timer = null
    }
  }

  const resetHoldState = (playCloseSound: boolean) => {
    const hold = holdRef.current
    const wasOpen = hold.phase === 'open'
    clearHoldTimer(hold)
    hold.generation += 1
    Object.assign(hold, freshHoldController(), { generation: hold.generation })
    setState(idleUi)
    if (playCloseSound && wasOpen) playSound('menuClose')
  }

  const openMenuUi = () => {
    const hold = holdRef.current
    const { cancelActiveStroke, cancelEraseSession } = useStrokesStore.getState()
    cancelActiveStroke()
    cancelEraseSession()
    cancelDrawRegistry.forEach((fn) => fn())
    useLassoStore.getState().cancelLasso()
    playSound('menuOpen')
    hold.phase = 'open'
    setState({
      phase: 'open',
      anchorX: hold.anchorX,
      anchorY: hold.anchorY,
      hoveredTool: null,
      toolOrder: hold.toolOrder,
    })
  }

  const cancelPendingHoldInternal = () => {
    const hold = holdRef.current
    if (hold.phase !== 'pending') return
    clearHoldTimer(hold)
    hold.generation += 1
    hold.phase = 'idle'
    hold.source = 'none'
    hold.pointerId = null
    hold.peakDriftPx = 0
  }

  const shouldCancelForDrift = (hold: HoldController) => {
    const limit = driftLimitPx(hold)
    if (hold.peakDriftPx <= limit) return false
    if (hold.strict) return true
    return performance.now() >= hold.graceUntilMs
  }

  const maybeCancelPendingForDrift = () => {
    const hold = holdRef.current
    if (hold.phase !== 'pending') return
    if (shouldCancelForDrift(hold)) cancelPendingHoldInternal()
  }

  const recordPointerSample = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    hold.peakDriftPx = Math.max(
      hold.peakDriftPx,
      dist(clientX, clientY, hold.anchorX, hold.anchorY),
    )
    maybeCancelPendingForDrift()
  }

  const updateOpenHover = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    const hovered = hitTestPenToolPill(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    setState((prev) =>
      prev.hoveredTool === hovered ? prev : { ...prev, hoveredTool: hovered },
    )
  }

  const finishOpenHold = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    const hovered = hitTestPenToolPill(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    if (hovered) useToolStore.getState().setMode(hovered)
    resetHoldState(true)
    return true
  }

  const scheduleHoldTimer = () => {
    const hold = holdRef.current
    clearHoldTimer(hold)
    const generation = hold.generation
    hold.timer = setTimeout(() => {
      hold.timer = null
      if (hold.generation !== generation) return
      if (hold.phase !== 'pending') return
      if (shouldCancelForDrift(hold)) {
        cancelPendingHoldInternal()
        return
      }
      openMenuUi()
    }, HOLD_MS)
  }

  const beginHold = (
    clientX: number,
    clientY: number,
    toolOrder: ToolMode[],
    source: HoldSource,
    opts: { strict: boolean; pointerId?: number | null },
  ) => {
    const hold = holdRef.current
    if (hold.phase === 'open') return

    clearHoldTimer(hold)
    hold.generation += 1
    hold.phase = 'pending'
    hold.source = source
    hold.pointerId = opts.pointerId ?? null
    hold.anchorX = clientX
    hold.anchorY = clientY
    hold.strict = opts.strict
    hold.peakDriftPx = 0
    hold.graceUntilMs = performance.now() + POINTER_MOVE_GRACE_MS
    hold.toolOrder = toolOrder
    scheduleHoldTimer()
  }

  const endHold = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    clearHoldTimer(hold)

    if (hold.phase === 'open') {
      recordPointerSample(clientX, clientY)
      return finishOpenHold(clientX, clientY)
    }

    if (hold.phase === 'pending') {
      cancelPendingHoldInternal()
    }

    hold.source = 'none'
    hold.pointerId = null
    return false
  }

  const trackPointer = (clientX: number, clientY: number, pointerId?: number | null) => {
    const hold = holdRef.current
    if (hold.phase === 'idle') return

    if (
      hold.source === 'pointer' &&
      hold.pointerId !== null &&
      pointerId != null &&
      pointerId !== hold.pointerId
    ) {
      return
    }

    if (hold.phase === 'pending') {
      recordPointerSample(clientX, clientY)
      return
    }

    if (hold.phase === 'open') {
      updateOpenHover(clientX, clientY)
    }
  }

  bridgeRef.current = {
    isActive: () => {
      const phase = holdRef.current.phase
      return phase === 'pending' || phase === 'open'
    },

    isMenuOpen: () => holdRef.current.phase === 'open',

    isPending: () => holdRef.current.phase === 'pending',

    onPointerDown(e) {
      const uiDraw = isUiDrawCanvasTarget(e.target)
      if (!uiDraw && !isPenMenuPointer(e)) return false
      if (isPenInput(e)) noteStylusInput()

      const hold = holdRef.current
      if (hold.phase === 'open') return false

      if (hold.source === 'space') {
        cancelPendingHoldInternal()
      }

      if (hold.pointerId !== null && hold.pointerId !== e.pointerId) {
        return false
      }

      if (!uiDraw) {
        if (!isCanvasViewportTarget(e.target)) return false
        const canvas = clientToCanvas(e.clientX, e.clientY, transformRef)
        if (!canvas && !(isPenInput(e) || isPenMenuPointer(e))) return false
      }

      beginHold(
        e.clientX,
        e.clientY,
        uiDraw ? UI_DRAW_PEN_TOOL_ORDER : PEN_TOOL_ORDER,
        'pointer',
        { strict: isStrictStylusHold(e), pointerId: e.pointerId },
      )
      return false
    },

    onPointerMove(e) {
      const hold = holdRef.current
      if (hold.phase === 'idle') return false
      if (hold.source === 'space') return false
      if (hold.pointerId !== null && e.pointerId !== hold.pointerId) return false

      trackPointer(e.clientX, e.clientY, e.pointerId)
      return hold.phase === 'open'
    },

    onPointerUp(e) {
      const hold = holdRef.current
      if (hold.phase === 'idle' && !isPenMenuPointer(e)) return false
      if (hold.source === 'space') return false
      if (hold.pointerId !== null && e.pointerId !== hold.pointerId) return false
      return endHold(e.clientX, e.clientY)
    },

    trackPointer,

    releasePointer(clientX, clientY, pointerId) {
      const hold = holdRef.current
      if (hold.source !== 'pointer') return false
      if (hold.pointerId !== null && pointerId != null && pointerId !== hold.pointerId) {
        return false
      }
      return endHold(clientX, clientY)
    },

    beginSpaceHold(clientX, clientY) {
      const hold = holdRef.current
      if (hold.phase === 'open') return
      if (hold.source === 'pointer') return

      const el = document.elementFromPoint(clientX, clientY)
      const uiDraw = isUiDrawCanvasTarget(el)
      if (!uiDraw && !isCanvasViewportTarget(el)) return

      beginHold(
        clientX,
        clientY,
        uiDraw ? UI_DRAW_PEN_TOOL_ORDER : PEN_TOOL_ORDER,
        'space',
        { strict: false },
      )
    },

    moveSpaceHold(clientX, clientY) {
      const hold = holdRef.current
      if (hold.source !== 'space') return false
      trackPointer(clientX, clientY)
      return hold.phase === 'open'
    },

    endSpaceHold(clientX, clientY) {
      const hold = holdRef.current
      if (hold.source !== 'space') return false
      return endHold(clientX, clientY)
    },

    cancelSpaceHold() {
      const hold = holdRef.current
      if (hold.source !== 'space' && hold.phase === 'idle') return
      if (hold.phase === 'open') {
        resetHoldState(true)
        return
      }
      cancelPendingHoldInternal()
    },

    cancelPendingHold() {
      cancelPendingHoldInternal()
    },

    resetHold() {
      resetHoldState(true)
    },
  }

  useEffect(() => {
    return useShortcutUiStore.subscribe((state, prev) => {
      if (prev.toolPaletteOpen && !state.toolPaletteOpen) {
        resetHoldState(true)
      }
    })
  }, [])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') resetHoldState(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      resetHoldState(false)
    }
  }, [])

  return { state, bridgeRef }
}
