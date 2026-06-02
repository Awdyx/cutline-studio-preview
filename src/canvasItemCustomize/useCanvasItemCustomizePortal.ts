import { canvasItemUiAnchorId } from '../uiCustomization/types'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import {
  isCanvasCustomizeTarget,
  useCanvasCustomizeLift,
  useCanvasCustomizeStore,
} from './canvasCustomizeStore'

/**
 * Whether this item should portal to the customize stage and hide its canvas shell.
 */
export function useCanvasItemCustomizePortal(itemId: string, enabled = true) {
  const active = useCanvasCustomizeStore((s) => s.active)
  const lift = useCanvasCustomizeLift(itemId)
  const anchorId = canvasItemUiAnchorId(itemId)

  const focusedAnchorId = useUiCustomizationStore((s) => s.focusedAnchorId)
  const sessionTarget =
    enabled && active && focusedAnchorId === anchorId

  const portalActive = enabled && isCanvasCustomizeTarget(itemId) && lift != null

  const clipped = useUiCustomizationStore((s) =>
    s.clippedAnchorIds.has(anchorId),
  )

  return {
    sessionTarget,
    portalActive,
    lift,
    clipOverflow: clipped,
  }
}
