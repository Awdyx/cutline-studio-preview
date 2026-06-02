import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { isImageInSticky } from '../canvasItems/types'
import {
  holdMediaObjectUrl,
  peekMediaObjectUrl,
  releaseMediaObjectUrl,
  resolveMediaObjectUrl,
} from '../media/mediaObjectUrlCache'

/** Extra ref-count per mediaId so embedded images keep blob URLs through portal remount. */
const heldMediaRefCounts = new Map<string, number>()

function addHandoffHold(mediaId: string): void {
  if (!holdMediaObjectUrl(mediaId)) return
  heldMediaRefCounts.set(mediaId, (heldMediaRefCounts.get(mediaId) ?? 0) + 1)
}

/** Extra ref-count so embedded images do not revoke URLs during portal → canvas remount. */
export function retainStickyEmbeddedMediaForHandoff(stickyId: string): void {
  const items = useCanvasItemsStore.getState().items
  for (const item of items) {
    if (item.type !== 'image' || !isImageInSticky(item) || item.stickyId !== stickyId) {
      continue
    }
    const { mediaId } = item
    if (peekMediaObjectUrl(mediaId)) {
      addHandoffHold(mediaId)
      continue
    }
    void resolveMediaObjectUrl(mediaId).then((url) => {
      if (url) addHandoffHold(mediaId)
    })
  }
}

export function releaseStickyEmbeddedMediaRetain(): void {
  for (const [mediaId, count] of heldMediaRefCounts) {
    for (let i = 0; i < count; i += 1) {
      releaseMediaObjectUrl(mediaId)
    }
  }
  heldMediaRefCounts.clear()
}
