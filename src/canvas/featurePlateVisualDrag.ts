import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import {
  CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX,
  canvasRectToRegionPercent,
} from './canvasMinimapGeometry'
import { FEATURE_PLATE_HEIGHT, FEATURE_PLATE_WIDTH } from '../drawing/canvasDimensions'
import type { FeaturePlateDestination } from './canvasPlate'
import { syncFeaturePlateLayoutVars } from './canvasPlate'
import {
  isStudioCentreDragEdgeSquishActive,
  readStudioCentreDragEdgeSquish,
  resetStudioCentreDragEdgeSquish,
  stepStudioCentreDragEdgeSquish,
  stepStudioCentreDragEdgeSquishSettle,
  studioCentreDragEdgePressures,
  studioCentreDragEdgeTransform,
} from './studioCentreDragEdgeBump'

const plateEls = new Map<FeaturePlateDestination, HTMLElement>()
const minimapPlateWrapEls = new Map<FeaturePlateDestination, HTMLElement>()
let edgeSpringRaf: number | null = null

export function registerFeaturePlateEl(
  dest: FeaturePlateDestination,
  el: HTMLElement | null,
): void {
  if (el) plateEls.set(dest, el)
  else plateEls.delete(dest)
}

export function registerFeaturePlateMinimapWrap(
  dest: FeaturePlateDestination,
  el: HTMLElement | null,
): void {
  if (el) minimapPlateWrapEls.set(dest, el)
  else minimapPlateWrapEls.delete(dest)
}

function applyDragTransformToEl(
  el: HTMLElement | null | undefined,
  translateX: number,
  translateY: number,
  squish: ReturnType<typeof stepStudioCentreDragEdgeSquish>,
): void {
  if (!el) return
  const { transform, transformOrigin } = studioCentreDragEdgeTransform(
    translateX,
    translateY,
    squish,
  )
  el.style.transform = transform
  if (transformOrigin) el.style.transformOrigin = transformOrigin
  else el.style.removeProperty('transform-origin')
}

function syncMinimapPlateLayout(
  dest: FeaturePlateDestination,
  region: CanvasMinimapRect,
  x: number,
  y: number,
): void {
  const wrap = minimapPlateWrapEls.get(dest)
  if (!wrap) return

  const pct = canvasRectToRegionPercent(
    {
      x,
      y,
      width: FEATURE_PLATE_WIDTH,
      height: FEATURE_PLATE_HEIGHT,
    },
    region,
  )

  wrap.style.left = `${pct.left}%`
  wrap.style.top = `calc(${pct.top}% - ${CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX}px)`
  wrap.style.width = `${pct.width}%`
  wrap.style.height = `calc(${pct.height}% + ${CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX}px)`
}

export function applyFeaturePlateDragTransform(
  dest: FeaturePlateDestination,
  dx: number,
  dy: number,
  rawX: number,
  rawY: number,
): void {
  const squish = stepStudioCentreDragEdgeSquish(rawX, rawY)
  applyDragTransformToEl(plateEls.get(dest), dx, dy, squish)
}

export function applyFeaturePlateMinimapDragTransform(
  dest: FeaturePlateDestination,
  _dxCanvas: number,
  _dyCanvas: number,
  region: CanvasMinimapRect,
  rawX: number,
  rawY: number,
): void {
  const squish = stepStudioCentreDragEdgeSquish(rawX, rawY)
  const { clamped } = studioCentreDragEdgePressures(rawX, rawY)
  syncFeaturePlateLayoutVars(dest, clamped.x, clamped.y)
  syncMinimapPlateLayout(dest, region, clamped.x, clamped.y)
  applyDragTransformToEl(plateEls.get(dest), 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEls.get(dest), 0, 0, squish)
}

export function clearFeaturePlateDragTransform(dest: FeaturePlateDestination): void {
  const el = plateEls.get(dest)
  if (!el) return
  el.style.transform = ''
  el.style.removeProperty('transform-origin')
}

export function clearFeaturePlateMinimapDragTransform(
  dest: FeaturePlateDestination,
): void {
  const wrap = minimapPlateWrapEls.get(dest)
  if (!wrap) return
  wrap.style.transform = ''
  wrap.style.removeProperty('transform-origin')
}

export function commitFeaturePlateDragPosition(dest: FeaturePlateDestination): void {
  clearFeaturePlateDragTransform(dest)
  clearFeaturePlateMinimapDragTransform(dest)
}

export function commitFeaturePlateMinimapDragRelease(
  dest: FeaturePlateDestination,
  region: CanvasMinimapRect,
  x: number,
  y: number,
): void {
  syncMinimapPlateLayout(dest, region, x, y)
  const squish = readStudioCentreDragEdgeSquish()
  applyDragTransformToEl(plateEls.get(dest), 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEls.get(dest), 0, 0, squish)
}

function applyEdgeSquishOnly(dest: FeaturePlateDestination): void {
  const squish = stepStudioCentreDragEdgeSquishSettle()
  applyDragTransformToEl(plateEls.get(dest), 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEls.get(dest), 0, 0, squish)
}

export function springBackFeaturePlateDragEdge(
  dest: FeaturePlateDestination,
  onComplete?: () => void,
): void {
  if (edgeSpringRaf !== null) {
    cancelAnimationFrame(edgeSpringRaf)
    edgeSpringRaf = null
  }

  if (!isStudioCentreDragEdgeSquishActive()) {
    clearFeaturePlateMinimapDragTransform(dest)
    onComplete?.()
    return
  }

  const tick = () => {
    applyEdgeSquishOnly(dest)
    if (!isStudioCentreDragEdgeSquishActive()) {
      edgeSpringRaf = null
      resetStudioCentreDragEdgeSquish()
      clearFeaturePlateDragTransform(dest)
      clearFeaturePlateMinimapDragTransform(dest)
      onComplete?.()
      return
    }
    edgeSpringRaf = requestAnimationFrame(tick)
  }

  edgeSpringRaf = requestAnimationFrame(tick)
}
