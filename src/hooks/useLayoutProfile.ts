import { useEffect, useState } from 'react'
import {
  PHONE_MAX_WIDTH_PX,
  syncLayoutProfileAttribute,
  type LayoutProfile,
} from '../platform/layoutProfile'

export function useLayoutProfile(): LayoutProfile {
  const [profile, setProfile] = useState<LayoutProfile>(() => {
    if (typeof window === 'undefined') return 'desktop'
    return syncLayoutProfileAttribute()
  })

  useEffect(() => {
    const narrowMq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`)
    const coarseMq = window.matchMedia('(pointer: coarse)')

    function update() {
      setProfile(syncLayoutProfileAttribute())
    }

    narrowMq.addEventListener('change', update)
    coarseMq.addEventListener('change', update)
    update()

    return () => {
      narrowMq.removeEventListener('change', update)
      coarseMq.removeEventListener('change', update)
    }
  }, [])

  return profile
}

export function useIsPhoneLayout(): boolean {
  return useLayoutProfile() === 'phone'
}
