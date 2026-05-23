export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due'

export type SubscriptionInfo = {
  planName: string
  status: SubscriptionStatus
  /** ISO date string for next renewal. */
  renewsAt: string
  priceLabel: string
  features: string[]
}
