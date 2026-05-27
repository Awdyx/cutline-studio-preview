import { useSoundStore } from './soundStore'
import {
  ensureAudioContext,
  playSoundEngine,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import type { SoundId } from './types'

export function playSound(
  id: SoundId,
  opts?: { layer?: boolean; bypassMute?: boolean },
): void {
  const { muted, hydrated } = useSoundStore.getState()
  if (!hydrated || (muted && !opts?.bypassMute)) return

  ensureAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)
  playSoundEngine(id, opts)
}
