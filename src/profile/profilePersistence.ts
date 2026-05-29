import type { PinnedTrack, ProfileSocialLink, UserProfile } from './types'
import { parseProfileMediaFrame } from './profileMediaFrame'
import { DEFAULT_PROFILE_STATUS, parseProfileStatus } from './profileStatus'

import { scopedStorageKey } from '../storage/storageScope'

export const PROFILE_STORAGE_KEY = scopedStorageKey('cutline-profile-v1')

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'CutlineBeta',
  handle: 'betatest',
  email: 'youractual@email.com',
  bio: '',
  studentCohort: 'HSFY',
  avatarColor: '#c4a373',
  avatarImageUrl: null,
  avatarFrame: null,
  bannerImageUrl: null,
  bannerFrame: null,
  socials: [],
  pinnedTrack: null,
  status: DEFAULT_PROFILE_STATUS,
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

function parsePinnedTrack(raw: unknown): PinnedTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== 'number' ||
    typeof o.title !== 'string' ||
    typeof o.artist !== 'string' ||
    typeof o.art !== 'string' ||
    typeof o.preview !== 'string'
  )
    return null
  const startTime = typeof o.startTime === 'number' && isFinite(o.startTime)
    ? Math.max(0, Math.min(o.startTime, 29))
    : 0
  let endTime =
    typeof o.endTime === 'number' && isFinite(o.endTime)
      ? Math.max(0, Math.min(o.endTime, 30))
      : 30
  if (endTime <= startTime) endTime = Math.min(30, startTime + 1)
  return { id: o.id, title: o.title, artist: o.artist, art: o.art, preview: o.preview, startTime, endTime }
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
    avatarFrame: parseProfileMediaFrame(o.avatarFrame) ?? null,
    bannerFrame: parseProfileMediaFrame(o.bannerFrame) ?? null,
    socials: parseSocials(o.socials),
    pinnedTrack: parsePinnedTrack(o.pinnedTrack),
    status: parseProfileStatus(o.status),
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
    avatarFrame: parseProfileMediaFrame(meta?.avatarFrame) ?? DEFAULT_PROFILE.avatarFrame,
    bannerFrame: parseProfileMediaFrame(meta?.bannerFrame) ?? DEFAULT_PROFILE.bannerFrame,
    socials: Array.isArray(meta?.socials) ? meta.socials : DEFAULT_PROFILE.socials,
    pinnedTrack: parsePinnedTrack(meta?.pinnedTrack) ?? DEFAULT_PROFILE.pinnedTrack,
    status: parseProfileStatus(meta?.status),
  }
}
