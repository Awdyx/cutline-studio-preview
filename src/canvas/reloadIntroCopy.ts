import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  DEFAULT_SPACE_NAME,
  DEFAULT_SPACE_NAME_PLACEHOLDER,
  isDefaultSpaceName,
} from '../spaces/types'

export type ReloadIntroCopy = {
  name: string
  suffix: string
}

export const RELOAD_INTRO_SUFFIXES = [
  '; )',
  '<3',
  'T_T',
  ">_<",
  ': P',
  ': D',
  '^_^',
  'o.o',
  ';_;',
  ':3',
  '(-_-)',
  '¯\\_(ツ)_/¯',
  '~_~',
  '♪(´▽｀)',
  '-.-',
  '??',
  '> study',
  '...',
] as const

export function pickRandomReloadIntroSuffix(): string {
  const i = Math.floor(Math.random() * RELOAD_INTRO_SUFFIXES.length)
  return RELOAD_INTRO_SUFFIXES[i]!
}

/** Title copy for the reload intro — last focused main-canvas plate, or pocket name. */
export function resolveReloadIntroCopy(): ReloadIntroCopy {
  const suffix = pickRandomReloadIntroSuffix()
  const { activeCanvasId, spaces } = useCanvasWorkspaceStore.getState()

  if (activeCanvasId !== 'main') {
    const raw = spaces[activeCanvasId]?.name ?? DEFAULT_SPACE_NAME
    const name = isDefaultSpaceName(raw) ? DEFAULT_SPACE_NAME_PLACEHOLDER : raw.trim()
    return { name, suffix }
  }

  return { name: '', suffix }
}
