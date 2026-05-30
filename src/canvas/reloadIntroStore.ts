import { create } from 'zustand'
import type { ReloadIntroCopy } from './reloadIntroCopy'
import {
  playReloadIntroArriveSound,
  playReloadIntroDismissSound,
} from '../sound/reloadIntroSound'

export type ReloadIntroPhase = 'idle' | 'armed' | 'revealing' | 'done'

type ReloadIntroState = {
  phase: ReloadIntroPhase
  panDirX: number
  panDirY: number
  copy: ReloadIntroCopy
  arm: (copy: ReloadIntroCopy) => void
  reveal: (dirX: number, dirY: number) => void
  dismiss: () => void
  finish: () => void
}

const DEFAULT_COPY: ReloadIntroCopy = { name: 'studio', suffix: '<3' }

function syncDom(phase: ReloadIntroPhase) {
  const root = document.documentElement
  if (phase === 'armed' || phase === 'revealing') {
    root.setAttribute('data-reload-intro', '')
  } else {
    root.removeAttribute('data-reload-intro')
  }
}

export const useReloadIntroStore = create<ReloadIntroState>((set, get) => ({
  phase: 'idle',
  panDirX: 0,
  panDirY: -1,
  copy: DEFAULT_COPY,

  arm: (copy) => {
    if (get().phase !== 'idle') return
    set({ phase: 'armed', copy })
    syncDom('armed')
    playReloadIntroArriveSound()
  },

  reveal: (dirX, dirY) => {
    if (get().phase !== 'armed') return
    const len = Math.hypot(dirX, dirY)
    const panDirX = len > 0.001 ? dirX / len : 0
    const panDirY = len > 0.001 ? dirY / len : -1
    set({ phase: 'revealing', panDirX, panDirY })
    syncDom('revealing')
    playReloadIntroDismissSound()
  },

  finish: () => {
    set({ phase: 'done' })
    syncDom('done')
  },

  dismiss: () => {
    get().reveal(0, -1)
  },
}))

export function isReloadIntroArmed(): boolean {
  return useReloadIntroStore.getState().phase === 'armed'
}
