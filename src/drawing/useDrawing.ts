import { useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canStartDrawingPointer,
  isPenDrawMode,
  isSpaceDrawHeld,
  isSpaceDrawPointer,
  isStylusTouch,
  noteStylusInput,
  setSpaceDrawHeld,
} from './penInput'
import type { PenToolMenuBridge } from './usePenToolMenu'
import { hitTestStickyAtCanvasPoint } from '../canvasItems/stickyHitTest'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from './strokesStore'
import { useToolStore } from './toolStore'
import type { StrokePoint } from './types'
import { clientToCanvasFromElement } from './canvasCoords'

const captureOpts = { capture: true } as const
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
    let lastSpacePointer: PointerEvent | null = null

    function setPenDown(down: boolean) {
      onPenStateChange?.(down)
    }

    function penMenu(): PenToolMenuBridge | null {
      return penMenuBridgeRef?.current ?? null
    }

    function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } | null {
      return clientToCanvasFromElement(clientX, clientY, canvasEl)
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
        applyDragErase(coords)
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

    function hasActiveDrawSession(): boolean {
      if (eraseActive) return true
      if (activeStickyId) return true
      return useStrokesStore.getState().activeStroke !== null
    }

    function spaceMenuAnchor(): { x: number; y: number } {
      if (lastSpacePointer) {
        return {
          x: lastSpacePointer.clientX,
          y: lastSpacePointer.clientY,
        }
      }
      const rect = canvasEl.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    }

    function applySpaceDrawAt(event: PointerEvent) {
      if (!isSpaceDrawHeld() || penMenu()?.isActive()) return
      if (penMenu()?.isMenuOpen()) return
      if (!isSpaceDrawPointer(event)) return

      const coords = toCanvasCoords(event.clientX, event.clientY)
      if (!coords) return

      const pressure = readPressure(event.pressure)
      if (!hasActiveDrawSession()) {
        startDrawAt(coords, pressure)
      } else {
        continueDrawAt(coords, pressure)
      }
    }

    function onSpaceDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      if (isEditableTarget(e.target)) return
      if (!isPenDrawMode() || penMenu()?.isActive()) return

      e.preventDefault()
      setSpaceDrawHeld(true)
      document.documentElement.setAttribute('data-space-draw', '')
      setPenDown(true)
      const anchor = spaceMenuAnchor()
      penMenu()?.beginSpaceHold(anchor.x, anchor.y)
    }

    function onSpaceUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      if (!isSpaceDrawHeld()) return

      e.preventDefault()
      setSpaceDrawHeld(false)
      document.documentElement.removeAttribute('data-space-draw')

      const anchor = spaceMenuAnchor()
      penMenu()?.endSpaceHold(anchor.x, anchor.y)

      if (!pointerPenActive) {
        endDrawSession()
        setPenDown(false)
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (penMenu()?.isActive()) return
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!isStylusTouch(touch)) return
      noteStylusInput()
      event.stopPropagation()
      setPenDown(true)
    }

    function onTouchEnd(event: TouchEvent) {
      if (penMenu()?.isActive()) return
      if (pointerPenActive || isSpaceDrawHeld()) return
      const ended = event.changedTouches[0]
      if (ended && isStylusTouch(ended)) {
        setPenDown(false)
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (penMenu()?.onPointerDown(event)) return
      if (!canStartDrawingPointer(event)) return

      event.preventDefault()
      event.stopPropagation()

      pointerPenActive = true
      activePointerId = event.pointerId
      setPenDown(true)
      capturePointer(event)

      const coords = toCanvasCoords(event.clientX, event.clientY)
      if (!coords) return

      startDrawAt(coords, readPressure(event.pressure))
    }

    function onPointerMove(event: PointerEvent) {
      if (isSpaceDrawPointer(event)) {
        const coords = toCanvasCoords(event.clientX, event.clientY)
        if (coords) lastSpacePointer = event
      }

      if (isSpaceDrawHeld()) {
        penMenu()?.moveSpaceHold(event.clientX, event.clientY)
        applySpaceDrawAt(event)
      }

      if (penMenu()?.onPointerMove(event)) return
      if (!pointerPenActive || event.pointerId !== activePointerId) return

      const mode = useToolStore.getState().mode

      if (mode === 'erase' && eraseActive) {
        event.preventDefault()
        const coords = toCanvasCoords(event.clientX, event.clientY)
        if (coords) eraseAt(coords)
        return
      }

      event.preventDefault()
      if (event.pointerType !== 'mouse' && event.pressure < 0.05) return

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

      if (!isSpaceDrawHeld()) {
        endDrawSession()
      }
    }

    canvasEl.addEventListener('touchstart', onTouchStart, captureOpts)
    canvasEl.addEventListener('touchend', onTouchEnd, captureOpts)
    canvasEl.addEventListener('touchcancel', onTouchEnd, captureOpts)

    canvasEl.addEventListener('pointerdown', onPointerDown, captureOpts)
    canvasEl.addEventListener('pointermove', onPointerMove, captureOpts)
    canvasEl.addEventListener('pointerup', releasePen, captureOpts)
    canvasEl.addEventListener('pointercancel', releasePen, captureOpts)

    function onWindowPointerEnd(event: PointerEvent) {
      if (pointerPenActive && event.pointerId === activePointerId) {
        releasePen(event)
        return
      }
      if (!pointerPenActive && !isSpaceDrawHeld()) setPenDown(false)
    }

    function onSpacePointerMove(event: PointerEvent) {
      if (!isSpaceDrawHeld()) return
      if (isSpaceDrawPointer(event)) {
        lastSpacePointer = event
      }
      penMenu()?.moveSpaceHold(event.clientX, event.clientY)
    }

    function onWindowBlur() {
      if (isSpaceDrawHeld()) {
        penMenu()?.cancelSpaceHold()
        setSpaceDrawHeld(false)
        document.documentElement.removeAttribute('data-space-draw')
        if (!pointerPenActive) {
          endDrawSession()
          setPenDown(false)
        }
      }
    }

    window.addEventListener('pointerup', onWindowPointerEnd)
    window.addEventListener('pointercancel', onWindowPointerEnd)
    window.addEventListener('pointermove', onSpacePointerMove)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('pointerup', onWindowPointerEnd)
      window.removeEventListener('pointercancel', onWindowPointerEnd)
      window.removeEventListener('pointermove', onSpacePointerMove)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
      window.removeEventListener('blur', onWindowBlur)
      canvasEl.removeEventListener('touchstart', onTouchStart, captureOpts)
      canvasEl.removeEventListener('touchend', onTouchEnd, captureOpts)
      canvasEl.removeEventListener('touchcancel', onTouchEnd, captureOpts)
      canvasEl.removeEventListener('pointerdown', onPointerDown, captureOpts)
      canvasEl.removeEventListener('pointermove', onPointerMove, captureOpts)
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
