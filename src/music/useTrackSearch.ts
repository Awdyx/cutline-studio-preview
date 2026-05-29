import { useState, useRef, useEffect, useCallback } from 'react'
import { resolveInput } from './musicApi'
import type { Track } from './musicApi'

export type TrackSearchStatus = 'idle' | 'searching' | 'ready' | 'empty' | 'spotify' | 'error'

export function useTrackSearch({ debounce = 350 } = {}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [status, setStatus] = useState<TrackSearchStatus>('idle')
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    const v = query.trim()
    if (!v) {
      setResults([])
      setStatus('idle')
      return
    }
    setStatus('searching')
    timer.current = setTimeout(async () => {
      const mine = ++seq.current
      try {
        const { kind, tracks } = await resolveInput(v)
        if (mine !== seq.current) return
        if (kind === 'spotify') {
          setResults([])
          setStatus('spotify')
          return
        }
        setResults(tracks)
        setStatus(tracks.length ? 'ready' : 'empty')
      } catch {
        if (mine === seq.current) setStatus('error')
      }
    }, debounce)
    return () => clearTimeout(timer.current)
  }, [query, debounce])

  const reset = useCallback(() => {
    setQuery('')
    setResults([])
    setStatus('idle')
  }, [])

  return { query, setQuery, results, status, reset }
}
