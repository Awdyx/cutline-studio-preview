import { memo, type RefObject } from 'react'
import { X } from 'lucide-react'
import StudyHubPanel from '../components/study/StudyHubPanel'
import StudyHubPracticePicker, {
  type StudyPracticeSelection,
} from '../components/study/StudyHubPracticePicker'
import { STUDY_SUBJECTS, STUDY_SUBJECT_CATALOG } from '../components/study/studyHubData'
import {
  CHROME_PRESERVE_CASE_CLASS,
  chromeFrostedMenuStyle,
  font,
} from '../styles/tokens'
import type { StudySubjectId } from './types'

const MemoStudyHubPanel = memo(StudyHubPanel)

export default function StudyHubWidget({
  subjectId,
  practice,
  onPracticeChange,
  scrollRef,
  showDismiss,
  onDismiss,
  perfDrag = false,
}: {
  subjectId: StudySubjectId
  practice: StudyPracticeSelection
  onPracticeChange: (next: StudyPracticeSelection) => void
  scrollRef?: RefObject<HTMLDivElement | null>
  showDismiss?: boolean
  onDismiss?: (e: React.MouseEvent | React.PointerEvent) => void
  perfDrag?: boolean
}) {
  const catalog = STUDY_SUBJECT_CATALOG[subjectId]
  const SubjectIcon = STUDY_SUBJECTS.find((s) => s.id === subjectId)?.icon

  return (
    <div
      className={`study-hub-widget theme-surface plus-fab-menu-glass ${CHROME_PRESERVE_CASE_CLASS}${perfDrag ? ' study-hub-widget--perf-drag' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...chromeFrostedMenuStyle,
        background: 'var(--study-hub-surface-bg, var(--glass-bg))',
        fontFamily: font.family,
        color: font.colorPrimary,
        overflow: 'hidden',
      }}
    >
      {showDismiss && onDismiss && (
        <button
          type="button"
          className="study-hub-menu-dismiss"
          aria-label="Return to previous canvas view"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDismiss}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 22px 14px',
          flexShrink: 0,
        }}
      >
        {SubjectIcon && (
          <SubjectIcon
            size={20}
            strokeWidth={1.8}
            color={font.colorMuted}
            style={{ flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: '0.04em',
              color: font.colorPrimary,
            }}
          >
            {catalog.paperCode}
          </p>
        </div>
      </header>

      <StudyHubPracticePicker value={practice} onChange={onPracticeChange} />

      <div
        ref={scrollRef}
        className="study-hub-scroll"
        style={{
          flex: 1,
          overflowY: perfDrag ? 'hidden' : 'auto',
          padding: '10px 22px 22px',
          minHeight: 0,
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          pointerEvents: perfDrag ? 'none' : undefined,
        }}
      >
        <MemoStudyHubPanel subjectId={subjectId} practice={practice} />
      </div>
    </div>
  )
}
