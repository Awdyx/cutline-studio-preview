import { CANVAS_CUSTOMIZE_BLUR_RELEASE_MS } from '../uiCustomization/canvasItemCustomizeLayout'
import { useCanvasCustomizeStore } from './canvasCustomizeStore'
import { releaseStickyEmbeddedMediaRetain } from './stickyCustomizeMediaRetain'

let blurReleaseTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleCanvasCustomizeBlurRelease(): void {
  cancelCanvasCustomizeBlurRelease()
  blurReleaseTimer = setTimeout(() => {
    blurReleaseTimer = null
    releaseStickyEmbeddedMediaRetain()
    useCanvasCustomizeStore.setState({ blurReleasing: false })
  }, CANVAS_CUSTOMIZE_BLUR_RELEASE_MS)
}

export function cancelCanvasCustomizeBlurRelease(): void {
  if (blurReleaseTimer == null) return
  clearTimeout(blurReleaseTimer)
  blurReleaseTimer = null
  releaseStickyEmbeddedMediaRetain()
}
