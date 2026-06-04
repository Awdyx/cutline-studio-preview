import { useCanvasItemsStore } from './canvasItemsStore'
import { SPACE_NAME_DEFAULT_FONT_SIZE } from './textEditorFontSize'
import { isDefaultSpaceName } from '../spaces/types'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import type { CanvasItem, SpaceCanvasItem } from './types'

/** Matches SpaceItem title row padding and typography. */
export const SPACE_TITLE_PAD_TOP = 7
export const SPACE_TITLE_PAD_X = 8
export const SPACE_TITLE_PAD_BOTTOM = 9
export const SPACE_TITLE_LINE_HEIGHT = 1.35

export function spaceTitleBandHeight(): number {
  return Math.ceil(
    SPACE_TITLE_PAD_TOP +
      SPACE_TITLE_PAD_BOTTOM +
      SPACE_NAME_DEFAULT_FONT_SIZE * SPACE_TITLE_LINE_HEIGHT,
  )
}

export function spaceTitleBandLocalRect(width: number): {
  x: number
  y: number
  width: number
  height: number
} {
  return { x: 0, y: 0, width, height: spaceTitleBandHeight() }
}

function canvasPointInSpaceTitleBand(
  space: SpaceCanvasItem,
  canvasX: number,
  canvasY: number,
): boolean {
  const band = spaceTitleBandLocalRect(space.width)
  const localX = canvasX - space.x
  const localY = canvasY - space.y
  return (
    localX >= band.x &&
    localX <= band.x + band.width &&
    localY >= band.y &&
    localY <= band.y + band.height
  )
}

/** Sole-selected untitled pocket title band — pen ink routes here instead of the canvas. */
export function hitTestSpaceTitleAtCanvasPoint(
  x: number,
  y: number,
  items?: CanvasItem[],
): string | null {
  if (!useCanvasWorkspaceStore.getState().isOnMainCanvas()) return null

  const { selectedIds } = useCanvasItemsStore.getState()
  if (selectedIds.length !== 1) return null
  const soleId = selectedIds[0]

  const list = items ?? useCanvasItemsStore.getState().items
  const ws = useCanvasWorkspaceStore.getState()

  const space = list.find(
    (item): item is SpaceCanvasItem =>
      item.type === 'space' && item.id === soleId,
  )
  if (!space) return null

  const name = ws.getSpaceName(space.id) ?? space.name
  if (!isDefaultSpaceName(name)) return null
  if (!canvasPointInSpaceTitleBand(space, x, y)) return null
  return space.id
}
