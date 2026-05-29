import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampProfileMediaFrame,
  framedImageStyle,
  zoomProfileMediaFrameAtPoint,
  type ProfileMediaFrame,
} from '../profile/profileMediaFrame'

/** WebKit pinch on Safari / macOS trackpad. */
type GestureLikeEvent = Event & { scale: number; preventDefault: () => void }

export const PROFILE_MEDIA_FRAME_EDITOR_CLASS = 'profile-media-frame-editor'

type ProfileMediaFrameEditorProps = {
  src: string
  frame: ProfileMediaFrame
  shape?: 'rect' | 'circle'
  onChange: (frame: ProfileMediaFrame) => void
  /** Short tap with no pan/pinch — e.g. open file picker. */
  onTap?: () => void
}

const PAN_GAIN = 1.4
/** Trackpad wheel deltas use opposite sign vs pointer drag for natural scroll feel. */
const WHEEL_PAN_GAIN = 1.4
const TAP_THRESHOLD_PX = 10

const PINCH_WHEEL_SENSITIVITY = 0.0045
const WHEEL_GESTURE_END_MS = 160

function wheelPixels(delta: number, event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * (event.view?.innerHeight ?? 0)
  }
  return delta
}

function wheelPanDelta(event: WheelEvent): { x: number; y: number } {
  return {
    x: wheelPixels(event.deltaX, event),
    y: wheelPixels(event.deltaY, event),
  }
}

