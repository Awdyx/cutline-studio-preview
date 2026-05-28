import { useEffect } from 'react'
import { idleAfterFirstPaint, isTouchFirstDevice } from '../platform/compositor'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { backgroundMusic } from '../sound/backgroundMusic'
import { syncBackgroundMusicEnclosedAcoustics } from '../sound/backgroundMusicAcoustics'
import { useSoundStore } from '../sound/soundStore'
import { unlockAudioFromUserGesture } from '../sound/unlockAudio'

export function useBackgroundMusic() {
  useEffect(() => {
    const sync = () => {
      const { musicEnabled, hydrated } = useSoundStore.getState()
      if (!hydrated) return
      backgroundMusic.sync(musicEnabled)
    }

    syncBackgroundMusicEnclosedAcoustics()

    const startSync = () => sync()

    if (isTouchFirstDevice()) {
      const startPreload = () => backgroundMusic.preload()
      document.addEventListener('pointerdown', startPreload, { once: true, capture: true })
      void idleAfterFirstPaint(1200).then(startPreload)
      void idleAfterFirstPaint(400).then(startSync)
    } else {
      backgroundMusic.preload()
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(startSync, { timeout: 200 })
      } else {
        setTimeout(startSync, 0)
      }
    }

    const unsubSound = useSoundStore.subscribe(sync)
    const unsubWorkspace = useCanvasWorkspaceStore.subscribe(() => {
      syncBackgroundMusicEnclosedAcoustics()
    })
    const unsubStudyFocus = useCanvasItemsStore.subscribe(() => {
      syncBackgroundMusicEnclosedAcoustics()
    })

    function unlock() {
      unlockAudioFromUserGesture()
    }

    document.addEventListener('pointerdown', unlock, { capture: true })
    document.addEventListener('keydown', unlock, { capture: true })

    return () => {
      unsubSound()
      unsubWorkspace()
      unsubStudyFocus()
      document.removeEventListener('pointerdown', unlock, { capture: true })
      document.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])
}
