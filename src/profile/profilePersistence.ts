import type { ProfileSocialLink, UserProfile } from './types'

export const PROFILE_STORAGE_KEY = 'cutline-profile-v1'

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'James',
  handle: 'james',
  email: 'james@cutline.app',
  bio: '',
  studentCohort: 'HSFY',
  avatarColor: '#c4a373',
  avatarImageUrl: null,
  bannerImageUrl: null,
  socials: [],
}

/** Profile fields stored in localStorage (images live in IndexedDB). */
export type PersistedProfileMeta = Omit<UserProfile, 'avatarImageUrl' | 'bannerImageUrl'>

function parseSocials(raw: unknown): ProfileSocialLink[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      label: typeof entry.label === 'string' ? entry.label.trim() : '',
      value: typeof entry.value === 'string' ? entry.value.trim() : '',
    }))
    .filter((link) => link.label && link.value)
}

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
    socials: parseSocials(o.socials),
  }
}

export function loadProfileMetaFromStorage(): PersistedProfileMeta {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return { ...stripProfileMedia(DEFAULT_PROFILE) }
    const parsed = JSON.parse(raw) as unknown

    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
      const state = (parsed as { state?: unknown }).state
      if (state && typeof state === 'object' && 'profile' in state) {
        const meta = parseProfileMeta((state as { profile?: unknown }).profile)
        if (meta) return meta
      }
    }

    const meta = parseProfileMeta(parsed)
    return meta ?? { ...stripProfileMedia(DEFAULT_PROFILE) }
  } catch {
    return { ...stripProfileMedia(DEFAULT_PROFILE) }
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

export function stripProfileMedia(profile: UserProfile): PersistedProfileMeta {
  const { avatarImageUrl: _avatar, bannerImageUrl: _banner, ...meta } = profile
  return meta
}

/** @deprecated Use stripProfileMedia */
export function stripAvatar(profile: UserProfile): PersistedProfileMeta {
  return stripProfileMedia(profile)
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
  media: { avatarImageUrl: string | null; bannerImageUrl: string | null },
): UserProfile {
  return { ...meta, ...media }
}

export function mergePersistedMeta(
  meta: Partial<PersistedProfileMeta> | undefined,
): PersistedProfileMeta {
  return {
    displayName: meta?.displayName ?? DEFAULT_PROFILE.displayName,
    handle: meta?.handle ?? DEFAULT_PROFILE.handle,
    email: meta?.email ?? DEFAULT_PROFILE.email,
    bio: meta?.bio ?? DEFAULT_PROFILE.bio,
    studentCohort: meta?.studentCohort ?? DEFAULT_PROFILE.studentCohort,
    avatarColor: meta?.avatarColor ?? DEFAULT_PROFILE.avatarColor,
    socials: Array.isArray(meta?.socials) ? meta.socials : DEFAULT_PROFILE.socials,
  }
}
