import { CHROME_PRESERVE_CASE_CLASS, chromeLabel, font } from '../styles/tokens'
import type { ProfileSocialLink } from '../profile/types'
import { visibleSocialLinks } from '../profile/profileUtils'

const socialPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid var(--glass-border)',
  background: 'rgba(20, 30, 50, 0.04)',
  color: font.colorMuted,
  fontSize: 11,
  fontWeight: 500,
  fontFamily: font.family,
  letterSpacing: '0.03em',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}

export default function ProfileSocialPills({
  socials,
  centered = false,
}: {
  socials: ProfileSocialLink[]
  centered?: boolean
}) {
  const links = visibleSocialLinks(socials)
  if (links.length === 0) return null

  return (
    <div
      className={CHROME_PRESERVE_CASE_CLASS}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
        justifyContent: centered ? 'center' : 'flex-start',
      }}
    >
      {links.map(({ label, value }) => (
        <span key={`${label}-${value}`} style={socialPillStyle}>
          {chromeLabel(`${label} · ${value}`)}
        </span>
      ))}
    </div>
  )
}
