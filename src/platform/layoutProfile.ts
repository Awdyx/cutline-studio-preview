/** Max viewport width treated as phone (iPad portrait is 768px+). */
export const PHONE_MAX_WIDTH_PX = 639

export type LayoutProfile = 'desktop' | 'phone'

export function detectLayoutProfile(): LayoutProfile {
  if (typeof window === 'undefined') return 'desktop'

  const narrow = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`).matches
  const coarse = window.matchMedia('(pointer: coarse)').matches

  return narrow && coarse ? 'phone' : 'desktop'
}

export function syncLayoutProfileAttribute(): LayoutProfile {
  const profile = detectLayoutProfile()
  document.documentElement.dataset.layout = profile
  return profile
}

export function isPhoneLayout(): boolean {
  if (typeof document === 'undefined') return false
  const attr = document.documentElement.dataset.layout
  if (attr === 'phone' || attr === 'desktop') return attr === 'phone'
  return detectLayoutProfile() === 'phone'
}
