import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import type { CanvasItem } from '../canvasItems/types'
import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import {
  canvasPointUnderPreviewPointer,
  resolveSpacePreviewPan,
} from './spacePreviewPan'

export type SpaceDropHit = {
  spaceId: string
  canvasX: number
  canvasY: number
}

export function canDropItemInSpace(item: CanvasItem | undefined): boolean {
  if (!item) return false
  if (item.type === 'space') return false
  if (!useCanvasWorkspaceStore.getState().isOnMainCanvas()) return false
  if (useCanvasItemsStore.getState().previewAdjustSpaceId != null) return false
  return true
}

export function dropPositionForItem(
  item: Pick<CanvasItem, 'width' | 'height'>,
  canvasX: number,
  canvasY: number,
): { x: number; y: number } {
  const x = Math.max(
    0,
    Math.min(CANVAS_ORIGINAL_WIDTH - item.width, canvasX - item.width / 2),
  )
  const y = Math.max(
    0,
    Math.min(CANVAS_ORIGINAL_HEIGHT - item.height, canvasY - item.height / 2),
  )
  return { x, y }
}

export function hitTestSpacePreviewAt(
  clientX: number,
  clientY: number,
  draggedItemId: string,
): SpaceDropHit | null {
  const dragged = useCanvasItemsStore
    .getState()
    .items.find((entry) => entry.id === draggedItemId)
  if (!canDropItemInSpace(dragged)) return null

  const previews = document.querySelectorAll<HTMLElement>('[data-space-preview]')
  for (const el of previews) {
    const rect = el.getBoundingClientRect()
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      continue
    }

    const card = el.closest('[data-canvas-item="space"]')
    const spaceId = card?.getAttribute('data-item-id')
    if (!spaceId || spaceId === draggedItemId) continue

    const spaceWidget = useCanvasItemsStore
      .getState()
      .items.find(
        (entry): entry is Extract<CanvasItem, { type: 'space' }> =>
          entry.id === spaceId && entry.type === 'space',
      )
    if (!spaceWidget) continue
    if (!useCanvasWorkspaceStore.getState().spaces[spaceId]) continue

    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const pan = resolveSpacePreviewPan(spaceWidget.previewPan)
    const point = canvasPointUnderPreviewPointer(
      pan,
      localX,
      localY,
      rect.width,
      rect.height,
    )

    return { spaceId, canvasX: point.x, canvasY: point.y }
  }

  return null
}
