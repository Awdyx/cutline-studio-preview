import type { CSSProperties, ReactNode } from 'react'
import type { MediaBlobStatus } from '../hooks/useMediaBlobUrl'

const PLACEHOLDER_FADE_MS = 280

export function mediaLoadOpacity(status: MediaBlobStatus): number {
  return status === 'ready' ? 1 : 0
}

export function mediaPlaceholderOpacity(status: MediaBlobStatus): number {
  return status === 'ready' ? 0 : 1
}

export function mediaLoadTransitionStyle(): CSSProperties {
  return {
    transition: `opacity ${PLACEHOLDER_FADE_MS}ms ease-out`,
  }
}

export function MediaLoadPlaceholder({
  status,
  style,
}: {
  status: MediaBlobStatus
  style?: CSSProperties
}) {
  if (status === 'idle') return null
  return (
    <div
      aria-hidden
      className="media-load-placeholder"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: mediaPlaceholderOpacity(status),
        pointerEvents: 'none',
        ...mediaLoadTransitionStyle(),
        ...style,
      }}
    />
  )
}

export function MediaBlobFrame({
  status,
  children,
  style,
}: {
  status: MediaBlobStatus
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <MediaLoadPlaceholder status={status} />
      {children}
    </div>
  )
}
