export type UserProfile = {
  displayName: string
  handle: string
  email: string
  bio: string
  /** Student cohort / stream category (e.g. HSFY). */
  studentCohort: string
  avatarColor: string
  avatarImageUrl: string | null
}

export type TopBarUser = {
  name: string
  initial: string
  avatarColor: string
  avatarImageUrl: string | null
}
