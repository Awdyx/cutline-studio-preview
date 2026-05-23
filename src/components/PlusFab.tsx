import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  StickyNote,
  Layers,
  Type,
  Image,
  CheckSquare,
  FileText,
  BookOpen,
  GraduationCap,
  MessageCircle,
  MessageCircleQuestion,
  Book,
  ChevronLeft,
  X,
} from 'lucide-react'
import {
  CHROME_CARD_CLASS,
  CHROME_GLASS_CLASS,
  chromeLabel,
  card,
  font,
  glass,
  menuDividerStyle,
} from '../styles/tokens'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'

type CanvasAddType = 'space' | 'sticky' | 'text' | 'image'
type StudyActionType = 'mcq' | 'saq' | 'mini_exam'
type TutorActionType = 'request_explanation' | 'dm' | 'textbook'
type Subject = 'HU' | 'CE' | 'CH' | 'PH'
type FabView = 'main' | 'tutor-menu' | 'subject-picker'

export type StudyAction =
  | { type: StudyActionType; subject: Subject }
  | { type: 'tutor'; tutorAction: TutorActionType; subject: Subject }

interface PlusFabProps {
  onAddToCanvas: (type: CanvasAddType) => void
  onStudyAction: (action: StudyAction) => void
  /** Spaces only exist on the main canvas — hide the option when inside a space. */
  showSpaceOption?: boolean
}

const SUBJECTS: { code: Subject; color: string }[] = [
  { code: 'HU', color: '#e87a73' },
  { code: 'CE', color: '#8b9dc3' },
  { code: 'CH', color: '#a3c4a3' },
  { code: 'PH', color: '#d4b08a' },
]

const STUDY_SUBJECT_LABELS: Record<StudyActionType, string> = {
  mcq: 'MCQs from…',
  saq: 'SAQs from…',
  mini_exam: 'Mini exam from…',
}

const TUTOR_SUBJECT_LABELS: Record<TutorActionType, string> = {
  request_explanation: 'Request tutor explanation from…',
  dm: 'DM tutor from…',
  textbook: 'Textbook from…',
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

const STUDY_ITEMS: {
  icon: React.ElementType
  label: string
  type: StudyActionType | 'tutor'
}[] = [
  { icon: CheckSquare, label: 'MCQs', type: 'mcq' },
  { icon: FileText, label: 'SAQs', type: 'saq' },
  { icon: BookOpen, label: 'Mini exam', type: 'mini_exam' },
  { icon: GraduationCap, label: 'Tutor', type: 'tutor' },
]

const TUTOR_ITEMS: {
  icon: React.ElementType
  label: string
  type: TutorActionType
}[] = [
  {
    icon: MessageCircleQuestion,
    label: 'Request tutor explanation',
    type: 'request_explanation',
  },
  { icon: MessageCircle, label: 'DM tutor', type: 'dm' },
  { icon: Book, label: 'Textbook', type: 'textbook' },
]

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
  padding: '12px 16px 6px',
  margin: 0,
}

/** Snappy glass morph — no horizontal slide, no layout shrink. */
const FAB_VIEW_SPRING = {
  type: 'spring' as const,
  stiffness: 640,
  damping: 38,
  mass: 0.52,
}

const FAB_MENU_OPEN_TRANSITION = {
  opacity: { duration: 0.11, ease: [0.22, 1, 0.36, 1] as const },
  scale: FAB_VIEW_SPRING,
  y: FAB_VIEW_SPRING,
  filter: { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const },
}

const FAB_VIEW_TRANSITION = {
  opacity: { duration: 0.1, ease: [0.22, 1, 0.36, 1] as const },
  scale: FAB_VIEW_SPRING,
  filter: { duration: 0.12, ease: [0.22, 1, 0.36, 1] as const },
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  dotColor,
}: {
  icon?: React.ElementType
  label: string
  onClick: () => void
  dotColor?: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: hovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: font.family,
        transition: 'background 150ms ease',
      }}
    >
      {dotColor ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
      ) : Icon ? (
        <Icon
          size={16}
          strokeWidth={1.8}
          color={font.colorMuted}
          style={{ flexShrink: 0 }}
        />
      ) : null}
      <span style={{ fontSize: 14, fontWeight: 400, color: font.colorPrimary }}>
        {chromeLabel(label)}
      </span>
    </button>
  )
}

