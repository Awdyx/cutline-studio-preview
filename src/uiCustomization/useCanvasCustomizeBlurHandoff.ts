import { useCanvasCustomizeStore } from '../canvasItemCustomize/canvasCustomizeStore'
import { useUiCustomizationStore } from './uiCustomizationStore'

/** True while a canvas-item customize session owns the blur. */
export function useCanvasCustomizeBlurSessionActive(): boolean {
  const sessionOpen = useCanvasCustomizeStore(
    (s) => s.active && s.itemId != null && s.lift != null,
  )
  const blurReleasing = useCanvasCustomizeStore((s) => s.blurReleasing)
  const enterPhase = useCanvasCustomizeStore((s) => s.enterPhase)
  const editing = useUiCustomizationStore((s) => s.editing)
  const customizeBlurReady =
    enterPhase === 'lifting' || enterPhase === 'live' || blurReleasing
  return (sessionOpen && editing && customizeBlurReady) || blurReleasing
}

/**
 * Canvas customize reuses the selection blur stack for the whole session so we
 * do not stack a second backdrop-filter on the board.
 */
export function useCanvasCustomizeBlurHandoff() {
  const sessionOpen = useCanvasCustomizeStore(
    (s) => s.active && s.itemId != null && s.lift != null,
  )
  const blurReleasing = useCanvasCustomizeStore((s) => s.blurReleasing)
  const enterPhase = useCanvasCustomizeStore((s) => s.enterPhase)
  const editing = useUiCustomizationStore((s) => s.editing)
  const customizeBlurReady =
    enterPhase === 'lifting' || enterPhase === 'live' || blurReleasing
  const holdSelectionBlur =
    (sessionOpen && editing && customizeBlurReady) || blurReleasing
  return {
    holdSelectionBlur,
    blurReleasing,
    /** Fades selection blur layers; outlives portal exit via blurReleasing latch. */
    customizeBlurFading: blurReleasing,
    enterPhase,
  }
}