function isTrackpadPanWheel(event: WheelEvent): boolean {
  if (event.ctrlKey || event.metaKey) return false
  return event.deltaX !== 0 || event.deltaY !== 0
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function touchSpan(event: TouchEvent): number | null {
  if (event.touches.length < 2) return null
  const a = event.touches[0]
  const b = event.touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function touchMidpointNorm(event: TouchEvent, rect: DOMRect): { x: number; y: number } {
  const a = event.touches[0]
  const b = event.touches[1]
  return {
    x: ((a.clientX + b.clientX) / 2 - rect.left) / rect.width,
    y: ((a.clientY + b.clientY) / 2 - rect.top) / rect.height,
  }
}

function clientNorm(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  }
}

function isTrackpadPinchWheel(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}

function applyImageStyles(img: HTMLImageElement, frame: ProfileMediaFrame) {
  const style = framedImageStyle(frame)
  for (const [key, value] of Object.entries(style)) {
    if (value != null) {
      ;(img.style as unknown as Record<string, string>)[key] = String(value)
    }
  }
}

export default function ProfileMediaFrameEditor({
  src,
  frame,
  shape = 'rect',
  onChange,
  onTap,
}: ProfileMediaFrameEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const frameRef = useRef(frame)
  const liveFrameRef = useRef(clampProfileMediaFrame(frame))
  const interactingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const commitRef = useRef<(frame: ProfileMediaFrame) => void>(() => {})

  const [isDragging, setIsDragging] = useState(false)
  const [isPinching, setIsPinching] = useState(false)

  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    gestured: boolean
  } | null>(null)

  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{
    distance: number
    frame: ProfileMediaFrame
    anchorX: number
    anchorY: number
  } | null>(null)
  const gestureRef = useRef<{
    frame: ProfileMediaFrame
    anchorX: number
    anchorY: number
  } | null>(null)
  const touchPinchRef = useRef<{
    distance: number
    frame: ProfileMediaFrame
    anchorX: number
    anchorY: number
  } | null>(null)
  const wheelPinchEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheelPinchRef = useRef<{
    frame: ProfileMediaFrame
    anchorX: number
    anchorY: number
    factor: number
  } | null>(null)
  const wheelPanRef = useRef<{
    frame: ProfileMediaFrame
    sumX: number
    sumY: number
  } | null>(null)

  const onTapRef = useRef(onTap)
  onTapRef.current = onTap

  const commitFrame = useCallback(
    (next: ProfileMediaFrame) => {
      const clamped = clampProfileMediaFrame(next)
      frameRef.current = clamped
      liveFrameRef.current = clamped
      onChange(clamped)
    },
    [onChange],
  )

  commitRef.current = commitFrame

  const schedulePaint = useCallback((next: ProfileMediaFrame) => {
    liveFrameRef.current = clampProfileMediaFrame(next)
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const clamped = liveFrameRef.current
      frameRef.current = clamped
      if (imgRef.current) applyImageStyles(imgRef.current, clamped)
      commitRef.current(clamped)
    })
  }, [])

  const paintImmediate = useCallback((next: ProfileMediaFrame) => {
    const clamped = clampProfileMediaFrame(next)
    liveFrameRef.current = clamped
    frameRef.current = clamped
    if (imgRef.current) applyImageStyles(imgRef.current, clamped)
    commitRef.current(clamped)
  }, [])

  const beginInteraction = useCallback(() => {
    interactingRef.current = true
  }, [])

  const endInteraction = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      const clamped = clampProfileMediaFrame(liveFrameRef.current)
      frameRef.current = clamped
      if (imgRef.current) applyImageStyles(imgRef.current, clamped)
      commitRef.current(clamped)
    }
    interactingRef.current = false
    setIsDragging(false)
    setIsPinching(false)
  }, [])

  useLayoutEffect(() => {
    if (imgRef.current) {
      applyImageStyles(imgRef.current, clampProfileMediaFrame(frame))
    }
  }, [])

  useEffect(() => {
    frameRef.current = frame
    if (!interactingRef.current && imgRef.current) {
      liveFrameRef.current = clampProfileMediaFrame(frame)
      applyImageStyles(imgRef.current, liveFrameRef.current)
    }
  }, [frame])

  const applyPanDelta = useCallback(
    (dx: number, dy: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const current = liveFrameRef.current
      schedulePaint({
        ...current,
        x: current.x - (dx / rect.width) * PAN_GAIN,
        y: current.y - (dy / rect.height) * PAN_GAIN,
      })
    },
    [schedulePaint],
  )

  const finishDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== pointerId) return

      if (!drag.gestured && pointersRef.current.size === 0) {
        onTapRef.current?.()
      }

      dragRef.current = null
      endInteraction()
    },
    [endInteraction],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function containerRect(): DOMRect | null {
      const rect = container!.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      return rect
    }

    function isInsideEditor(target: EventTarget | null): boolean {
      return target instanceof Node && container!.contains(target)
    }

    function applyPinchScale(
      base: ProfileMediaFrame,
      nextScale: number,
      anchorX: number,
      anchorY: number,
    ) {
      schedulePaint(zoomProfileMediaFrameAtPoint(base, nextScale, anchorX, anchorY))
    }

    function applyWheelPan(deltaX: number, deltaY: number) {
      const rect = containerRect()
      if (!rect) return

      if (!wheelPanRef.current) {
        wheelPanRef.current = {
          frame: clampProfileMediaFrame(liveFrameRef.current),
          sumX: 0,
          sumY: 0,
        }
      }

      const session = wheelPanRef.current
      session.sumX += deltaX
      session.sumY += deltaY

      paintImmediate({
        ...session.frame,
        x: session.frame.x + (session.sumX / rect.width) * WHEEL_PAN_GAIN,
        y: session.frame.y + (session.sumY / rect.height) * WHEEL_PAN_GAIN,
      })
    }

    function scheduleWheelGestureEnd() {
      if (wheelPinchEndTimerRef.current) clearTimeout(wheelPinchEndTimerRef.current)
      wheelPinchEndTimerRef.current = setTimeout(() => {
        wheelPinchEndTimerRef.current = null
        wheelPinchRef.current = null
        wheelPanRef.current = null
        gestureRef.current = null
        endInteraction()
      }, WHEEL_GESTURE_END_MS)
    }

    function onWheel(event: WheelEvent) {
      if (!isInsideEditor(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (isTrackpadPinchWheel(event)) {
        wheelPanRef.current = null
        beginInteraction()
        setIsDragging(false)
        setIsPinching(true)

        const rect = containerRect()
        if (!rect) return

        const anchor = clientNorm(event.clientX, event.clientY, rect)
        const stepFactor = Math.exp(-event.deltaY * PINCH_WHEEL_SENSITIVITY)

        if (!wheelPinchRef.current) {
          wheelPinchRef.current = {
            frame: clampProfileMediaFrame(liveFrameRef.current),
            anchorX: anchor.x,
            anchorY: anchor.y,
            factor: stepFactor,
          }
        } else {
          wheelPinchRef.current.factor *= stepFactor
        }

        const session = wheelPinchRef.current
        paintImmediate(
          zoomProfileMediaFrameAtPoint(
            session.frame,
            session.frame.scale * session.factor,
            session.anchorX,
            session.anchorY,
          ),
        )

        scheduleWheelGestureEnd()
        return
      }

      if (!isTrackpadPanWheel(event)) return

      const { x: deltaX, y: deltaY } = wheelPanDelta(event)
      if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return

      wheelPinchRef.current = null
      gestureRef.current = null
      beginInteraction()
      setIsPinching(false)
      setIsDragging(true)
      applyWheelPan(deltaX, deltaY)
      scheduleWheelGestureEnd()
    }

    function onGestureStart(event: Event) {
      if (!isInsideEditor(event.target)) return
      const gesture = event as GestureLikeEvent
      gesture.preventDefault()

      beginInteraction()
      setIsPinching(true)
      dragRef.current = null
      touchPinchRef.current = null
      pinchRef.current = null

      gestureRef.current = {
        frame: clampProfileMediaFrame(liveFrameRef.current),
        anchorX: 0.5,
        anchorY: 0.5,
      }
    }

    function onGestureChange(event: Event) {
      if (!isInsideEditor(event.target)) return
      const gesture = event as GestureLikeEvent
      gesture.preventDefault()

      const session = gestureRef.current
      if (!session) return

      applyPinchScale(
        session.frame,
        session.frame.scale * gesture.scale,
        session.anchorX,
        session.anchorY,
      )
    }

    function onGestureEnd(event: Event) {
      if (!isInsideEditor(event.target)) return
      const gesture = event as GestureLikeEvent
      gesture.preventDefault()
      gestureRef.current = null
      endInteraction()
    }

    function onTouchStart(event: TouchEvent) {
      if (!isInsideEditor(event.target)) return
      if (event.touches.length < 2) return

      event.stopPropagation()

      const rect = containerRect()
      const distance = touchSpan(event)
      if (!distance || !rect) return

      beginInteraction()
      setIsPinching(true)
      dragRef.current = null
      pinchRef.current = null

      const anchor = touchMidpointNorm(event, rect)
      touchPinchRef.current = {
        distance,
        frame: clampProfileMediaFrame(liveFrameRef.current),
        anchorX: anchor.x,
        anchorY: anchor.y,
      }
    }

    function onTouchMove(event: TouchEvent) {
      const pinch = touchPinchRef.current
      if (!pinch || event.touches.length < 2) return
      if (!isInsideEditor(event.target)) return

      event.preventDefault()
      event.stopPropagation()

      const distance = touchSpan(event)
      if (!distance) return

      applyPinchScale(
        pinch.frame,
        pinch.frame.scale * (distance / pinch.distance),
        pinch.anchorX,
        pinch.anchorY,
      )
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length >= 2) return
      if (!touchPinchRef.current) return
      touchPinchRef.current = null
      endInteraction()
    }

    function onWindowPointerMove(event: PointerEvent) {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

      if (pointersRef.current.size >= 2) {
        syncPointerPinchRef.current()
        return
      }

      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      const dx = event.clientX - drag.lastX
      const dy = event.clientY - drag.lastY
      const totalDx = event.clientX - drag.startX
      const totalDy = event.clientY - drag.startY

      if (!drag.gestured) {
        if (Math.hypot(totalDx, totalDy) < TAP_THRESHOLD_PX) return
        drag.gestured = true
        beginInteraction()
        setIsDragging(true)
      }

      if (dx !== 0 || dy !== 0) {
        applyPanDelta(dx, dy)
        drag.lastX = event.clientX
        drag.lastY = event.clientY
      }
    }

    function onWindowPointerUp(event: PointerEvent) {
      pointersRef.current.delete(event.pointerId)

      if (pointersRef.current.size < 2) {
        if (pinchRef.current) {
          pinchRef.current = null
          endInteraction()
        }
      } else {
        syncPointerPinchRef.current()
      }

      finishDrag(event.pointerId)

      const captureTarget = container
      if (captureTarget?.hasPointerCapture(event.pointerId)) {
        try {
          captureTarget.releasePointerCapture(event.pointerId)
        } catch {
          /* already released */
        }
      }
    }

    const captureOpts = { passive: false, capture: true } as const

    window.addEventListener('wheel', onWheel, captureOpts)
    window.addEventListener('gesturestart', onGestureStart, captureOpts)
    window.addEventListener('gesturechange', onGestureChange, captureOpts)
    window.addEventListener('gestureend', onGestureEnd, captureOpts)
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    container.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('gesturestart', onGestureStart, true)
      window.removeEventListener('gesturechange', onGestureChange, true)
      window.removeEventListener('gestureend', onGestureEnd, true)
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
      if (wheelPinchEndTimerRef.current) clearTimeout(wheelPinchEndTimerRef.current)
      wheelPinchRef.current = null
      wheelPanRef.current = null
    }
  }, [applyPanDelta, beginInteraction, endInteraction, finishDrag, paintImmediate, schedulePaint])

  const syncPointerPinch = useCallback(() => {
    const container = containerRef.current
    const pointers = [...pointersRef.current.values()]
    if (pointers.length < 2 || !container) {
      pinchRef.current = null
      return
    }

    const rect = container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const distance = pointerDistance(pointers[0], pointers[1])
    if (distance <= 0) return

    const anchor = {
      x: ((pointers[0].x + pointers[1].x) / 2 - rect.left) / rect.width,
      y: ((pointers[0].y + pointers[1].y) / 2 - rect.top) / rect.height,
    }

    const pinch = pinchRef.current
    if (!pinch) {
      beginInteraction()
      setIsPinching(true)
      pinchRef.current = {
        distance,
        frame: clampProfileMediaFrame(liveFrameRef.current),
        anchorX: anchor.x,
        anchorY: anchor.y,
      }
      dragRef.current = null
      return
    }

    schedulePaint(
      zoomProfileMediaFrameAtPoint(
        pinch.frame,
        pinch.frame.scale * (distance / pinch.distance),
        pinch.anchorX,
        pinch.anchorY,
      ),
    )
  }, [beginInteraction, schedulePaint])

  const syncPointerPinchRef = useRef(syncPointerPinch)
  syncPointerPinchRef.current = syncPointerPinch

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size >= 2) {
        dragRef.current = null
        pinchRef.current = null
        touchPinchRef.current = null
        syncPointerPinch()
        return
      }

      if (e.button !== 0) return

      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        gestured: false,
      }
    },
    [syncPointerPinch],
  )

  const isGrabbing = isDragging || isPinching

  return (
    <div
      ref={containerRef}
      className={PROFILE_MEDIA_FRAME_EDITOR_CLASS}
      onPointerDown={handlePointerDown}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: shape === 'circle' ? '50%' : undefined,
        touchAction: 'none',
        cursor: isGrabbing ? 'grabbing' : 'grab',
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          userSelect: 'none',
          pointerEvents: 'none',
          ...({ WebkitUserDrag: 'none' } as CSSProperties),
          willChange: isGrabbing ? 'transform, object-position' : undefined,
        }}
      />
    </div>
  )
}
