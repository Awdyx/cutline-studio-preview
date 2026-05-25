import { create } from 'zustand'

type CanvasContextMenuState = {
  open: boolean
  clientX: number
  clientY: number
  canvasX: number
  canvasY: number
  widgetsOpen: boolean
  openAt: (clientX: number, clientY: number, canvasX: number, canvasY: number) => void
  close: () => void
  setWidgetsOpen: (open: boolean) => void
}

export const useCanvasContextMenuStore = create<CanvasContextMenuState>((set) => ({
  open: false,
  clientX: 0,
  clientY: 0,
  canvasX: 0,
  canvasY: 0,
  widgetsOpen: false,
  openAt: (clientX, clientY, canvasX, canvasY) =>
    set({
      open: true,
      clientX,
      clientY,
      canvasX,
      canvasY,
      widgetsOpen: false,
    }),
  close: () =>
    set({
      open: false,
      widgetsOpen: false,
    }),
  setWidgetsOpen: (widgetsOpen) => set({ widgetsOpen }),
}))
