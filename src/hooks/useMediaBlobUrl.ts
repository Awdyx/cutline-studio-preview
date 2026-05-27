import { useEffect, useState } from 'react'
import {
  releaseMediaObjectUrl,
  releaseSnapshotObjectUrl,
  resolveMediaObjectUrl,
  resolveSnapshotObjectUrl,
} from '../media/mediaObjectUrlCache'

export type MediaBlobStatus = 'idle' | 'loading' | 'ready' | 'error'

const BLOB_RESOLVE_MAX_ATTEMPTS = 20
const BLOB_RESOLVE_RETRY_MS = 100

async function resolveMediaObjectUrlWithRetry(
  mediaId: string,
  itemId?: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < BLOB_RESOLVE_MAX_ATTEMPTS; attempt++) {
    const objectUrl = await resolveMediaObjectUrl(mediaId, itemId)
    if (objectUrl) return objectUrl
    if (attempt < BLOB_RESOLVE_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, BLOB_RESOLVE_RETRY_MS)
      })
    }
  }
  return null
}

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

    void resolveMediaObjectUrlWithRetry(mediaId, itemId)
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
