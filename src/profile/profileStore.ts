import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  loadLegacyAvatarFromStorage,
  loadProfileMetaFromStorage,
  mergePersistedMeta,
  saveProfileMetaToStorage,
  stripProfileMedia,
  DEFAULT_PROFILE,
  PROFILE_STORAGE_KEY,
  metaToProfile,
  type PersistedProfileMeta,
} from './profilePersistence'
import {
  loadProfileAvatar,
  loadProfileBanner,
  saveProfileAvatar,
  saveProfileBanner,
} from './profileAvatarPersistence'
import { sanitizeProfileDraft } from './profileUtils'
import type { UserProfile } from './types'

type ProfileState = {
  profile: UserProfile
  saveProfile: (next: UserProfile) => void
}

async function mergeMediaIntoProfile(meta: PersistedProfileMeta): Promise<UserProfile> {
  const [fromIdbAvatar, fromIdbBanner] = await Promise.all([
    loadProfileAvatar(),
    loadProfileBanner(),
  ])

  if (fromIdbAvatar) {
    return metaToProfile(meta, {
      avatarImageUrl: fromIdbAvatar,
      bannerImageUrl: fromIdbBanner,
    })
  }

  const legacy = loadLegacyAvatarFromStorage()
  if (legacy) {
    await saveProfileAvatar(legacy)
    saveProfileMetaToStorage(meta)
    return metaToProfile(meta, {
      avatarImageUrl: legacy,
      bannerImageUrl: fromIdbBanner,
    })
  }

  return metaToProfile(meta, {
    avatarImageUrl: null,
    bannerImageUrl: fromIdbBanner,
  })
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
        version: 2,
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
        void saveProfileBanner(profile.bannerImageUrl)
      },
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => profileStorage),
      partialize: (state) => ({
        profile: stripProfileMedia(state.profile),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ProfileState> | undefined
        if (!saved?.profile) return current
        const meta = mergePersistedMeta(saved.profile)
        return {
          ...current,
          profile: metaToProfile(meta, {
            avatarImageUrl: null,
            bannerImageUrl: null,
          }),
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        void mergeMediaIntoProfile(stripProfileMedia(state.profile)).then((profile) => {
          useProfileStore.setState({ profile })
        })
      },
    },
  ),
)

void useProfileStore.persist.rehydrate()
