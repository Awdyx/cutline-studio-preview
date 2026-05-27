import UiPinView from './UiPinView'
import {
  usePinsForAnchor,
  useUiCustomizationStore,
} from './uiCustomizationStore'
import type { UiAnchorId } from './types'

/**
 * Pin host — rendered as the last child of every chrome anchor element.
 *
 * Pins are absolutely positioned relative to this host (which fills the anchor),
 * so they automatically follow the anchor as it moves, scales, or animates.
 */
export default function UiPinHost({ anchorId }: { anchorId: UiAnchorId }) {
  const pins = usePinsForAnchor(anchorId)
  const editing = useUiCustomizationStore((s) => s.editing)
  const selectedPinId = useUiCustomizationStore((s) => s.selectedPinId)
  const clipped = useUiCustomizationStore((s) =>
    s.clippedAnchorIds.has(anchorId),
  )
  // The pin toolbar is position:fixed (outside this host's stacking context),
  // so we can apply clipping immediately without waiting for pin deselection.
  const applyClipping = clipped

  if (pins.length === 0) return null

  return (
    <div
      data-ui-pin-host={anchorId}
      data-ui-pin-host-clipped={applyClipping ? '1' : undefined}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        // Pins are absolute children; the host itself shouldn't intercept
        // events except in edit mode where the pins enable their own pointer-events.
        pointerEvents: 'none',
        // Per-anchor clipping toggle: when on (and no pin currently selected),
        // pin content is trimmed to the chrome's bounds. When off, pins
        // extend past the anchor naturally.
        overflow: applyClipping ? 'hidden' : 'visible',
        borderRadius: applyClipping ? 'inherit' : undefined,
        // Ensure pins paint above the chrome's content but inside the anchor's stacking context.
        zIndex: 1,
      }}
    >
      {pins.map((pin) => (
        <UiPinView
          key={pin.id}
          pin={pin}
          editing={editing}
          selected={editing && selectedPinId === pin.id}
          anchorId={anchorId}
        />
      ))}
    </div>
  )
}
