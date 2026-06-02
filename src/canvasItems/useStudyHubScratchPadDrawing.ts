import { useEffect, useRef, useState, type RefObject } from 'react'
import { resolveStrokeFill } from '../drawing/colorUtils'
import { generateStrokeId } from '../drawing/strokeId'
import {
  isDesktopPenDrawMode,
  isPenDrawMode,
  isPenInput,
  isPhoneFingerDrawMode,
  isSpaceDrawHeld,
  noteStylusInput,
  setSpaceDrawHeld,
} from '../drawing/penInput'
import {
  penToolMenuBridgeRef,
  registerPenMenuCancelDraw,
} from '../drawing/usePenToolMenu'
import {
  decimateStrokePoints,
  shouldAppendStrokePoint,
} from '../drawing/strokePointDecimation'
import { ensureMinimumStrokePoints, strokeToSvgPath } from '../drawing/strokePath'
import { ERASE_HIT_RADIUS, hitTestStroke } from '../drawing/eraseUtils'
import { strokeIntersectsPolygon, type Pt } from '../drawing/lassoGeometry'
import { useEraserStore } from '../drawing/useEraserStore'
import { isPhoneLayout } from '../platform/layoutProfile'
import { useToolStore } from '../drawing/toolStore'
import type { DrawTool, Stroke, StrokePoint } from '../drawing/types'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { STUDY_HUB_SCRATCH_PAD_TRANSITION_MS } from './studyHubMenuFocusLayout'

type StrokeConfig = {
  color: string
  size: number
  tool: DrawTool
}

const STYLUS_DRAW_CANCEL_PX = 4
const ERASE_THROTTLE_MS = 16
const captureOpts = { capture: true } as const

function readPressure(pressure: number): number {
  return pressure > 0 ? pressure : 0.5
}

