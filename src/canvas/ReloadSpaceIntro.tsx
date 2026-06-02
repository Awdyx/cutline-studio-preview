import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useReloadIntroStore } from './reloadIntroStore'
import { useReloadIntroDismiss } from './useReloadIntroDismiss'

const ENTRY_EASE = [0.16, 1.08, 0.28, 1] as const
const REVEAL_EASE = [0.22, 0.94, 0.28, 1] as const
const BRAND_EXIT_EASE = [0.42, 0.03, 0.18, 1] as const

const ENTRY_MS = 0.72
const REVEAL_MS = 0.88
const BRAND_EXIT_MS = 0.62
const REST_EXIT_MS = 0.48

export default function ReloadSpaceIntro() {
  const phase = useReloadIntroStore((s) => s.phase)
  const panDirX = useReloadIntroStore((s) => s.panDirX)
  const panDirY = useReloadIntroStore((s) => s.panDirY)
  const nameLabel = useReloadIntroStore((s) => s.copy.name)
  const suffixLabel = useReloadIntroStore((s) => s.copy.suffix)
  const finish = useReloadIntroStore((s) => s.finish)
  const dismiss = useReloadIntroStore((s) => s.dismiss)
  const reduceMotion = useReducedMotion()

  useReloadIntroDismiss()

  const revealing = phase === 'revealing'
  const visible = phase === 'armed' || revealing

  useEffect(() => {
    if (!revealing) return
    const ms = reduceMotion ? 220 : REVEAL_MS * 1000 + 80
    const id = window.setTimeout(() => finish(), ms)
    return () => window.clearTimeout(id)
  }, [revealing, reduceMotion, finish])

  if (!visible) return null

  const brandExitX = panDirX * (reduceMotion ? 48 : 168)
  const brandExitY = panDirY * (reduceMotion ? 48 : 168)
  const brandSpin = panDirX * (reduceMotion ? 0 : 14) - panDirY * (reduceMotion ? 0 : 8)
  const veilShiftX = panDirX * (reduceMotion ? 0 : 18)
  const veilShiftY = panDirY * (reduceMotion ? 0 : 18)

  return createPortal(
    <div
      className="reload-space-intro"
      aria-hidden
      onPointerDown={(e) => {
        if (phase !== 'armed' && phase !== 'revealing') return
        if (phase === 'armed') dismiss()
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <motion.div
        className="reload-space-intro__veil"
        initial={{ opacity: 1 }}
        animate={
          revealing
            ? {
                opacity: 0,
                scale: reduceMotion ? 1 : 1.08,
                x: veilShiftX,
                y: veilShiftY,
                filter: reduceMotion ? 'blur(0px)' : 'blur(18px)',
              }
            : { opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)' }
        }
        transition={
          revealing
            ? { duration: reduceMotion ? 0.18 : REVEAL_MS, ease: REVEAL_EASE }
            : { duration: 0 }
        }
      />
      <motion.div
        className="reload-space-intro__spotlight"
        initial={{ opacity: 0, scale: 0.82 }}
        animate={
          revealing
            ? { opacity: 0, scale: 1.24 }
            : { opacity: 1, scale: 1 }
        }
        transition={{
          duration: revealing
            ? reduceMotion
              ? 0.16
              : REVEAL_MS * 0.92
            : reduceMotion
              ? 0.1
              : ENTRY_MS,
          ease: revealing ? REVEAL_EASE : ENTRY_EASE,
        }}
      />
      <motion.p
        className="reload-space-intro__title"
        initial={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, y: 28, filter: 'blur(16px)', scale: 1.06 }
        }
        animate={
          reduceMotion
            ? { opacity: revealing ? 0 : 1 }
            : {
                opacity: revealing ? 0 : 1,
                y: revealing ? -18 : 0,
                filter: revealing ? 'blur(10px)' : 'blur(0px)',
                scale: revealing ? 0.98 : 1,
              }
        }
        transition={{
          duration: revealing
            ? reduceMotion
              ? 0.16
              : REST_EXIT_MS
            : reduceMotion
              ? 0.12
              : ENTRY_MS,
          ease: revealing ? REVEAL_EASE : ENTRY_EASE,
        }}
      >
        <motion.span
          className="reload-space-intro__brand"
          initial={reduceMotion ? false : { opacity: 0, x: -22, filter: 'blur(10px)' }}
          animate={
            revealing
              ? {
                  opacity: 0,
                  x: brandExitX,
                  y: brandExitY,
                  scale: reduceMotion ? 1 : 0.72,
                  rotate: brandSpin,
                  filter: reduceMotion ? 'blur(0px)' : 'blur(14px)',
                }
              : { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }
          }
          transition={{
            duration: revealing
              ? reduceMotion
                ? 0.14
                : BRAND_EXIT_MS
              : reduceMotion
                ? 0.1
                : ENTRY_MS * 0.72,
            delay: revealing ? 0 : reduceMotion ? 0 : 0.08,
            ease: revealing ? BRAND_EXIT_EASE : ENTRY_EASE,
          }}
        >
          cutline
        </motion.span>
        <motion.span
          className="reload-space-intro__name"
          initial={reduceMotion ? false : { opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={
            revealing
              ? {
                  opacity: 0,
                  y: -12,
                  filter: reduceMotion ? 'blur(0px)' : 'blur(8px)',
                }
              : { opacity: 1, y: 0, filter: 'blur(0px)' }
          }
          transition={{
            duration: revealing
              ? reduceMotion
                ? 0.14
                : REST_EXIT_MS
              : reduceMotion
                ? 0.1
                : ENTRY_MS * 0.82,
            delay: revealing
              ? reduceMotion
                ? 0.04
                : 0.07
              : reduceMotion
                ? 0.04
                : 0.18,
            ease: revealing ? REVEAL_EASE : ENTRY_EASE,
          }}
        >
          {nameLabel}
        </motion.span>
        <motion.span
          className="reload-space-intro__suffix"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
          animate={
            revealing
              ? { opacity: 0, scale: 1.18, y: -8 }
              : { opacity: 1, scale: 1, y: 0 }
          }
          transition={{
            duration: revealing
              ? reduceMotion
                ? 0.12
                : REST_EXIT_MS * 0.9
              : reduceMotion
                ? 0.1
                : 0.42,
            delay: revealing
              ? reduceMotion
                ? 0.08
                : 0.12
              : reduceMotion
                ? 0.08
                : 0.34,
            ease: revealing ? REVEAL_EASE : ENTRY_EASE,
          }}
        >
          {suffixLabel}
        </motion.span>
      </motion.p>
    </div>,
    document.body,
  )
}
