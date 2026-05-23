import type { TopBarUser, UserProfile } from './types'

export const BIO_MAX_LENGTH = 190
export const DISPLAY_NAME_MAX_LENGTH = 32
export const HANDLE_MAX_LENGTH = 32

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

export function profilesEqual(a: UserProfile, b: UserProfile): boolean {
  return (
    a.displayName === b.displayName &&
    a.handle === b.handle &&
    a.email === b.email &&
    a.bio === b.bio &&
    a.studentCohort === b.studentCohort &&
    a.avatarColor === b.avatarColor &&
    a.avatarImageUrl === b.avatarImageUrl
  )
}

export type ProfileValidation = {
  displayName?: string
  handle?: string
  bio?: string
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

  return errors
}

export function sanitizeProfileDraft(draft: UserProfile): UserProfile {
  return {
    ...draft,
    displayName: draft.displayName.trim(),
    handle: normalizeHandle(draft.handle),
    bio: draft.bio.trim(),
  }
}
