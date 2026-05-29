import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ChevronLeft } from 'lucide-react'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  DEFAULT_SPACE_NAME,
  DEFAULT_SPACE_NAME_PLACEHOLDER,
  SPACE_NAME_MAX_LENGTH,
  clampSpaceName,
  isDefaultSpaceName,
} from '../spaces/types'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, glass, font } from '../styles/tokens'

const SPACE_NAME_PLACEHOLDER = DEFAULT_SPACE_NAME_PLACEHOLDER

const nameFontStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  fontFamily: font.family,
  lineHeight: 1.2,
}

const nameFieldPadding = '4px 0 4px 0'
/** Extra breathing room after the name — matches visual inset of the back arrow. */
const NAME_TRAILING_SPACE = 14
const PILL_INSET_LEFT = 8
const PILL_INSET_RIGHT = 14

const PILL_EASE = [0.22, 1, 0.36, 1] as const

export const SPACE_BACK_PILL_MOTION = {
  initial: { opacity: 0, y: -3, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -3, filter: 'blur(6px)' },
  transition: {
    opacity: { duration: 0.28, ease: PILL_EASE },
    y: { duration: 0.34, ease: PILL_EASE },
    filter: { duration: 0.38, ease: PILL_EASE },
  },
  style: {
    position: 'fixed',
    top: 64,
    left: 16,
    zIndex: 25,
  } as const,
}

export const SPACE_BACK_PILL_PHONE_CLASS = 'cutline-space-back-pill-host'

export default function SpaceBackPill({
  onExit,
}: {
  onExit: () => void
}) {
  const activeCanvasId = useCanvasWorkspaceStore((s) => s.activeCanvasId)
  const canvasSwapSpaceId = useCanvasWorkspaceStore((s) => s.canvasSwapSpaceId)
  const getSpaceName = useCanvasWorkspaceStore((s) => s.getSpaceName)
  const updateSpaceName = useCanvasWorkspaceStore((s) => s.updateSpaceName)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameWidth, setNameWidth] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)

  const spaceId =
    activeCanvasId !== 'main' ? activeCanvasId : canvasSwapSpaceId
  const name = spaceId ? getSpaceName(spaceId) : ''
  const showingPlaceholder = !editing && isDefaultSpaceName(name)
  const measureText = editing
    ? draft || SPACE_NAME_PLACEHOLDER
    : showingPlaceholder
      ? SPACE_NAME_PLACEHOLDER
      : name

  useLayoutEffect(() => {
    setNameWidth(measureRef.current?.offsetWidth ?? 0)
  }, [measureText, editing])

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
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    maxWidth: 'calc(100vw - 32px)',
    gap: 6,
    padding: `6px ${PILL_INSET_RIGHT}px 6px ${PILL_INSET_LEFT}px`,
    borderRadius: 999,
    border: glass.border,
    background: glass.bg,
    boxShadow: glass.shadow,
    fontFamily: font.family,
    color: font.colorPrimary,
  }

  const nameFieldWrapStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: nameWidth > 0 ? nameWidth : undefined,
    paddingRight: NAME_TRAILING_SPACE,
    boxSizing: 'content-box',
    flexShrink: 0,
  }

  const nameInputStyle: CSSProperties = {
    ...nameFontStyle,
    display: 'block',
    border: 'none',
    background: 'transparent',
    color: font.colorPrimary,
    outline: 'none',
    margin: 0,
    padding: nameFieldPadding,
    width: '100%',
    boxSizing: 'content-box',
  }

  const nameButtonStyle: CSSProperties = {
    ...nameInputStyle,
    cursor: 'text',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  }

  return (
    <div data-space-back-pill>
      <span
        ref={measureRef}
        aria-hidden
        className={CHROME_PRESERVE_CASE_CLASS}
        style={{
          ...nameFontStyle,
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          pointerEvents: 'none',
        }}
      >
        {measureText}
      </span>

      <div className={`theme-surface ${CHROME_GLASS_CLASS}`} style={pillShellStyle}>
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to main canvas"
          className="space-back-pill-chevron"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
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
          <div style={nameFieldWrapStyle}>
            {draft.length === 0 && (
              <span
                aria-hidden
                className={CHROME_PRESERVE_CASE_CLASS}
                style={{
                  ...nameFontStyle,
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  padding: nameFieldPadding,
                  color: font.colorFaint,
                  opacity: 0.55,
                  pointerEvents: 'none',
                  whiteSpace: 'pre',
                }}
              >
                {SPACE_NAME_PLACEHOLDER}
              </span>
            )}
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
              aria-label="Pocket name"
              className={CHROME_PRESERVE_CASE_CLASS}
              style={nameInputStyle}
            />
          </div>
        ) : (
          <div style={nameFieldWrapStyle}>
            <button
              type="button"
              className={CHROME_PRESERVE_CASE_CLASS}
              onClick={() => {
                setDraft(isDefaultSpaceName(name) ? '' : clampSpaceName(name))
                setEditing(true)
              }}
              aria-label={`Rename pocket: ${name}`}
              style={{
                ...nameButtonStyle,
                color: showingPlaceholder ? font.colorFaint : font.colorPrimary,
                opacity: showingPlaceholder ? 0.55 : 1,
              }}
            >
              {showingPlaceholder ? SPACE_NAME_PLACEHOLDER : name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
