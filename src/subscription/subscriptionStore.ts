import { create } from 'zustand'
import type { SubscriptionInfo, SubscriptionStatus } from './types'

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  planName: 'Cutline Pro',
  status: 'active',
  renewsAt: '2026-06-01',
  priceLabel: '$40 / week',
  features: [
    'Unlimited canvases & spaces',
    'Full drawing & annotation tools',
    'Cloud sync across devices',
    'Priority support',
  ],
}

type SubscriptionState = {
  subscription: SubscriptionInfo
}

export const useSubscriptionStore = create<SubscriptionState>(() => ({
  subscription: { ...DEFAULT_SUBSCRIPTION },
}))

export function formatRenewalDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'trialing':
      return 'Trial'
    case 'canceled':
      return 'Canceled'
    case 'past_due':
      return 'Past due'
  }
}
