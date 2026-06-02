import { create } from 'zustand'

export const STROKE_ERASE_FADE_MS = 80

type StrokeEraseVisualState = {
  erasingIds: Set<string>
}

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useStrokeEraseVisualStore = create<StrokeEraseVisualState>(() => ({
  erasingIds: new Set(),
}))

function markErasing(id: string) {
  const { erasingIds } = useStrokeEraseVisualStore.getState()
  if (erasingIds.has(id)) return false
  const next = new Set(erasingIds)
  next.add(id)
  useStrokeEraseVisualStore.setState({ erasingIds: next })
  return true
}

function unmarkErasing(id: string) {
  const { erasingIds } = useStrokeEraseVisualStore.getState()
  if (!erasingIds.has(id)) return
  const next = new Set(erasingIds)
  next.delete(id)
  useStrokeEraseVisualStore.setState({ erasingIds: next })
}

/** Fade the stroke out, then run `remove` once the animation finishes. */
export function scheduleStrokeErase(id: string, remove: () => void) {
  if (!markErasing(id)) return
  const existing = pendingTimers.get(id)
  if (existing != null) clearTimeout(existing)
  pendingTimers.set(
    id,
    setTimeout(() => {
      pendingTimers.delete(id)
      unmarkErasing(id)
      remove()
    }, STROKE_ERASE_FADE_MS),
  )
}

export function cancelPendingStrokeErases() {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  useStrokeEraseVisualStore.setState({ erasingIds: new Set() })
}
