import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { CHROME_CARD_CLASS, card, chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import { useProfileStore } from '../profile/profileStore'
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  HANDLE_MAX_LENGTH,
  profilesEqual,
  sanitizeProfileDraft,
  validateProfileDraft,
  type ProfileValidation,
} from '../profile/profileUtils'
import type { UserProfile } from '../profile/types'
import UserAvatar from './UserAvatar'
import ProfileIdentityTags from './ProfileIdentityTags'
import { usePanelAlignedSubmenuLayout } from './usePanelAlignedSubmenuLayout'

const SUBMENU_WIDTH = 320
const SUBMENU_GAP = 10
const SAVE_BUBBLE_GAP = 10
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

const labelStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 0 6px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: font.colorMuted,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--glass-border)',
  background: 'var(--card-bg)',
  color: font.colorPrimary,
  fontSize: 14,
  fontFamily: font.family,
  outline: 'none',
}

const fieldErrorStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 12,
  color: '#c44e4e',
}

interface ProfileSubmenuProps {
  panelRef: RefObject<HTMLElement | null>
  onClose: () => void
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label htmlFor={id} style={labelStyle}>
        {chromeLabel(label)}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: font.colorFaint }}>{hint}</p>
      )}
      {error && <p style={fieldErrorStyle}>{error}</p>}
    </div>
  )
}

export default function ProfileSubmenu({ panelRef, onClose }: ProfileSubmenuProps) {
  const savedProfile = useProfileStore((s) => s.profile)
  const saveProfile = useProfileStore((s) => s.saveProfile)
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<UserProfile>(savedProfile)
  const [errors, setErrors] = useState<ProfileValidation>({})
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const layout = usePanelAlignedSubmenuLayout(panelRef, SUBMENU_WIDTH, SUBMENU_GAP)

  const dirty = !profilesEqual(draft, savedProfile)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setDraft(savedProfile)
    setErrors({})
    setAvatarError(null)
  }, [savedProfile])

  const patchDraft = useCallback((patch: Partial<UserProfile>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setErrors({})
    setAvatarError(null)
  }, [])

  const resetDraft = useCallback(() => {
    setDraft(savedProfile)
    setErrors({})
    setAvatarError(null)
  }, [savedProfile])

  const handleClose = useCallback(() => {
    resetDraft()
    onClose()
  }, [onClose, resetDraft])

  const handleDiscard = useCallback(() => {
    resetDraft()
  }, [resetDraft])

  const handleSave = useCallback(() => {
    const next = sanitizeProfileDraft(draft)
    const validation = validateProfileDraft(next)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      setDraft(next)
      return
    }
    saveProfile(next)
    setErrors({})
    onClose()
  }, [draft, onClose, saveProfile])

  const handleAvatarFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be 2 MB or smaller')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        patchDraft({ avatarImageUrl: reader.result })
      }
    }
    reader.onerror = () => setAvatarError('Could not read that image')
    reader.readAsDataURL(file)
  }, [patchDraft])

  if (!mounted) return null

  const saveBubbleTop =
    layout.height > 0 ? layout.top + layout.height + SAVE_BUBBLE_GAP : 0

  return createPortal(
    <>
      <motion.div
        data-profile-submenu
        initial={{ opacity: 0, scale: 0.96, x: 8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.96, x: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: layout.top,
          left: layout.left,
          width: SUBMENU_WIDTH,
          height: layout.height > 0 ? layout.height : undefined,
          display: 'flex',
          flexDirection: 'column',
          background: card.bg,
          border: card.border,
          boxShadow: card.shadow,
          borderRadius: card.radius,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 45,
          overflow: 'hidden',
        }}
        className={`theme-surface ${CHROME_CARD_CLASS}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 14px 10px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={handleClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            cursor: 'pointer',
            color: font.colorMuted,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1 }}>
          {chromeLabel('Edit profile')}
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <UserAvatar
            displayName={draft.displayName}
            avatarColor={draft.avatarColor}
            avatarImageUrl={draft.avatarImageUrl}
            size={56}
            fontSize={22}
          />
          <ProfileIdentityTags
            displayName={draft.displayName}
            handle={draft.handle}
            studentCohort={draft.studentCohort}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={secondaryButtonStyle}
            >
              <Camera size={14} strokeWidth={2} />
              {chromeLabel('Change avatar')}
            </button>
            {draft.avatarImageUrl && (
              <button
                type="button"
                onClick={() => patchDraft({ avatarImageUrl: null })}
                style={secondaryButtonStyle}
              >
                <Trash2 size={14} strokeWidth={2} />
                {chromeLabel('Remove photo')}
              </button>
            )}
          </div>
          {avatarError && <p style={{ ...fieldErrorStyle, margin: 0 }}>{avatarError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarFile}
          />
        </div>

        <div style={menuDividerStyle} />

        <Field id="profile-display-name" label="Display name" error={errors.displayName}>
          <input
            id="profile-display-name"
            type="text"
            value={draft.displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            onChange={(e) => patchDraft({ displayName: e.target.value })}
            style={inputStyle}
            autoComplete="name"
          />
        </Field>

        <Field
          id="profile-handle"
          label="Username"
          hint="Letters, numbers, and underscores"
          error={errors.handle}
        >
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                borderRadius: '10px 0 0 10px',
                border: '1px solid var(--glass-border)',
                borderRight: 'none',
                background: 'rgba(20, 30, 50, 0.04)',
                color: font.colorMuted,
                fontSize: 14,
              }}
            >
              @
            </span>
            <input
              id="profile-handle"
              type="text"
              value={draft.handle}
              maxLength={HANDLE_MAX_LENGTH}
              onChange={(e) => patchDraft({ handle: e.target.value })}
              style={{ ...inputStyle, borderRadius: '0 10px 10px 0' }}
              autoComplete="username"
            />
          </div>
        </Field>

        <Field
          id="profile-bio"
          label="Bio"
          error={errors.bio}
          hint={`${draft.bio.length}/${BIO_MAX_LENGTH}`}
        >
          <textarea
            id="profile-bio"
            value={draft.bio}
            maxLength={BIO_MAX_LENGTH}
            rows={3}
            onChange={(e) => patchDraft({ bio: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
            placeholder="a line about you"
          />
        </Field>
      </div>
      </motion.div>

      <AnimatePresence>
        {dirty && layout.height > 0 && (
          <motion.div
            key="profile-save-bubble"
            data-profile-save-bubble
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.75 }}
            style={{
              position: 'fixed',
              top: saveBubbleTop,
              left: layout.left,
              width: SUBMENU_WIDTH,
              padding: '14px 16px 16px',
              background: card.bg,
              border: card.border,
              boxShadow: card.shadow,
              borderRadius: card.radius,
              fontFamily: font.family,
              color: font.colorPrimary,
              zIndex: 46,
            }}
            className={`theme-surface ${CHROME_CARD_CLASS}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 12,
                fontWeight: 500,
                color: font.colorMuted,
                textAlign: 'center',
                lineHeight: 1.35,
              }}
            >
              Careful — you have unsaved changes!
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleDiscard} style={discardButtonStyle}>
                Discard
              </button>
              <button type="button" onClick={handleSave} style={saveButtonStyle}>
                {chromeLabel('Save changes')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--glass-border)',
  background: 'transparent',
  color: font.colorPrimary,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: font.family,
  cursor: 'pointer',
}

const discardButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'rgba(20, 30, 50, 0.06)',
  color: font.colorPrimary,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: font.family,
  cursor: 'pointer',
}

const saveButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--ui-accent)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: font.family,
  cursor: 'pointer',
}
