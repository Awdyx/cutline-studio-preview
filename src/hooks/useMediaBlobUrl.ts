import { useEffect, useState } from 'react'
import {
  releaseMediaObjectUrl,
  releaseSnapshotObjectUrl,
  resolveMediaObjectUrl,
  resolveSnapshotObjectUrl,
} from '../media/mediaObjectUrlCache'

export type MediaBlobStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useMediaBlobUrl(
  mediaId: string | null | undefined,
  itemId?: string,
): {
  url: string | undefined
  status: MediaBlobStatus
} {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<MediaBlobStatus>('idle')

  useEffect(() => {
    if (!mediaId) {
      setUrl(undefined)
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')
    setUrl(undefined)

    void resolveMediaObjectUrl(mediaId, itemId)
      .then((objectUrl) => {
        if (cancelled) {
          if (objectUrl) releaseMediaObjectUrl(mediaId)
          return
        }
        if (!objectUrl) {
          setUrl(undefined)
          setStatus('error')
          return
        }
        setUrl(objectUrl)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      releaseMediaObjectUrl(mediaId)
    }
  }, [mediaId, itemId])

  return { url, status }
}

export function useSnapshotBlobUrl(
  snapshotId: string | null | undefined,
): {
  url: string | undefined
  status: MediaBlobStatus
} {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<MediaBlobStatus>('idle')

  useEffect(() => {
    if (!snapshotId) {
      setUrl(undefined)
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')
    setUrl(undefined)

    void resolveSnapshotObjectUrl(snapshotId)
      .then((objectUrl) => {
        if (cancelled) {
          if (objectUrl) releaseSnapshotObjectUrl(snapshotId)
          return
        }
        if (!objectUrl) {
          setUrl(undefined)
          setStatus('error')
          return
        }
        setUrl(objectUrl)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      releaseSnapshotObjectUrl(snapshotId)
    }
  }, [snapshotId])

  return { url, status }
}
