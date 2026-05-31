import type { Variants } from 'framer-motion'

/** No-motion variants — instant show/hide, no transitions. */
export const overviewTitleVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (tone: number) => ({ opacity: tone }),
  exit: { opacity: 0 },
}

export const overviewTitleFocusTransition = {}

export const overviewDragHandleVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (show: boolean) => ({ opacity: show ? 1 : 0 }),
  exit: { opacity: 0 },
}

export const overviewRepositionVariants: Variants = {
  hidden: { opacity: 0, x: '-50%' },
  visible: (show: boolean) => ({ opacity: show ? 1 : 0, x: '-50%' }),
  exit: { opacity: 0, x: '-50%' },
}

export function overviewChromePresenceProps(_reduceMotion: boolean | null) {
  return {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    transition: { duration: 0 },
  } as const
}