function strokeConfig(): StrokeConfig | null {
  const tools = useToolStore.getState()
  if (tools.mode === 'pen') {
    return {
      color: tools.penColor,
      size: tools.penSize,
      tool: 'pen',
    }
  }
  if (tools.mode === 'highlighter') {
    return {
      color: tools.highlighterColor,
      size: tools.highlighterSize,
      tool: 'highlighter',
    }
  }
  return null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function canUseScratchPadTool(event: PointerEvent): boolean {
  const mode = useToolStore.getState().mode
  const drawCapable =
    event.pointerType === 'pen' ||
    isPenInput(event) ||
    (event.pointerType === 'mouse' && isDesktopPenDrawMode()) ||
    (event.pointerType === 'touch' && isPhoneFingerDrawMode())
  if (!drawCapable) return false
  if (mode === 'pen' || mode === 'highlighter') return strokeConfig() != null
  return mode === 'erase' || mode === 'lasso'
}

function isStylusDrawPointer(event: PointerEvent): boolean {
  if (isPhoneFingerDrawMode()) return false
  return event.pointerType === 'pen' || isPenInput(event)
}

function localPointFromClient(
  clientX: number,
  clientY: number,
  pad: HTMLElement,
): StrokePoint | null {
  const rect = pad.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  return { x, y, pressure: 0.5 }
}

function localPoint(
  event: PointerEvent,
  pad: HTMLElement,
): StrokePoint | null {
  const rect = pad.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  return { x, y, pressure: readPressure(event.pressure) }
}

function isPointerOverPad(
  clientX: number,
  clientY: number,
  pad: HTMLElement,
): boolean {
  return localPointFromClient(clientX, clientY, pad) != null
}

function screenPolyToPadLocal(screenPoly: Pt[], pad: HTMLElement): Pt[] {
  const rect = pad.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return []
  return screenPoly.map((p) => ({
    x: p.x - rect.left,
    y: p.y - rect.top,
  }))
}

export function useStudyHubScratchPadDrawing(
  padRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null)
  const [lassoDrawingPoints, setLassoDrawingPoints] = useState<Pt[]>([])
  const activeStrokeRef = useRef<Stroke | null>(null)
  const activePointerId = useRef<number | null>(null)
  const eraseActiveRef = useRef(false)
  const lassoDrawingRef = useRef(false)
  const lassoPointsRef = useRef<Pt[]>([])
  const lastEraseAtRef = useRef(0)
  const lastPointerPos = useRef<{ clientX: number; clientY: number } | null>(null)
  const drawPointerDownX = useRef(0)
  const drawPointerDownY = useRef(0)
  const spaceDrawOwned = useRef(false)
  const scratchMenuGesture = useRef(false)

  useEffect(() => {
    return registerPenMenuCancelDraw(() => {
      activeStrokeRef.current = null
      activePointerId.current = null
      eraseActiveRef.current = false
      lassoDrawingRef.current = false
      lassoPointsRef.current = []
      setLassoDrawingPoints([])
      setActiveStroke(null)
    })
  }, [])

  useEffect(() => {
    if (active) return
    const timer = window.setTimeout(() => {
      setStrokes([])
      setActiveStroke(null)
      activeStrokeRef.current = null
      setLassoDrawingPoints([])
      lassoDrawingRef.current = false
      lassoPointsRef.current = []
      eraseActiveRef.current = false
    }, STUDY_HUB_SCRATCH_PAD_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  useEffect(() => {
    const pad = padRef.current
    if (!pad || !active) return

    function penMenu() {
      return penToolMenuBridgeRef.current
    }

    function cancelActiveStroke() {
      activeStrokeRef.current = null
      activePointerId.current = null
      eraseActiveRef.current = false
      lassoDrawingRef.current = false
      lassoPointsRef.current = []
      setLassoDrawingPoints([])
      setActiveStroke(null)
    }

    function finishStroke() {
      const current = activeStrokeRef.current
      activeStrokeRef.current = null
      setActiveStroke(null)
      if (!current) return

      let points = [...current.points]
      if (points.length > 2 && points[points.length - 1].pressure < 0.05) {
        points.pop()
      }
      if (points.length === 0) return

      points = decimateStrokePoints(points)
      points = ensureMinimumStrokePoints(points, 3)
      const trimmed = { ...current, points }
      const path = strokeToSvgPath(trimmed, true)
      setStrokes((prev) => [...prev, { ...trimmed, path }])
    }

    function eraseAtPadPoint(x: number, y: number) {
      const { targetTypes } = useEraserStore.getState()
      if (!targetTypes.includes('strokes')) return

      const now = performance.now()
      if (now - lastEraseAtRef.current < ERASE_THROTTLE_MS) return
      lastEraseAtRef.current = now

      setStrokes((prev) => {
        const next = prev.filter(
          (stroke) => !hitTestStroke(stroke, x, y, ERASE_HIT_RADIUS),
        )
        return next.length === prev.length ? prev : next
      })
    }

    function startScratchLasso(clientX: number, clientY: number) {
      const next = [{ x: clientX, y: clientY }]
      lassoDrawingRef.current = true
      lassoPointsRef.current = next
      setLassoDrawingPoints(next)
    }

    function addScratchLassoPoint(clientX: number, clientY: number) {
      const next = [...lassoPointsRef.current, { x: clientX, y: clientY }]
      lassoPointsRef.current = next
      setLassoDrawingPoints(next)
    }

    function cancelScratchLasso() {
      lassoDrawingRef.current = false
      lassoPointsRef.current = []
      setLassoDrawingPoints([])
    }

    function commitScratchLasso() {
      const points = lassoPointsRef.current
      lassoDrawingRef.current = false
      lassoPointsRef.current = []
      setLassoDrawingPoints([])

      if (points.length < 3) return

      const poly = screenPolyToPadLocal(points, pad)
      if (poly.length < 3) return

      setStrokes((prev) =>
        prev.filter((stroke) => !strokeIntersectsPolygon(stroke, poly)),
      )
    }

    function endPointerSession() {
      if (lassoDrawingRef.current) {
        commitScratchLasso()
        return
      }
      if (eraseActiveRef.current) {
        eraseActiveRef.current = false
        return
      }
      finishStroke()
    }

    function beginPadToolAt(
      mode: ReturnType<typeof useToolStore.getState>['mode'],
      clientX: number,
      clientY: number,
    ) {
      if (mode === 'lasso') {
        startScratchLasso(clientX, clientY)
        return
      }
      if (mode === 'erase') {
        eraseActiveRef.current = true
        lastEraseAtRef.current = 0
        const point = localPointFromClient(clientX, clientY, pad)
        if (point) eraseAtPadPoint(point.x, point.y)
        return
      }
      const config = strokeConfig()
      const point = localPointFromClient(clientX, clientY, pad)
      if (config && point) beginStrokeAt(point, config)
    }

    function continuePadToolAt(
      mode: ReturnType<typeof useToolStore.getState>['mode'],
      clientX: number,
      clientY: number,
    ) {
      if (mode === 'lasso' && lassoDrawingRef.current) {
        addScratchLassoPoint(clientX, clientY)
        return
      }
      if (mode === 'erase' && eraseActiveRef.current) {
        const point = localPointFromClient(clientX, clientY, pad)
        if (point) eraseAtPadPoint(point.x, point.y)
        return
      }
      const point = localPointFromClient(clientX, clientY, pad)
      if (point) continueStrokeAt(point)
    }

    function beginStrokeAt(point: StrokePoint, config: StrokeConfig) {
      const next: Stroke = {
        id: generateStrokeId(),
        points: [point],
        color: config.color,
        size: config.size,
        tool: config.tool,
      }
      activeStrokeRef.current = next
      setActiveStroke(next)
    }

    function continueStrokeAt(point: StrokePoint) {
      const current = activeStrokeRef.current
      if (!current) return
      const last = current.points[current.points.length - 1]
      if (!shouldAppendStrokePoint(last, point)) return
      const next = {
        ...current,
        points: [...current.points, point],
      }
      activeStrokeRef.current = next
      setActiveStroke(next)
    }

    function maybeCancelMenuForStylusDraw(clientX: number, clientY: number) {
      const menu = penMenu()
      if (!menu?.isPending()) return
      if (
        Math.hypot(clientX - drawPointerDownX.current, clientY - drawPointerDownY.current) >=
        STYLUS_DRAW_CANCEL_PX
      ) {
        menu.cancelPendingHold()
      }
    }

    function notePointerPos(clientX: number, clientY: number) {
      lastPointerPos.current = { clientX, clientY }
    }

    function onSpaceDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return
      if (isEditableTarget(event.target)) return
      if (isPhoneLayout()) return
      if (!isPenDrawMode() || penMenu()?.isActive()) return
      if (!lastPointerPos.current) return
      if (
        !isPointerOverPad(
          lastPointerPos.current.clientX,
          lastPointerPos.current.clientY,
          pad,
        )
      ) {
        return
      }

      event.preventDefault()
      setSpaceDrawHeld(true)
      spaceDrawOwned.current = true
      document.documentElement.setAttribute('data-space-draw', '')

      const { clientX, clientY } = lastPointerPos.current
      penMenu()?.beginSpaceHold(clientX, clientY)
      scratchMenuGesture.current = true

      if (!penMenu()?.isMenuOpen()) {
        beginPadToolAt(useToolStore.getState().mode, clientX, clientY)
      }
    }

    function onSpaceUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return
      if (!spaceDrawOwned.current || !isSpaceDrawHeld()) return

      event.preventDefault()
      setSpaceDrawHeld(false)
      spaceDrawOwned.current = false
      document.documentElement.removeAttribute('data-space-draw')

      const pos = lastPointerPos.current
      penMenu()?.endSpaceHold(pos?.clientX ?? 0, pos?.clientY ?? 0)
      scratchMenuGesture.current = false
      endPointerSession()
    }

    function onWindowBlur() {
      if (!spaceDrawOwned.current || !isSpaceDrawHeld()) return
      penMenu()?.cancelSpaceHold()
      setSpaceDrawHeld(false)
      spaceDrawOwned.current = false
      scratchMenuGesture.current = false
      document.documentElement.removeAttribute('data-space-draw')
      endPointerSession()
    }

    function shouldArmScratchPadMenuHold(event: PointerEvent): boolean {
      if (event.pointerType === 'pen' || isPenInput(event)) return true
      if (event.pointerType === 'touch' && isPhoneFingerDrawMode()) return true
      return false
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse') {
        notePointerPos(event.clientX, event.clientY)
      }

      const menuOnDown = penMenu()
      if (menuOnDown?.isMenuOpen()) {
        menuOnDown.onPointerDown(event)
        return
      }
      if (shouldArmScratchPadMenuHold(event)) {
        menuOnDown?.onPointerDown(event)
        if (menuOnDown?.isActive()) scratchMenuGesture.current = true
        if (menuOnDown?.isMenuOpen()) return
      }

      if (!canUseScratchPadTool(event)) return
      if (activePointerId.current != null) return
      if (event.pointerType === 'pen' || isPenInput(event)) noteStylusInput()

      const mode = useToolStore.getState().mode

      event.preventDefault()
      event.stopPropagation()
      pad.setPointerCapture(event.pointerId)

      drawPointerDownX.current = event.clientX
      drawPointerDownY.current = event.clientY
      activePointerId.current = event.pointerId

      if (mode === 'lasso') {
        startScratchLasso(event.clientX, event.clientY)
        return
      }

      const point = localPoint(event, pad)
      if (mode === 'erase') {
        eraseActiveRef.current = true
        lastEraseAtRef.current = 0
        if (point) eraseAtPadPoint(point.x, point.y)
        return
      }

      const config = strokeConfig()
      if (!config || !point) return
      beginStrokeAt(point, config)
    }

    function onDocumentPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse') {
        notePointerPos(event.clientX, event.clientY)
      }

      const menu = penMenu()
      const mode = useToolStore.getState().mode

      if (
        spaceDrawOwned.current &&
        isSpaceDrawHeld() &&
        event.pointerType === 'mouse'
      ) {
        menu?.moveSpaceHold(event.clientX, event.clientY)
        if (!menu?.isMenuOpen()) {
          if (mode === 'lasso' && lassoDrawingRef.current) {
            addScratchLassoPoint(event.clientX, event.clientY)
          } else if (
            isPointerOverPad(event.clientX, event.clientY, pad) ||
            (mode === 'lasso' && lassoDrawingRef.current)
          ) {
            continuePadToolAt(mode, event.clientX, event.clientY)
          }
        }
        return
      }

      const menuSessionActive =
        scratchMenuGesture.current &&
        menu?.isActive() &&
        (menu.isMenuOpen() ||
          menu.isPending() ||
          activePointerId.current === event.pointerId)

      if (menuSessionActive) {
        if (menu.isPending() && activePointerId.current === event.pointerId) {
          menu.trackPointer(event.clientX, event.clientY, event.pointerId)
        }
        if (menu.onPointerMove(event)) return
      }

      if (activePointerId.current !== event.pointerId) return

      if (isStylusDrawPointer(event)) {
        maybeCancelMenuForStylusDraw(event.clientX, event.clientY)
      }

      if (mode === 'lasso' && lassoDrawingRef.current) {
        event.preventDefault()
        event.stopPropagation()
        addScratchLassoPoint(event.clientX, event.clientY)
        return
      }

      if (mode === 'erase' && eraseActiveRef.current) {
        event.preventDefault()
        event.stopPropagation()
        const point = localPoint(event, pad)
        if (point) eraseAtPadPoint(point.x, point.y)
        return
      }

      if (!isPointerOverPad(event.clientX, event.clientY, pad)) return

      const current = activeStrokeRef.current
      const point = localPoint(event, pad)
      if (!current || !point) return

      event.preventDefault()
      event.stopPropagation()
      continueStrokeAt(point)
    }

    function onDocumentPointerUp(event: PointerEvent) {
      const menu = penMenu()
      let menuHandled = false

      if (scratchMenuGesture.current) {
        scratchMenuGesture.current = false
        menuHandled = menu?.onPointerUp(event) ?? false
      }

      if (activePointerId.current !== event.pointerId) return

      event.preventDefault()
      event.stopPropagation()
      if (pad.hasPointerCapture(event.pointerId)) {
        pad.releasePointerCapture(event.pointerId)
      }
      activePointerId.current = null

      if (menuHandled) {
        cancelActiveStroke()
        return
      }

      endPointerSession()
    }

    function onPadPointerEnter(event: PointerEvent) {
      if (event.pointerType === 'mouse') {
        notePointerPos(event.clientX, event.clientY)
      }
    }

    pad.addEventListener('pointerdown', onPointerDown, { capture: true })
    pad.addEventListener('pointerenter', onPadPointerEnter)
    document.addEventListener('pointermove', onDocumentPointerMove, captureOpts)
    window.addEventListener('pointerup', onDocumentPointerUp, captureOpts)
    window.addEventListener('pointercancel', onDocumentPointerUp, captureOpts)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      pad.removeEventListener('pointerdown', onPointerDown, { capture: true })
      pad.removeEventListener('pointerenter', onPadPointerEnter)
      document.removeEventListener('pointermove', onDocumentPointerMove, captureOpts)
      window.removeEventListener('pointerup', onDocumentPointerUp, captureOpts)
      window.removeEventListener('pointercancel', onDocumentPointerUp, captureOpts)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
      window.removeEventListener('blur', onWindowBlur)
      if (spaceDrawOwned.current) {
        setSpaceDrawHeld(false)
        spaceDrawOwned.current = false
        scratchMenuGesture.current = false
        document.documentElement.removeAttribute('data-space-draw')
        penMenu()?.cancelSpaceHold()
      }
    }
  }, [active, padRef])

  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const isDark = effectiveMode === 'dark'

  return { strokes, activeStroke, isDark, lassoDrawingPoints }
}

export function scratchPadStrokeFill(
  stroke: Stroke,
  isDark: boolean,
): string {
  return resolveStrokeFill(stroke.color, stroke.tool, isDark ? 'dark' : 'light')
}
