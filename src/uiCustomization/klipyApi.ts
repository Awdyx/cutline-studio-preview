export type KlipyMediaKind = 'gifs' | 'stickers'

export interface KlipyMediaResult {
  id: string
  url: string
  previewUrl: string
  width: number
  height: number
}

const KLIPY_BASE = 'https://api.klipy.com/api/v1'
const CUSTOMER_ID_KEY = 'cutline-klipy-customer-id'

export const KLIPY_DEFAULT_TERMS = [
  'korean aesthetic',
  'y2k',
  'frutiger aero',
  'chiikawa',
  'miku',
  'evangelion',
  'dreamcore',
  'low poly',
  'bsod',
  'blue aesthetic',
  'pink aesthetic',
  'green aesthetic',
  'red aesthetic',
  'purple aesthetic',
  'yellow aesthetic',
  'cybercore',
  'cute cats',
  'med school aesthetic',
] as const

const DEFAULT_FEED_TERM_COUNT = 10
const DEFAULT_FEED_TOTAL = 42
/** KLIPY search requires per_page >= 8. */
const DEFAULT_FEED_PER_TERM = 8

const FEED_CACHE_KEY = (kind: KlipyMediaKind) => `cutline-klipy-feed-${kind}`
const FEED_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

type PersistedFeed = { results: KlipyMediaResult[]; fetchedAt: number }

function readPersistedFeed(kind: KlipyMediaKind): KlipyMediaResult[] | null {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY(kind))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedFeed
    if (Date.now() - parsed.fetchedAt > FEED_CACHE_TTL_MS) {
      localStorage.removeItem(FEED_CACHE_KEY(kind))
      return null
    }
    return parsed.results
  } catch {
    return null
  }
}

function writePersistedFeed(kind: KlipyMediaKind, results: KlipyMediaResult[]) {
  try {
    const payload: PersistedFeed = { results, fetchedAt: Date.now() }
    localStorage.setItem(FEED_CACHE_KEY(kind), JSON.stringify(payload))
  } catch {
    // localStorage quota exceeded — silently skip persistence
  }
}

const defaultFeedCache = new Map<KlipyMediaKind, KlipyMediaResult[]>()

export class KlipyRateLimitError extends Error {
  constructor() {
    super('KLIPY rate limit exceeded')
    this.name = 'KlipyRateLimitError'
  }
}

export function isKlipyRateLimitError(err: unknown): err is KlipyRateLimitError {
  return err instanceof KlipyRateLimitError
}

type KlipyFileFormat = {
  url?: string
  width?: number
  height?: number
}

type KlipyFileTier = {
  gif?: KlipyFileFormat
  webp?: KlipyFileFormat
  png?: KlipyFileFormat
}

type KlipyItem = {
  id?: number | string
  slug?: string
  type?: string
  file?: {
    hd?: KlipyFileTier
    md?: KlipyFileTier
    sm?: KlipyFileTier
    xs?: KlipyFileTier
  }
}

function klipyAppKey(): string | null {
  const key = import.meta.env.VITE_KLIPY_APP_KEY
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null
}

export function isKlipyConfigured(): boolean {
  return klipyAppKey() != null
}

function klipyCustomerId(): string {
  if (typeof localStorage === 'undefined') return 'cutline-anon'
  const existing = localStorage.getItem(CUSTOMER_ID_KEY)
  if (existing) return existing
  const id = `cutline-${crypto.randomUUID()}`
  localStorage.setItem(CUSTOMER_ID_KEY, id)
  return id
}

function klipyLocale(): string {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  const region = lang.split('-')[1]?.toLowerCase()
  if (region === 'gb') return 'uk'
  if (region && region.length === 2) return region
  return 'us'
}

function pickFormat(
  tier: KlipyFileTier | undefined,
  prefer: 'webp' | 'gif' | 'png',
): KlipyFileFormat | undefined {
  if (!tier) return undefined
  if (prefer === 'png') return tier.png ?? tier.webp ?? tier.gif
  if (prefer === 'webp') return tier.webp ?? tier.png ?? tier.gif
  return tier.gif ?? tier.webp ?? tier.png
}

function parseKlipyItem(
  item: KlipyItem,
  kind: KlipyMediaKind,
): KlipyMediaResult | null {
  if (item.type === 'ad') return null
  const file = item.file
  if (!file) return null

  const fullPrefer = kind === 'stickers' ? 'png' : 'gif'
  const full = pickFormat(file.md ?? file.hd ?? file.sm, fullPrefer)
  const preview = pickFormat(file.sm ?? file.xs ?? file.md, 'webp')
  if (!full?.url) return null

  const width = full.width ?? preview?.width ?? 200
  const height = full.height ?? preview?.height ?? 200
  const id =
    item.slug ??
    (item.id != null ? String(item.id) : null) ??
    full.url

  return {
    id,
    url: full.url,
    previewUrl: preview?.url ?? full.url,
    width,
    height,
  }
}

