import { create } from 'zustand'

export type FisheyeOverviewStatus = 'idle' | 'capturing' | 'ready'

type FisheyeOverviewState = {
  status: FisheyeOverviewStatus
  dataUrl: string | null
  setCapturing: () => void
  setReady: (dataUrl: string) => void
  clear: () => void
}

export const useFisheyeOverviewStore = create<FisheyeOverviewState>((set) => ({
  status: 'idle',
  dataUrl: null,
  setCapturing: () => set({ status: 'capturing', dataUrl: null }),
  setReady: (dataUrl) => set({ status: 'ready', dataUrl }),
  clear: () => set({ status: 'idle', dataUrl: null }),
}))

export function isFisheyeOverviewReady(
  status: FisheyeOverviewStatus,
  dataUrl: string | null,
): boolean {
  return status === 'ready' && dataUrl != null
}
