import { create } from 'zustand'
import {
  loadQuickMenuFromStorage,
  saveQuickMenuToStorage,
  type PersistedQuickMenuSettings,
  type QuickMenuMode,
} from './quickMenuPersistence'

type QuickMenuState = PersistedQuickMenuSettings & {
  hydrated: boolean
  hydrate: () => void
  setMode: (mode: QuickMenuMode) => void
}

let persistEnabled = false

function persist(settings: PersistedQuickMenuSettings) {
  if (persistEnabled) saveQuickMenuToStorage(settings)
}

export const useQuickMenuStore = create<QuickMenuState>((set, get) => ({
  mode: 'shortcut',
  hydrated: false,

  hydrate: () => {
    const loaded = loadQuickMenuFromStorage()
    set({ ...loaded, hydrated: true })
    persistEnabled = true
  },

  setMode: (mode) => {
    set({ mode })
    persist(get())
  },
}))
