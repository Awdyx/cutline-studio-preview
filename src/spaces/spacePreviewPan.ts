import {
  pocketStripBounds,
  POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
} from './pocketStripDimensions'

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

/** Vertical slice height shown in pocket card previews (logical units). */
export const PREVIEW_STRIP_SLICE_HEIGHT = 1400

/** Card preview + drop mapping from saved pocket strip scroll. */
export function previewViewFromStripScroll(
  scrollY: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): SpacePreviewPan {
  const clamped = clampStripScrollY(scrollY, logicalWidth)
  return {
    x: 0,
    // previewTransform shows logical y = -pan.y at the card center; pocket center is +scrollY.
    y: -clamped,
    scale: 1,
  }
}

export function clampStripScrollY(
  scrollY: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): number {
  if (!Number.isFinite(scrollY)) return 0
  const bounds = pocketStripBounds(logicalWidth)
  const maxScroll = bounds.maxY - PREVIEW_STRIP_SLICE_HEIGHT / 2
  const minScroll = bounds.minY + PREVIEW_STRIP_SLICE_HEIGHT / 2
  return Math.max(minScroll, Math.min(maxScroll, scrollY))
}

export function previewLogicalWidth(logicalWidth?: number): number {
  return logicalWidth && logicalWidth > 0
    ? logicalWidth
    : POCKET_STRIP_DEFAULT_LOGICAL_WIDTH
}

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
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): PreviewScreenRect {
  const pan = resolveSpacePreviewPan(view)
  const renderScale = previewRenderScale(
    containerWidth,
    containerHeight,
    pan.scale,
    logicalWidth,
  )
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    left: cx + (item.x - logicalWidth / 2 - pan.x) * renderScale,
    top: cy + (item.y + pan.y) * renderScale,
    width: item.width * renderScale,
    height: item.height * renderScale,
  }
}

export function previewSliceScale(
  containerWidth: number,
  containerHeight: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1
  const fitWidth = containerWidth / logicalWidth
  const fitHeight = containerHeight / PREVIEW_STRIP_SLICE_HEIGHT
  return Math.max(fitWidth, fitHeight)
}

export function previewRenderScale(
  containerWidth: number,
  containerHeight: number,
  zoom: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): number {
  return previewSliceScale(containerWidth, containerHeight, logicalWidth) * zoom
}

export function computePreviewPanBounds(
  containerWidth: number,
  containerHeight: number,
  zoom = 1,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
) {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom, logicalWidth)
  const visibleWidth = containerWidth / scale
  const visibleHeight = containerHeight / scale
  const maxPanX = Math.max(0, (logicalWidth - visibleWidth) / 2)
  const maxPanY = Math.max(0, (PREVIEW_STRIP_SLICE_HEIGHT - visibleHeight) / 2)
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
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): SpacePreviewPan {
  const view = resolveSpacePreviewPan(pan)
  const { minX, maxX, minY, maxY } = computePreviewPanBounds(
    containerWidth,
    containerHeight,
    view.scale,
    logicalWidth,
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
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): Pick<SpacePreviewPan, 'x' | 'y'> {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom, logicalWidth)
  return { x: deltaX / scale, y: deltaY / scale }
}

export function canvasPointUnderPreviewPointer(
  pan: SpacePreviewPan,
  pointerX: number,
  pointerY: number,
  containerWidth: number,
  containerHeight: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): { x: number; y: number } {
  const view = resolveSpacePreviewPan(pan)
  const scale = previewRenderScale(containerWidth, containerHeight, view.scale, logicalWidth)
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    x: logicalWidth / 2 + view.x + (pointerX - cx) / scale,
    y: -view.y + (pointerY - cy) / scale,
  }
}

export function panForCanvasPointAtPointer(
  canvasPoint: { x: number; y: number },
  pointerX: number,
  pointerY: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): Pick<SpacePreviewPan, 'x' | 'y'> {
  const scale = previewRenderScale(containerWidth, containerHeight, zoom, logicalWidth)
  const cx = containerWidth / 2
  const cy = containerHeight / 2
  return {
    x: canvasPoint.x - logicalWidth / 2 - (pointerX - cx) / scale,
    y: canvasPoint.y - (pointerY - cy) / scale,
  }
}

export function previewTransform(
  view: SpacePreviewPan,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
): string {
  const pan = resolveSpacePreviewPan(view)
  const cx = logicalWidth / 2
  const cy = 0
  return `translate(${cx + pan.x} ${cy + pan.y}) scale(${pan.scale}) translate(${-cx} ${-cy})`
}

export function previewStripViewBox(logicalWidth: number): string {
  const h = PREVIEW_STRIP_SLICE_HEIGHT
  return `0 ${-h / 2} ${logicalWidth} ${h}`
}

export function zoomSpacePreviewPan(
  pan: SpacePreviewPan,
  nextScale: number,
  pointerX: number,
  pointerY: number,
  containerWidth: number,
  containerHeight: number,
  logicalWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
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
    logicalWidth,
  )
  const nextPan = panForCanvasPointAtPointer(
    anchor,
    pointerX,
    pointerY,
    scale,
    containerWidth,
    containerHeight,
    logicalWidth,
  )
  return clampSpacePreviewPan(
    { x: nextPan.x, y: nextPan.y, scale },
    containerWidth,
    containerHeight,
    logicalWidth,
  )
}
