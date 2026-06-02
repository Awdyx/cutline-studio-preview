/** Pin ids that already played ui-pin-enter — skip respawn when customize portal remounts. */
const pinEnterCompleted = new Set<string>()

export function shouldPlayPinEnterAnimation(pinId: string): boolean {
  return !pinEnterCompleted.has(pinId)
}

export function markPinEnterAnimationDone(pinId: string): void {
  pinEnterCompleted.add(pinId)
}

export function clearPinEnterAnimation(pinId: string): void {
  pinEnterCompleted.delete(pinId)
}
