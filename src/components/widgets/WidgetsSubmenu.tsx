import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { playSubmenuHover, playSubmenuTap } from '../../sound/submenuSound'
import { useIsPhoneLayout } from '../../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../../styles/tokens'
import { phoneFabSheetStyle, phoneSubmenuSlideMotion } from '../../styles/phoneChrome'
import ChromeScrollFade from '../ChromeScrollFade'
import { SubmenuSoundScope } from '../SubmenuSoundScope'
import { useSubmenuPosition } from '../useSubmenuPosition'
import PhoneStackHeader from '../PhoneStackHeader'
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
  preview: React.ReactNode
}

type WidgetFamily = {
  name: string
  options: WidgetOption[]
}

const PREVIEW_HEIGHT = 88
const PANEL_WIDTH = 244
const PANEL_MAX_HEIGHT = 420
const PANEL_MENU_GAP = 18

const WIDGET_FAMILIES: WidgetFamily[] = [
  {
    name: 'Study',
    options: [
      { id: 'mcq', preview: <McqWidgetPreview /> },
      { id: 'saq', preview: <SaqWidgetPreview /> },
      { id: 'tutor', preview: <TutorWidgetPreview /> },
    ],
  },
  {
    name: 'Leaderboard',
    options: [
      { id: 'leaderboard_ranks', preview: <LeaderboardRanksPreview /> },
      { id: 'leaderboard_streak', preview: <LeaderboardStreakPreview /> },
    ],
  },
  {
    name: 'Forum',
    options: [
      { id: 'forum_threads', preview: <ForumThreadsPreview /> },
      { id: 'forum_chat', preview: <ForumChatPreview /> },
    ],
  },
  {
    name: 'UCAT',
    options: [
      { id: 'ucat_countdown', preview: <UcatCountdownPreview /> },
      { id: 'ucat_practice', preview: <UcatPracticePreview /> },
    ],
  },
  {
    name: 'To-do',
    options: [
      { id: 'todo', preview: <TodoWidgetPreview /> },
      { id: 'exam_countdown', preview: <ExamCountdownPreview /> },
    ],
  },
]

const familyNameStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
  margin: '0 0 12px',
}

function WidgetPickerCard({
  preview,
  onSelect,
}: {
  preview: React.ReactNode
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
        width: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: 12,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          height: PREVIEW_HEIGHT,
          width: '100%',
          overflow: 'hidden',
          borderRadius: 10,
        }}
      >
        {preview}
      </div>
    </button>
  )
}

interface WidgetsSubmenuProps {
  anchorRef: RefObject<HTMLElement | null>
  menuPanelRef: RefObject<HTMLElement | null>
  onSelectWidget?: (kind: WidgetKind) => void
  onBack?: () => void
}

export default function WidgetsSubmenu({
  anchorRef,
  menuPanelRef,
  onSelectWidget,
  onBack,
}: WidgetsSubmenuProps) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pos = useSubmenuPosition(anchorRef, {
    side: 'left',
    widthPx: PANEL_WIDTH,
    maxHeightPx: PANEL_MAX_HEIGHT,
    gapPx: PANEL_MENU_GAP,
    alignCenterToRef: menuPanelRef,
    horizontalAlignToRef: menuPanelRef,
    panelRef,
    enabled: mounted && !isPhone,
  })

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <motion.div
      ref={panelRef}
      data-plus-fab-submenu="widgets"
      {...(isPhone ? phoneSubmenuSlideMotion : {
        initial: { opacity: 0, scale: 0.96, x: 4 },
        animate: { opacity: 1, scale: 1, x: 0 },
        exit: { opacity: 0, scale: 0.96, x: 4 },
        transition: { duration: 0.18, ease: 'easeOut' },
      })}
      style={{
        ...(isPhone
          ? phoneFabSheetStyle({ zIndex: 42, maxHeight: 'min(70dvh, 560px)' })
          : {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: PANEL_WIDTH,
              maxHeight: pos.maxHeight,
            }),
        display: 'flex',
        flexDirection: 'column',
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        color: font.colorPrimary,
        overflow: 'hidden',
        zIndex: 40,
      }}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SubmenuSoundScope>
        {isPhone && onBack && <PhoneStackHeader title="Widgets" onBack={onBack} />}
        <ChromeScrollFade
          scrollStyle={{ padding: '0 14px' }}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {WIDGET_FAMILIES.map(({ name, options }) => (
            <section key={name}>
              <p style={familyNameStyle}>{chromeLabel(name)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {options.map(({ id, preview }) => (
                  <WidgetPickerCard
                    key={id}
                    preview={preview}
                    onSelect={() => onSelectWidget?.(id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </ChromeScrollFade>
      </SubmenuSoundScope>
    </motion.div>,
    document.body,
  )
}
