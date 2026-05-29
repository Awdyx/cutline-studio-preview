import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'

export type SpacePreviewPan = {
  x: number
  y: number
  scale: number
}

export const DEFAULT_SPACE_PREVIEW_PAN: SpacePreviewPan = {
  x: 0,
  y: 0,
  scale: 1,
}

export const PREVIEW_ZOOM_MIN = 1
export const PREVIEW_ZOOM_MAX = 4

export function resolveSpacePreviewPan(
  pan: Partial<SpacePreviewPan> | undefined,
): SpacePreviewPan {
  if (!pan) return DEFAULT_SPACE_PREVIEW_PAN
  const x = typeof pan.x === 'number' && Number.isFinite(pan.x) ? pan.x : 0
  const y = typeof pan.y === 'number' && Number.isFinite(pan.y) ? pan.y : 0
  const rawScale = pan.scale
  const scale =
    typeof rawScale === 'number' && Number.isFinite(rawScale)
      ? Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, rawScale))
      : 1
  return { x, y, scale }
}

export type PreviewScreenRect = {
  left: number
  top: number
  width: number
  height: number
}

/** Map a canvas item box to container pixels (matches SVG slice + preview pan). */
export function canvasItemToPreviewScreenRect(
  item: { x: number; y: number; width: number; height: number },
  view: SpacePreviewPan,
  containerWidth: number,
  containerHeight: number,
): PreviewScreenRect {
  const pan = resolveSpacePreviewPan(view)
  const renderScale = previewRenderScale(
    containerWidth,
    containerHeight,
    pan.scale,
  )
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    left: cx + (item.x - CANVAS_ORIGINAL_WIDTH / 2 - pan.x) * renderScale,
    top: cy + (item.y - CANVAS_ORIGINAL_HEIGHT / 2 - pan.y) * renderScale,
    width: item.width * renderScale,
    height: item.height * renderScale,
  }
}

export function previewSliceScale(
  containerWidth: number,
  containerHeight: number,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1
  return Math.max(
    containerWidth / CANVAS_ORIGINAL_WIDTH,
    containerHeight / CANVAS_ORIGINAL_HEIGHT,
  )
}

export function previewRenderScale(
  containerWidth: number,
  containerHeight: number,
  zoom: number,
): number {
  return previewSliceScale(containerWidth, containerHeight) * zoom
}

export function computePreviewPanBounds(
  containerWidth: number,
  containerHeight: number,
  zoom = 1,
) {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom)
  const visibleWidth = containerWidth / scale
  const visibleHeight = containerHeight / scale
  const maxPanX = Math.max(0, (CANVAS_ORIGINAL_WIDTH - visibleWidth) / 2)
  const maxPanY = Math.max(0, (CANVAS_ORIGINAL_HEIGHT - visibleHeight) / 2)
  return {
    minX: -maxPanX,
    maxX: maxPanX,
    minY: -maxPanY,
    maxY: maxPanY,
  }
}

export function clampSpacePreviewPan(
  pan: SpacePreviewPan,
  containerWidth: number,
  containerHeight: number,
): SpacePreviewPan {
  const view = resolveSpacePreviewPan(pan)
  const { minX, maxX, minY, maxY } = computePreviewPanBounds(
    containerWidth,
    containerHeight,
    view.scale,
  )
  return {
    scale: view.scale,
    x: Math.max(minX, Math.min(maxX, view.x)),
    y: Math.max(minY, Math.min(maxY, view.y)),
  }
}

export function screenDeltaToPreviewPanDelta(
  deltaX: number,
  deltaY: number,
  containerWidth: number,
  containerHeight: number,
  zoom: number,
): Pick<SpacePreviewPan, 'x' | 'y'> {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom)
  return { x: deltaX / scale, y: deltaY / scale }
}

export function canvasPointUnderPreviewPointer(
  pan: SpacePreviewPan,
  pointerX: number,
  pointerY: number,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const view = resolveSpacePreviewPan(pan)
  const scale = previewRenderScale(containerWidth, containerHeight, view.scale)
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    x: CANVAS_ORIGINAL_WIDTH / 2 + view.x + (pointerX - cx) / scale,
    y: CANVAS_ORIGINAL_HEIGHT / 2 + view.y + (pointerY - cy) / scale,
  }
}

export function panForCanvasPointAtPointer(
  canvasPoint: { x: number; y: number },
  pointerX: number,
  pointerY: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
): Pick<SpacePreviewPan, 'x' | 'y'> {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom)
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    x: canvasPoint.x - CANVAS_ORIGINAL_WIDTH / 2 - (pointerX - cx) / scale,
    y: canvasPoint.y - CANVAS_ORIGINAL_HEIGHT / 2 - (pointerY - cy) / scale,
  }
}

export function previewTransform(view: SpacePreviewPan): string {
  const pan = resolveSpacePreviewPan(view)
  const cx = CANVAS_ORIGINAL_WIDTH / 2
  const cy = CANVAS_ORIGINAL_HEIGHT / 2
  return `translate(${cx + pan.x} ${cy + pan.y}) scale(${pan.scale}) translate(${-cx} ${-cy})`
}

export function zoomSpacePreviewPan(
  pan: SpacePreviewPan,
  nextScale: number,
  pointerX: number,
  pointerY: number,
  containerWidth: number,
  containerHeight: number,
): SpacePreviewPan {
  const current = resolveSpacePreviewPan(pan)
  const scale = Math.max(
    PREVIEW_ZOOM_MIN,
    Math.min(PREVIEW_ZOOM_MAX, nextScale),
  )
  const anchor = canvasPointUnderPreviewPointer(
    current,
    pointerX,
    pointerY,
    containerWidth,
    containerHeight,
  )
  const nextPan = panForCanvasPointAtPointer(
    anchor,
    pointerX,
    pointerY,
    scale,
    containerWidth,
    containerHeight,
  )
  return clampSpacePreviewPan(
    { x: nextPan.x, y: nextPan.y, scale },
    containerWidth,
    containerHeight,
  )
}
