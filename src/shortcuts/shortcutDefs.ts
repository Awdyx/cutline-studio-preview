import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Copy,
  Eraser,
  GraduationCap,
  Highlighter,
  Image,
  Lasso,
  Lock,
  Map as MapIcon,
  Pen,
  Plus,
  Redo2,
  Search,
  Settings,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  User,
} from 'lucide-react'
import { modKeyLabel } from './modKey'

export type ShortcutKeyPart = string

export type ShortcutDef = {
  id: string
  label: string
  category: string
  keys: ShortcutKeyPart[]
  icon?: LucideIcon
  /** When true, firing this shortcut does not show the action toast. */
  skipToast?: boolean
}

const mod = modKeyLabel()

function modKeys(...parts: string[]): ShortcutKeyPart[] {
  return [mod, ...parts]
}

export const SHORTCUTS: ShortcutDef[] = [
  // ── Edit ──────────────────────────────────────────────────────────────────
  {
    id: 'undo',
    label: 'Undo',
    category: 'Edit',
    keys: modKeys('Z'),
    icon: Undo2,
  },
  {
    id: 'redo',
    label: 'Redo',
    category: 'Edit',
    keys: modKeys('⇧', 'Z'),
    icon: Redo2,
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    category: 'Edit',
    keys: modKeys('D'),
    icon: Copy,
  },
  {
    id: 'delete',
    label: 'Delete',
    category: 'Edit',
    keys: ['⌫'],
    icon: Trash2,
  },
  {
    id: 'deselect',
    label: 'Deselect / dismiss',
    category: 'Edit',
    keys: ['Esc'],
  },
  {
    id: 'text-font-size-increase',
    label: 'Increase font size',
    category: 'Edit',
    keys: modKeys(']'),
    skipToast: true,
  },
  {
    id: 'text-font-size-decrease',
    label: 'Decrease font size',
    category: 'Edit',
    keys: modKeys('['),
    skipToast: true,
  },
  // ── Create ────────────────────────────────────────────────────────────────
  {
    id: 'add-text',
    label: 'New text',
    category: 'Create',
    keys: modKeys('E'),
    icon: Type,
  },
  {
    id: 'add-sticky',
    label: 'New sticky',
    category: 'Create',
    keys: modKeys('S'),
    icon: StickyNote,
  },
  {
    id: 'add-image',
    label: 'New image',
    category: 'Create',
    keys: modKeys('I'),
    icon: Image,
  },
  {
    id: 'open-fab',
    label: 'Add to canvas',
    category: 'Create',
    keys: modKeys('K'),
    icon: Plus,
    skipToast: true,
  },
  // ── Canvas ────────────────────────────────────────────────────────────────
  {
    id: 'select-all',
    label: 'Select all',
    category: 'Canvas',
    keys: modKeys('A'),
    icon: Lasso,
  },
  {
    id: 'toggle-lock',
    label: 'Toggle canvas lock',
    category: 'Canvas',
    keys: modKeys('L'),
    icon: Lock,
  },
  // ── Drawing ───────────────────────────────────────────────────────────────
  {
    id: 'draw-pen',
    label: 'Pen',
    category: 'Drawing',
    keys: ['P'],
    icon: Pen,
  },
  {
    id: 'draw-pen-d',
    label: 'Pen',
    category: 'Drawing',
    keys: ['D'],
    icon: Pen,
  },
  {
    id: 'draw-highlighter',
    label: 'Highlighter',
    category: 'Drawing',
    keys: ['H'],
    icon: Highlighter,
  },
  {
    id: 'draw-eraser',
    label: 'Eraser',
    category: 'Drawing',
    keys: ['E'],
    icon: Eraser,
  },
  {
    id: 'draw-lasso',
    label: 'Lasso',
    category: 'Drawing',
    keys: ['L'],
    icon: Lasso,
  },
  // ── Navigation ────────────────────────────────────────────────────────────
  {
    id: 'find',
    label: 'Search canvas',
    category: 'Navigation',
    keys: modKeys('F'),
    icon: Search,
    skipToast: true,
  },
  {
    id: 'open-canvas-map',
    label: 'Open canvas map',
    category: 'Navigation',
    keys: modKeys('⇧', 'V'),
    icon: MapIcon,
    skipToast: true,
  },
  // ── Panels ────────────────────────────────────────────────────────────────
  {
    id: 'open-settings',
    label: 'Settings',
    category: 'Panels',
    keys: modKeys('⇧', 'S'),
    icon: Settings,
    skipToast: true,
  },
  {
    id: 'open-profile',
    label: 'Profile',
    category: 'Panels',
    keys: modKeys('⇧', 'P'),
    icon: User,
    skipToast: true,
  },
  {
    id: 'open-notifications',
    label: 'Notis / News',
    category: 'Panels',
    keys: modKeys('⇧', 'N'),
    icon: Bell,
    skipToast: true,
  },
  // ── Study shortcuts ────────────────────────────────────────────────────────
  {
    id: 'study-hub-1',
    label: 'Hubs hub',
    category: 'Study shortcuts',
    keys: modKeys('1'),
    icon: GraduationCap,
  },
  {
    id: 'study-hub-2',
    label: 'Cels hub',
    category: 'Study shortcuts',
    keys: modKeys('2'),
    icon: GraduationCap,
  },
  {
    id: 'study-hub-3',
    label: 'Chem hub',
    category: 'Study shortcuts',
    keys: modKeys('3'),
    icon: GraduationCap,
  },
  {
    id: 'study-hub-4',
    label: 'Phsi hub',
    category: 'Study shortcuts',
    keys: modKeys('4'),
    icon: GraduationCap,
  },
]

export const SHORTCUTS_BY_ID = Object.fromEntries(
  SHORTCUTS.map((s) => [s.id, s]),
) as Record<string, ShortcutDef>

export const SHORTCUT_CATEGORIES = [
  'Edit',
  'Create',
  'Canvas',
  'Drawing',
  'Navigation',
  'Panels',
  'Study shortcuts',
] as const

export function shortcutsByCategory(): Map<string, ShortcutDef[]> {
  const map = new Map<string, ShortcutDef[]>()
  for (const cat of SHORTCUT_CATEGORIES) {
    map.set(cat, [])
  }
  for (const s of SHORTCUTS) {
    const list = map.get(s.category) ?? []
    list.push(s)
    map.set(s.category, list)
  }
  return map
}
