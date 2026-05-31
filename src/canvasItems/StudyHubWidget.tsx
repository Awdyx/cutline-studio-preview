import { memo, type RefObject } from 'react'
import { X } from 'lucide-react'
import StudyHubPanel from '../components/study/StudyHubPanel'
import StudyHubPracticePicker, {
  type StudyPracticeSelection,
} from '../components/study/StudyHubPracticePicker'
import {
  STUDY_SUBJECTS,
  STUDY_SUBJECT_CATALOG,
  studySubjectProgressPct,
} from '../components/study/studyHubData'
import { CHROME_PRESERVE_CASE_CLASS } from '../styles/tokens'
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
  if (!catalog) return null
  const subjectMeta = STUDY_SUBJECTS.find((s) => s.id === subjectId)
  const SubjectIcon = subjectMeta?.icon
  const progressPct = subjectMeta
    ? studySubjectProgressPct(subjectMeta.progress)
    : null

  return (
    <div
      className={`study-hub-widget theme-surface ${CHROME_PRESERVE_CASE_CLASS}${perfDrag ? ' study-hub-widget--perf-drag' : ''}`}
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

      <header className="study-hub-header">
        <div className="study-hub-header__identity">
          {SubjectIcon && (
            <span className="study-hub-header__icon" aria-hidden>
              <SubjectIcon size={18} strokeWidth={1.85} />
            </span>
          )}
          <div className="study-hub-header__titles">
            <p className="study-hub-header__code">{catalog.paperCode}</p>
            <p className="study-hub-header__name">{catalog.fullName}</p>
          </div>
        </div>
        {progressPct != null && subjectMeta && (
          <div className="study-hub-header__progress" aria-label={`${progressPct}% complete`}>
            <span className="study-hub-header__progress-track" aria-hidden>
              <span
                className="study-hub-header__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </span>
            <span className="study-hub-header__progress-label">{progressPct}%</span>
          </div>
        )}
      </header>

      <StudyHubPracticePicker value={practice} onChange={onPracticeChange} />

      <div
        ref={scrollRef}
        className={`study-hub-scroll${perfDrag ? ' study-hub-scroll--perf-drag' : ''}`}
      >
        <MemoStudyHubPanel subjectId={subjectId} practice={practice} />
      </div>
    </div>
  )
}
