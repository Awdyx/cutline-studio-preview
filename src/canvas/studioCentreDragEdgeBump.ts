import type { EdgeStrengths } from '../canvasPanVignette'
import { clampStudioCentrePosition } from './studioCentrePosition'
import {
  IDLE_MINIMAP_VIEWPORT_SQUISH,
  minimapViewportSquishTransform,
  squishFromEdgePressures,
  type MinimapViewportSquish,
} from './canvasMinimapViewportSquish'

/** Canvas-space overshoot that reaches full edge squish while dragging. */
const DRAG_EDGE_PRESSURE_REFERENCE = 520

const DRAG_SQUISH_ATTACK = 0.54
const DRAG_SQUISH_RELEASE = 0.11
const DRAG_ORIGIN_ATTACK = 0.62
const DRAG_ORIGIN_RELEASE = 0.13
/** Softer settle used while springing back after pointer release. */
const DRAG_SQUISH_SETTLE = 0.075
const DRAG_ORIGIN_SETTLE = 0.09
const IDLE_EPS = 0.0015

function edgePressure(overflowCanvas: number): number {
  if (overflowCanvas <= 0) return 0
  return Math.min(overflowCanvas / DRAG_EDGE_PRESSURE_REFERENCE, 1)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function isSquishIdle(squish: MinimapViewportSquish): boolean {
  return (
    Math.abs(squish.scaleX - 1) < IDLE_EPS &&
    Math.abs(squish.scaleY - 1) < IDLE_EPS &&
    Math.abs(squish.originX - 50) < 0.35 &&
    Math.abs(squish.originY - 50) < 0.35
  )
}

function stepDragSquish(
  prev: MinimapViewportSquish,
  target: MinimapViewportSquish,
  pushing: boolean,
  settling: boolean,
): MinimapViewportSquish {
  const scaleRate = settling
    ? DRAG_SQUISH_SETTLE
    : pushing
      ? DRAG_SQUISH_ATTACK
      : DRAG_SQUISH_RELEASE
  const originRate = settling
    ? DRAG_ORIGIN_SETTLE
    : pushing
      ? DRAG_ORIGIN_ATTACK
      : DRAG_ORIGIN_RELEASE

  const next: MinimapViewportSquish = {
    scaleX: lerp(prev.scaleX, target.scaleX, scaleRate),
    scaleY: lerp(prev.scaleY, target.scaleY, scaleRate),
    originX: lerp(prev.originX, target.originX, originRate),
    originY: lerp(prev.originY, target.originY, originRate),
  }

  if ((!pushing || settling) && isSquishIdle(next)) {
    return IDLE_MINIMAP_VIEWPORT_SQUISH
  }

  return next
}

export function studioCentreDragEdgePressures(
  rawX: number,
  rawY: number,
): { edges: EdgeStrengths; clamped: ReturnType<typeof clampStudioCentrePosition> } {
  const clamped = clampStudioCentrePosition(rawX, rawY)
  return {
    clamped,
    edges: {
      left: edgePressure(clamped.x - rawX),
      right: edgePressure(rawX - clamped.x),
      top: edgePressure(clamped.y - rawY),
      bottom: edgePressure(rawY - clamped.y),
    },
  }
}

let smoothSquish: MinimapViewportSquish = IDLE_MINIMAP_VIEWPORT_SQUISH

export function resetStudioCentreDragEdgeSquish(): void {
  smoothSquish = IDLE_MINIMAP_VIEWPORT_SQUISH
}

export function readStudioCentreDragEdgeSquish(): MinimapViewportSquish {
  return smoothSquish
}

export function isStudioCentreDragEdgeSquishActive(): boolean {
  return !isSquishIdle(smoothSquish)
}

export function stepStudioCentreDragEdgeSquish(
  rawX: number,
  rawY: number,
): MinimapViewportSquish {
  const { edges } = studioCentreDragEdgePressures(rawX, rawY)
  const pushing = edges.left + edges.right + edges.top + edges.bottom > 0.001
  const target = pushing
    ? squishFromEdgePressures(edges)
    : IDLE_MINIMAP_VIEWPORT_SQUISH
  smoothSquish = stepDragSquish(smoothSquish, target, pushing, false)
  return smoothSquish
}

export function stepStudioCentreDragEdgeSquishSettle(): MinimapViewportSquish {
  smoothSquish = stepDragSquish(
    smoothSquish,
    IDLE_MINIMAP_VIEWPORT_SQUISH,
    false,
    true,
  )
  return smoothSquish
}

export function studioCentreDragEdgeTransform(
  translateX: number,
  translateY: number,
  squish: MinimapViewportSquish,
): { transform: string; transformOrigin: string } {
  const parts: string[] = []
  if (translateX !== 0 || translateY !== 0) {
    parts.push(
      `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0)`,
    )
  }
  const scale = minimapViewportSquishTransform(squish)
  if (scale) parts.push(scale)

  const atIdle = isSquishIdle(squish)

  return {
    transform: parts.join(' ') || '',
    transformOrigin: atIdle ? '' : `${squish.originX}% ${squish.originY}%`,
  }
}
