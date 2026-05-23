import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PaletteConfig } from './paletteGenerator'

export type ThemeMode = 'light' | 'dark' | 'auto'

export type ThemeState = {
  mode: ThemeMode
  palette: PaletteConfig
  setMode: (mode: ThemeMode) => void
}

export const defaultPalette: PaletteConfig = {
  blobDepth: 1,
}

type PersistedV1 = {
  mode?: ThemeMode
  palette?: {
    baseHue?: number
    saturation?: number
    warmth?: number
    blobDepth?: number
  }
}

function migratePalette(raw: PersistedV1['palette']): PaletteConfig {
  if (!raw) return defaultPalette
  if (typeof raw.blobDepth === 'number') {
    return { blobDepth: Math.min(1, Math.max(0, raw.blobDepth)) }
  }
  const saturation =
    typeof raw.saturation === 'number' ? Math.min(0.48, Math.max(0, raw.saturation)) : 0.18
  return { blobDepth: Math.min(1, saturation / 0.48) }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',
      palette: defaultPalette,

      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'cutline-theme-v1',
      version: 3,
      migrate: (persisted: unknown, fromVersion) => {
        const state = persisted as PersistedV1
        const palette =
          fromVersion < 3
            ? defaultPalette
            : migratePalette(state.palette)
        return {
          mode: state.mode ?? 'light',
          palette,
        }
      },
    },
  ),
)
