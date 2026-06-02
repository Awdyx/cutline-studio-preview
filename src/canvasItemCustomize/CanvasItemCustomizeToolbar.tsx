import { Check, Crop } from 'lucide-react'
import type { UiAnchorId } from '../uiCustomization/types'
import { UiCustomizeFocusButton } from '../uiCustomization/UiCustomizeFocusButton'

export default function CanvasItemCustomizeToolbar({
  focusedAnchorId,
  focusedAnchorClipped,
  onDone,
  onToggleClipping,
}: {
  focusedAnchorId: UiAnchorId
  focusedAnchorClipped: boolean
  onDone: () => void
  onToggleClipping: () => void
}) {
  return (
    <div
      data-ui-customization-toolbar=""
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      <UiCustomizeFocusButton
        ariaLabel="Done customizing"
        icon={<Check size={14} strokeWidth={2.4} />}
        label="done"
        onClick={onDone}
      />
      <UiCustomizeFocusButton
        ariaLabel={
          focusedAnchorClipped
            ? 'Disable clipping for this element'
            : 'Enable clipping for this element'
        }
        ariaPressed={focusedAnchorClipped}
        icon={<Crop size={14} strokeWidth={2.2} />}
        label="clipping"
        active={focusedAnchorClipped}
        onClick={onToggleClipping}
      />
    </div>
  )
}
