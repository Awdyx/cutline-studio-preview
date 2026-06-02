import { create } from 'zustand'
import { scopedStorageKey } from '../storage/storageScope'

/** Canvas types the eraser can affect (matches pen FAB target picker). */
export type EraserTargetType = 'strokes' | 'sticky' | 'text' | 'image'

const DEFAULT_TARGETS: EraserTargetType[] = ['strokes', 'sticky']

const ERASER_TARGETS_KEY = scopedStorageKey('cutline-eraser-targets-v1')
const VALID_TARGETS = new Set<EraserTargetType>(['strokes', 'sticky', 'text', 'image'])

function loadTargetTypes(): EraserTargetType[] {
  try {
    const raw = localStorage.getItem(ERASER_TARGETS_KEY)
    if (!raw) return [...DEFAULT_TARGETS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_TARGETS]
    const valid = parsed.filter((t): t is EraserTargetType =>
      VALID_TARGETS.has(t as EraserTargetType),
    )
    return valid.length > 0 ? valid : [...DEFAULT_TARGETS]
  } catch {
    return [...DEFAULT_TARGETS]
  }
}

function saveTargetTypes(types: EraserTargetType[]): void {
  try {
    localStorage.setItem(ERASER_TARGETS_KEY, JSON.stringify(types))
  } catch {
    // ignore
  }
}

type EraserState = {
  targetTypes: EraserTargetType[]
  toggleTargetType: (type: EraserTargetType) => void
}

export const useEraserStore = create<EraserState>((set) => ({
  targetTypes: loadTargetTypes(),

  toggleTargetType: (type) =>
    set((s) => {
      const has = s.targetTypes.includes(type)
      if (has && s.targetTypes.length === 1) return s
      const next = has
        ? s.targetTypes.filter((t) => t !== type)
        : [...s.targetTypes, type]
      saveTargetTypes(next)
      return { targetTypes: next }
    }),
}))
