import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { font } from '../styles/tokens'

const ACCESS_PASSWORD = 'asianavoidans4life'

type Props = {
  onUnlock: () => void
}

export default function AppAccessGate({ onUnlock }: Props) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = useCallback(() => {
    if (value === ACCESS_PASSWORD) {
      onUnlock()
      return
    }
    setWrong(true)
    setValue('')
    inputRef.current?.focus()
  }, [onUnlock, value])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}
    >
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.22 }}
        style={{
          margin: 0,
          color: '#fff',
          fontFamily: font.family,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        coming soon {'<3'}
      </motion.p>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.22 }}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <input
          ref={inputRef}
          type="password"
          value={value}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="Access password"
          placeholder="password"
          onChange={(e) => {
            setWrong(false)
            setValue(e.target.value)
          }}
          style={{
            width: 220,
            padding: '10px 14px',
            borderRadius: 10,
            border: wrong ? '1px solid rgba(255, 90, 90, 0.7)' : '1px solid rgba(255, 255, 255, 0.14)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#fff',
            fontFamily: font.family,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            outline: 'none',
            textAlign: 'center',
          }}
        />
        {wrong && (
          <span
            style={{
              margin: 0,
              color: 'rgba(255, 120, 120, 0.9)',
              fontFamily: font.family,
              fontSize: 12,
              fontWeight: 400,
            }}
          >
            wrong password
          </span>
        )}
      </motion.form>
    </motion.div>,
    document.body,
  )
}