function SubmenuHeader({
  title,
  onBack,
  onClose,
}: {
  title: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 12px 8px',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
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
          color: font.colorPrimary,
        }}
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: font.colorPrimary,
          flex: 1,
          textAlign: 'center',
        }}
      >
        {chromeLabel(title)}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
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
    </div>
  )
}

function MainMenuContent({
  onAddToCanvas,
  onStudyItemClick,
  showSpaceOption,
}: {
  onAddToCanvas: (type: CanvasAddType) => void
  onStudyItemClick: (type: StudyActionType | 'tutor') => void
  showSpaceOption: boolean
}) {
  const addItems = showSpaceOption
    ? ADD_TO_CANVAS_ITEMS
    : ADD_TO_CANVAS_ITEMS.filter((i) => i.type !== 'space')

  return (
    <>
      <p style={sectionHeaderStyle}>Add to canvas</p>
      {addItems.map(({ icon, label, type }) => (
        <MenuRow
          key={type}
          icon={icon}
          label={label}
          onClick={() => onAddToCanvas(type)}
        />
      ))}

      <div style={menuDividerStyle} />

      <p style={sectionHeaderStyle}>Study</p>
      {STUDY_ITEMS.map(({ icon, label, type }) => (
        <MenuRow
          key={type}
          icon={icon}
          label={label}
          onClick={() => onStudyItemClick(type)}
        />
      ))}
    </>
  )
}

function TutorMenuContent({
  onBack,
  onClose,
  onTutorItemClick,
}: {
  onBack: () => void
  onClose: () => void
  onTutorItemClick: (type: TutorActionType) => void
}) {
  return (
    <>
      <SubmenuHeader title="Tutor" onBack={onBack} onClose={onClose} />
      {TUTOR_ITEMS.map(({ icon, label, type }) => (
        <MenuRow
          key={type}
          icon={icon}
          label={label}
          onClick={() => onTutorItemClick(type)}
        />
      ))}
    </>
  )
}

function SubjectPickerContent({
  title,
  onBack,
  onClose,
  onSubjectSelect,
}: {
  title: string
  onBack: () => void
  onClose: () => void
  onSubjectSelect: (subject: Subject) => void
}) {
  return (
    <>
      <SubmenuHeader title={title} onBack={onBack} onClose={onClose} />
      {SUBJECTS.map(({ code, color }) => (
        <MenuRow
          key={code}
          label={code}
          dotColor={color}
          onClick={() => onSubjectSelect(code)}
        />
      ))}
    </>
  )
}

function FabViewPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
      transition={FAB_VIEW_TRANSITION}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        willChange: 'opacity, transform, filter',
      }}
    >
      {children}
    </motion.div>
  )
}

