import { useRef, useState, useEffect, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import { font } from '../styles/tokens'
import {
  startPreviewPlayback,
  stopPreviewPlayback,
  bindPreviewEndCutoff,
  unbindPreviewEndCutoff,
  completeTrackPreviewSession,
  TRACK_PREVIEW_TRIGGER,
} from './previewAudioEffects'

const FALLBACK_DURATION = 30
const MIN_CLIP = 1

interface TrackScrubberProps {
  previewUrl: string
  startTime: number
  endTime: number
  onStartTimeChange: (t: number) => void
  onEndTimeChange: (t: number) => void
}

type DragTarget = 'start' | 'end' | null

const handleStyle = (dragging: boolean): CSSProperties => ({
  position: 'absolute',
  transform: `translateX(-50%) scale(${dragging ? 1.25 : 1})`,
  width: 3,
  height: 16,
  borderRadius: 999,
  background: 'var(--ui-accent)',
  boxShadow: dragging
    ? '0 0 0 4px rgba(var(--ui-accent-rgb, 100,120,200), 0.18)'
    : 'none',
  cursor: 'ew-resize',
  zIndex: 2,
  willChange: 'left, transform',
  transformOrigin: 'center center',
  touchAction: 'none',
})

export default function TrackScrubber({
  previewUrl,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: TrackScrubberProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cutoffCleanupRef = useRef<(() => void) | null>(null)
  const previewSessionActiveRef = useRef(false)
  const togglingRef = useRef(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(startTime)
  const [duration, setDuration] = useState(FALLBACK_DURATION)
  const [dragging, setDragging] = useState<DragTarget>(null)
  const [snapping, setSnapping] = useState(false)

  useEffect(() => {
    return () => {
      cutoffCleanupRef.current?.()
      cutoffCleanupRef.current = null
      if (audioRef.current) unbindPreviewEndCutoff(audioRef.current)
      if (!previewSessionActiveRef.current) return
      previewSessionActiveRef.current = false
      void stopPreviewPlayback(audioRef.current!)
    }
  }, [])

  useEffect(() => {
    if (!playing && !dragging) setPlayhead(startTime)
  }, [startTime, playing, dragging])

  function clearCutoffMonitor() {
    cutoffCleanupRef.current?.()
    cutoffCleanupRef.current = null
  }

  function attachCutoffMonitor(audio: HTMLAudioElement) {
    clearCutoffMonitor()
    cutoffCleanupRef.current = bindPreviewEndCutoff(audio, {
      startTime,
      endTime,
      onFadeComplete: () => {
        clearCutoffMonitor()
        previewSessionActiveRef.current = false
        void completeTrackPreviewSession().then(() => {
          setPlaying(false)
          setSnapping(true)
          setPlayhead(startTime)
          setTimeout(() => setSnapping(false), 600)
        })
      },
    })
  }

  useEffect(() => {
    if (!playing) return
    const audio = audioRef.current
    if (!audio) return
    attachCutoffMonitor(audio)
  }, [playing, startTime, endTime])

  async function stopScrubberPreview() {
    const audio = audioRef.current
    clearCutoffMonitor()
    setPlaying(false)
    previewSessionActiveRef.current = false
    if (audio) await stopPreviewPlayback(audio)
  }

  async function togglePlay() {
    if (togglingRef.current) return
    togglingRef.current = true

    const audio = audioRef.current
    try {
      if (!audio) return
      if (playing) {
        await stopScrubberPreview()
        return
      }

      await startPreviewPlayback(audio, previewUrl, startTime)
      previewSessionActiveRef.current = true
      setPlayhead(startTime)
      setPlaying(true)
    } catch {
      previewSessionActiveRef.current = false
      setPlaying(false)
    } finally {
      togglingRef.current = false
    }
  }

  function clampStart(t: number) {
    return Math.max(0, Math.min(t, endTime - MIN_CLIP))
  }

  function clampEnd(t: number) {
    return Math.max(startTime + MIN_CLIP, Math.min(t, duration))
  }

  function timeFromClientX(clientX: number): number {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }

  function handlePointerDown(target: DragTarget) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(target)
      setSnapping(false)
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const t = timeFromClientX(e.clientX)
    if (dragging === 'start') {
      const next = clampStart(t)
      onStartTimeChange(next)
      setPlayhead(next)
      if (audioRef.current && playing) audioRef.current.currentTime = next
    } else {
      const next = clampEnd(t)
      onEndTimeChange(next)
      if (audioRef.current && playing && audioRef.current.currentTime > next) {
        audioRef.current.currentTime = next
        setPlayhead(next)
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(null)
  }

  const startPct = (startTime / duration) * 100
  const endPct = (endTime / duration) * 100
  const playheadPct = (Math.min(playhead, endTime) / duration) * 100
  const fillWidth = Math.max(0, playheadPct - startPct)
  const livePos = playing || dragging !== null

  const handleTransition = livePos
    ? 'none'
    : snapping
      ? 'left 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.18s ease'
      : 'left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.18s ease'

  function fmt(s: number) {
    const secs = Math.floor(Math.max(0, s))
    return `0:${String(secs).padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        {...{ [TRACK_PREVIEW_TRIGGER]: '' }}
        aria-label={playing ? 'Pause preview' : 'Play from start point'}
        onClick={togglePlay}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 8,
          border: '1px solid var(--glass-border)',
          background: playing ? 'rgba(20,30,50,0.06)' : 'var(--card-bg)',
          color: font.colorMuted,
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={playing ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {playing ? (
              <Pause size={12} strokeWidth={2.2} />
            ) : (
              <Play size={12} strokeWidth={2.2} />
            )}
          </motion.span>
        </AnimatePresence>
      </button>

      <div
        ref={trackRef}
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          height: 30,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 3,
            background: 'var(--ui-divider)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            height: 4,
            borderRadius: 3,
            background: 'var(--ui-accent)',
            opacity: 0.2,
            transition: livePos ? 'none' : 'left 0.25s ease, width 0.25s ease',
          }}
        />

        {playing && (
          <div
            style={{
              position: 'absolute',
              left: `${startPct}%`,
              width: `${fillWidth}%`,
              height: 4,
              borderRadius: 3,
              background: 'var(--ui-accent)',
              opacity: 0.45,
              transition: 'none',
            }}
          />
        )}

        {playing && (
          <div
            style={{
              position: 'absolute',
              left: `${playheadPct}%`,
              transform: 'translateX(-50%)',
              width: 2,
              height: 10,
              borderRadius: 999,
              background: 'var(--ui-accent)',
              opacity: 0.85,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}

        <div
          role="slider"
          aria-label="Start time"
          aria-valuemin={0}
          aria-valuemax={endTime - MIN_CLIP}
          aria-valuenow={startTime}
          style={{
            ...handleStyle(dragging === 'start'),
            left: `${startPct}%`,
            transition: handleTransition,
          }}
          onPointerDown={handlePointerDown('start')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        <div
          role="slider"
          aria-label="End time"
          aria-valuemin={startTime + MIN_CLIP}
          aria-valuemax={duration}
          aria-valuenow={endTime}
          style={{
            ...handleStyle(dragging === 'end'),
            left: `${endPct}%`,
            transition: handleTransition,
          }}
          onPointerDown={handlePointerDown('end')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          color: font.colorMuted,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          width: 26,
          textAlign: 'right',
          letterSpacing: '0.02em',
        }}
      >
        {fmt(endTime - startTime)}
      </span>

      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={() => {
          const audio = audioRef.current
          if (!audio) return
          setPlayhead(audio.currentTime)
        }}
        onDurationChange={() => {
          const d = audioRef.current?.duration
          if (d && isFinite(d) && d > 0) setDuration(d)
        }}
        onEnded={() => {
          void (async () => {
            await stopScrubberPreview()
            setSnapping(true)
            setPlayhead(startTime)
            setTimeout(() => setSnapping(false), 600)
          })()
        }}
      />
    </div>
  )
}
