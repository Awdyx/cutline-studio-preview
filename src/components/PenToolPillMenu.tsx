import { useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Eraser, Highlighter, Pen } from 'lucide-react'
import { LassoIcon } from '../drawing/LassoIcon'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import type { PenToolMenuState } from '../drawing/usePenToolMenu'
import { PILL_PADDING, pillScreenRect, SEGMENT_WIDTH } from '../drawing/penToolMenuLayout'
import type { ToolMode } from '../drawing/toolStore'

const ICON_SIZE = 20
const ICON_STROKE = 2
const ICON_HALO_STROKE = 3

const PILL_OPEN_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 34,
  mass: 0.85,
}

const PILL_DISMISS_TRANSITION = {
  duration: 0.26,
  ease: [0.45, 0.05, 0.85, 0.45] as const,
}

const PILL_COMMIT_TRANSITION = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1] as const,
}

type ToolIconProps = {
  size?: number | string
  strokeWidth?: number | string
  className?: string
  stroke?: string
  color?: string
}

const TOOL_DEFS: { mode: ToolMode; Icon: ComponentType<ToolIconProps>; label: string }[] = [
  { mode: 'pen', Icon: Pen, label: 'Pen' },
  { mode: 'highlighter', Icon: Highlighter, label: 'Highlighter' },
  { mode: 'lasso', Icon: LassoIcon, label: 'Lasso' },
  { mode: 'erase', Icon: Eraser, label: 'Eraser' },
]

type PillMotionPhase = 'open' | 'dismiss' | 'commit'

function segmentOriginPercent(index: number, pillWidth: number): string {
  const centerPx = PILL_PADDING + SEGMENT_WIDTH * (index + 0.5)
  return `${(centerPx / pillWidth) * 100}%`
}

function PillToolIcon({
  Icon,
  emphasized,
}: {
  Icon: ComponentType<ToolIconProps>
  emphasized?: boolean
}) {
  return (
    <motion.span
      className="pen-tool-pill__icon"
      aria-hidden
      animate={
        emphasized
          ? { scale: [1, 1.22, 1.06], rotate: [0, -4, 0] }
          : { scale: 1, rotate: 0 }
      }
      transition={
        emphasized
          ? { duration: 0.34, ease: [0.22, 1, 0.36, 1], times: [0, 0.42, 1] }
          : { duration: 0.16 }
      }
    >
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
    </motion.span>
  )
}

type Props = {
  state: PenToolMenuState
  onCloseAnimationComplete?: () => void
}

export default function PenToolPillMenu({ state, onCloseAnimationComplete }: Props) {
  const isPhone = useIsPhoneLayout()
  const canvasEditEnabled = useCanvasEditStore((s) => s.enabled)
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const layoutRef = useRef(pillScreenRect(0, 0))
  const closeHandledRef = useRef(false)

  const visible = state.phase === 'open' || state.phase === 'closing'

  if (visible) {
    layoutRef.current = pillScreenRect(state.anchorX, state.anchorY, state.toolOrder)
  }

  const { left, top, width, height } = layoutRef.current
  const tools = state.toolOrder
    .map((mode) => TOOL_DEFS.find((tool) => tool.mode === mode))
    .filter((tool): tool is (typeof TOOL_DEFS)[number] => tool != null)

  const motionPhase: PillMotionPhase | null = !visible
    ? null
    : state.phase === 'closing'
      ? state.committedTool
        ? 'commit'
        : 'dismiss'
      : 'open'

  const committedIndex =
    state.committedTool == null
      ? -1
      : tools.findIndex((tool) => tool.mode === state.committedTool)

  const commitOrigin =
    committedIndex >= 0 ? segmentOriginPercent(committedIndex, width) : '100% 50%'

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (state.phase !== 'closing') {
      closeHandledRef.current = false
    }
  }, [state.phase])

  if (!mounted) return null
  if (isPhone && !canvasEditEnabled) return null

  return createPortal(
    visible && motionPhase != null ? (
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
          transformOrigin: motionPhase === 'commit' ? `${commitOrigin} 50%` : '100% 50%',
        }}
        initial={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, scaleX: 0.1, scaleY: 0.68, x: 14, filter: 'blur(10px)' }
        }
        animate={
          motionPhase === 'open'
            ? reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, scaleX: 1, scaleY: 1, x: 0, filter: 'blur(0px)' }
            : motionPhase === 'dismiss'
              ? reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    scaleX: 0.14,
                    scaleY: 0.72,
                    x: 16,
                    filter: 'blur(8px)',
                  }
              : reduceMotion
                ? { opacity: 0, scale: 0.94 }
                : {
                    opacity: [1, 1, 0],
                    scaleX: [1, 1.03, 0.1],
                    scaleY: [1, 1.06, 0.42],
                    x: [0, -3, 10],
                    filter: ['blur(0px)', 'blur(0px)', 'blur(6px)'],
                  }
        }
        transition={
          motionPhase === 'open'
            ? PILL_OPEN_SPRING
            : motionPhase === 'dismiss'
              ? PILL_DISMISS_TRANSITION
              : {
                  ...PILL_COMMIT_TRANSITION,
                  times: reduceMotion ? undefined : [0, 0.34, 1],
                }
        }
        onAnimationComplete={() => {
          if (state.phase !== 'closing' || closeHandledRef.current) return
          closeHandledRef.current = true
          onCloseAnimationComplete?.()
        }}
      >
        <div
          className={[
            'pen-tool-pill',
            motionPhase === 'commit' ? 'pen-tool-pill--committing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {tools.map(({ mode, Icon, label }, index) => {
            const hovered = state.hoveredTool === mode
            const committed = state.committedTool === mode
            const closing = state.phase === 'closing'
            const fadePeer = closing && state.committedTool != null && !committed

            return (
              <motion.div
                key={mode}
                className={[
                  'pen-tool-pill__segment',
                  hovered && !closing ? 'pen-tool-pill__segment--hovered' : '',
                  committed && closing ? 'pen-tool-pill__segment--committed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="img"
                aria-label={label}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.55, y: 6 }
                }
                animate={
                  fadePeer
                    ? { opacity: 0, scale: 0.72, y: 0 }
                    : closing && committed
                      ? { opacity: 1, scale: 1, y: 0 }
                      : closing
                        ? { opacity: 0.35, scale: 0.92, y: 2 }
                        : { opacity: 1, scale: 1, y: 0 }
                }
                transition={{
                  delay: motionPhase === 'open' && !reduceMotion ? index * 0.045 + 0.04 : 0,
                  duration:
                    motionPhase === 'open'
                      ? 0.28
                      : fadePeer
                        ? 0.14
                        : closing
                          ? 0.2
                          : 0.28,
                  ease: motionPhase === 'open' ? [0.22, 1, 0.36, 1] : [0.4, 0, 0.85, 0.45],
                }}
              >
                <PillToolIcon Icon={Icon} emphasized={committed && closing && !reduceMotion} />
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    ) : null,
    document.body,
  )
}