export default function PlusFab({
  onAddToCanvas,
  onStudyAction,
  showSpaceOption = true,
}: PlusFabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<FabView>('main')
  const [pendingStudyAction, setPendingStudyAction] =
    useState<StudyActionType | null>(null)
  const [pendingTutorAction, setPendingTutorAction] =
    useState<TutorActionType | null>(null)
  const [fabHovered, setFabHovered] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const menuStackRef = useRef<HTMLDivElement>(null)
  const [menuShellHeight, setMenuShellHeight] = useState(384)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  function captureMenuShellHeight() {
    const h = menuStackRef.current?.offsetHeight
    if (h && h > 0) setMenuShellHeight(h)
  }

  function resetView() {
    setView('main')
    setPendingStudyAction(null)
    setPendingTutorAction(null)
  }

  function closeMenu() {
    if (isOpenRef.current) playSound('menuClose')
    setIsOpen(false)
    resetView()
  }

  function openMenu() {
    playSound('menuOpen')
    setIsOpen(true)
  }

  function handleAddToCanvas(type: CanvasAddType) {
    onAddToCanvas(type)
    closeMenu()
  }

  function handleStudyItemClick(type: StudyActionType | 'tutor') {
    captureMenuShellHeight()
    if (type === 'tutor') {
      setPendingStudyAction(null)
      setPendingTutorAction(null)
      setView('tutor-menu')
      return
    }
    setPendingTutorAction(null)
    setPendingStudyAction(type)
    setView('subject-picker')
  }

  function handleTutorItemClick(type: TutorActionType) {
    captureMenuShellHeight()
    setPendingStudyAction(null)
    setPendingTutorAction(type)
    setView('subject-picker')
  }

  function handleSubjectSelect(subject: Subject) {
    if (pendingTutorAction) {
      onStudyAction({ type: 'tutor', tutorAction: pendingTutorAction, subject })
    } else if (pendingStudyAction) {
      onStudyAction({ type: pendingStudyAction, subject })
    } else {
      return
    }
    closeMenu()
  }

  function subjectPickerTitle(): string {
    if (pendingTutorAction) return TUTOR_SUBJECT_LABELS[pendingTutorAction]
    if (pendingStudyAction) return STUDY_SUBJECT_LABELS[pendingStudyAction]
    return ''
  }

  function handleSubjectPickerBack() {
    if (pendingTutorAction) {
      setPendingTutorAction(null)
      setView('tutor-menu')
      return
    }
    setPendingStudyAction(null)
    setView('main')
  }

  useLayoutEffect(() => {
    if (!isOpen || view !== 'main') return
    captureMenuShellHeight()
  }, [isOpen, view, showSpaceOption])

  useEffect(() => {
    useShortcutUiStore.getState().registerPlusFab({
      open: openMenu,
      close: closeMenu,
      isOpen: () => isOpenRef.current,
    })
    return () => useShortcutUiStore.getState().registerPlusFab(null)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="fab-menu"
            initial={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: 6, filter: 'blur(10px)' }}
            transition={FAB_MENU_OPEN_TRANSITION}
            className={`theme-surface ${CHROME_GLASS_CLASS} ${CHROME_CARD_CLASS} plus-fab-menu-glass`}
            style={{
              width: 280,
              marginBottom: 12,
              background: glass.bg,
              border: glass.border,
              borderRadius: card.radius,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'hidden',
            }}
          >
            <div
              ref={menuStackRef}
              style={{
                position: 'relative',
                minHeight: menuShellHeight,
              }}
            >
              <AnimatePresence mode="sync" initial={false}>
                {view === 'main' && (
                  <FabViewPanel key="main">
                    <MainMenuContent
                      onAddToCanvas={handleAddToCanvas}
                      onStudyItemClick={handleStudyItemClick}
                      showSpaceOption={showSpaceOption}
                    />
                  </FabViewPanel>
                )}
                {view === 'tutor-menu' && (
                  <FabViewPanel key="tutor-menu">
                    <TutorMenuContent
                      onBack={() => setView('main')}
                      onClose={closeMenu}
                      onTutorItemClick={handleTutorItemClick}
                    />
                  </FabViewPanel>
                )}
                {view === 'subject-picker' && (
                  <FabViewPanel key="subject-picker">
                    <SubjectPickerContent
                      title={subjectPickerTitle()}
                      onBack={handleSubjectPickerBack}
                      onClose={closeMenu}
                      onSubjectSelect={handleSubjectSelect}
                    />
                  </FabViewPanel>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        data-fab-trigger
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        animate={{
          scale: fabHovered ? 1.05 : 1,
          rotate: isOpen ? 45 : 0,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isOpen ? 'var(--card-bg)' : glass.bg,
          border: glass.border,
          boxShadow: fabHovered ? 'var(--card-shadow)' : glass.shadow,
          transition:
            'background 200ms ease-out, box-shadow 200ms ease-out, background-color 400ms ease',
          flexShrink: 0,
        }}
      >
        <Plus size={22} color="var(--ui-text)" strokeWidth={2} />
      </motion.button>
    </div>
  )
}
