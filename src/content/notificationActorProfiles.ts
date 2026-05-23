import sofiacodesAvatar from '../assets/notification-profiles/sofiacodes-avatar.png'
import sofiacodesBanner from '../assets/notification-profiles/sofiacodes-banner.png'
import sofiacodesCanvas from '../assets/notification-profiles/sofiacodes-canvas.png'

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
}

export const NOTIFICATION_ACTOR_PROFILES: Record<string, NotificationActorProfile> = {
  '@sofiacodes': {
    handle: '@sofiacodes',
    displayName: 'Sofia Chen',
    bio: 'Med student · HU notes & ethics essays. Building shared canvases for our cohort.',
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
  },
}
