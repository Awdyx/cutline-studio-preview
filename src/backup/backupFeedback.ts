import { Check, TriangleAlert } from 'lucide-react'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'

function showBackupToast(label: string, holdMs = 2800): void {
  requestAnimationFrame(() => {
    useShortcutUiStore.getState().showActionToast({
      shortcutId: 'cutline-backup',
      label,
      keys: [],
      icon: TriangleAlert,
      holdMs,
    })
  })
}

export function showBackupExportStarted(): void {
  showBackupToast('Preparing backup…', 2000)
}

export function showBackupExportDone(): void {
  requestAnimationFrame(() => {
    useShortcutUiStore.getState().showActionToast({
      shortcutId: 'cutline-backup-exported',
      label: 'Backup downloaded',
      keys: [],
      icon: Check,
      holdMs: 2200,
    })
  })
}

export function showBackupExportFailed(): void {
  showBackupToast("Couldn't create backup", 3500)
}

export function showBackupImportFailed(reason?: string): void {
  const label =
    reason === 'invalid_json'
      ? "That file isn't valid JSON"
      : reason === 'invalid_format'
        ? "That file isn't a Cutline Studio backup"
        : "Couldn't import backup"
  showBackupToast(label, 3500)
}
