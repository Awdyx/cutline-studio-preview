import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useAnimate } from 'framer-motion'
import { CHROME_GLASS_CLASS, chromeLabel, font, glass } from '../styles/tokens'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { ShortcutKeycaps } from './ShortcutKeycaps'

const DEFAULT_HOLD_MS = 1200

export default function ActionToast() {
  const toast = useShortcutUiStore((s) => s.toast)
  const toastNonce = useShortcutUiStore((s) => s.toastNonce)
  const toastShakeNonce = useShortcutUiStore((s) => s.toastShakeNonce)
  const clearToast = useShortcutUiStore((s) => s.clearToast)
  const timerRef = useRef<number | null>(null)
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (!toast) return
    const holdMs = toast.holdMs ?? DEFAULT_HOLD_MS
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      clearToast()
    }, holdMs)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [toast, toastNonce, clearToast])

  useEffect(() => {
    if (toastShakeNonce === 0 || !scope.current) return
    animate(
      scope.current,
      { x: [0, -3, 3, -2, 2, 0] },
      { duration: 0.32, ease: 'easeInOut' },
    )
  }, [toastShakeNonce])

  const Icon = toast?.icon

  return (
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={`${toast.shortcutId}-${toastNonce}`}
          initial={{ opacity: 0, y: 12, scale: 0.96, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 8, scale: 0.98, x: '-50%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          {/* Inner wrapper carries the shake — keeps the outer x:'-50%' centering intact */}
          <div
            ref={scope}
            className={`theme-surface ${CHROME_GLASS_CLASS}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: glass.bg,
              border: glass.border,
              boxShadow: glass.shadow,
              borderRadius: 999,
              fontFamily: font.family,
            }}
          >
            {Icon && (
              <Icon size={16} strokeWidth={2} color={font.colorMuted} style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 500, color: font.colorPrimary }}>
              {chromeLabel(toast.label)}
            </span>
            <ShortcutKeycaps keys={toast.keys} size="sm" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
