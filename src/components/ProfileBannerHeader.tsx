import UserAvatar from './UserAvatar'
import ProfileFramedImage from './ProfileFramedImage'
import { DEFAULT_BANNER_FRAME } from '../profile/profileMediaFrame'
import type { ProfileMediaFrame, ProfileStatus } from '../profile/types'

const AVATAR_RING_PX = 3
const CONTENT_GAP_PX = 10

const defaultBannerGradient =
  'linear-gradient(135deg, rgba(148, 132, 184, 0.22), rgba(106, 155, 200, 0.18))'

export function profileHeaderContentOffset(
  avatarSize: number,
  contentGap = CONTENT_GAP_PX,
): number {
  return avatarSize / 2 + AVATAR_RING_PX + contentGap
}

export const PROFILE_BANNER_HEIGHT = 80
export const PROFILE_EDIT_PHOTO_GAP = 22

export default function ProfileBannerHeader({
  bannerImageUrl,
  bannerFrame,
  displayName,
  avatarColor,
  avatarImageUrl,
  avatarFrame,
  avatarSize = 44,
  bannerHeight = PROFILE_BANNER_HEIGHT,
  edgeToEdge = false,
  fullBleed = false,
  contentGap,
  contentPaddingBottom,
  status,
  children,
}: {
  bannerImageUrl: string | null
  bannerFrame?: ProfileMediaFrame | null
  displayName: string
  avatarColor: string
  avatarImageUrl: string | null
  avatarFrame?: ProfileMediaFrame | null
  avatarSize?: number
  bannerHeight?: number
  /** Banner spans the full card width (profile panel). */
  edgeToEdge?: boolean
  /** Extend banner past horizontal scroll padding (edit submenu). */
  fullBleed?: boolean
  /** Space between avatar bottom and header content (edit profile). */
  contentGap?: number
  contentPaddingBottom?: number
  status?: ProfileStatus | null
  children?: React.ReactNode
}) {
  const contentPadX = edgeToEdge || fullBleed ? 16 : 0
  const gap = contentGap ?? CONTENT_GAP_PX
  const bottomPad =
    contentPaddingBottom ??
    (edgeToEdge || fullBleed ? 18 : undefined)

  return (
    <>
      <div
        style={{
          position: 'relative',
          margin: fullBleed ? '0 -16px' : undefined,
        }}
      >
        <div
          aria-hidden
          style={{
            height: bannerHeight,
            overflow: 'hidden',
            background: 'var(--card-bg)',
            borderBottom: edgeToEdge || fullBleed ? '1px solid var(--glass-border)' : undefined,
          }}
        >
          {bannerImageUrl ? (
            <ProfileFramedImage
              src={bannerImageUrl}
              frame={bannerFrame ?? DEFAULT_BANNER_FRAME}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: defaultBannerGradient,
              }}
            />
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: 'translate(-50%, 50%)',
            zIndex: 2,
            borderRadius: '50%',
            boxShadow: `0 0 0 ${AVATAR_RING_PX}px var(--card-bg)`,
          }}
        >
          <UserAvatar
            displayName={displayName}
            avatarColor={avatarColor}
            avatarImageUrl={avatarImageUrl}
            avatarFrame={avatarFrame}
            size={avatarSize}
            fontSize={Math.max(14, Math.round(avatarSize * 0.4))}
            status={status}
          />
        </div>
      </div>
      {children ? (
        <div
          style={{
            paddingTop: profileHeaderContentOffset(avatarSize, gap),
            paddingLeft: contentPadX,
            paddingRight: contentPadX,
            paddingBottom: bottomPad,
            textAlign: 'center',
          }}
        >
          {children}
        </div>
      ) : null}
    </>
  )
}
