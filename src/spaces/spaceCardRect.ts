import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import type { SpaceCanvasItem } from '../canvasItems/types'
import type { SpaceCamera } from './types'

type CanvasItemRect = Pick<
  { x: number; y: number; width: number; height: number },
  'x' | 'y' | 'width' | 'height'
>

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

  const left = wrapperBounds.left + positionX + item.x * scale
  const top = wrapperBounds.top + positionY + item.y * scale
  const width = item.width * scale
  const height = item.height * scale

  return new DOMRect(left, top, width, height)
}

/** Screen-space rect of a space card from canvas item coords + pan/zoom. */
export function spaceCardClientRect(
  item: Pick<SpaceCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  transformRef: ReactZoomPanPinchContentRef | null,
  camera?: SpaceCamera | null,
): DOMRect | null {
  return canvasItemClientRect(item, transformRef, camera)
}
