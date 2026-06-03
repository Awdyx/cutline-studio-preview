import { create } from 'zustand'

type StrokeRasterState = {
  displayRaster: boolean
  /** data-stroke-raster-key → webp/png data URL */
  bitmapsByKey: Record<string, string>
  cacheFingerprint: string | null
  rebuilding: boolean
  setRebuilding: (rebuilding: boolean) => void
  setCache: (fingerprint: string, bitmapsByKey: Record<string, string>) => void
  setDisplayRaster: (active: boolean) => void
  clear: () => void
}

function syncRasterDocumentAttr(active: boolean): void {
  const root = document.documentElement
  if (active) root.setAttribute('data-stroke-raster-active', '')
  else root.removeAttribute('data-stroke-raster-active')
}

export const useStrokeRasterStore = create<StrokeRasterState>((set, get) => ({
  displayRaster: false,
  bitmapsByKey: {},
  cacheFingerprint: null,
  rebuilding: false,

  setRebuilding: (rebuilding) => set({ rebuilding }),

  setCache: (fingerprint, bitmapsByKey) =>
    set({ cacheFingerprint: fingerprint, bitmapsByKey, rebuilding: false }),

  setDisplayRaster: (active) => {
    if (get().displayRaster === active) return
    syncRasterDocumentAttr(active)
    set({ displayRaster: active })
  },

  clear: () => {
    syncRasterDocumentAttr(false)
    set({
      displayRaster: false,
      bitmapsByKey: {},
      cacheFingerprint: null,
      rebuilding: false,
    })
  },
}))
