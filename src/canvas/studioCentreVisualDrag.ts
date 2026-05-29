/** Compositor-friendly studio-centre drag — transform on the draw target, no React churn. */

import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import {
  CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX,
  canvasRectToRegionPercent,
} from './canvasMinimapGeometry'
import { STUDIO_VISUAL_HEIGHT, STUDIO_VISUAL_WIDTH } from '../drawing/canvasDimensions'
import { syncStudioCentreLayoutVars } from './studioCentrePosition'
import {
  isStudioCentreDragEdgeSquishActive,
  readStudioCentreDragEdgeSquish,
  resetStudioCentreDragEdgeSquish,
  stepStudioCentreDragEdgeSquish,
  stepStudioCentreDragEdgeSquishSettle,
  studioCentreDragEdgePressures,
  studioCentreDragEdgeTransform,
} from './studioCentreDragEdgeBump'
import {
  clearStudioCentreDragParallax,
  syncStudioCentreDragParallax,
} from './studioCentreDragParallax'

let drawTargetEl: HTMLElement | null = null
let minimapPlateWrapEl: HTMLElement | null = null
let edgeSpringRaf: number | null = null

export function registerStudioCentreDrawTarget(el: HTMLElement | null): void {
  drawTargetEl = el
}

export function registerStudioCentreMinimapPlateWrap(el: HTMLElement | null): void {
  minimapPlateWrapEl = el
}

