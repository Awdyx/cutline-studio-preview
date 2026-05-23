import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Highlighter, Pen } from 'lucide-react'
import type { PenToolMenuState } from '../drawing/usePenToolMenu'
import { pillScreenRect } from '../drawing/penToolMenuLayout'
import type { ToolMode } from '../drawing/toolStore'
import { CHROME_MENU_TRANSITION } from '../styles/tokens'

const ICON_SIZE = 20
const ICON_STROKE = 2
/** Thin physical ring behind the glyph (theme-colored via --pill-icon-halo). */
const ICON_HALO_STROKE = 3

const tools: { mode: ToolMode; Icon: typeof Pen; label: string }[] = [
  { mode: 'pen', Icon: Pen, label: 'Pen' },
  { mode: 'highlighter', Icon: Highlighter, label: 'Highlighter' },
  { mode: 'erase', Icon: Eraser, label: 'Eraser' },
]

/** Same open/close as Cutline flyout submenus — slides in from the pencil anchor. */
const PEN_TOOL_PILL_MOTION = {
  initial: { opacity: 0, scale: 0.96, x: 4 },
  animate: { opacity: 1, scale: 1, x: 0 },
  exit: { opacity: 0, scale: 0.96, x: 4 },
  transition: CHROME_MENU_TRANSITION,
}

function PillToolIcon({ Icon }: { Icon: typeof Pen }) {
  return (
    <span className="pen-tool-pill__icon" aria-hidden>
      <Icon
        className="pen-tool-pill__icon-ring"
        size={ICON_SIZE}
        strokeWidth={ICON_HALO_STROKE}
        stroke="var(--pill-icon-halo)"
      />
      <Icon
        className="pen-tool-pill__icon-glyph"
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        color="var(--ui-text)"
      />
    </span>
  )
}

type Props = {
  state: PenToolMenuState
}

export default function PenToolPillMenu({ state }: Props) {
  const [mounted, setMounted] = useState(false)
  const layoutRef = useRef(pillScreenRect(0, 0))

  if (state.phase === 'open') {
    layoutRef.current = pillScreenRect(state.anchorX, state.anchorY)
  }

  const { left, top, width, height } = layoutRef.current

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence initial={false}>
      {state.phase === 'open' && (
        <motion.div
          key="pen-tool-pill"
          role="toolbar"
          aria-label="Drawing tools"
          style={{
            position: 'fixed',
            left,
            top,
            width,
            height,
            zIndex: 25,
            pointerEvents: 'none',
            transformOrigin: '100% 50%',
          }}
          {...PEN_TOOL_PILL_MOTION}
        >
          <div className="pen-tool-pill">
            {tools.map(({ mode, Icon, label }) => {
              const hovered = state.hoveredTool === mode

              return (
                <div
                  key={mode}
                  className={[
                    'pen-tool-pill__segment',
                    hovered ? 'pen-tool-pill__segment--hovered' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="img"
                  aria-label={label}
                >
                  <PillToolIcon Icon={Icon} />
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
