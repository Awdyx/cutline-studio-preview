import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { memo, type RefObject } from 'react'
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
  perfDrag = false,
}: {
  subjectId: StudySubjectId
  practice: StudyPracticeSelection
  onPracticeChange: (next: StudyPracticeSelection) => void
  scrollRef?: RefObject<HTMLDivElement | null>
  perfDrag?: boolean
}) {
  const reduceMotion = useReducedMotion()
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={practice.mode}
            className="study-hub-scroll__panel"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <MemoStudyHubPanel subjectId={subjectId} practice={practice} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
