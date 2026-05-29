import { deriveInitial } from '../profile/profileUtils'
import ProfileFramedImage from './ProfileFramedImage'
import ProfileStatusDot from './ProfileStatusDot'
import { DEFAULT_AVATAR_FRAME } from '../profile/profileMediaFrame'
import type { ProfileMediaFrame, ProfileStatus } from '../profile/types'

type UserAvatarProps = {
  displayName: string
  avatarColor: string
  avatarImageUrl?: string | null
  avatarFrame?: ProfileMediaFrame | null
  size?: number
  fontSize?: number
  status?: ProfileStatus | null
}

export default function UserAvatar({
  displayName,
  avatarColor,
  avatarImageUrl,
  avatarFrame,
  size = 44,
  fontSize,
  status,
}: UserAvatarProps) {
  const initial = deriveInitial(displayName)
  const glyphSize = fontSize ?? Math.round(size * 0.4)

  const avatarNode = avatarImageUrl ? (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <ProfileFramedImage
        src={avatarImageUrl}
        frame={avatarFrame ?? DEFAULT_AVATAR_FRAME}
        shape="circle"
      />
    </div>
  ) : (
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
      }}
    >
      {initial}
    </span>
  )

  if (!status) return avatarNode

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {avatarNode}
      <ProfileStatusDot status={status} avatarSize={size} />
    </div>
  )
}
