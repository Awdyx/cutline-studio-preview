import type { LucideIcon } from 'lucide-react'
import { playSubmenuHover } from '../../sound/submenuSound'
import { font } from '../../styles/tokens'
import { useSubmenuSoundScope } from '../SubmenuSoundScope'
import {
  studySubjectProgressPct,
  type StudySubjectProgress,
} from './studyHubData'

type StudySubjectMenuRowProps = {
  icon: LucideIcon
  label: string
  progress: StudySubjectProgress
  onClick: () => void
}

export default function StudySubjectMenuRow({
  icon: Icon,
  label,
  progress,
  onClick,
}: StudySubjectMenuRowProps) {
  const sounds = useSubmenuSoundScope()
  const pct = studySubjectProgressPct(progress)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        if (sounds) playSubmenuHover()
      }}
      className="theme-surface study-subject-menu-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: font.family,
        color: font.colorPrimary,
        transition: 'background 150ms ease',
        textAlign: 'left',
      }}
    >
      <Icon
        size={16}
        strokeWidth={1.8}
        color={font.colorMuted}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, lineHeight: 1.2 }}>{label}</span>
        <span
          className="study-subject-menu-row__progress"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            columnGap: 8,
            marginTop: 6,
          }}
        >
          <span
            aria-hidden
            className="study-subject-menu-row__track"
            style={{
              width: '100%',
              height: 4,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <span
              className="study-subject-menu-row__fill"
              style={{
                display: 'block',
                width: `${pct}%`,
                height: '100%',
                borderRadius: 999,
              }}
            />
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: font.colorMuted,
              whiteSpace: 'nowrap',
              minWidth: '4ch',
              textAlign: 'right',
            }}
          >
            {pct}%
          </span>
        </span>
      </span>
    </button>
  )
}