function pickRandomTerms(count: number): string[] {
  const pool = [...KLIPY_DEFAULT_TERMS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

function shuffleResults(items: KlipyMediaResult[]): KlipyMediaResult[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function dedupeResults(items: KlipyMediaResult[]): KlipyMediaResult[] {
  const seen = new Set<string>()
  const out: KlipyMediaResult[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

async function fetchKlipyPage(
  kind: KlipyMediaKind,
  query: string,
  page: number,
  perPage: number,
  signal: AbortSignal,
): Promise<KlipySearchPage> {
  const appKey = klipyAppKey()
  if (!appKey) {
    throw new Error('KLIPY app key is not configured')
  }

  const trimmed = query.trim()
  const effectivePerPage = trimmed
    ? Math.max(8, Math.min(50, perPage))
    : Math.max(1, Math.min(50, perPage))
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    per_page: String(effectivePerPage),
    customer_id: klipyCustomerId(),
    locale: klipyLocale(),
    content_filter: 'high',
  })

  const path = trimmed
    ? `${kind}/search?${params}&q=${encodeURIComponent(trimmed)}`
    : `${kind}/trending?${params}`

  const res = await fetch(`${KLIPY_BASE}/${appKey}/${path}`, { signal })
  if (res.status === 429) throw new KlipyRateLimitError()
  if (!res.ok) throw new Error(`KLIPY request failed: ${res.status}`)

  const payload = (await res.json()) as {
    result?: boolean
    data?: {
      data?: KlipyItem[]
      has_next?: boolean
      current_page?: number
    }
  }

  const items = payload.data?.data
  if (!Array.isArray(items)) {
    return { results: [], hasNext: false, page }
  }

  const results = items.flatMap((item) => {
    const parsed = parseKlipyItem(item, kind)
    return parsed ? [parsed] : []
  })

  return {
    results,
    hasNext: payload.data?.has_next === true,
    page: payload.data?.current_page ?? page,
  }
}

export async function loadKlipyDefaultFeed(
  kind: KlipyMediaKind,
  signal: AbortSignal,
): Promise<KlipySearchPage> {
  // 1. In-memory cache (fastest — same session, same tab)
  const cached = defaultFeedCache.get(kind)
  if (cached?.length) {
    return { results: cached, hasNext: false, page: 1 }
  }

  // 2. localStorage cache (persists across sessions, expires after 1 week)
  const persisted = readPersistedFeed(kind)
  if (persisted?.length) {
    defaultFeedCache.set(kind, persisted)
    return { results: persisted, hasNext: false, page: 1 }
  }

  const terms = pickRandomTerms(DEFAULT_FEED_TERM_COUNT)
  const merged: KlipyMediaResult[] = []
  let rateLimited = false

  for (const term of terms) {
    if (dedupeResults(merged).length >= DEFAULT_FEED_TOTAL) break
    try {
      const page = await fetchKlipyPage(kind, term, 1, DEFAULT_FEED_PER_TERM, signal)
      merged.push(...page.results)
    } catch (err) {
      if (isKlipyRateLimitError(err)) {
        rateLimited = true
        break
      }
    }
  }

  let results = shuffleResults(dedupeResults(merged)).slice(0, DEFAULT_FEED_TOTAL)

  if (results.length < DEFAULT_FEED_TOTAL && !rateLimited) {
    try {
      const trending = await fetchKlipyPage(kind, '', 1, 24, signal)
      results = shuffleResults(
        dedupeResults([...merged, ...trending.results]),
      ).slice(0, DEFAULT_FEED_TOTAL)
    } catch (err) {
      if (isKlipyRateLimitError(err)) rateLimited = true
    }
  }

  if (results.length === 0 && rateLimited) {
    throw new KlipyRateLimitError()
  }
  if (results.length === 0) {
    throw new Error('KLIPY default feed returned no results')
  }

  defaultFeedCache.set(kind, results)
  writePersistedFeed(kind, results)
  return { results, hasNext: false, page: 1 }
}

export interface KlipySearchPage {
  results: KlipyMediaResult[]
  hasNext: boolean
  page: number
}

export async function searchKlipy(
  kind: KlipyMediaKind,
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<KlipySearchPage> {
  const trimmed = query.trim()
  if (!trimmed) {
    return loadKlipyDefaultFeed(kind, signal)
  }
  return fetchKlipyPage(kind, trimmed, page, 24, signal)
}
