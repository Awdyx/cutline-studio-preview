export type NotificationTab = 'all' | 'unread' | 'mentions'

export type Notification = {
  id: string
  avatar: { initial: string; color: string }
  /** Handle or name shown in italics at the start of the message. */
  actor?: string
  message: string
  timestamp: string
  isUnread: boolean
  type: 'all' | 'mention'
}

export type NewsTab = 'all' | 'blogs' | 'updates'

export type NewsCategory = 'blog' | 'update'

export type NewsPost = {
  id: string
  category: NewsCategory
  title: string
  /** Teaser for blog-style posts; release notes use highlights instead. */
  summary?: string
  date?: string
  /** Shipped version label for release-note posts. */
  version?: string
  highlights?: string[]
  isNew?: boolean
}
