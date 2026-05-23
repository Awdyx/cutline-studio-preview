import { deriveInitial } from '../profile/profileUtils'

type UserAvatarProps = {
  displayName: string
  avatarColor: string
  avatarImageUrl?: string | null
  size?: number
  fontSize?: number
}

export default function UserAvatar({
  displayName,
  avatarColor,
  avatarImageUrl,
  size = 44,
  fontSize,
}: UserAvatarProps) {
  const initial = deriveInitial(displayName)
  const glyphSize = fontSize ?? Math.round(size * 0.4)

  if (avatarImageUrl) {
    return (
      <img
        src={avatarImageUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: avatarColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: glyphSize,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}
