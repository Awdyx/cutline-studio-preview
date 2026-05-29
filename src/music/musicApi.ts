/**
 * musicApi.ts — zero-dependency music search + preview engine.
 *
 * Powered by the public iTunes Search API. No API key, no signup, no backend.
 *
 * ⚠️ KEEP THESE CALLS CLIENT-SIDE. The API rate-limits ~20 requests/min per IP.
 * Per-user (per-device) calls scale fine. Proxying through one server IP would
 * throttle your whole userbase at once. This module uses JSONP, which only
 * works in the browser anyway — that's intentional, not a limitation.
 */

export type Track = {
  id: number
  title: string
  artist: string
  album: string
  art: string
  preview: string
  link: string
  duration: number
}

const ENDPOINT = 'https://itunes.apple.com'

function jsonp(path: string, { timeout = 8000 } = {}): Promise<{ results?: unknown[] }> {
  return new Promise((resolve, reject) => {
    const cb = 'itcb_' + Math.random().toString(36).slice(2)
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('iTunes API timeout'))
    }, timeout)

    function cleanup() {
      clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[cb]
      script.remove()
    }

    ;(window as unknown as Record<string, unknown>)[cb] = (data: { results?: unknown[] }) => {
      cleanup()
      resolve(data)
    }

    script.onerror = () => {
      cleanup()
      reject(new Error('iTunes API network error'))
    }

    script.src = `${ENDPOINT}/${path}${path.includes('?') ? '&' : '?'}callback=${cb}`
    document.body.appendChild(script)
  })
}

export function upgradeArtwork(url: string, size = 400): string {
  return (url || '').replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
}

function normalize(r: Record<string, unknown>): Track {
  return {
    id: r.trackId as number,
    title: r.trackName as string,
    artist: r.artistName as string,
    album: r.collectionName as string,
    art: upgradeArtwork(r.artworkUrl100 as string),
    preview: r.previewUrl as string,
    link: r.trackViewUrl as string,
    duration: r.trackTimeMillis as number,
  }
}

export function parseAppleId(url: string): string | null {
  const m = (url || '').match(
    /music\.apple\.com\/[a-z]{2}\/(?:song\/[^/]+\/(\d+)|album\/[^/]+\/\d+\?i=(\d+))/i,
  )
  return m ? (m[1] ?? m[2] ?? null) : null
}

export function isSpotifyLink(url: string): boolean {
  return /open\.spotify\.com|spotify\.link|spotify\.app\.link/i.test(url || '')
}

export async function searchSongs(
  term: string,
  { limit = 8, country = 'US' } = {},
): Promise<Track[]> {
  if (!term || !term.trim()) return []
  const data = await jsonp(
    `search?term=${encodeURIComponent(term.trim())}&media=music&entity=song&limit=${limit}&country=${country}`,
  )
  return ((data.results || []) as Record<string, unknown>[])
    .filter((r) => r.previewUrl)
    .map(normalize)
}

export async function lookupTrack(idOrUrl: string | number): Promise<Track | null> {
  const id =
    typeof idOrUrl === 'string' && idOrUrl.includes('http')
      ? parseAppleId(idOrUrl)
      : idOrUrl
  if (!id) return null
  const data = await jsonp(`lookup?id=${id}`)
  const t = ((data.results || []) as Record<string, unknown>[]).map(normalize)[0]
  return t && t.preview ? t : null
}

export async function resolveInput(
  input: string,
): Promise<{ kind: 'results' | 'spotify' | 'empty'; tracks: Track[] }> {
  const v = (input || '').trim()
  if (!v) return { kind: 'empty', tracks: [] }
  if (isSpotifyLink(v)) return { kind: 'spotify', tracks: [] }
  if (parseAppleId(v)) {
    const t = await lookupTrack(v)
    return { kind: 'results', tracks: t ? [t] : [] }
  }
  return { kind: 'results', tracks: await searchSongs(v) }
}
