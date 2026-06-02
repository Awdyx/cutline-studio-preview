import { Image, PenLine, StickyNote, Type } from 'lucide-react'
import { font } from '../styles/tokens'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useLassoStore, type LassoTargetType } from '../drawing/useLassoStore'

const LASSO_TARGET_OPTIONS: { id: LassoTargetType; label: string; Icon: typeof PenLine }[] = [
  { id: 'strokes', label: 'Strokes', Icon: PenLine },
  { id: 'sticky', label: 'Stickies', Icon: StickyNote },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'image', label: 'Images', Icon: Image },
]

export default function LassoTargetSettingsPanel() {
  const targets = useLassoStore((s) => s.targetTypes)
  const toggleLassoTarget = useLassoStore((s) => s.toggleTargetType)

  return (
    <div
      data-tool-settings=""
      data-lasso-target-settings=""
      className="lasso-target-settings lasso-target-settings--pill"
      style={{
        padding: '12px',
        fontFamily: font.family,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="lasso-target-settings__pill-track">
        {LASSO_TARGET_OPTIONS.map(({ id, label, Icon }) => {
          const active = targets.includes(id)
          return (
            <button
              key={id}
              type="button"
              data-lasso-target={id}
              aria-label={label}
              aria-pressed={active}
              className="lasso-target-settings__pill-btn"
              onMouseEnter={() => playSubmenuHover()}
              onClick={() => {
                if (targets.length === 1 && targets.includes(id)) {
                  const store = useShortcutUiStore.getState()
                  if (store.toast?.shortcutId === 'lasso-easter-egg') {
                    store.shakeActionToast()
                  } else {
                    store.showActionToast({
                      shortcutId: 'lasso-easter-egg',
                      label: "let's think about what we're trying to achieve",
                      keys: [],
                      holdMs: 2800,
                    })
                  }
                  return
                }
                playSubmenuTap()
                toggleLassoTarget(id)
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
