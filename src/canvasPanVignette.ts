import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

export const MAX_VELOCITY = 14

export type EdgeStrengths = {
  left: number
  right: number
  top: number
  bottom: number
}

export type EdgeKey = keyof EdgeStrengths

export const EMPTY_EDGE_STRENGTHS: EdgeStrengths = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
}

const EDGE_KEYS: EdgeKey[] = ['left', 'right', 'top', 'bottom']

const BOUND_EPS = 1.5
const HOLD_STRENGTH = 0.66
const AWAY_VELOCITY = 0.4
/** Per-frame pan delta that counts as intentional movement while approaching an edge. */
const MOTION_EPS = 0.08
/** Ignore velocity decay / touch jitter when latched at an edge. */
export const EDGE_HOLD_MOTION_EPS = 1.4
/** Pause at the edge before the held vignette starts fading. */
const HOLD_IDLE_MS = 375
/** How long the held vignette takes to fade out while idle at the edge. */
const HOLD_FADE_MS = 520

type EdgeRuntime = {
  peak: number
  idleStartedAt: number | null
}

const edgeRuntime: Record<EdgeKey, EdgeRuntime> = {
  left: { peak: 0, idleStartedAt: null },
  right: { peak: 0, idleStartedAt: null },
  top: { peak: 0, idleStartedAt: null },
  bottom: { peak: 0, idleStartedAt: null },
}

function readEdgeContact(ref: ReactZoomPanPinchRef): Record<EdgeKey, boolean> {
  const bounds = ref.instance.bounds
  if (!bounds) {
    return { left: false, right: false, top: false, bottom: false }
  }

  const { positionX, positionY } = ref.state
  return {
    left: positionX >= bounds.maxPositionX - BOUND_EPS,
    right: positionX <= bounds.minPositionX + BOUND_EPS,
    top: positionY >= bounds.maxPositionY - BOUND_EPS,
    bottom: positionY <= bounds.minPositionY + BOUND_EPS,
  }
}

function motionEdgeStrengths(vx: number, vy: number): EdgeStrengths {
  const xIntensity = Math.min(Math.abs(vx) / MAX_VELOCITY, 1)
  const yIntensity = Math.min(Math.abs(vy) / MAX_VELOCITY, 1)

  return {
    left: vx > 0 ? xIntensity : 0,
    right: vx < 0 ? xIntensity : 0,
    top: vy > 0 ? yIntensity : 0,
    bottom: vy < 0 ? yIntensity : 0,
  }
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function fadeHeldStrength(peak: number, idleStartedAt: number, now: number): number {
  const idleElapsed = now - idleStartedAt
  if (idleElapsed < HOLD_IDLE_MS) return peak

  const fadeT = Math.min(1, (idleElapsed - HOLD_IDLE_MS) / HOLD_FADE_MS)
  return peak * (1 - easeOutQuad(fadeT))
}

function resetEdgeRuntime(key: EdgeKey): void {
  edgeRuntime[key].peak = 0
  edgeRuntime[key].idleStartedAt = null
}

export function resetPanVignetteRuntime(): void {
  for (const key of EDGE_KEYS) resetEdgeRuntime(key)
}

function updateEdgeStrength(
  key: EdgeKey,
  atEdge: boolean,
  motion: number,
  movingAway: boolean,
  vx: number,
  vy: number,
  now: number,
): number {
  const rt = edgeRuntime[key]
  const approaching = Math.abs(vx) > MOTION_EPS || Math.abs(vy) > MOTION_EPS
  const intentionalAtEdge =
    Math.abs(vx) > EDGE_HOLD_MOTION_EPS || Math.abs(vy) > EDGE_HOLD_MOTION_EPS

  if (movingAway) {
    resetEdgeRuntime(key)
    return 0
  }

  if (approaching && !atEdge) {
    rt.idleStartedAt = null
    rt.peak = motion
    return motion
  }

  if (atEdge && intentionalAtEdge) {
    rt.idleStartedAt = null
    rt.peak = Math.max(motion, HOLD_STRENGTH)
    return rt.peak
  }

  if (atEdge && rt.peak > 0) {
    if (rt.idleStartedAt === null) rt.idleStartedAt = now
    const faded = fadeHeldStrength(rt.peak, rt.idleStartedAt, now)
    if (faded <= 0.01) {
      resetEdgeRuntime(key)
      return 0
    }
    return faded
  }

  if (!atEdge) resetEdgeRuntime(key)
  return 0
}

function computeEdges(
  ref: ReactZoomPanPinchRef,
  vx: number,
  vy: number,
  now: number,
): EdgeStrengths {
  const moving = Math.abs(vx) > MOTION_EPS || Math.abs(vy) > MOTION_EPS
  if (!moving) {
    resetPanVignetteRuntime()
    return EMPTY_EDGE_STRENGTHS
  }

  const motion = motionEdgeStrengths(vx, vy)
  const contact = readEdgeContact(ref)

  return {
    left: updateEdgeStrength(
      'left',
      contact.left,
      motion.left,
      vx < -AWAY_VELOCITY,
      vx,
      vy,
      now,
    ),
    right: updateEdgeStrength(
      'right',
      contact.right,
      motion.right,
      vx > AWAY_VELOCITY,
      vx,
      vy,
      now,
    ),
    top: updateEdgeStrength(
      'top',
      contact.top,
      motion.top,
      vy < -AWAY_VELOCITY,
      vx,
      vy,
      now,
    ),
    bottom: updateEdgeStrength(
      'bottom',
      contact.bottom,
      motion.bottom,
      vy > AWAY_VELOCITY,
      vx,
      vy,
      now,
    ),
  }
}

/** Motion + latched edge contact for the pan vignette overlay. */
export function computePanVignetteEdges(
  ref: ReactZoomPanPinchRef,
  vx: number,
  vy: number,
  now = Date.now(),
): EdgeStrengths {
  return computeEdges(ref, vx, vy, now)
}

/** Continue fading held edges while the camera is idle against a bound. */
export function stepPanVignetteHoldFade(
  ref: ReactZoomPanPinchRef,
  now = Date.now(),
): EdgeStrengths {
  return computeEdges(ref, 0, 0, now)
}

export function shouldContinueHoldFade(
  ref: ReactZoomPanPinchRef,
  edges: EdgeStrengths,
): boolean {
  if (!vignetteIsVisible(edges)) return false
  const contact = readEdgeContact(ref)
  return EDGE_KEYS.some(
    (key) => contact[key] && edgeRuntime[key].idleStartedAt !== null,
  )
}

export function shouldRunHoldFadeLoop(
  ref: ReactZoomPanPinchRef,
  edges: EdgeStrengths,
  vx: number,
  vy: number,
): boolean {
  const intentional =
    Math.abs(vx) > EDGE_HOLD_MOTION_EPS || Math.abs(vy) > EDGE_HOLD_MOTION_EPS
  if (intentional) return false
  if (!vignetteIsVisible(edges)) return false
  const contact = readEdgeContact(ref)
  return EDGE_KEYS.some((key) => contact[key] && edgeRuntime[key].peak > 0)
}

export function vignetteIsVisible(edges: EdgeStrengths): boolean {
  return (
    edges.left > 0 ||
    edges.right > 0 ||
    edges.top > 0 ||
    edges.bottom > 0
  )
}
