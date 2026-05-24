import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, StickyNote, Layers, Type, Image, LayoutGrid } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import {
  CHROME_CARD_CLASS,
  CHROME_FROSTED_MENU_CLASS,
  CHROME_GLASS_CLASS,
  chromeFrostedMenuStyle,
  chromeMenuMotionY,
  chromeBottomRightFixed,
  card,
  font,
  glass,
  menuDividerStyle,
} from '../styles/tokens'
import { phoneFabSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { useShortcutUiStore, type ChromeMenuSoundOpts } from '../shortcuts/shortcutUiStore'
import { countSpaceWidgets, useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { MAX_SPACE_WIDGETS } from '../canvasItems/types'
import { MenuRow } from './MenuRow'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useCanvasMeshPauseWhile } from '../canvas/useCanvasMeshPause'
import WidgetsSubmenu from './widgets/WidgetsSubmenu'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import StudySubjectMenuRow from './study/StudySubjectMenuRow'
import { STUDY_SUBJECTS, type StudySubjectId } from './study/studyHubData'

type CanvasAddType = 'space' | 'sticky' | 'text' | 'image'

interface PlusFabProps {
  onAddToCanvas: (type: CanvasAddType) => void
  onStudySubjectSelect?: (subjectId: StudySubjectId) => void
  /** Spaces only exist on the main canvas — hide the option when inside a space. */
  showSpaceOption?: boolean
}

const ADD_TO_CANVAS_ITEMS: {
  icon: React.ElementType
  label: string
  type: CanvasAddType
}[] = [
  { icon: Layers, label: 'Space', type: 'space' },
  { icon: StickyNote, label: 'Sticky note', type: 'sticky' },
  { icon: Type, label: 'Text', type: 'text' },
  { icon: Image, label: 'Image', type: 'image' },
]

const PLUS_FAB_MENU_PAD_X = 16

const plusFabSectionHeaderTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
}

function PlusFabSectionHeader({
  children,
  first = false,
}: {
  children: React.ReactNode
  first?: boolean
}) {
  return (
    <p
      style={{
        ...plusFabSectionHeaderTextStyle,
        padding: first ? '20px 16px 10px' : '8px 16px 10px',
        paddingLeft: PLUS_FAB_MENU_PAD_X,
      }}
    >
      {children}
    </p>
  )
}

const plusFabSectionDividerStyle: React.CSSProperties = {
  ...menuDividerStyle,
  margin: '12px 16px',
}

const PLUS_FAB_MENU_MOTION = chromeMenuMotionY(4)

function MainMenuContent({
  onAddToCanvas,
  onWidgetsClick,
  onStudySubjectClick,
  showSpaceOption,
  spaceWidgetCount,
  widgetsAnchorRef,
}: {
  onAddToCanvas: (type: CanvasAddType) => void
  onWidgetsClick: () => void
  onStudySubjectClick: (subject: StudySubjectId) => void
  showSpaceOption: boolean
  spaceWidgetCount: number
  widgetsAnchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const addItems = showSpaceOption
    ? ADD_TO_CANVAS_ITEMS
    : ADD_TO_CANVAS_ITEMS.filter((i) => i.type !== 'space')
  const spacesFull = spaceWidgetCount >= MAX_SPACE_WIDGETS

  return (
    <>
      <PlusFabSectionHeader first>Add to canvas</PlusFabSectionHeader>
      {addItems.map(({ icon, label, type }) => (
        <MenuRow
          key={type}
          icon={icon}
          label={label}
          disabled={type === 'space' && spacesFull}
          right={
            type === 'space' ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: spacesFull ? font.colorFaint : font.colorMuted,
                  flexShrink: 0,
                }}
              >
                {spaceWidgetCount}/{MAX_SPACE_WIDGETS}
              </span>
            ) : undefined
          }
          onClick={() => onAddToCanvas(type)}
        />
      ))}
      <div ref={widgetsAnchorRef} data-plus-fab-submenu-anchor="widgets" style={{ paddingBottom: 10 }}>
        <MenuRow icon={LayoutGrid} label="Widgets" onClick={onWidgetsClick} />
      </div>

      <div style={plusFabSectionDividerStyle} />

      <PlusFabSectionHeader>Study</PlusFabSectionHeader>
      <div style={{ paddingBottom: 16 }}>
        {STUDY_SUBJECTS.map(({ id, label, icon, progress }) => (
          <StudySubjectMenuRow
            key={id}
            icon={icon}
            label={label}
            progress={progress}
            onClick={() => onStudySubjectClick(id)}
          />
        ))}
      </div>
    </>
  )
}

