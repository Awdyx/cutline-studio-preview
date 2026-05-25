import { isTouchPointerStillActive } from '../canvas/canvasPointer'

/** True when the primary button is no longer held (e.g. released outside the browser). */
export function primaryPointerReleased(
  event: PointerEvent | MouseEvent,
  pointerId?: number,
): boolean {
  if (event.buttons !== 0) return false
  if (
    pointerId != null &&
    'pointerType' in event &&
    event.pointerType === 'touch' &&
    isTouchPointerStillActive(pointerId)
  ) {
    return false
  }
  return true
}
