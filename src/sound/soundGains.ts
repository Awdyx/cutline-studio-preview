import type { SoundId } from './types'

/**
 * Per-sound trim before the SFX compressor. Normalized to menuOpen perceived loudness
 * (short UI blip reference) using synthesis peak, duration, and layer count.
 * Tune by ear — small nudges only.
 */
export const SOUND_LEVELS: Record<SoundId, number> = {
  submenuTap: 1.22,
  menuOpen: 1,
  menuClose: 1.16,
  itemSelect: 1.16,
  itemDeselect: 1.47,
  /** Hand-tuned — excluded from global normalization (duration-weighted trim broke wipe > single hierarchy). */
  deleteElement: 0.92,
  wipeCanvas: 0.96,
  profileOpen: 0.8,
  profileClose: 1.3,
  itemGrab: 0.38,
  itemDrop: 0.09,
  studioCentreGrab: 0.56,
  studioCentreDrop: 0.2,
  spawn: 0.95,
  lock: 0.09,
  unlock: 0.1,
  spaceEnter: 0.2,
  spaceExit: 0.2,
  submenuHover: 0.37,
  undo: 0.24,
  redo: 0.24,
  modalOpen: 0.18,
  themeToLight: 0.40,
  themeToDark: 0.40,
  zOrderFront: 0.53,
  zOrderBack: 0.56,
  aspectSnap: 0.88,
  fisheyeEnter: 0.62,
  fisheyeExit: 0.62,
  minimapOpen: 1.02,
  minimapClose: 0.98,
  textCommit: 0.9,
  /** Brand pill area lock-in — whisper loader (very quiet). */
  plateFocus: 0.48,
}

/** Trim for looping drag noise (pre-compressor). Bed sits below one-shot blips. */
export const CONTINUOUS_SFX_LEVEL = 0.50

/** Resize handle bed — soft, dark tonal hum that tracks item size. */
export const RESIZE_SFX_LEVEL = 0.216

/** Studio centre drag bed — dark sub mass hum; separate from item noise scrape. */
export const STUDIO_CENTRE_DRAG_SFX_LEVEL = 0.92

/** Canvas pan whoosh — airy/bright bed, kept subtle since panning is frequent. */
export const PAN_SFX_LEVEL = 2.08
