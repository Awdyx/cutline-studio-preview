import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import { clientToCanvas } from './canvasCoords'
import { isPenInput, isPenMenuPointer, noteStylusInput } from './penInput'
import { hitTestPenToolPill } from './penToolMenuLayout'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useStrokesStore } from './strokesStore'
import { useToolStore, type ToolMode } from './toolStore'
import { useLassoStore } from './useLassoStore'

/** Hold this long with no UI — pill swoops in once threshold is met. */
export const HOLD_MS = 400

// Lightweight hook for any drawing surface to cancel its in-progress stroke
// when the pen tool pill menu opens.
type CancelFn = () => void
const cancelDrawRegistry: Set<CancelFn> = new Set()
export function registerPenMenuCancelDraw(fn: CancelFn): () => void {
  cancelDrawRegistry.add(fn)
  return () => cancelDrawRegistry.delete(fn)
}
const MOVE_CANCEL_PX = 20
const MOVE_GRACE_MS = 80

export type PenToolMenuPhase = 'idle' | 'open'

export type PenToolMenuState = {
  phase: PenToolMenuPhase
  /** Pencil anchor in viewport (client) coordinates. */
  anchorX: number
  anchorY: number
  hoveredTool: ToolMode | null
}

const idleUi: PenToolMenuState = {
  phase: 'idle',
  anchorX: 0,
  anchorY: 0,
  hoveredTool: null,
}

type InternalPhase = 'idle' | 'pending' | 'open'
type HoldSource = 'none' | 'pointer' | 'space'

