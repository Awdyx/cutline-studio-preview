import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  loadLegacyAvatarFromStorage,
  loadProfileMetaFromStorage,
  metaToProfile,
  saveProfileMetaToStorage,
  stripAvatar,
  DEFAULT_PROFILE,
  PROFILE_STORAGE_KEY,
  type PersistedProfileMeta,
} from './profilePersistence'
import {
  loadProfileAvatar,
  saveProfileAvatar,
} from './profileAvatarPersistence'
import { sanitizeProfileDraft } from './profileUtils'
import type { UserProfile } from './types'

type ProfileState = {
  profile: UserProfile
  saveProfile: (next: UserProfile) => void
}

async function mergeAvatarIntoProfile(meta: PersistedProfileMeta): Promise<UserProfile> {
  const fromIdb = await loadProfileAvatar()
  if (fromIdb) return metaToProfile(meta, fromIdb)

  const legacy = loadLegacyAvatarFromStorage()
  if (legacy) {
    await saveProfileAvatar(legacy)
    saveProfileMetaToStorage(meta)
    return metaToProfile(meta, legacy)
  }

  return metaToProfile(meta, null)
}

/** Accept legacy flat JSON blobs written before zustand persist. */
const profileStorage: StateStorage = {
  getItem: (name) => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.state && typeof parsed.state === 'object') return raw
      const meta = loadProfileMetaFromStorage()
      return JSON.stringify({
        state: { profile: meta },
        version: 1,
      })
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
  },
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: { ...DEFAULT_PROFILE },

      saveProfile: (next) => {
        const profile = sanitizeProfileDraft(next)
        set({ profile })
        void saveProfileAvatar(profile.avatarImageUrl)
      },
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => profileStorage),
      partialize: (state) => ({
        profile: stripAvatar(state.profile),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ProfileState> | undefined
        if (!saved?.profile) return current
        const meta = saved.profile
        return {
          ...current,
          profile: metaToProfile(
            {
              displayName: meta.displayName ?? DEFAULT_PROFILE.displayName,
              handle: meta.handle ?? DEFAULT_PROFILE.handle,
              email: meta.email ?? DEFAULT_PROFILE.email,
              bio: meta.bio ?? DEFAULT_PROFILE.bio,
              studentCohort: meta.studentCohort ?? DEFAULT_PROFILE.studentCohort,
              avatarColor: meta.avatarColor ?? DEFAULT_PROFILE.avatarColor,
            },
            null,
          ),
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        void mergeAvatarIntoProfile(stripAvatar(state.profile)).then((profile) => {
          useProfileStore.setState({ profile })
        })
      },
    },
  ),
)

void useProfileStore.persist.rehydrate()
