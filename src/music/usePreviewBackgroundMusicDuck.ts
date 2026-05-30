import { useEffect, useRef } from 'react'
import { restoreBackgroundMusicAfterPreview, isProfilePreviewOutroActive } from './previewAudioEffects'

export function usePreviewBackgroundMusicDuck(): {
  onPreviewStarted: () => void
  onPreviewStopped: () => void
} {
  const duckingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!duckingRef.current) return
      if (isProfilePreviewOutroActive()) return
      restoreBackgroundMusicAfterPreview()
      duckingRef.current = false
    }
  }, [])

  return {
    onPreviewStarted: () => {
      duckingRef.current = true
    },
    onPreviewStopped: () => {
      if (!duckingRef.current) return
      restoreBackgroundMusicAfterPreview()
      duckingRef.current = false
    },
  }
}
