import { useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canStartDrawingPointer,
  isFingerTouch,
  isPenDrawMode,
  isPhoneFingerDrawMode,
  isSpaceDrawHeld,
  isStylusTouch,
  noteStylusInput,
  setSpaceDrawHeld,
} from './penInput'
import { isPhoneLayout } from '../platform/layoutProfile'
import type { PenToolMenuBridge } from './usePenToolMenu'
import { hitTestStickyAtCanvasPoint } from '../canvasItems/stickyHitTest'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from './strokesStore'
import { useToolStore } from './toolStore'
import type { StrokePoint } from './types'
import { clientToCanvasFromElementForStroke } from './canvasCoords'
import { useLassoStore } from './useLassoStore'
import { keepActiveLassoSelectionForPointer } from './lassoPointerGuard'
import { isPointerOnCanvasItem } from '../canvas/canvasSelectionDismiss'
import { isUiDrawCanvasTarget } from './penToolMenuLayout'

const captureOpts = { capture: true } as const
const capturePassiveOpts = { capture: true, passive: false } as const
const ERASE_THROTTLE_MS = 16

function readPressure(pressure: number): number {
  return pressure > 0 ? pressure : 0.5
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useDrawing(
  canvasRef: RefObject<HTMLDivElement | null>,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  onPenStateChange?: (isDown: boolean) => void,
  penMenuBridgeRef?: RefObject<PenToolMenuBridge | null>,
  /** Pass the mounted canvas node so listeners attach when the ref is set. */
  canvasMount?: HTMLDivElement | null,
) {
  useEffect(() => {
    const el = canvasMount ?? canvasRef.current
    if (!el) return
    const canvasEl: HTMLDivElement = el

    const {
      startStroke,
      addPoint,
      endStroke,
      beginDragErase,
      applyDragErase,
    } = useStrokesStore.getState()

    const {
      startStickyStroke,
      addStickyStrokePoint,
      endStickyStroke,
      getStickyById,
    } = useCanvasItemsStore.getState()

    let pointerPenActive = false
    let activePointerId: number | null = null
    let eraseActive = false
    let lastEraseAt = 0
    let activeStickyId: string | null = null
    let lastPointerPos: { clientX: number; clientY: number } | null = null

    function setPenDown(down: boolean) {
      onPenStateChange?.(down)
    }

    function penMenu(): PenToolMenuBridge | null {
      return penMenuBridgeRef?.current ?? null
    }

    function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } | null {
      return clientToCanvasFromElementForStroke(clientX, clientY, canvasEl)
    }

    function toStickyLocalPoint(
      canvasX: number,
      canvasY: number,
      stickyId: string,
      pressure: number,
    ): StrokePoint | null {
      const sticky = getStickyById(stickyId)
      if (!sticky) return null
      return {
        x: canvasX - sticky.x,
        y: canvasY - sticky.y,
        pressure,
      }
    }

    function capturePointer(event: PointerEvent) {
      try {
        canvasEl.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }

    function releasePointer(event: PointerEvent) {
      if (canvasEl.hasPointerCapture(event.pointerId)) {
        canvasEl.releasePointerCapture(event.pointerId)
      }
    }

    function eraseAt(coords: { x: number; y: number }) {
      const now = performance.now()
      if (now - lastEraseAt < ERASE_THROTTLE_MS) return
      lastEraseAt = now
      applyDragErase(coords)
      useCanvasItemsStore.getState().applyStickyStrokeErase(coords)
    }

    function strokeConfig() {
      const tools = useToolStore.getState()
      const mode = tools.mode
      if (mode === 'pen') {
        return {
          color: tools.penColor,
          size: tools.penSize,
          tool: 'pen' as const,
        }
      }
      return {
        color: tools.highlighterColor,
        size: tools.highlighterSize,
        tool: 'highlighter' as const,
      }
    }

    function startDrawAt(
      coords: { x: number; y: number },
      pressure: number,
    ) {
      const mode = useToolStore.getState().mode
      if (mode === 'erase') {
        eraseActive = true
        beginDragErase()
        lastEraseAt = 0
        eraseAt(coords)
        return
      }

      const config = strokeConfig()
      const stickyId = hitTestStickyAtCanvasPoint(coords.x, coords.y)
      if (stickyId) {
        const local = toStickyLocalPoint(coords.x, coords.y, stickyId, pressure)
        if (!local) return
        activeStickyId = stickyId
        startStickyStroke(stickyId, local, config)
        return
      }

      activeStickyId = null
      startStroke({ ...coords, pressure }, config)
    }

    function continueDrawAt(
      coords: { x: number; y: number },
      pressure: number,
    ) {
      const mode = useToolStore.getState().mode
      if (mode === 'erase' && eraseActive) {
        eraseAt(coords)
        return
      }

      if (activeStickyId) {
        const local = toStickyLocalPoint(
          coords.x,
          coords.y,
          activeStickyId,
          pressure,
        )
        if (local) addStickyStrokePoint(local)
        return
      }

      const activeStroke = useStrokesStore.getState().activeStroke
      if (!activeStroke) return
      addPoint({ ...coords, pressure })
    }

    function endDrawSession() {
      const mode = useToolStore.getState().mode
      if (mode === 'erase') {
        eraseActive = false
        return
      }

      if (activeStickyId) {
        endStickyStroke()
        activeStickyId = null
        return
      }

      const activeStroke = useStrokesStore.getState().activeStroke
      if (activeStroke) endStroke()
    }

    function onSpaceDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      if (isEditableTarget(e.target)) return
      if (isPhoneLayout()) return
      if (!isPenDrawMode() || penMenu()?.isActive()) return
      if (!lastPointerPos) return

      e.preventDefault()
      setSpaceDrawHeld(true)
      document.documentElement.setAttribute('data-space-draw', '')
      setPenDown(true)

      const { clientX, clientY } = lastPointerPos
      penMenu()?.beginSpaceHold(clientX, clientY)

      const mode = useToolStore.getState().mode
      if (mode === 'lasso') {
        useLassoStore.getState().clearSelection()
        useLassoStore.getState().startLasso(clientX, clientY)
      } else {
        const coords = toCanvasCoords(clientX, clientY)
        if (coords) startDrawAt(coords, 0.5)
      }
    }

    function onSpaceUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      if (!isSpaceDrawHeld()) return

      e.preventDefault()
      setSpaceDrawHeld(false)
      document.documentElement.removeAttribute('data-space-draw')

      const pos = lastPointerPos
      penMenu()?.endSpaceHold(pos?.clientX ?? 0, pos?.clientY ?? 0)

      if (!pointerPenActive) {
        const lasso = useLassoStore.getState()
        if (lasso.isDrawing) {
          lasso.commitLasso(canvasEl)
        } else {
          endDrawSession()
        }
        setPenDown(false)
      }
    }

    function isCanvasEventTarget(target: EventTarget | null): boolean {
      if (isUiDrawCanvasTarget(target)) return true
      // Canvas DOM hit — always allow (covers items, mesh blobs, etc.).
      if (target instanceof Node && canvasEl.contains(target)) return true
      // Outside the canvas viewport (chrome UI: FABs, top bar, panels, menus)
      // — don't hijack the event so buttons stay clickable in draw mode.
      if (target instanceof Element) {
        return !!target.closest('.cutline-canvas-viewport')
      }
      return false
    }

    function isHandleTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false
      return !!target.closest('.canvas-item-resize-handle, .canvas-item-drag-handle-wrapper')
    }

    function isLassoSelectionChromeTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false
      return !!target.closest('.lasso-selection-pane')
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!isCanvasEventTarget(event.target)) {
        return
      }

      if (isPhoneFingerDrawMode() && isFingerTouch(touch)) {
        if (!penMenu()?.isMenuOpen()) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }

      if (penMenu()?.isActive()) return

      if (!isStylusTouch(touch)) return
      noteStylusInput()
      event.stopPropagation()
      setPenDown(true)
    }

    function onTouchEnd(event: TouchEvent) {
      const menu = penMenu()
      if (menu?.isMenuOpen()) {
        const ended = event.changedTouches[0]
        if (ended) menu.releasePointer(ended.clientX, ended.clientY)
        return
      }
      // Pointer stroke still live — wait for pointerup; iPad can reorder touch vs pointer end.
      if (pointerPenActive || isSpaceDrawHeld()) return
      if (menu?.isPending()) {
        const ended = event.changedTouches[0]
        if (ended) menu.releasePointer(ended.clientX, ended.clientY)
      }
      const ended = event.changedTouches[0]
      if (ended && isStylusTouch(ended)) {
        setPenDown(false)
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!isCanvasEventTarget(event.target)) return
      if (isHandleTarget(event.target)) return
      if (isLassoSelectionChromeTarget(event.target)) return
      if (penMenu()?.isMenuOpen()) return
      penMenu()?.onPointerDown(event)
      if (isUiDrawCanvasTarget(event.target)) return
      if (!canStartDrawingPointer(event)) return

      const mode = useToolStore.getState().mode
      // Direct tap on a canvas item → standard item select, not a lasso gesture.
      if (
        mode === 'lasso' &&
        isPointerOnCanvasItem(event.target) &&
        !isHandleTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      pointerPenActive = true
      activePointerId = event.pointerId
      setPenDown(true)
      capturePointer(event)

      if (mode === 'lasso') {
        if (
          keepActiveLassoSelectionForPointer(
            event.clientX,
            event.clientY,
            event.target,
            canvasEl,
          )
        ) {
          return
        }
        useLassoStore.getState().clearSelection()
        useLassoStore.getState().startLasso(event.clientX, event.clientY)
        return
      }

      const coords = toCanvasCoords(event.clientX, event.clientY)
      if (!coords) return

      startDrawAt(coords, readPressure(event.pressure))
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse') {
        lastPointerPos = { clientX: event.clientX, clientY: event.clientY }
      }

      if (isSpaceDrawHeld() && event.pointerType === 'mouse') {
        penMenu()?.moveSpaceHold(event.clientX, event.clientY)
        if (!penMenu()?.isMenuOpen()) {
          const spaceMode = useToolStore.getState().mode
          if (spaceMode === 'lasso' && useLassoStore.getState().isDrawing) {
            useLassoStore.getState().addPoint(event.clientX, event.clientY)
          } else {
            const coords = toCanvasCoords(event.clientX, event.clientY)
            if (coords) continueDrawAt(coords, readPressure(event.pressure))
          }
        }
      }

      if (
        pointerPenActive &&
        event.pointerId === activePointerId &&
        isPhoneFingerDrawMode()
      ) {
        penMenu()?.cancelPendingHold()
      }

      const menu = penMenu()
      if (
        menu &&
        menu.isPending() &&
        pointerPenActive &&
        event.pointerId === activePointerId
      ) {
        menu.trackPointer(event.clientX, event.clientY, event.pointerId)
      }

      if (menu?.onPointerMove(event)) return
      if (!pointerPenActive || event.pointerId !== activePointerId) return

      const mode = useToolStore.getState().mode

      if (mode === 'lasso' && useLassoStore.getState().isDrawing) {
        event.preventDefault()
        useLassoStore.getState().addPoint(event.clientX, event.clientY)
        return
      }

      if (mode === 'erase' && eraseActive) {
        event.preventDefault()
        const coords = toCanvasCoords(event.clientX, event.clientY)
        if (coords) eraseAt(coords)
        return
      }

      event.preventDefault()
      // iOS finger touch reports 0 pressure — only gate pen hover moves.
      if (event.pointerType === 'pen' && event.pressure < 0.05) return

      const coords = toCanvasCoords(event.clientX, event.clientY)
      if (!coords) return

      continueDrawAt(coords, readPressure(event.pressure))
    }

    function releasePen(event: PointerEvent) {
      const penMenuHandled = penMenu()?.onPointerUp(event) ?? false

      if (penMenuHandled) {
        if (pointerPenActive && event.pointerId === activePointerId) {
          pointerPenActive = false
          activePointerId = null
          if (!isSpaceDrawHeld()) setPenDown(false)
          releasePointer(event)
        }
        eraseActive = false
        activeStickyId = null
        useCanvasItemsStore.getState().cancelActiveStickyStroke()
        return
      }

      if (!pointerPenActive || event.pointerId !== activePointerId) return

      event.preventDefault()

      pointerPenActive = false
      activePointerId = null
      if (!isSpaceDrawHeld()) {
        setPenDown(false)
      }
      releasePointer(event)

      const modeAtRelease = useToolStore.getState().mode
      if (modeAtRelease === 'lasso') {
        useLassoStore.getState().commitLasso(canvasEl)
        return
      }

      if (!isSpaceDrawHeld()) {
        endDrawSession()
      }
    }

    function onTouchMove(event: TouchEvent) {
      const menu = penMenu()
      if (menu?.isActive()) {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i]
          menu.trackPointer(touch.clientX, touch.clientY)
        }
      }
      if (!pointerPenActive) return
      if (event.cancelable) event.preventDefault()
    }

    document.addEventListener('touchstart', onTouchStart, capturePassiveOpts)
    document.addEventListener('touchmove', onTouchMove, capturePassiveOpts)

    canvasEl.addEventListener('touchend', onTouchEnd, captureOpts)
    canvasEl.addEventListener('touchcancel', onTouchEnd, captureOpts)

    document.addEventListener('pointerdown', onPointerDown, captureOpts)
    document.addEventListener('pointermove', onPointerMove, captureOpts)
    canvasEl.addEventListener('pointerup', releasePen, captureOpts)
    canvasEl.addEventListener('pointercancel', releasePen, captureOpts)

    function onWindowPointerEnd(event: PointerEvent) {
      if (penMenu()?.isActive()) {
        releasePen(event)
        return
      }
      if (pointerPenActive && event.pointerId === activePointerId) {
        releasePen(event)
        return
      }
      if (!pointerPenActive && !isSpaceDrawHeld()) setPenDown(false)
    }

    function onWindowBlur() {
      if (isSpaceDrawHeld()) {
        penMenu()?.cancelSpaceHold()
        setSpaceDrawHeld(false)
        document.documentElement.removeAttribute('data-space-draw')
        if (!pointerPenActive) {
          const lasso = useLassoStore.getState()
          if (lasso.isDrawing) {
            lasso.cancelLasso()
          } else {
            endDrawSession()
          }
          setPenDown(false)
        }
      }
    }

    window.addEventListener('pointerup', onWindowPointerEnd)
    window.addEventListener('pointercancel', onWindowPointerEnd)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('pointerup', onWindowPointerEnd)
      window.removeEventListener('pointercancel', onWindowPointerEnd)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('touchstart', onTouchStart, capturePassiveOpts)
      document.removeEventListener('touchmove', onTouchMove, capturePassiveOpts)
      canvasEl.removeEventListener('touchend', onTouchEnd, captureOpts)
      canvasEl.removeEventListener('touchcancel', onTouchEnd, captureOpts)
      document.removeEventListener('pointerdown', onPointerDown, captureOpts)
      document.removeEventListener('pointermove', onPointerMove, captureOpts)
      canvasEl.removeEventListener('pointerup', releasePen, captureOpts)
      canvasEl.removeEventListener('pointercancel', releasePen, captureOpts)
      setSpaceDrawHeld(false)
      document.documentElement.removeAttribute('data-space-draw')
      penMenu()?.cancelSpaceHold()
      setPenDown(false)
      activeStickyId = null
      activePointerId = null
    }
  }, [canvasMount, canvasRef, transformRef, onPenStateChange, penMenuBridgeRef])
}
