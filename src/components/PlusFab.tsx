import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  Sticker,
  StickyNote,
  Image,
  CheckSquare,
  FileText,
  BookOpen,
  ChevronLeft,
  X,
} from 'lucide-react'
import { card, font, glass } from '../styles/tokens'

type CanvasAddType = 'widget' | 'sticky' | 'image'
type StudyActionType = 'mcq' | 'saq' | 'mini_exam'
type Subject = 'HU' | 'CE' | 'CH' | 'PH'

interface PlusFabProps {
  onAddToCanvas: (type: CanvasAddType) => void
  onStudyAction: (action: {
    type: StudyActionType
    subject: Subject
  }) => void
}

const SUBJECTS: { code: Subject; color: string }[] = [
  { code: 'HU', color: '#e87a73' },
  { code: 'CE', color: '#8b9dc3' },
  { code: 'CH', color: '#a3c4a3' },
  { code: 'PH', color: '#d4b08a' },
]

const STUDY_ACTION_LABELS: Record<StudyActionType, string> = {
  mcq: 'MCQs from…',
  saq: 'SAQs from…',
  mini_exam: 'Mini exam from…',
}

const ADD_TO_CANVAS_ITEMS: {
  icon: React.ElementType
  label: string
  type: CanvasAddType
}[] = [
  { icon: Sticker, label: 'Widget', type: 'widget' },
  { icon: StickyNote, label: 'Sticky note', type: 'sticky' },
  { icon: Image, label: 'Image', type: 'image' },
]

const STUDY_ITEMS: {
  icon: React.ElementType
  label: string
  type: StudyActionType
}[] = [
  { icon: CheckSquare, label: 'MCQs', type: 'mcq' },
  { icon: FileText, label: 'SAQs', type: 'saq' },
  { icon: BookOpen, label: 'Mini exam', type: 'mini_exam' },
]

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: font.colorMuted,
  padding: '12px 16px 6px',
  margin: 0,
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: 'rgba(20, 30, 50, 0.07)',
  margin: '4px 0',
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
        {label}
      </span>
    </button>
  )
}

function MainMenuContent({
  onAddToCanvas,
  onStudyItemClick,
}: {
  onAddToCanvas: (type: CanvasAddType) => void
  onStudyItemClick: (type: StudyActionType) => void
}) {
  return (
    <>
      <p style={sectionHeaderStyle}>Add to canvas</p>
      {ADD_TO_CANVAS_ITEMS.map(({ icon, label, type }) => (
        <MenuRow
          key={type}
          icon={icon}
          label={label}
          onClick={() => onAddToCanvas(type)}
        />
      ))}

      <div style={dividerStyle} />

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

function SubjectPickerContent({
  pendingAction,
  onBack,
  onClose,
  onSubjectSelect,
}: {
  pendingAction: StudyActionType
  onBack: () => void
  onClose: () => void
  onSubjectSelect: (subject: Subject) => void
}) {
  return (
    <>
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
          {STUDY_ACTION_LABELS[pendingAction]}
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

export default function PlusFab({ onAddToCanvas, onStudyAction }: PlusFabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'main' | 'subject-picker'>('main')
  const [pendingAction, setPendingAction] = useState<StudyActionType | null>(
    null,
  )
  const [fabHovered, setFabHovered] = useState(false)
  const [morphDirection, setMorphDirection] = useState<'forward' | 'back'>(
    'forward',
  )

  const containerRef = useRef<HTMLDivElement>(null)

  function resetView() {
    setView('main')
    setPendingAction(null)
    setMorphDirection('forward')
  }

  function closeMenu() {
    setIsOpen(false)
    resetView()
  }

  function handleAddToCanvas(type: CanvasAddType) {
    onAddToCanvas(type)
    closeMenu()
  }

  function handleStudyItemClick(type: StudyActionType) {
    setMorphDirection('forward')
    setPendingAction(type)
    setView('subject-picker')
  }

  function handleSubjectSelect(subject: Subject) {
    if (!pendingAction) return
    onStudyAction({ type: pendingAction, subject })
    closeMenu()
  }

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
            layout
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              width: 280,
              marginBottom: 12,
              background: card.bg,
              backdropFilter: card.blur,
              WebkitBackdropFilter: card.blur,
              border: card.border,
              boxShadow: card.shadow,
              borderRadius: card.radius,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'hidden',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {view === 'main' || !pendingAction ? (
                <motion.div
                  key="main"
                  initial={{
                    opacity: 0,
                    x: morphDirection === 'back' ? -20 : 20,
                  }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{
                    opacity: 0,
                    x: morphDirection === 'forward' ? -20 : 20,
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <MainMenuContent
                    onAddToCanvas={handleAddToCanvas}
                    onStudyItemClick={handleStudyItemClick}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="subject-picker"
                  initial={{
                    opacity: 0,
                    x: morphDirection === 'forward' ? 20 : -20,
                  }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{
                    opacity: 0,
                    x: morphDirection === 'back' ? 20 : -20,
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <SubjectPickerContent
                    pendingAction={pendingAction}
                    onBack={() => {
                      setMorphDirection('back')
                      setView('main')
                      setPendingAction(null)
                    }}
                    onClose={closeMenu}
                    onSubjectSelect={handleSubjectSelect}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        data-fab-trigger
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        animate={{
          scale: fabHovered ? 1.05 : 1,
          rotate: isOpen ? 45 : 0,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isOpen ? 'rgba(255, 255, 255, 0.72)' : glass.bg,
          backdropFilter: glass.blur,
          WebkitBackdropFilter: glass.blur,
          border: glass.border,
          boxShadow: fabHovered
            ? '0 8px 32px rgba(20, 30, 50, 0.14)'
            : glass.shadow,
          transition: 'background 200ms ease-out, box-shadow 200ms ease-out',
          flexShrink: 0,
        }}
      >
        <Plus size={22} color={font.colorPrimary} strokeWidth={2} />
      </motion.button>
    </div>
  )
}