export type PenToolMenuBridge = {
  isActive: () => boolean
  isMenuOpen: () => boolean
  onPointerDown: (e: PointerEvent) => boolean
  onPointerMove: (e: PointerEvent) => boolean
  onPointerUp: (e: PointerEvent) => boolean
  beginSpaceHold: (clientX: number, clientY: number) => void
  moveSpaceHold: (clientX: number, clientY: number) => boolean
  endSpaceHold: (clientX: number, clientY: number) => boolean
  cancelSpaceHold: () => void
  /** Cancel an in-progress pointer hold (e.g. finger started drawing). */
  cancelPointerHold: () => void
  resetHold: () => void
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function usePenToolMenu(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): {
  state: PenToolMenuState
  bridgeRef: RefObject<PenToolMenuBridge>
} {
  const [state, setState] = useState<PenToolMenuState>(idleUi)

  const phaseRef = useRef<InternalPhase>('idle')
  const holdSourceRef = useRef<HoldSource>('none')
  const pointerIdRef = useRef<number | null>(null)
  const anchorRef = useRef({ x: 0, y: 0 })
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceUntilRef = useRef(0)
  const bridgeRef = useRef<PenToolMenuBridge>(null!)

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const resetToIdle = () => {
    const wasOpen = phaseRef.current === 'open'
    clearHoldTimer()
    pointerIdRef.current = null
    holdSourceRef.current = 'none'
    phaseRef.current = 'idle'
    setState(idleUi)
    if (wasOpen) playSound('menuClose')
  }

  const openMenu = () => {
    const { cancelActiveStroke, cancelEraseSession } = useStrokesStore.getState()
    cancelActiveStroke()
    cancelEraseSession()
    cancelDrawRegistry.forEach((fn) => fn())
    // Also cancel any active lasso gesture
    useLassoStore.getState().cancelLasso()
    playSound('menuOpen')
    phaseRef.current = 'open'
    const { x, y } = anchorRef.current
    setState({
      phase: 'open',
      anchorX: x,
      anchorY: y,
      hoveredTool: null,
    })
  }

  const startPending = (clientX: number, clientY: number) => {
    clearHoldTimer()
    anchorRef.current = { x: clientX, y: clientY }
    graceUntilRef.current = performance.now() + MOVE_GRACE_MS
    phaseRef.current = 'pending'

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null
      if (phaseRef.current === 'pending') openMenu()
    }, HOLD_MS)
  }

  const cancelPending = () => {
    if (phaseRef.current !== 'pending') return
    clearHoldTimer()
    phaseRef.current = 'idle'
    if (holdSourceRef.current === 'pointer') {
      pointerIdRef.current = null
    }
    holdSourceRef.current = 'none'
  }

  const cancelHold = () => {
    cancelPending()
  }

  const checkDrift = (clientX: number, clientY: number) => {
    if (performance.now() < graceUntilRef.current) return
    const o = anchorRef.current
    if (dist(clientX, clientY, o.x, o.y) <= MOVE_CANCEL_PX) return
    if (phaseRef.current === 'pending') cancelPending()
  }

  const updateHover = (clientX: number, clientY: number) => {
    const { x, y } = anchorRef.current
    const hovered = hitTestPenToolPill(clientX, clientY, x, y)
    setState((prev) =>
      prev.hoveredTool === hovered ? prev : { ...prev, hoveredTool: hovered },
    )
  }

  const finishOpenHold = (clientX: number, clientY: number) => {
    const { x, y } = anchorRef.current
    const hovered = hitTestPenToolPill(clientX, clientY, x, y)
    if (hovered) {
      useToolStore.getState().setMode(hovered)
    }
    resetToIdle()
    return true
  }

  const moveHold = (clientX: number, clientY: number) => {
    if (phaseRef.current === 'open') {
      updateHover(clientX, clientY)
      return true
    }
    if (phaseRef.current === 'pending') {
      checkDrift(clientX, clientY)
    }
    return false
  }

  bridgeRef.current = {
    isActive: () => phaseRef.current === 'pending' || phaseRef.current === 'open',

    isMenuOpen: () => phaseRef.current === 'open',

    onPointerDown(e) {
      if (!isPenMenuPointer(e)) return false
      if (isPenInput(e)) noteStylusInput()
      if (phaseRef.current === 'open') return false

      if (holdSourceRef.current === 'space') {
        cancelHold()
      }

      if (
        pointerIdRef.current !== null &&
        pointerIdRef.current !== e.pointerId
      ) {
        return false
      }

      const canvas = clientToCanvas(e.clientX, e.clientY, transformRef)
      if (!canvas) return false

      holdSourceRef.current = 'pointer'
      pointerIdRef.current = e.pointerId
      startPending(e.clientX, e.clientY)
      return false
    },

    onPointerMove(e) {
      if (!isPenMenuPointer(e)) return false
      if (holdSourceRef.current === 'space') return false
      if (
        pointerIdRef.current !== null &&
        e.pointerId !== pointerIdRef.current
      ) {
        return false
      }
      if (phaseRef.current === 'idle' && holdSourceRef.current !== 'pointer') {
        return false
      }

      return moveHold(e.clientX, e.clientY)
    },

    onPointerUp(e) {
      if (!isPenMenuPointer(e)) return false
      if (
        pointerIdRef.current !== null &&
        e.pointerId !== pointerIdRef.current
      ) {
        return false
      }
      if (holdSourceRef.current === 'space') return false

      if (holdSourceRef.current !== 'pointer' && phaseRef.current === 'idle') {
        if (pointerIdRef.current === e.pointerId) {
          pointerIdRef.current = null
        }
        return false
      }

      clearHoldTimer()

      if (phaseRef.current === 'open') {
        finishOpenHold(e.clientX, e.clientY)
        return true
      }

      cancelHold()
      pointerIdRef.current = null
      holdSourceRef.current = 'none'
      return false
    },

    beginSpaceHold(clientX, clientY) {
      if (phaseRef.current === 'open') return
      if (holdSourceRef.current === 'pointer') return

      const canvas = clientToCanvas(clientX, clientY, transformRef)
      if (!canvas) return

      holdSourceRef.current = 'space'
      pointerIdRef.current = null
      startPending(clientX, clientY)
    },

    moveSpaceHold(clientX, clientY) {
      if (holdSourceRef.current !== 'space') return false
      return moveHold(clientX, clientY)
    },

    endSpaceHold(clientX, clientY) {
      if (holdSourceRef.current !== 'space') return false

      clearHoldTimer()

      if (phaseRef.current === 'open') {
        finishOpenHold(clientX, clientY)
        return true
      }

      cancelHold()
      return false
    },

    cancelSpaceHold() {
      if (holdSourceRef.current !== 'space') return
      clearHoldTimer()
      if (phaseRef.current === 'open') {
        resetToIdle()
        return
      }
      cancelHold()
    },

    cancelPointerHold() {
      if (holdSourceRef.current !== 'pointer') return
      if (phaseRef.current === 'open') return
      cancelHold()
    },

    resetHold() {
      resetToIdle()
    },
  }

  useEffect(() => {
    return useShortcutUiStore.subscribe((state, prev) => {
      if (prev.toolPaletteOpen && !state.toolPaletteOpen) {
        resetToIdle()
      }
    })
  }, [])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') resetToIdle()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      resetToIdle()
    }
  }, [])

  return { state, bridgeRef }
}
