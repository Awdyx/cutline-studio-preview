import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import { clientToCanvas } from './canvasCoords'
import { isPenInput, isPenMenuPointer, isPhoneFingerDrawMode, noteStylusInput } from './penInput'
import {
  advancePenToolMenuRail,
  hitTestPenToolPill,
  initPenToolMenuRail,
  snapPenToolMenuRailToPointer,
  isPointerExitingPenToolPillTop,
  isPointerInPenToolPill,
  isPointerInPenToolSettingsPanel,
  isPointerInPenToolSubmenuZone,
  isUiDrawCanvasTarget,
  PEN_TOOL_ORDER,
  pillSegmentCenters,
  type PenToolPillSettingsPanel,
  pillToolSupportsSettingsPanel,
  UI_DRAW_PEN_TOOL_ORDER,
} from './penToolMenuLayout'
import { applyToolSettingsPickAtPoint } from './penToolSettingsCommit'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useStrokesStore } from './strokesStore'
import { useToolStore, type ToolMode } from './toolStore'
import { useLassoStore } from './useLassoStore'
import { isStudyHubScratchPadTarget } from '../canvasItems/studyHubMenuFocus'

/** Hold this long with no UI — pill swoops in once threshold is met. */
export const HOLD_MS = 400

/** Stylus stillness radius (screen px) — any drift beyond this cancels the hold. */
export const PEN_MOVE_CANCEL_PX = 16

/** Brief stylus wobble grace before drift checks apply (iPad hand tremor). */
const PEN_MOVE_GRACE_MS = 180

/** Mouse / space-bar stillness radius (screen px). */
const POINTER_MOVE_CANCEL_PX = 3

/** Mouse / space-bar wobble grace before drift checks apply. */
const POINTER_MOVE_GRACE_MS = 80

type CancelFn = () => void
const cancelDrawRegistry: Set<CancelFn> = new Set()

/** Shared bridge for hooks outside the canvas draw surface (e.g. study hub scratch pad). */
export const penToolMenuBridgeRef: { current: PenToolMenuBridge | null } = {
  current: null,
}
export function registerPenMenuCancelDraw(fn: CancelFn): () => void {
  cancelDrawRegistry.add(fn)
  return () => cancelDrawRegistry.delete(fn)
}

export type PenToolMenuPhase = 'idle' | 'open' | 'closing'

export type PenToolMenuState = {
  phase: PenToolMenuPhase
  anchorX: number
  anchorY: number
  /** Live pointer while the pill is open — drives elastic segment morph. */
  pointerX: number | null
  pointerY: number | null
  hoveredTool: ToolMode | null
  /** Tool picked on release — drives the commit close animation. */
  committedTool: ToolMode | null
  /** Colour/size or lasso-target panel above the pill. */
  settingsPanel: PenToolPillSettingsPanel | null
  toolOrder: ToolMode[]
}

const idleUi: PenToolMenuState = {
  phase: 'idle',
  anchorX: 0,
  anchorY: 0,
  pointerX: null,
  pointerY: null,
  hoveredTool: null,
  committedTool: null,
  settingsPanel: null,
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
  /** Called when the close animation finishes in PenToolPillMenu. */
  finishCloseAnimation: () => void
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function isCanvasViewportTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.cutline-canvas-viewport') != null
}

function isPenMenuAnchorTarget(target: EventTarget | null): boolean {
  return isCanvasViewportTarget(target) || isStudyHubScratchPadTarget(target)
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
  /** Guard-rail X while the pill is open (delta-integrated, wall-clamped). */
  railX: number
  lastRawX: number
  strict: boolean
  peakDriftPx: number
  graceUntilMs: number
  generation: number
  toolOrder: ToolMode[]
  timer: ReturnType<typeof setTimeout> | null
  settingsPanel: PenToolPillSettingsPanel | null
  /** Settings-capable tool under the pointer while on the pill (before exiting upward). */
  pillAimTool: PenToolPillSettingsPanel | null
  settingsOpened: boolean
  /** True while the pointer is in the settings panel — pill rail X stays frozen. */
  interactingWithSettings: boolean
}

