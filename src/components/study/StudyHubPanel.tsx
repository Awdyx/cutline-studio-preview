import { ChevronRight } from 'lucide-react'
import { playSubmenuTap } from '../../sound/submenuSound'
import { STUDY_SUBJECT_CATALOG, type StudySubjectId } from './studyHubData'
import type { StudyPracticeSelection } from './StudyHubPracticePicker'

export default function StudyHubPanel({
  subjectId,
  practice,
}: {
  subjectId: StudySubjectId
  practice: StudyPracticeSelection
}) {
  const catalog = STUDY_SUBJECT_CATALOG[subjectId]
  let lectureNumber = 0

  return (
    <div className="study-hub-panel-content ui-chrome-preserve-case">
      {catalog.modules.map((module) => (
        <section key={module.name} className="study-hub-module">
          <div className="study-hub-module-head">
            <p className="study-hub-module-label">{module.name}</p>
            <span className="study-hub-module-count">
              {module.lectures.length} lectures
            </span>
          </div>
          <ul className="study-hub-lecture-list">
            {module.lectures.map((lecture) => {
              lectureNumber += 1
              return (
                <li key={lecture}>
                  <button
                    type="button"
                    className="study-hub-lecture"
                    onClick={() => playSubmenuTap()}
                    onPointerDown={(e) => e.pointerType === 'pen' && e.preventDefault()}
                    data-practice-mode={practice.mode}
                    data-exam-timing={practice.mode === 'exam' ? practice.examTiming : undefined}
                    data-exam-style={practice.mode === 'exam' ? practice.examStyle : undefined}
                  >
                    <span className="study-hub-lecture-num">{lectureNumber}</span>
                    <span className="study-hub-lecture-title">{lecture}</span>
                    <ChevronRight
                      className="study-hub-lecture-chevron"
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
