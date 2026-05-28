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
    let touchMusicReady = !isTouchFirstDevice()

    const sync = () => {
      const { musicEnabled, hydrated } = useSoundStore.getState()
      if (!hydrated || !touchMusicReady) return
      backgroundMusic.sync(musicEnabled)
    }

    syncBackgroundMusicEnclosedAcoustics()

    let unsubHydrated: (() => void) | undefined
    let idlePreload: Promise<void> | undefined
    let idleSync: Promise<void> | undefined

    function startTouchIdleFallbacks() {
      touchMusicReady = true
      idlePreload = idleAfterFirstPaint(2000).then(() => backgroundMusic.preload())
      idleSync = idleAfterFirstPaint(1200).then(sync)
    }

    function attachGestureUnlock() {
      function unlock() {
        touchMusicReady = true
        unlockAudioFromUserGesture()
        sync()
      }

      document.addEventListener('pointerdown', unlock, { capture: true })
      document.addEventListener('keydown', unlock, { capture: true })

      return () => {
        document.removeEventListener('pointerdown', unlock, { capture: true })
        document.removeEventListener('keydown', unlock, { capture: true })
      }
    }

    let removeGestureUnlock = attachGestureUnlock()

    if (isTouchFirstDevice()) {
      removeGestureUnlock()

      const startTouchAudio = () => {
        startTouchIdleFallbacks()
        removeGestureUnlock = attachGestureUnlock()
      }

      if (useSoundStore.getState().hydrated) {
        startTouchAudio()
      } else {
        unsubHydrated = useSoundStore.subscribe((state) => {
          if (!state.hydrated) return
          unsubHydrated?.()
          unsubHydrated = undefined
          startTouchAudio()
        })
      }
    } else {
      backgroundMusic.preload()
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(sync, { timeout: 200 })
      } else {
        setTimeout(sync, 0)
      }
    }

    const unsubSound = useSoundStore.subscribe(sync)
    const unsubWorkspace = useCanvasWorkspaceStore.subscribe(() => {
      syncBackgroundMusicEnclosedAcoustics()
    })
    const unsubStudyFocus = useCanvasItemsStore.subscribe(() => {
      syncBackgroundMusicEnclosedAcoustics()
    })

    return () => {
      unsubHydrated?.()
      void idlePreload
      void idleSync
      removeGestureUnlock()
      unsubSound()
      unsubWorkspace()
      unsubStudyFocus()
    }
  }, [])
}
