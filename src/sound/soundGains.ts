import type { SoundId } from './types'

/**
 * Per-sound trim before the SFX compressor. Reference weight ≈ short UI blips (menuOpen,
 * itemSelect). Tune by ear — goal is equal perceived loudness at default SFX master.
 */
export const SOUND_LEVELS: Record<SoundId, number> = {
  submenuTap: 1.05,
  menuOpen: 1,
  menuClose: 1,
  itemSelect: 1,
  itemDeselect: 0.95,
  clearAnnotations: 1,
  profileOpen: 0.7,
  profileClose: 0.66,
  itemGrab: 0.72,
  itemDrop: 0.32,
  spawn: 0.55,
  lock: 0.38,
  unlock: 0.42,
  spaceEnter: 0.58,
  spaceExit: 0.58,
  submenuHover: 0.82,
  undo: 0.72,
  redo: 0.72,
  modalOpen: 0.56,
  themeToLight: 0.52,
  themeToDark: 0.52,
  zOrderFront: 0.78,
  zOrderBack: 0.78,
}

/** Trim for looping drag / resize noise (pre-compressor). */
export const CONTINUOUS_SFX_LEVEL = 0.72
