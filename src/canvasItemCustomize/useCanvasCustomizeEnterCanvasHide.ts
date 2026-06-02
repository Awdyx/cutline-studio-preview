import { useCanvasCustomizeStore } from './canvasCustomizeStore'

/** Hide canvas once the portaled lift origin has painted — set in portal useLayoutEffect. */
export function useCanvasCustomizeEnterCanvasHide(
  itemId: string,
  showCustomizePortal: boolean,
  customizeExiting: boolean,
): boolean {
  const enterPhase = useCanvasCustomizeStore((s) =>
    s.itemId === itemId ? s.enterPhase : 'idle',
  )
  const enterCanvasHideReady = useCanvasCustomizeStore((s) =>
    s.itemId === itemId ? s.enterCanvasHideReady : false,
  )

  return (
    showCustomizePortal &&
    !customizeExiting &&
    enterPhase !== 'staging' &&
    enterCanvasHideReady
  )
}
