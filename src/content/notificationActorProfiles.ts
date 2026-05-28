import sofiacodesAvatar from '../assets/notification-profiles/sofiacodes-avatar.png'
import sofiacodesBanner from '../assets/notification-profiles/sofiacodes-banner.png'
import sofiacodesCanvas from '../assets/notification-profiles/sofiacodes-canvas.png'
import type { PinnedTrack } from '../profile/types'

export type NotificationActorSocial = {
  label: string
  value: string
}

export type NotificationActorProfile = {
  handle: string
  displayName: string
  bio: string
  avatarColor: string
  avatarInitial: string
  avatarImageUrl?: string
  bannerImageUrl?: string
  bannerGradient?: string
  canvasPreviewImageUrl?: string
  cohort?: string
  socials: NotificationActorSocial[]
  canvasTitle: string
  pinnedTrack?: PinnedTrack | null
  /** Resolved client-side via iTunes lookup when preview URLs are not stored. */
  pinnedTrackAppleUrl?: string
}

export const NOTIFICATION_ACTOR_PROFILES: Record<string, NotificationActorProfile> = {
  '@sofiacodes': {
    handle: '@sofiacodes',
    displayName: 'Sofia Chen',
    bio: 'i loveeeee @ais he\'s just sooooo cool',
    avatarColor: '#9484b8',
    avatarInitial: 'S',
    avatarImageUrl: sofiacodesAvatar,
    bannerImageUrl: sofiacodesBanner,
    canvasPreviewImageUrl: sofiacodesCanvas,
    cohort: 'HSFY',
    socials: [
      { label: 'instagram', value: 'sofiacodes' },
      { label: 'github', value: 'sofiacodes' },
      { label: 'website', value: 'sofi.study' },
    ],
    canvasTitle: 'HU Ethics — Week 4',
    pinnedTrack: {
      id: 1709413704,
      title: 'Your face',
      artist: 'Wisp',
      art: '',
      preview: '',
      startTime: 0,
    },
    pinnedTrackAppleUrl:
      'https://music.apple.com/nz/album/your-face/1709413623?i=1709413704',
  },
}
