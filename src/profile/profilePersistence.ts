import type { UserProfile } from './types'

export const PROFILE_STORAGE_KEY = 'cutline-profile-v1'

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'James',
  handle: 'james',
  email: 'james@cutline.app',
  bio: '',
  studentCohort: 'HSFY',
  avatarColor: '#c4a373',
  avatarImageUrl: null,
}

/** Profile fields stored in localStorage (avatar image lives in IndexedDB). */
export type PersistedProfileMeta = Omit<UserProfile, 'avatarImageUrl'>

function parseProfileMeta(raw: unknown): PersistedProfileMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const displayName =
    typeof o.displayName === 'string'
      ? o.displayName
      : typeof o.name === 'string'
        ? o.name
        : null

  const handle =
    typeof o.handle === 'string'
      ? o.handle
      : typeof o.username === 'string'
        ? o.username
        : null

  if (!displayName || !handle) return null
  if (typeof o.email !== 'string') return null
  if (typeof o.bio !== 'string') return null
  if (typeof o.avatarColor !== 'string') return null

  const studentCohort =
    typeof o.studentCohort === 'string' && o.studentCohort.trim()
      ? o.studentCohort.trim()
      : DEFAULT_PROFILE.studentCohort

  return {
    displayName,
    handle,
    email: o.email,
    bio: o.bio,
    studentCohort,
    avatarColor: o.avatarColor,
  }
}

export function loadProfileMetaFromStorage(): PersistedProfileMeta {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return { ...stripAvatar(DEFAULT_PROFILE) }
    const parsed = JSON.parse(raw) as unknown
    const meta = parseProfileMeta(parsed)
    return meta ?? { ...stripAvatar(DEFAULT_PROFILE) }
  } catch {
    return { ...stripAvatar(DEFAULT_PROFILE) }
  }
}

export function saveProfileMetaToStorage(meta: PersistedProfileMeta): boolean {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(meta))
    return true
  } catch (err) {
    console.warn('[profile] failed to save profile', err)
    return false
  }
}

export function stripAvatar(profile: UserProfile): PersistedProfileMeta {
  const { avatarImageUrl: _avatar, ...meta } = profile
  return meta
}

/** Legacy payloads may still embed avatarImageUrl in localStorage. */
export function loadLegacyAvatarFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const url = parsed.avatarImageUrl
    return typeof url === 'string' ? url : null
  } catch {
    return null
  }
}

export function metaToProfile(
  meta: PersistedProfileMeta,
  avatarImageUrl: string | null,
): UserProfile {
  return { ...meta, avatarImageUrl }
}