export default function PlusFab({
  onAddToCanvas,
  onStudySubjectSelect,
  showSpaceOption = true,
}: PlusFabProps) {
  const isPhone = useIsPhoneLayout()
  const [isOpen, setIsOpen] = useState(false)
  const [fabHoverScale, setFabHoverScale] = useState(false)
  const [widgetsSubmenuOpen, setWidgetsSubmenuOpen] = useState(false)
  const spaceWidgetCount = useCanvasItemsStore((s) => countSpaceWidgets(s.items))

  const containerRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const menuContentRef = useRef<HTMLDivElement>(null)
  const widgetsAnchorRef = useRef<HTMLDivElement>(null)
  const [menuShellHeight, setMenuShellHeight] = useState(440)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  useCanvasMeshPauseWhile(isOpen)

  function captureMenuShellHeight() {
    const h = menuContentRef.current?.scrollHeight
    if (h && h > 0) setMenuShellHeight(h)
  }

  function closeMenu(opts?: ChromeMenuSoundOpts) {
    if (!opts?.silent && isOpenRef.current) playSound('menuClose')
    setFabHoverScale(false)
    setWidgetsSubmenuOpen(false)
    setIsOpen(false)
  }

  function openMenu() {
    playSound('menuOpen')
    setFabHoverScale(false)
    setIsOpen(true)
  }

  function handleFabTriggerClick() {
    if (isOpen) {
      closeMenu()
      return
    }
    useShortcutUiStore.getState().dismissPeerChromeForFab('plus')
    openMenu()
  }

  function handleAddToCanvas(type: CanvasAddType) {
    onAddToCanvas(type)
    closeMenu({ silent: true })
  }

  function handleWidgetsClick() {
    setWidgetsSubmenuOpen((o) => !o)
  }

  function handleStudySubjectClick(subject: StudySubjectId) {
    closeMenu({ silent: true })
    playSound('menuOpen')
    onStudySubjectSelect?.(subject)
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    captureMenuShellHeight()
  }, [isOpen, showSpaceOption])

  useEffect(() => {
    useShortcutUiStore.getState().registerPlusFab({
      open: openMenu,
      close: closeMenu,
      isOpen: () => isOpenRef.current,
    })
    return () => useShortcutUiStore.getState().registerPlusFab(null)
  }, [])

  useEffect(() => {
    if (!isOpen) setWidgetsSubmenuOpen(false)
  }, [isOpen])

  useMenuOutsideDismiss({
    active: isOpen,
    panelRef: containerRef,
    onDismiss: (target) => {
      if (target.closest('[data-plus-fab-submenu-anchor]')) return

      if (containerRef.current?.contains(target)) {
        setWidgetsSubmenuOpen(false)
        return
      }

      setWidgetsSubmenuOpen(false)
      closeMenu()
    },
    isInside: (target) => !!target.closest('[data-plus-fab-submenu]'),
    dismissInsidePanel: widgetsSubmenuOpen,
  })

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (widgetsSubmenuOpen) {
        setWidgetsSubmenuOpen(false)
        return
      }
      closeMenu()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, widgetsSubmenuOpen])

  return (
    <div
      ref={containerRef}
      data-plus-fab=""
      style={{
        ...chromeBottomRightFixed,
        right: 'calc(16px + env(safe-area-inset-right, 0px))',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="fab-menu"
            ref={menuPanelRef}
            {...(isPhone ? phoneSubmenuSlideMotion : PLUS_FAB_MENU_MOTION)}
            className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
            style={{
              ...(isPhone
                ? phoneFabSheetStyle({ pointerEvents: 'auto' })
                : { width: 308, marginBottom: 12 }),
              ...chromeFrostedMenuStyle,
              borderRadius: card.radius,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            <SubmenuSoundScope>
              <div
                ref={menuContentRef}
                style={{
                  minHeight: menuShellHeight,
                }}
              >
                <MainMenuContent
                  onAddToCanvas={handleAddToCanvas}
                  onWidgetsClick={handleWidgetsClick}
                  onStudySubjectClick={handleStudySubjectClick}
                  showSpaceOption={showSpaceOption}
                  spaceWidgetCount={spaceWidgetCount}
                  widgetsAnchorRef={widgetsAnchorRef}
                />
              </div>
            </SubmenuSoundScope>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {widgetsSubmenuOpen && (
          <WidgetsSubmenu
            key="widgets-submenu"
            anchorRef={widgetsAnchorRef}
            menuPanelRef={menuPanelRef}
            onBack={() => setWidgetsSubmenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <button
        type="button"
        data-fab-trigger
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        onClick={handleFabTriggerClick}
        onMouseEnter={() => setFabHoverScale(true)}
        onMouseLeave={() => setFabHoverScale(false)}
        className={`chrome-fab-trigger theme-surface ${CHROME_GLASS_CLASS} ${
          isOpen ? 'chrome-fab-trigger--open' : ''
        } ${fabHoverScale ? 'chrome-fab-trigger--hover' : ''}`}
        style={{
          background: isOpen ? 'var(--card-bg)' : glass.bg,
          border: glass.border,
        }}
      >
        <Plus size={22} color="var(--ui-text)" strokeWidth={2} />
      </button>
    </div>
  )
}
