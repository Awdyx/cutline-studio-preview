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
  deleteElement: 1.02,
  wipeCanvas: 0.96,
  profileOpen: 0.8,
  profileClose: 1.3,
  itemGrab: 0.38,
  itemDrop: 0.09,
  spawn: 0.95,
  /** Customize pin latch on UI anchor — quiet rising settle + soft ding. */
  uiPinPlace: 1.05,
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
  textCommit: 0.9,
  /** Brand pill area lock-in — whisper loader (very quiet). */
  plateFocus: 0.48,
  /** Reload intro — crystal gather on title appear. */
  reloadIntroArrive: 0.5,
  /** Reload intro — crystal major wash on dismiss. */
  reloadIntroDismiss: 0.5,
}

/** Trim for looping drag noise (pre-compressor). Bed sits below one-shot blips. */
export const CONTINUOUS_SFX_LEVEL = 0.50

/** Resize handle bed — soft, dark tonal hum that tracks item size. */
export const RESIZE_SFX_LEVEL = 0.216

/** Canvas pan whoosh — airy/bright bed, kept subtle since panning is frequent. */
export const PAN_SFX_LEVEL = 2.08