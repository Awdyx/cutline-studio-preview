import { Image, PenLine, StickyNote, Type } from 'lucide-react'
import { font } from '../styles/tokens'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useEraserStore, type EraserTargetType } from '../drawing/useEraserStore'

const ERASER_TARGET_OPTIONS: { id: EraserTargetType; label: string; Icon: typeof PenLine }[] = [
  { id: 'strokes', label: 'Strokes', Icon: PenLine },
  { id: 'sticky', label: 'Stickies', Icon: StickyNote },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'image', label: 'Images', Icon: Image },
]

export default function EraserTargetSettingsPanel() {
  const targets = useEraserStore((s) => s.targetTypes)
  const toggleEraserTarget = useEraserStore((s) => s.toggleTargetType)

  return (
    <div
      data-tool-settings=""
      data-eraser-target-settings=""
      className="lasso-target-settings lasso-target-settings--pill"
      style={{
        padding: '12px',
        fontFamily: font.family,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="lasso-target-settings__pill-track">
        {ERASER_TARGET_OPTIONS.map(({ id, label, Icon }) => {
          const active = targets.includes(id)
          return (
            <button
              key={id}
              type="button"
              data-eraser-target={id}
              aria-label={label}
              aria-pressed={active}
              className="lasso-target-settings__pill-btn"
              onMouseEnter={() => playSubmenuHover()}
              onClick={() => {
                if (targets.length === 1 && targets.includes(id)) {
                  const store = useShortcutUiStore.getState()
                  if (store.toast?.shortcutId === 'eraser-easter-egg') {
                    store.shakeActionToast()
                  } else {
                    store.showActionToast({
                      shortcutId: 'eraser-easter-egg',
                      label: "let's think about what we're trying to achieve",
                      keys: [],
                      holdMs: 2800,
                    })
                  }
                  return
                }
                playSubmenuTap()
                toggleEraserTarget(id)
              }}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
