import { useRef, useState, useEffect, useLayoutEffect, type CSSProperties } from 'react'
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
  completeTrackPreviewSession,
  TRACK_PREVIEW_TRIGGER,
} from './previewAudioEffects'

export default function ProfilePinnedTrack({ track }: { track: PinnedTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cutoffCleanupRef = useRef<(() => void) | null>(null)
  const togglingRef = useRef(false)
  const titleViewportRef = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)
  const [titleOverflowPx, setTitleOverflowPx] = useState(0)

  useLayoutEffect(() => {
    const viewport = titleViewportRef.current
    if (!viewport) return
    const title = viewport.querySelector('.profile-track-preview__title')
    if (!(title instanceof HTMLElement)) return

    const measure = () => {
      setTitleOverflowPx(Math.max(0, title.scrollWidth - viewport.clientWidth))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [track.title])

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
    setPlaying(false)
  }

  async function stopPreview() {
    const audio = audioRef.current
    if (audio) unbindActiveProfilePreview(audio)
    if (audio) await stopPreviewPlayback(audio)
    notifyPreviewStopped()
  }

  async function togglePlay() {
    if (togglingRef.current) return
    togglingRef.current = true

    const audio = audioRef.current
    try {
      if (!audio) return
      if (playing) {
        await stopPreview()
        return
      }

      bindActiveProfilePreview(audio, notifyPreviewStopped, track.startTime, track.endTime)
      await startPreviewPlayback(audio, track.preview, track.startTime)
      setPlaying(true)
      clearCutoffMonitor()
      cutoffCleanupRef.current = bindPreviewEndCutoff(audio, {
        startTime: track.startTime,
        endTime: track.endTime,
        onFadeComplete: () => {
          unbindActiveProfilePreview(audio)
          void completeTrackPreviewSession().then(notifyPreviewStopped)
        },
      })
    } catch {
      setPlaying(false)
    } finally {
      togglingRef.current = false
    }
  }

  return (
    <div style={{ marginTop: 8, textAlign: 'center' }}>
      <button
        type="button"
        className="profile-track-preview"
        data-profile-track-playing={playing ? '' : undefined}
        data-title-marquee={playing && titleOverflowPx > 0 ? '' : undefined}
        {...{ [TRACK_PREVIEW_TRIGGER]: '' }}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
        onClick={() => void togglePlay()}
        style={{
          ...(titleOverflowPx > 0
            ? ({
                '--profile-track-title-overflow': `${titleOverflowPx}px`,
              } as CSSProperties)
            : undefined),
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
        <span className="profile-track-preview__art-wrap" aria-hidden>
          <img
            className="profile-track-preview__art"
            src={track.art}
            alt=""
            width={22}
            height={22}
          />
        </span>
        <span ref={titleViewportRef} className="profile-track-preview__title-wrap">
          <span
            className="profile-track-preview__title"
            style={{ color: font.colorPrimary }}
          >
            {track.title}
          </span>
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
