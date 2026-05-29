import type { ProfileStatus } from './types'

export const DEFAULT_PROFILE_STATUS: ProfileStatus = 'online'

export const PROFILE_STATUS_OPTIONS: {
  value: ProfileStatus
  label: string
}[] = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'dnd', label: 'Do not disturb' },
]

export function parseProfileStatus(raw: unknown): ProfileStatus {
  if (raw === 'online' || raw === 'offline' || raw === 'dnd') return raw
  return DEFAULT_PROFILE_STATUS
}

export function profileStatusColor(status: ProfileStatus): string {
  switch (status) {
    case 'online':
      return '#3ecf6e'
    case 'offline':
      return '#8b9199'
    case 'dnd':
      return '#e85d5d'
  }
}

export function profileStatusDotGlow(status: ProfileStatus): string | undefined {
  if (status === 'online') return '0 0 6px rgba(62, 207, 110, 0.65)'
  return undefined
}

const STATUS_CYCLE: ProfileStatus[] = ['online', 'dnd', 'offline']

export function profileStatusShortLabel(status: ProfileStatus): string {
  switch (status) {
    case 'online':
      return 'online'
    case 'offline':
      return 'offline'
    case 'dnd':
      return 'dnd'
  }
}

export function cycleProfileStatus(current: ProfileStatus): ProfileStatus {
  const index = STATUS_CYCLE.indexOf(current)
  const next = index < 0 ? 0 : (index + 1) % STATUS_CYCLE.length
  return STATUS_CYCLE[next]!
}
