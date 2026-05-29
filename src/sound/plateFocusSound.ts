import type { AppDestination } from '../navigation/appDestinationStore'
import { useSoundStore } from './soundStore'
import {
  ensureAudioContext,
  playPlateFocusSoundEngine,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'

/** Subtle per-area tint — about ±1 semitone across the map. */
const PLATE_FOCUS_PITCH_SEMITONES: Record<AppDestination, number> = {
  studio: 0,
  leaderboard: -0.9,
  forum: 0.55,
  groups: 1,
  ucat: -1.15,
}

export function plateFocusPitchMul(destination: AppDestination): number {
  return 2 ** (PLATE_FOCUS_PITCH_SEMITONES[destination] / 12)
}

export function playPlateFocusSound(destination: AppDestination): void {
  const { muted, hydrated } = useSoundStore.getState()
  if (!hydrated || muted) return

  ensureAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)
  playPlateFocusSoundEngine(destination, plateFocusPitchMul(destination))
}
