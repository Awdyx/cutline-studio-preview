import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { playSubmenuHover, playSubmenuTap } from '../../sound/submenuSound'
import {
  CHROME_CARD_CLASS,
  CHROME_GLASS_CLASS,
  CHROME_MENU_TRANSITION,
  card,
  chromeLabel,
  font,
  glass,
} from '../../styles/tokens'
import { useCanvasMeshPauseWhile } from '../../canvas/useCanvasMeshPause'
import { ForumChatPreview } from './ForumChatPreview'
import {
  ForumThreadsPreview,
  ExamCountdownPreview,
  LeaderboardRanksPreview,
  LeaderboardStreakPreview,
  McqWidgetPreview,
  SaqWidgetPreview,
  TodoWidgetPreview,
  TutorWidgetPreview,
  UcatCountdownPreview,
  UcatPracticePreview,
} from './WidgetPreviews'

export type WidgetKind =
  | 'todo'
  | 'exam_countdown'
  | 'mcq'
  | 'saq'
  | 'tutor'
  | 'leaderboard_ranks'
  | 'leaderboard_streak'
  | 'forum_threads'
  | 'forum_chat'
  | 'ucat_countdown'
  | 'ucat_practice'

type WidgetOption = {
  id: WidgetKind
  label: string
  preview: React.ReactNode
}

type WidgetFamily = {
  name: string
  options: WidgetOption[]
}

const PREVIEW_HEIGHT = 120
const CARD_WIDTH = 164
const CARD_GAP = 10
const COLUMNS = 3
const H_PAD = 40

/** Exact width for a 3-card row — modal hugs content, no dead space. */
const PANEL_WIDTH = COLUMNS * CARD_WIDTH + (COLUMNS - 1) * CARD_GAP + H_PAD

const WIDGET_FAMILIES: WidgetFamily[] = [
  {
    name: 'Study',
    options: [
      { id: 'mcq', label: 'MCQ', preview: <McqWidgetPreview /> },
      { id: 'saq', label: 'SAQ', preview: <SaqWidgetPreview /> },
      { id: 'tutor', label: 'Tutor', preview: <TutorWidgetPreview /> },
    ],
  },
  {
    name: 'Leaderboard',
    options: [
      { id: 'leaderboard_ranks', label: 'Rankings', preview: <LeaderboardRanksPreview /> },
      { id: 'leaderboard_streak', label: 'Streak', preview: <LeaderboardStreakPreview /> },
    ],
  },
  {
    name: 'Forum',
    options: [
      { id: 'forum_threads', label: 'Threads', preview: <ForumThreadsPreview /> },
      { id: 'forum_chat', label: 'Live chat', preview: <ForumChatPreview /> },
    ],
  },
  {
    name: 'UCAT',
    options: [
      { id: 'ucat_countdown', label: 'Countdown', preview: <UcatCountdownPreview /> },
      { id: 'ucat_practice', label: 'Quick drill', preview: <UcatPracticePreview /> },
    ],
  },
  {
    name: 'To-do',
    options: [
      { id: 'todo', label: 'List', preview: <TodoWidgetPreview /> },
      { id: 'exam_countdown', label: 'Exam countdown', preview: <ExamCountdownPreview /> },
    ],
  },
]

const familyNameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: font.colorPrimary,
  margin: '0 0 8px',
  opacity: 0.72,
}

function rowWidthForCount(count: number): number {
  const n = Math.min(count, COLUMNS)
  return n * CARD_WIDTH + (n - 1) * CARD_GAP
}

function cardWidthForCount(count: number): number {
  if (count >= COLUMNS) return CARD_WIDTH
  return (rowWidthForCount(COLUMNS) - (count - 1) * CARD_GAP) / count
}

function WidgetPickerCard({
  label,
  preview,
  width,
  onSelect,
}: {
  label: string
  preview: React.ReactNode
  width: number
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playSubmenuTap()
        onSelect()
      }}
      onMouseEnter={() => playSubmenuHover()}
      className="widget-picker-card"
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: 14,
        textAlign: 'left',
      }}
    >
      <div style={{ height: PREVIEW_HEIGHT, width: '100%' }}>{preview}</div>
      <span
        className="ui-chrome-preserve-case"
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: font.colorMuted,
          paddingLeft: 2,
        }}
      >
        {label}
      </span>
    </button>
  )
}

function WidgetRow({ options, onSelect }: { options: WidgetOption[]; onSelect: (id: WidgetKind) => void }) {
  const cardW = cardWidthForCount(options.length)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: CARD_GAP,
        width: rowWidthForCount(COLUMNS),
      }}
    >
      {options.map(({ id, label, preview }) => (
        <WidgetPickerCard
          key={id}
          label={label}
          preview={preview}
          width={cardW}
          onSelect={() => onSelect(id)}
        />
      ))}
    </div>
  )
}

interface WidgetPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectWidget?: (kind: WidgetKind) => void
}

export default function WidgetPickerModal({
  isOpen,
  onClose,
  onSelectWidget,
}: WidgetPickerModalProps) {
  const [mounted, setMounted] = useState(false)
  useCanvasMeshPauseWhile(isOpen)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="widget-picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CHROME_MENU_TRANSITION}
            onMouseDown={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(20, 30, 50, 0.18)',
              zIndex: 60,
            }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 61,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              key="widget-picker-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Widgets"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={CHROME_MENU_TRANSITION}
              onMouseDown={(e) => e.stopPropagation()}
              className={`theme-surface ${CHROME_GLASS_CLASS} ${CHROME_CARD_CLASS}`}
              style={{
                width: PANEL_WIDTH,
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: 'min(82vh, 680px)',
                display: 'flex',
                flexDirection: 'column',
                background: glass.bg,
                border: glass.border,
                boxShadow: card.shadow,
                borderRadius: card.radius,
                fontFamily: font.family,
                color: font.colorPrimary,
                overflow: 'hidden',
                pointerEvents: 'auto',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px 12px',
                  flexShrink: 0,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {chromeLabel('Widgets')}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    playSubmenuTap()
                    onClose()
                  }}
                  onMouseEnter={() => playSubmenuHover()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    background: 'none',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: font.colorMuted,
                  }}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </header>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0 20px 20px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {WIDGET_FAMILIES.map(({ name, options }) => (
                    <div key={name}>
                      <p className="ui-chrome-preserve-case" style={familyNameStyle}>
                        {name}
                      </p>
                      <WidgetRow
                        options={options}
                        onSelect={(id) => onSelectWidget?.(id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <footer
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 20px 16px',
                  borderTop: '1px solid var(--ui-divider)',
                  flexShrink: 0,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: font.colorMuted }}>
                  {chromeLabel('Drag a widget onto the canvas to add it')}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  onMouseEnter={() => playSubmenuHover()}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ui-accent)',
                    color: '#fff',
                    fontFamily: font.family,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {chromeLabel('Done')}
                </button>
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
