import { useEffect } from 'react'
import { useReloadIntroStore } from './reloadIntroStore'

/** Click anywhere or Esc while the reload intro is armed. */
export function useReloadIntroDismiss() {
  const phase = useReloadIntroStore((s) => s.phase)

  useEffect(() => {
    if (phase !== 'armed') return

    const dismiss = () => {
      useReloadIntroStore.getState().dismiss()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      dismiss()
    }

    const onPointerDown = () => {
      dismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [phase])
}
