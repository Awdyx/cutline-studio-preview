import { BASE_MASTER_GAIN } from './soundEngine'

/** SFX bus when unmuted (+20% from 0.525). */
export const SFX_ON_GAIN = BASE_MASTER_GAIN

/** Background music bus when enabled (~14% below prior 0.063). */
export const MUSIC_ON_GAIN = 0.054