function applyDragTransformToEl(
  el: HTMLElement | null,
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

function syncMinimapPlateLayout(region: CanvasMinimapRect, x: number, y: number): void {
  if (!minimapPlateWrapEl) return

  const pct = canvasRectToRegionPercent(
    {
      x,
      y,
      width: STUDIO_VISUAL_WIDTH,
      height: STUDIO_VISUAL_HEIGHT,
    },
    region,
  )

  minimapPlateWrapEl.style.left = `${pct.left}%`
  minimapPlateWrapEl.style.top = `calc(${pct.top}% - ${CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX}px)`
  minimapPlateWrapEl.style.width = `${pct.width}%`
  minimapPlateWrapEl.style.height = `calc(${pct.height}% + ${CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX}px)`
}

function minimapPlateDragTranslate(
  dxCanvas: number,
  dyCanvas: number,
  region: CanvasMinimapRect,
): { x: number; y: number } {
  if (!minimapPlateWrapEl || region.width <= 0 || region.height <= 0) {
    return { x: 0, y: 0 }
  }

  const frameEl = minimapPlateWrapEl.closest(
    '.canvas-minimap-expanded-menu__frame',
  ) as HTMLElement | null
  if (!frameEl) return { x: 0, y: 0 }

  const { width, height } = frameEl.getBoundingClientRect()
  if (width <= 0 || height <= 0) return { x: 0, y: 0 }

  return {
    x: (dxCanvas / region.width) * width,
    y: (dyCanvas / region.height) * height,
  }
}

type StudioCentreDragFrame = {
  drawDx: number
  drawDy: number
  rawX: number
  rawY: number
  minimapDxCanvas?: number
  minimapDyCanvas?: number
  minimapRegion?: CanvasMinimapRect
}

function applyStudioCentreDragFrameInternal({
  drawDx,
  drawDy,
  rawX,
  rawY,
  minimapDxCanvas,
  minimapDyCanvas,
  minimapRegion,
}: StudioCentreDragFrame): void {
  const squish = stepStudioCentreDragEdgeSquish(rawX, rawY)
  syncStudioCentreDragParallax(
    minimapDxCanvas ?? drawDx,
    minimapDyCanvas ?? drawDy,
  )
  applyDragTransformToEl(drawTargetEl, drawDx, drawDy, squish)

  if (
    minimapRegion &&
    minimapDxCanvas != null &&
    minimapDyCanvas != null
  ) {
    const { x, y } = minimapPlateDragTranslate(
      minimapDxCanvas,
      minimapDyCanvas,
      minimapRegion,
    )
    applyDragTransformToEl(minimapPlateWrapEl, x, y, squish)
  }
}

export function applyStudioCentreDragTransform(
  dx: number,
  dy: number,
  rawX: number,
  rawY: number,
): void {
  applyStudioCentreDragFrameInternal({
    drawDx: dx,
    drawDy: dy,
    rawX,
    rawY,
  })
}

/** Live minimap follow — layout vars + edge squish only (no translate snap on drop). */
export function applyMinimapPlateDragTransform(
  _dxCanvas: number,
  _dyCanvas: number,
  region: CanvasMinimapRect,
  rawX: number,
  rawY: number,
): void {
  const squish = stepStudioCentreDragEdgeSquish(rawX, rawY)
  syncStudioCentreDragParallax(_dxCanvas, _dyCanvas)
  const { clamped } = studioCentreDragEdgePressures(rawX, rawY)
  syncStudioCentreLayoutVars(clamped.x, clamped.y)
  syncMinimapPlateLayout(region, clamped.x, clamped.y)
  applyDragTransformToEl(drawTargetEl, 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEl, 0, 0, squish)
}

export function clearStudioCentreDragTransform(): void {
  cancelStudioCentreDragEdgeSpringBack()
  resetStudioCentreDragEdgeSquish()
  clearStudioCentreDragParallax()
  if (!drawTargetEl) return
  drawTargetEl.style.transform = ''
  drawTargetEl.style.removeProperty('transform-origin')
}

export function clearMinimapPlateDragTransform(): void {
  if (minimapPlateWrapEl) {
    minimapPlateWrapEl.style.transform = ''
    minimapPlateWrapEl.style.removeProperty('transform-origin')
  }
}

/** Drop commit — layout vars take over; keep squish state for spring-back. */
export function commitStudioCentreDragPosition(): void {
  if (drawTargetEl) {
    drawTargetEl.style.transform = ''
    drawTargetEl.style.removeProperty('transform-origin')
  }
  clearMinimapPlateDragTransform()
}

/** Minimap drop — layout already live during drag; keep edge squish for spring-back. */
export function commitMinimapPlateDragRelease(
  region: CanvasMinimapRect,
  x: number,
  y: number,
): void {
  syncMinimapPlateLayout(region, x, y)
  const squish = readStudioCentreDragEdgeSquish()
  applyDragTransformToEl(drawTargetEl, 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEl, 0, 0, squish)
}

function applyEdgeSquishOnly(): void {
  const squish = stepStudioCentreDragEdgeSquishSettle()
  applyDragTransformToEl(drawTargetEl, 0, 0, squish)
  applyDragTransformToEl(minimapPlateWrapEl, 0, 0, squish)
}

export function cancelStudioCentreDragEdgeSpringBack(): void {
  if (edgeSpringRaf !== null) {
    cancelAnimationFrame(edgeSpringRaf)
    edgeSpringRaf = null
  }
}

/** Ease squish back after drop while position is already committed. */
export function springBackStudioCentreDragEdge(onComplete?: () => void): void {
  cancelStudioCentreDragEdgeSpringBack()

  if (!isStudioCentreDragEdgeSquishActive()) {
    clearMinimapPlateDragTransform()
    onComplete?.()
    return
  }

  const tick = () => {
    applyEdgeSquishOnly()
    if (!isStudioCentreDragEdgeSquishActive()) {
      edgeSpringRaf = null
      resetStudioCentreDragEdgeSquish()
      if (drawTargetEl) {
        drawTargetEl.style.transform = ''
        drawTargetEl.style.removeProperty('transform-origin')
      }
      clearMinimapPlateDragTransform()
      onComplete?.()
      return
    }
    edgeSpringRaf = requestAnimationFrame(tick)
  }

  edgeSpringRaf = requestAnimationFrame(tick)
}
