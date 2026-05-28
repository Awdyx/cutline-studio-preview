import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { scopedStorageKey } from '../storage/storageScope'
import { modKeyEvent, modKeyLabel } from './modKey'
import { SHORTCUTS_BY_ID } from './shortcutDefs'

/** Structured keyboard combo — used for both matching and display. */
export type KeyCombo = {
  mod: boolean     // metaKey (Mac) / ctrlKey (Win/Linux)
  shift: boolean
  alt: boolean
  key: string      // e.key-derived; single letters stored lowercase, specials kept as-is
  display: string[] // ordered label array for ShortcutKeycaps
}

/** Shortcut IDs that cannot be remapped (Escape drives layered dismiss logic). */
export const NON_CUSTOMIZABLE_IDS = new Set(['deselect', 'select-all'])

/** Build the display-label array from a structured combo. */
export function buildComboDisplay(combo: Omit<KeyCombo, 'display'>): string[] {
  const parts: string[] = []
  if (combo.mod) parts.push(modKeyLabel())
  if (combo.shift) parts.push('⇧')
  if (combo.alt) parts.push('⌥')
  const { key } = combo
  if (key === 'Backspace') parts.push('⌫')
  else if (key === 'Escape') parts.push('Esc')
  else if (key === 'Delete') parts.push('Del')
  else if (key === 'Tab') parts.push('Tab')
  else if (key === ' ') parts.push('Space')
  else if (key === 'ArrowUp') parts.push('↑')
  else if (key === 'ArrowDown') parts.push('↓')
  else if (key === 'ArrowLeft') parts.push('←')
  else if (key === 'ArrowRight') parts.push('→')
  else parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts
}

/** Build a KeyCombo from a live KeyboardEvent. Returns null for pure-modifier presses. */
export function comboFromEvent(e: KeyboardEvent): KeyCombo | null {
  const MODIFIERS = ['Meta', 'Control', 'Shift', 'Alt', 'AltGraph', 'CapsLock', 'NumLock']
  if (MODIFIERS.includes(e.key)) return null
  const mod = modKeyEvent(e)
  const shift = e.shiftKey
  const alt = e.altKey
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const display = buildComboDisplay({ mod, shift, alt, key })
  return { mod, shift, alt, key, display }
}

/** Parse a ShortcutDef display-label array (e.g. ['⌘','Z']) into a matchable KeyCombo. */
export function displayToCombo(display: string[]): KeyCombo | null {
  let mod = false
  let shift = false
  let alt = false
  let key = ''
  for (const part of display) {
    if (part === '⌘' || part === 'Ctrl') { mod = true; continue }
    if (part === '⇧') { shift = true; continue }
    if (part === '⌥') { alt = true; continue }
    if (part === '⌫') { key = 'Backspace'; continue }
    if (part === 'Esc') { key = 'Escape'; continue }
    if (part === 'Del') { key = 'Delete'; continue }
    key = part.toLowerCase()
  }
  if (!key) return null
  return { mod, shift, alt, key, display }
}

/** Returns true when two combos represent the same key binding. */
export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return a.mod === b.mod && a.shift === b.shift && a.alt === b.alt && a.key === b.key
}

/** Returns true when the event matches the given combo. */
export function comboMatchesEvent(combo: KeyCombo, e: KeyboardEvent): boolean {
  if (combo.mod !== modKeyEvent(e)) return false
  if (combo.shift !== e.shiftKey) return false
  if (combo.alt !== e.altKey) return false
  const ek = e.key.length === 1 ? e.key.toLowerCase() : e.key
  return ek === combo.key
}

/** Returns the effective display labels for a shortcut (override ?? default). */
export function effectiveDisplayKeys(shortcutId: string): string[] {
  const overrides = useShortcutCustomStore.getState().overrides
  if (overrides[shortcutId]) return overrides[shortcutId].display
  const def = SHORTCUTS_BY_ID[shortcutId]
  return def?.keys ?? []
}

/** Returns true when event matches a shortcut's effective combo (override ?? default). */
export function matchesShortcut(e: KeyboardEvent, shortcutId: string): boolean {
  const overrides = useShortcutCustomStore.getState().overrides
  const override = overrides[shortcutId]
  if (override) return comboMatchesEvent(override, e)
  const def = SHORTCUTS_BY_ID[shortcutId]
  if (!def) return false
  const combo = displayToCombo(def.keys)
  if (!combo) return false
  return comboMatchesEvent(combo, e)
}

type ShortcutCustomState = {
  overrides: Record<string, KeyCombo>
  setOverride: (id: string, combo: KeyCombo) => void
  resetOverride: (id: string) => void
  resetAll: () => void
  /** Returns the id of the shortcut that already uses this combo, excluding forId. */
  findConflict: (forId: string, combo: KeyCombo) => string | null
}

export const useShortcutCustomStore = create<ShortcutCustomState>()(
  persist(
    (set, get) => ({
      overrides: {},

      setOverride: (id, combo) =>
        set((s) => ({ overrides: { ...s.overrides, [id]: combo } })),

      resetOverride: (id) =>
        set((s) => {
          const next = { ...s.overrides }
          delete next[id]
          return { overrides: next }
        }),

      resetAll: () => set({ overrides: {} }),

      findConflict: (forId, combo) => {
        const { overrides } = get()
        for (const def of Object.values(SHORTCUTS_BY_ID)) {
          if (def.id === forId) continue
          const effective = overrides[def.id] ?? displayToCombo(def.keys)
          if (!effective) continue
          if (
            effective.mod === combo.mod &&
            effective.shift === combo.shift &&
            effective.alt === combo.alt &&
            effective.key === combo.key
          ) return def.id
        }
        return null
      },
    }),
    { name: scopedStorageKey('cutline-shortcut-overrides'), version: 1 },
  ),
)
