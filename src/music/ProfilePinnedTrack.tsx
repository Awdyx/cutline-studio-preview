import { useRef, useState, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { font } from '../styles/tokens'
import type { PinnedTrack } from '../profile/types'
import {
  startPreviewPlayback,
  stopPreviewPlayback,
  bindPreviewEndCutoff,
  bindActiveProfilePreview,
  unbindActiveProfilePreview,
  stopActiveProfilePreviewPlayback,
} from './previewAudioEffects'
import { usePreviewBackgroundMusicDuck } from './usePreviewBackgroundMusicDuck'

export default function ProfilePinnedTrack({ track }: { track: PinnedTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cutoffCleanupRef = useRef<(() => void) | null>(null)
  const { onPreviewStarted, onPreviewStopped } = usePreviewBackgroundMusicDuck()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => {
      void stopActiveProfilePreviewPlayback()
    }
  }, [])

  function clearCutoffMonitor() {
    cutoffCleanupRef.current?.()
    cutoffCleanupRef.current = null
  }

  function notifyPreviewStopped() {
    clearCutoffMonitor()
    onPreviewStopped()
    setPlaying(false)
  }

  async function stopPreview() {
    const audio = audioRef.current
    if (audio) unbindActiveProfilePreview(audio)
    notifyPreviewStopped()
    if (audio) await stopPreviewPlayback(audio)
  }

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      await stopPreview()
      return
    }

    try {
      await startPreviewPlayback(audio, track.preview, track.startTime)
      onPreviewStarted()
      setPlaying(true)
      bindActiveProfilePreview(audio, notifyPreviewStopped, track.startTime, track.endTime)
      clearCutoffMonitor()
      cutoffCleanupRef.current = bindPreviewEndCutoff(audio, {
        startTime: track.startTime,
        endTime: track.endTime,
        onFadeComplete: () => {
          unbindActiveProfilePreview(audio)
          notifyPreviewStopped()
        },
      })
    } catch {
      onPreviewStopped()
      setPlaying(false)
    }
  }

  return (
    <div style={{ marginTop: 8, textAlign: 'center' }}>
      <button
        type="button"
        aria-label={playing ? 'Pause preview' : 'Play preview'}
        onClick={() => void togglePlay()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 9px 4px 4px',
          borderRadius: 20,
          border: '1px solid var(--glass-border)',
          background: playing ? 'rgba(20, 30, 50, 0.06)' : 'transparent',
          cursor: 'pointer',
          maxWidth: '100%',
          transition: 'background 0.15s ease',
          fontFamily: font.family,
        }}
      >
        <img
          src={track.art}
          alt=""
          width={22}
          height={22}
          style={{
            borderRadius: 11,
            objectFit: 'cover',
            flexShrink: 0,
            display: 'block',
          }}
        />
        <span
          style={{
            flex: '1 1 0',
            minWidth: 0,
            fontSize: 12,
            fontWeight: 500,
            color: font.colorPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {track.title}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            color: font.colorFaint,
            marginLeft: 1,
          }}
        >
          {playing ? (
            <Pause size={11} strokeWidth={2} />
          ) : (
            <Play size={11} strokeWidth={2} />
          )}
        </span>
      </button>
      {/* src is assigned in preparePreviewForPlayback so crossOrigin applies before load */}
      <audio ref={audioRef} onEnded={() => void stopPreview()} preload="none" />
    </div>
  )
}
