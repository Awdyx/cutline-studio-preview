export type NotificationTab = 'all' | 'unread' | 'mentions'

export type Notification = {
  id: string
  avatar: { initial: string; color: string }
  message: string
  timestamp: string
  isUnread: boolean
  type: 'all' | 'mention'
}
