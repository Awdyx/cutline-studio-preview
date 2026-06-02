import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isOverviewHyperPanActive } from '../canvas/canvasVirtualPan'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
import type { SpaceCanvasItem } from '../canvasItems/types'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import type { SpaceCamera } from './types'

export type CanvasItemRect = Pick<
  { x: number; y: number; width: number; height: number },
  'x' | 'y' | 'width' | 'height'
>

/**
 * Map studio-local logical item coords → expanded main-canvas space.
 * Pockets and the void grid use logical coords on the transform root directly.
 */
export function canvasItemTransformRect(item: CanvasItemRect): CanvasItemRect {
  if (useCanvasWorkspaceStore.getState().isInsideSpace()) {
    return item
  }

  if (isOverviewHyperPanActive()) {
    return item
  }

  const { x: studioX, y: studioY } = useStudioCentrePositionStore.getState()
  return {
    x: studioX + item.x,
    y: studioY + item.y,
    width: item.width,
    height: item.height,
  }
}

/** Screen-space rect of a canvas item from canvas coords + pan/zoom. */
export function canvasItemClientRect(
  item: CanvasItemRect,
  transformRef: ReactZoomPanPinchContentRef | null,
  camera?: SpaceCamera | null,
): DOMRect | null {
  const wrapper = transformRef?.instance?.wrapperComponent
  if (!transformRef || !wrapper) return null
  const positionX =
    camera?.positionX ?? transformRef.state.positionX
  const positionY = camera?.positionY ?? transformRef.state.positionY
  const scale = camera?.scale ?? transformRef.state.scale
  const wrapperBounds = wrapper.getBoundingClientRect()
  const canvasRect = canvasItemTransformRect(item)

  const left = wrapperBounds.left + positionX + canvasRect.x * scale
  const top = wrapperBounds.top + positionY + canvasRect.y * scale
  const width = canvasRect.width * scale
  const height = canvasRect.height * scale

  return new DOMRect(left, top, width, height)
}

/** Live screen rect — prefers the mounted item shell (tracks CSS transforms during focus). */
export function canvasItemLiveClientRect(
  item: CanvasItemRect & { id: string },
  transformRef: ReactZoomPanPinchContentRef | null,
  camera?: SpaceCamera | null,
): DOMRect | null {
  const el = document.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`)
  if (el instanceof HTMLElement) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return rect
  }
  return canvasItemClientRect(item, transformRef, camera)
}

/** Screen-space rect of a space card from canvas item coords + pan/zoom. */
export function spaceCardClientRect(
  item: Pick<SpaceCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  transformRef: ReactZoomPanPinchContentRef | null,
  camera?: SpaceCamera | null,
): DOMRect | null {
  return canvasItemClientRect(item, transformRef, camera)
}
