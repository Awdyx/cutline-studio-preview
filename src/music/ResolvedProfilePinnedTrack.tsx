import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { font } from '../styles/tokens'
import { lookupTrack } from './musicApi'
import ProfilePinnedTrack from './ProfilePinnedTrack'
import type { PinnedTrack } from '../profile/types'

function LoadingTrackPill({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 8, textAlign: 'center' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 9px 4px 4px',
          borderRadius: 20,
          border: '1px solid var(--glass-border)',
          maxWidth: '100%',
          fontFamily: font.family,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            background: 'rgba(20, 30, 50, 0.08)',
            flexShrink: 0,
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
          {title}
        </span>
        <span style={{ display: 'flex', flexShrink: 0, color: font.colorFaint }}>
          <Play size={11} strokeWidth={2} />
        </span>
      </span>
    </div>
  )
}

export default function ResolvedProfilePinnedTrack({
  track,
  appleMusicUrl,
}: {
  track?: PinnedTrack | null
  appleMusicUrl?: string
}) {
  const [resolved, setResolved] = useState<PinnedTrack | null>(
    track?.preview ? track : null,
  )

  useEffect(() => {
    if (track?.preview) {
      setResolved(track)
      return
    }
    const input = appleMusicUrl ?? (track?.id ? track.id : null)
    if (!input) return

    let cancelled = false
    lookupTrack(input).then((t) => {
      if (cancelled || !t) return
      setResolved({
        id: t.id,
        title: t.title,
        artist: t.artist,
        art: t.art,
        preview: t.preview,
        startTime: track?.startTime ?? 0,
      })
    })

    return () => {
      cancelled = true
    }
  }, [track, appleMusicUrl])

  if (resolved) return <ProfilePinnedTrack track={resolved} />
  if (track?.title) return <LoadingTrackPill title={track.title} />
  return null
}
