import { font } from '../styles/tokens'
import { normalizeHandle } from '../profile/profileUtils'

function MetaPill({
  children,
  dark = false,
}: {
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <span
      className={dark ? 'profile-cohort-pill' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 6,
        border: dark ? undefined : '1px solid var(--glass-border)',
        background: dark ? undefined : 'rgba(20, 30, 50, 0.04)',
        color: dark ? undefined : font.colorMuted,
        fontSize: 11,
        fontWeight: dark ? 600 : 500,
        fontFamily: font.family,
        letterSpacing: '0.03em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function ProfileIdentityTags({
  displayName,
  handle,
  studentCohort,
  showDisplayName = true,
}: {
  displayName?: string
  handle: string
  studentCohort: string
  showDisplayName?: boolean
}) {
  const normalized = normalizeHandle(handle)
  const handleLabel = normalized ? `@${normalized}` : null
  const cohortLabel = studentCohort.trim()

  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      {showDisplayName && displayName && (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: font.colorPrimary,
          }}
        >
          {displayName}
        </p>
      )}
      {(handleLabel || cohortLabel) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: showDisplayName && displayName ? 6 : 0,
          }}
        >
          {handleLabel && <MetaPill>{handleLabel}</MetaPill>}
          {cohortLabel && <MetaPill dark>{cohortLabel}</MetaPill>}
        </div>
      )}
    </div>
  )
}