function freshHoldController(): HoldController {
  return {
    phase: 'idle',
    source: 'none',
    pointerId: null,
    anchorX: 0,
    anchorY: 0,
    railX: 0,
    lastRawX: 0,
    strict: false,
    peakDriftPx: 0,
    graceUntilMs: 0,
    generation: 0,
    toolOrder: PEN_TOOL_ORDER,
    timer: null,
    settingsPanel: null,
    pillAimTool: null,
    settingsOpened: false,
    interactingWithSettings: false,
  }
}

export function usePenToolMenu(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): {
  state: PenToolMenuState
  bridgeRef: RefObject<PenToolMenuBridge>
} {
  const [state, setState] = useState<PenToolMenuState>(idleUi)
  const stateRef = useRef(state)
  stateRef.current = state
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

  const resetHoldInternal = (playCloseSound: boolean, opts?: { instant?: boolean }) => {
    const hold = holdRef.current

    if (hold.phase === 'open') {
      if (opts?.instant) {
        clearHoldTimer(hold)
        hold.generation += 1
        Object.assign(hold, freshHoldController(), { generation: hold.generation })
        setState(idleUi)
        if (playCloseSound) playSound('menuClose')
      } else {
        beginCloseUi(null, playCloseSound)
      }
      return
    }

    clearHoldTimer(hold)
    hold.generation += 1
    Object.assign(hold, freshHoldController(), { generation: hold.generation })
    setState((prev) => (prev.phase === 'closing' && !opts?.instant ? prev : idleUi))
  }

  const beginCloseUi = (committedTool: ToolMode | null, playCloseSound: boolean) => {
    const hold = holdRef.current
    const ui = stateRef.current
    if (ui.phase !== 'open') return

    const snapshot = {
      anchorX: hold.anchorX,
      anchorY: hold.anchorY,
      pointerX: null,
      pointerY: null,
      toolOrder: hold.toolOrder,
      hoveredTool: committedTool,
      committedTool,
      settingsPanel: null,
    }

    clearHoldTimer(hold)
    hold.generation += 1
    Object.assign(hold, freshHoldController(), { generation: hold.generation })

    setState({ phase: 'closing', ...snapshot })
    if (playCloseSound) playSound(committedTool ? 'submenuTap' : 'menuClose')
  }

  const resetHoldState = (playCloseSound: boolean, opts?: { instant?: boolean }) => {
    resetHoldInternal(playCloseSound, opts)
  }

  const playOpenMenuSoundIfNeeded = () => {
    const hold = holdRef.current
    if (hold.phase !== 'open') return
    // Upward drag into settings in the same frame — one confirm sound on release instead.
    if (hold.settingsOpened) return
    playSound('menuOpen')
  }

  const openMenuUi = () => {
    const hold = holdRef.current
    const { cancelActiveStroke, cancelEraseSession } = useStrokesStore.getState()
    cancelActiveStroke()
    cancelEraseSession()
    cancelDrawRegistry.forEach((fn) => fn())
    useLassoStore.getState().cancelLasso()
    hold.phase = 'open'
    const rail = initPenToolMenuRail(
      hold.anchorX,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    hold.railX = rail.railX
    hold.lastRawX = rail.lastRawX
    const hovered = hitTestPenToolPill(
      rail.x,
      rail.y,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
      { guardRail: true },
    )
    hold.settingsPanel = null
    hold.pillAimTool = null
    hold.settingsOpened = false
    hold.interactingWithSettings = false
    setState({
      phase: 'open',
      anchorX: hold.anchorX,
      anchorY: hold.anchorY,
      pointerX: rail.x,
      pointerY: rail.y,
      hoveredTool: hovered,
      committedTool: null,
      settingsPanel: null,
      toolOrder: hold.toolOrder,
    })
    requestAnimationFrame(playOpenMenuSoundIfNeeded)
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

  const sampleOpenRail = (hold: HoldController, clientX: number) => {
    const next = advancePenToolMenuRail(
      { railX: hold.railX, lastRawX: hold.lastRawX },
      clientX,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    hold.railX = next.railX
    hold.lastRawX = next.lastRawX
    return next
  }

  const collapseSettingsSubmenu = (hold: HoldController) => {
    hold.settingsOpened = false
    hold.settingsPanel = null
  }

  const updateSettingsDrag = (
    hold: HoldController,
    clientX: number,
    clientY: number,
    hovered: ToolMode | null,
  ): PenToolPillSettingsPanel | null => {
    const zonePanel = hold.settingsPanel
    const inSubmenuZone = isPointerInPenToolSubmenuZone(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
      zonePanel,
    )
    const onPill = isPointerInPenToolPill(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )

    if (onPill) {
      if (hold.settingsOpened) collapseSettingsSubmenu(hold)
      hold.pillAimTool =
        hovered && pillToolSupportsSettingsPanel(hovered) ? hovered : null
      return null
    }

    if (hold.settingsOpened && hold.settingsPanel && inSubmenuZone) {
      return hold.settingsPanel
    }

    const exitingTop = isPointerExitingPenToolPillTop(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    if (exitingTop && hold.pillAimTool) {
      if (!hold.settingsOpened) {
        hold.settingsOpened = true
        hold.settingsPanel = hold.pillAimTool
      }
      return hold.settingsPanel
    }

    if (hold.settingsOpened) collapseSettingsSubmenu(hold)
    return null
  }

  const settingsToolCenterX = (hold: HoldController, tool: PenToolPillSettingsPanel) => {
    const centers = pillSegmentCenters(
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    const index = hold.toolOrder.indexOf(tool)
    return index >= 0 ? (centers[index] ?? hold.railX) : hold.railX
  }

  const updateOpenHover = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    const zonePanel = hold.settingsPanel
    const inSubmenuZone = isPointerInPenToolSubmenuZone(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
      zonePanel,
    )
    const inSettingsPanel = isPointerInPenToolSettingsPanel(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
      zonePanel,
    )
    const onPill = isPointerInPenToolPill(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )
    const inSettings =
      hold.settingsOpened &&
      hold.settingsPanel != null &&
      inSubmenuZone &&
      !onPill

    const freezeRail = inSubmenuZone && hold.settingsOpened && hold.settingsPanel != null
    const wasInSettings = hold.interactingWithSettings
    if (freezeRail) {
      if (!wasInSettings) hold.lastRawX = clientX
      hold.interactingWithSettings = true
    } else {
      if (wasInSettings) hold.lastRawX = clientX
      hold.interactingWithSettings = false
    }

    let pointerX = hold.railX
    let pointerY = hold.anchorY
    let hovered: ToolMode | null

    if (onPill) {
      const snapped = snapPenToolMenuRailToPointer(
        clientX,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
      )
      hold.railX = snapped.railX
      hold.lastRawX = snapped.lastRawX
      pointerX = snapped.x
      pointerY = snapped.y
      hovered = hitTestPenToolPill(
        clientX,
        clientY,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
      )
    } else if (inSettings) {
      hovered = hold.settingsPanel
      pointerX = settingsToolCenterX(hold, hold.settingsPanel!)
      pointerY = hold.anchorY
    } else {
      const rail = sampleOpenRail(hold, clientX)
      pointerX = rail.x
      pointerY = rail.y
      hovered = hitTestPenToolPill(
        rail.x,
        rail.y,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
        { guardRail: true },
      )
    }

    const aimForSettings = onPill
      ? hitTestPenToolPill(
          clientX,
          clientY,
          hold.anchorX,
          hold.anchorY,
          hold.toolOrder,
        )
      : inSettings
        ? hold.settingsPanel
        : hovered
    const settingsPanel = updateSettingsDrag(
      hold,
      clientX,
      clientY,
      aimForSettings,
    )
    if (inSettingsPanel && hold.settingsPanel) {
      applyToolSettingsPickAtPoint(clientX, clientY, hold.settingsPanel)
    }
    setState((prev) => {
      if (
        prev.hoveredTool === hovered &&
        prev.pointerX === pointerX &&
        prev.pointerY === pointerY &&
        prev.settingsPanel === settingsPanel
      ) {
        return prev
      }
      return {
        ...prev,
        hoveredTool: hovered,
        pointerX,
        pointerY,
        settingsPanel,
      }
    })
  }

  const finishOpenHold = (clientX: number, clientY: number) => {
    const hold = holdRef.current
    const zonePanel = hold.settingsPanel
    const inSubmenuZone = isPointerInPenToolSubmenuZone(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
      zonePanel,
    )

    const onPill = isPointerInPenToolPill(
      clientX,
      clientY,
      hold.anchorX,
      hold.anchorY,
      hold.toolOrder,
    )

    let hovered: ToolMode | null
    if (onPill) {
      const snapped = snapPenToolMenuRailToPointer(
        clientX,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
      )
      hold.railX = snapped.railX
      hold.lastRawX = snapped.lastRawX
      hovered = hitTestPenToolPill(
        clientX,
        clientY,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
      )
    } else if (inSubmenuZone && hold.settingsPanel) {
      hovered = hold.settingsPanel
    } else {
      const rail = sampleOpenRail(hold, clientX)
      hovered = hitTestPenToolPill(
        rail.x,
        rail.y,
        hold.anchorX,
        hold.anchorY,
        hold.toolOrder,
        { guardRail: true },
      )
    }
    updateSettingsDrag(
      hold,
      clientX,
      clientY,
      onPill
        ? hovered
        : inSubmenuZone && hold.settingsPanel
          ? hold.settingsPanel
          : hovered,
    )

    if (hold.settingsOpened && hold.settingsPanel && inSubmenuZone) {
      const tool = hold.settingsPanel
      useToolStore.getState().setMode(tool)
      const picked = applyToolSettingsPickAtPoint(clientX, clientY, tool)
      beginCloseUi(tool, !picked)
      if (picked) playSound('submenuTap')
      return true
    }

    if (hovered) useToolStore.getState().setMode(hovered)
    beginCloseUi(hovered, false)
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

    useShortcutUiStore.getState().dismissShortcutMenusForPenHover()

    clearHoldTimer(hold)
    hold.generation += 1
    hold.phase = 'pending'
    hold.source = source
    hold.pointerId = opts.pointerId ?? null
    hold.anchorX = clientX
    hold.anchorY = clientY
    hold.strict = opts.strict
    hold.peakDriftPx = 0
    hold.graceUntilMs =
      performance.now() + (opts.strict ? PEN_MOVE_GRACE_MS : POINTER_MOVE_GRACE_MS)
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
      const holdPhase = holdRef.current.phase
      return holdPhase === 'pending' || holdPhase === 'open'
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
        if (!isPenMenuAnchorTarget(e.target)) return false
        if (!isStudyHubScratchPadTarget(e.target)) {
          const canvas = clientToCanvas(e.clientX, e.clientY, transformRef)
          if (!canvas && !(isPenInput(e) || isPenMenuPointer(e))) return false
        }
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
      if (!uiDraw && !isPenMenuAnchorTarget(el)) return

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

    finishCloseAnimation() {
      setState(idleUi)
    },
  }

  penToolMenuBridgeRef.current = bridgeRef.current

  useEffect(() => {
    return useShortcutUiStore.subscribe((state, prev) => {
      if (prev.toolPaletteOpen && !state.toolPaletteOpen) {
        resetHoldState(true, { instant: true })
      }
    })
  }, [])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') resetHoldState(false, { instant: true })
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      resetHoldState(false, { instant: true })
    }
  }, [])

  return { state, bridgeRef }
}
