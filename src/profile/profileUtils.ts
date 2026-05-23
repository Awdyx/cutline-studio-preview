import type { ProfileSocialLink, TopBarUser, UserProfile } from './types'

export const BIO_MAX_LENGTH = 190
export const DISPLAY_NAME_MAX_LENGTH = 32
export const HANDLE_MAX_LENGTH = 32
export const SOCIAL_MAX = 5
export const SOCIAL_LABEL_MAX_LENGTH = 20
export const SOCIAL_VALUE_MAX_LENGTH = 64

export function deriveInitial(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export function profileToTopBarUser(profile: UserProfile): TopBarUser {
  return {
    name: profile.displayName,
    initial: deriveInitial(profile.displayName),
    avatarColor: profile.avatarColor,
    avatarImageUrl: profile.avatarImageUrl,
  }
}

export function visibleSocialLinks(socials: ProfileSocialLink[]): ProfileSocialLink[] {
  return socials
    .map((link) => ({
      label: link.label.trim().toLowerCase(),
      value: link.value.trim(),
    }))
    .filter((link) => link.label && link.value)
}

function socialsEqual(a: ProfileSocialLink[], b: ProfileSocialLink[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (link, index) =>
      link.label === b[index]?.label && link.value === b[index]?.value,
  )
}

export function profilesEqual(a: UserProfile, b: UserProfile): boolean {
  return (
    a.displayName === b.displayName &&
    a.handle === b.handle &&
    a.email === b.email &&
    a.bio === b.bio &&
    a.studentCohort === b.studentCohort &&
    a.avatarColor === b.avatarColor &&
    a.avatarImageUrl === b.avatarImageUrl &&
    a.bannerImageUrl === b.bannerImageUrl &&
    socialsEqual(a.socials, b.socials)
  )
}

export type ProfileValidation = {
  displayName?: string
  handle?: string
  bio?: string
  socials?: string
}

export function validateProfileDraft(draft: UserProfile): ProfileValidation {
  const errors: ProfileValidation = {}
  const displayName = draft.displayName.trim()
  const handle = normalizeHandle(draft.handle)

  if (!displayName) {
    errors.displayName = 'Display name is required'
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`
  }

  if (!handle) {
    errors.handle = 'Username is required'
  } else if (!/^[a-z0-9_]+$/.test(handle)) {
    errors.handle = 'Use letters, numbers, and underscores only'
  } else if (handle.length > HANDLE_MAX_LENGTH) {
    errors.handle = `Use ${HANDLE_MAX_LENGTH} characters or fewer`
  }

  if (draft.bio.length > BIO_MAX_LENGTH) {
    errors.bio = `Bio must be ${BIO_MAX_LENGTH} characters or fewer`
  }

  if (draft.socials.length > SOCIAL_MAX) {
    errors.socials = `Add up to ${SOCIAL_MAX} links`
  } else {
    for (const link of draft.socials) {
      const label = link.label.trim().toLowerCase()
      const value = link.value.trim()
      if (!label && !value) continue
      if (!label || !value) {
        errors.socials = 'Each link needs a platform and handle or URL'
        break
      }
      if (!/^[a-z0-9]+$/.test(label)) {
        errors.socials = 'Platform names use letters and numbers only'
        break
      }
      if (label.length > SOCIAL_LABEL_MAX_LENGTH) {
        errors.socials = `Platform names must be ${SOCIAL_LABEL_MAX_LENGTH} characters or fewer`
        break
      }
      if (value.length > SOCIAL_VALUE_MAX_LENGTH) {
        errors.socials = `Handles and URLs must be ${SOCIAL_VALUE_MAX_LENGTH} characters or fewer`
        break
      }
    }
  }

  return errors
}

export function sanitizeProfileDraft(draft: UserProfile): UserProfile {
  return {
    ...draft,
    displayName: draft.displayName.trim(),
    handle: normalizeHandle(draft.handle),
    bio: draft.bio.trim(),
    socials: visibleSocialLinks(draft.socials).slice(0, SOCIAL_MAX),
  }
}
