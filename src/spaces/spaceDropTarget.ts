import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import type { CanvasItem } from '../canvasItems/types'
import { clampItemPositionInPocketStrip } from './activeCanvasLayout'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import {
  canvasPointUnderPreviewPointer,
  previewLogicalWidth,
  previewViewFromStripScroll,
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
  return true
}

export function dropPositionForItem(
  item: Pick<CanvasItem, 'width' | 'height'>,
  canvasX: number,
  canvasY: number,
  spaceId: string,
): { x: number; y: number } {
  const space = useCanvasWorkspaceStore.getState().spaces[spaceId]
  const logicalWidth = previewLogicalWidth(space?.strip?.logicalWidth)
  return clampItemPositionInPocketStrip(
    canvasX - item.width / 2,
    canvasY - item.height / 2,
    item.width,
    item.height,
    logicalWidth,
  )
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

    const spaceData = useCanvasWorkspaceStore.getState().spaces[spaceId]
    if (!spaceData) continue

    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const logicalWidth = previewLogicalWidth(spaceData.strip?.logicalWidth)
    const pan = previewViewFromStripScroll(spaceData.strip.scrollY, logicalWidth)
    const point = canvasPointUnderPreviewPointer(
      pan,
      localX,
      localY,
      rect.width,
      rect.height,
      logicalWidth,
    )

    return { spaceId, canvasX: point.x, canvasY: point.y }
  }

  return null
}
