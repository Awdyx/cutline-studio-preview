/** GitHub Pages project slug from Vite base, or `local` for dev. */
function pagesScope(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const slug = base.replace(/^\/+|\/+$/g, '')
  return slug || 'local'
}

const LEGACY_DEMO_SCOPE = 'cutline-studio-demo'

/** Legacy demo URL keeps unscoped keys; other Pages paths get fresh storage. */
export function scopedStorageKey(key: string): string {
  const scope = pagesScope()
  if (scope === 'local' || scope === LEGACY_DEMO_SCOPE) return key
  return `${scope}::${key}`
}

export function scopedIdbName(name: string): string {
  const scope = pagesScope()
  if (scope === 'local' || scope === LEGACY_DEMO_SCOPE) return name
  return `${name}-${scope}`
}

const CUTLINE_PREFIX = 'cutline-'

/** Whether a localStorage key belongs to this site's persisted Cutline data. */
export function isCutlineStorageKey(key: string): boolean {
  if (key.startsWith(CUTLINE_PREFIX)) return true
  const tail = key.split('::').pop()
  return tail?.startsWith(CUTLINE_PREFIX) ?? false
}
