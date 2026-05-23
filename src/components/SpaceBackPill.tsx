import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  DEFAULT_SPACE_NAME,
  SPACE_NAME_MAX_LENGTH,
  clampSpaceName,
} from '../spaces/types'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, glass, font } from '../styles/tokens'

export default function SpaceBackPill({
  onExit,
}: {
  onExit: () => void
}) {
  const activeCanvasId = useCanvasWorkspaceStore((s) => s.activeCanvasId)
  const getSpaceName = useCanvasWorkspaceStore((s) => s.getSpaceName)
  const updateSpaceName = useCanvasWorkspaceStore((s) => s.updateSpaceName)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const spaceId = activeCanvasId === 'main' ? null : activeCanvasId
  const name = spaceId ? getSpaceName(spaceId) : ''

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitName = useCallback(() => {
    if (!spaceId) return
    const trimmed = clampSpaceName(draft.trim() || DEFAULT_SPACE_NAME)
    updateSpaceName(spaceId, trimmed)
    setEditing(false)
  }, [draft, spaceId, updateSpaceName])

  if (!spaceId) return null

  const pillShellStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 12px 6px 8px',
    borderRadius: 999,
    border: glass.border,
    background: glass.bg,
    boxShadow: glass.shadow,
    fontFamily: font.family,
    color: font.colorPrimary,
    maxWidth: 'min(320px, calc(100vw - 32px))',
  }

  return (
    <motion.div
      data-space-back-pill
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 64,
        left: 16,
        zIndex: 25,
      }}
    >
      <div className={`theme-surface ${CHROME_GLASS_CLASS}`} style={pillShellStyle}>
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to main canvas"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            marginRight: 2,
            padding: 0,
            border: 'none',
            borderRadius: 999,
            background: 'transparent',
            cursor: 'pointer',
            color: font.colorPrimary,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={SPACE_NAME_MAX_LENGTH}
            onChange={(e) => setDraft(clampSpaceName(e.target.value))}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitName()
              }
              if (e.key === 'Escape') {
                setEditing(false)
              }
            }}
            aria-label="Space name"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: font.family,
              color: font.colorPrimary,
              outline: 'none',
              width: 140,
              maxWidth: '40vw',
              padding: '4px 0',
              margin: 0,
            }}
          />
        ) : (
          <button
            type="button"
            className={CHROME_PRESERVE_CASE_CLASS}
            onClick={() => {
              setDraft(clampSpaceName(name))
              setEditing(true)
            }}
            aria-label={`Rename space: ${name}`}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'text',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: font.family,
              color: font.colorPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
              padding: '4px 0',
              margin: 0,
              textAlign: 'left',
            }}
          >
            {name}
          </button>
        )}
      </div>
    </motion.div>
  )
}
