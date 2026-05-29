export type ProfileMediaFrame = {
  /** Horizontal focal shift, -1 (left) to 1 (right). */
  x: number
  /** Vertical focal shift, -1 (top) to 1 (bottom). */
  y: number
  /** Zoom from focal point, 1 = fill frame. */
  scale: number
}

export type ProfileSocialLink = {
  label: string
  value: string
}

export type ProfileStatus = 'online' | 'offline' | 'dnd'

export type PinnedTrack = {
  id: number
  title: string
  artist: string
  art: string
  preview: string
  /** Start offset in seconds within the 30-second preview clip (0–29). */
  startTime: number
  /** End offset in seconds within the 30-second preview clip (startTime+1–30). */
  endTime: number
}

export type UserProfile = {
  displayName: string
  handle: string
  email: string
  bio: string
  /** Student cohort / stream category (e.g. HSFY). */
  studentCohort: string
  avatarColor: string
  avatarImageUrl: string | null
  avatarFrame: ProfileMediaFrame | null
  bannerImageUrl: string | null
  bannerFrame: ProfileMediaFrame | null
  socials: ProfileSocialLink[]
  pinnedTrack: PinnedTrack | null
  status: ProfileStatus
}

export type TopBarUser = {
  name: string
  initial: string
  avatarColor: string
  avatarImageUrl: string | null
  avatarFrame?: ProfileMediaFrame | null
  status: ProfileStatus
}
