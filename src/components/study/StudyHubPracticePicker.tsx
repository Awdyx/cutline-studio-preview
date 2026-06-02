import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playSubmenuHover, playSubmenuTap } from '../../sound/submenuSound'
import { SubmenuSoundScope } from '../SubmenuSoundScope'

export type StudyPracticeMode = 'mcq' | 'saq' | 'exam'
export type StudyExamTiming = 'timed' | 'untimed'
export type StudyExamStyle = 'otago' | 'minimal'

export type StudyPracticeSelection = {
  mode: StudyPracticeMode
  examTiming: StudyExamTiming
  examStyle: StudyExamStyle
}

const MODES: { id: StudyPracticeMode; label: string }[] = [
  { id: 'mcq', label: 'MCQs' },
  { id: 'saq', label: 'SAQs' },
  { id: 'exam', label: 'Exams' },
]

function SegmentOption({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`study-hub-segment${active ? ' study-hub-segment--active' : ''}`}
      aria-pressed={active}
      onClick={() => {
        playSubmenuTap()
        onClick()
      }}
      onMouseEnter={() => playSubmenuHover()}
      onPointerDown={(e) => e.pointerType === 'pen' && e.preventDefault()}
    >
      {label}
    </button>
  )
}

export default function StudyHubPracticePicker({
  value,
  onChange,
}: {
  value: StudyPracticeSelection
  onChange: (next: StudyPracticeSelection) => void
}) {
  const reduceMotion = useReducedMotion()

  function selectMode(mode: StudyPracticeMode) {
    onChange({ ...value, mode })
  }

  return (
    <SubmenuSoundScope>
      <div className="study-hub-practice ui-chrome-preserve-case">
        <div className="study-hub-mode-bar" role="tablist" aria-label="Practice type">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={value.mode === id}
              className={`study-hub-mode-tab${value.mode === id ? ' study-hub-mode-tab--active' : ''}`}
              onClick={() => {
                playSubmenuTap()
                selectMode(id)
              }}
              onMouseEnter={() => playSubmenuHover()}
              onPointerDown={(e) => e.pointerType === 'pen' && e.preventDefault()}
            >
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {value.mode === 'exam' && (
            <motion.div
              key="exam-menu"
              className="study-hub-exam-menu"
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{
                duration: reduceMotion ? 0.01 : 0.34,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ overflow: 'hidden' }}
            >
              <div className="study-hub-exam-menu__inner">
                <div className="study-hub-exam-row">
                  <span className="study-hub-exam-label">Timing</span>
                  <div className="study-hub-segment-group">
                    <SegmentOption
                      label="Timed"
                      active={value.examTiming === 'timed'}
                      onClick={() => onChange({ ...value, examTiming: 'timed' })}
                    />
                    <SegmentOption
                      label="Untimed"
                      active={value.examTiming === 'untimed'}
                      onClick={() => onChange({ ...value, examTiming: 'untimed' })}
                    />
                  </div>
                </div>
                <div className="study-hub-exam-row">
                  <span className="study-hub-exam-label">Style</span>
                  <div className="study-hub-segment-group">
                    <SegmentOption
                      label="Otago"
                      active={value.examStyle === 'otago'}
                      onClick={() => onChange({ ...value, examStyle: 'otago' })}
                    />
                    <SegmentOption
                      label="Minimal"
                      active={value.examStyle === 'minimal'}
                      onClick={() => onChange({ ...value, examStyle: 'minimal' })}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SubmenuSoundScope>
  )
}

export const DEFAULT_STUDY_PRACTICE: StudyPracticeSelection = {
  mode: 'mcq',
  examTiming: 'timed',
  examStyle: 'otago',
}
