import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { font } from '../../styles/tokens'

type ChatLine = {
  id: string
  tag: string
  name: string
  color: string
  text: string
}

type TypingState = {
  name: string
  color: string
} | null

const SCRIPT: Omit<ChatLine, 'id'>[] = [
  { tag: 'All', name: 'KaiSurg', color: '#5a8fc7', text: 'Kings dent cutoff rumoured 760 avg this cycle' },
  { tag: 'All', name: 'MayaBio', color: '#c89b3c', text: '760?? thats brutal for grad entry' },
  { tag: 'All', name: 'PriyaDent', color: '#a86acb', text: 'Bristol dent was 710 last year i thought' },
  { tag: 'All', name: 'OmarUCAT', color: '#6aab6a', text: '710 might still work if portfolio is strong' },
  { tag: 'All', name: 'KaiSurg', color: '#5a8fc7', text: 'Sheffield posted 695 threshold on their FAQ' },
  { tag: 'All', name: 'MayaBio', color: '#c89b3c', text: '695 gets you an interview not an offer tho' },
  { tag: 'All', name: 'PriyaDent', color: '#a86acb', text: 'anyone applying Cardiff with 720?' },
  { tag: 'All', name: 'OmarUCAT', color: '#6aab6a', text: 'Cardiff weight situational more than raw UCAT' },
  { tag: 'All', name: 'KaiSurg', color: '#5a8fc7', text: 'cutoffs shift every year its so opaque' },
  { tag: 'All', name: 'MayaBio', color: '#c89b3c', text: 'literally refreshing results thread every hour' },
]

const VISIBLE_MAX = 5
const CHAT_INSET = { top: 10, x: 12, typing: 32 } as const

/** Soft ease — no snap. */
const GENTLE_EASE = [0.33, 0, 0.2, 1] as const

function randMs(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

const lineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 8,
  lineHeight: 1.3,
  color: font.colorPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

function ChatLineRow({ line }: { line: ChatLine }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4, ease: GENTLE_EASE }}
      style={lineStyle}
    >
      <span style={{ color: font.colorMuted, marginRight: 3 }}>{line.tag}</span>
      <span style={{ color: line.color, fontWeight: 600 }}>{line.name}</span>
      <span style={{ color: font.colorMuted }}>: </span>
      <span>{line.text}</span>
    </motion.p>
  )
}

function TypingOverlay({ name, color }: { name: string; color: string }) {
  return (
    <motion.div
      className="widget-chat-typing-overlay ui-chrome-preserve-case"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.75, ease: GENTLE_EASE }}
    >
      <p className="widget-chat-typing-overlay__line">
        <span style={{ color, fontWeight: 600 }}>{name}</span>
        <span>is typing</span>
        <span className="widget-chat-typing-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </p>
    </motion.div>
  )
}

export function ForumChatPreview() {
  const [visible, setVisible] = useState<ChatLine[]>(() =>
    SCRIPT.slice(0, 3).map((line, i) => ({ ...line, id: `seed-${i}` })),
  )
  const [typing, setTyping] = useState<TypingState>(null)
  const stepRef = useRef(3)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    function schedule(ms: number, fn: () => void) {
      timer = setTimeout(() => {
        if (!cancelled && mountedRef.current) fn()
      }, ms)
    }

    function runStep() {
      const nextIndex = stepRef.current % SCRIPT.length
      const next = SCRIPT[nextIndex]
      stepRef.current += 1

      setTyping({ name: next.name, color: next.color })

      schedule(randMs(18000, 33000), () => {
        setTyping(null)
        setVisible((prev) => {
          const line: ChatLine = { ...next, id: `msg-${nextIndex}-${Date.now()}` }
          return [...prev, line].slice(-VISIBLE_MAX)
        })

        const looped = stepRef.current >= SCRIPT.length + 3
        schedule(looped ? randMs(42000, 66000) : randMs(15000, 30000), () => {
          if (stepRef.current >= SCRIPT.length + 3) {
            stepRef.current = 0
            setVisible(SCRIPT.slice(0, 3).map((line, i) => ({ ...line, id: `reset-${i}-${Date.now()}` })))
            schedule(randMs(18000, 30000), runStep)
          } else {
            runStep()
          }
        })
      })
    }

    schedule(randMs(15000, 27000), runStep)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div
      className="ui-chrome-preserve-case"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 14,
        background: 'var(--card-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: font.family,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: `${CHAT_INSET.top}px ${CHAT_INSET.x}px ${CHAT_INSET.typing}px`,
            gap: 2,
            overflow: 'hidden',
          }}
        >
          {visible.map((line) => (
            <ChatLineRow key={line.id} line={line} />
          ))}
        </div>

        <AnimatePresence initial={false}>
          {typing && <TypingOverlay key={typing.name} name={typing.name} color={typing.color} />}
        </AnimatePresence>
      </div>
    </div>
  )
}
