import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import { useProfileStore } from '../profile/profileStore'
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  deriveInitial,
  HANDLE_MAX_LENGTH,
  SOCIAL_LABEL_MAX_LENGTH,
  SOCIAL_MAX,
  SOCIAL_VALUE_MAX_LENGTH,
  profilesEqual,
  sanitizeProfileDraft,
  validateProfileDraft,
  type ProfileValidation,
} from '../profile/profileUtils'
import type { ProfileSocialLink, UserProfile } from '../profile/types'
import {
  beginProfileFilePicker,
  endProfileFilePicker,
} from '../profile/profileFilePickerSession'
import { prepareProfileImageDataUrl, type ProfileImageKind } from '../profile/profileImageImport'
import { defaultProfileMediaFrame } from '../profile/profileMediaFrame'
import type { ProfileMediaFrame } from '../profile/types'
import ProfileMediaFrameEditor from './ProfileMediaFrameEditor'
import { usePanelAlignedSubmenuLayout } from './usePanelAlignedSubmenuLayout'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { phoneSubmenuSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import ChromeScrollFade from './ChromeScrollFade'

const SUBMENU_WIDTH = 320
const SUBMENU_GAP = 10
const SAVE_BUBBLE_GAP = 10
const MEDIA_BUTTON_HEIGHT = 120

const defaultBannerGradient =
  'linear-gradient(135deg, rgba(148, 132, 184, 0.22), rgba(106, 155, 200, 0.18))'

const emptySocialLink = (): ProfileSocialLink => ({ label: '', value: '' })

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
  onDraftChange?: (draft: UserProfile) => void
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

export default function ProfileSubmenu({ panelRef, onClose, onDraftChange }: ProfileSubmenuProps) {
  const savedProfile = useProfileStore((s) => s.profile)
  const saveProfile = useProfileStore((s) => s.saveProfile)
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<UserProfile>(savedProfile)
  const [errors, setErrors] = useState<ProfileValidation>({})
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [mediaBusy, setMediaBusy] = useState<ProfileImageKind | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const formScrollRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const userEditedRef = useRef(false)
  const isPhone = useIsPhoneLayout()
  const layout = usePanelAlignedSubmenuLayout(panelRef, SUBMENU_WIDTH, SUBMENU_GAP)

  const dirty = !profilesEqual(draft, savedProfile)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (userEditedRef.current) return
    setDraft(savedProfile)
    setErrors({})
    setAvatarError(null)
    setBannerError(null)
  }, [savedProfile])

  useEffect(() => {
    function handleWindowFocus() {
      window.setTimeout(() => endProfileFilePicker(), 0)
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])

  const patchDraft = useCallback((patch: Partial<UserProfile>) => {
    userEditedRef.current = true
    setDraft((prev) => ({ ...prev, ...patch }))
    setErrors({})
    setAvatarError(null)
    setBannerError(null)
  }, [])

  const resetDraft = useCallback(() => {
    userEditedRef.current = false
    setDraft(savedProfile)
    setErrors({})
    setAvatarError(null)
    setBannerError(null)
  }, [savedProfile])

  const handleClose = useCallback(() => {
    resetDraft()
    onClose()
  }, [onClose, resetDraft])

  const handleDiscard = useCallback(() => {
    resetDraft()
  }, [resetDraft])

  const handleSave = useCallback(() => {
    const validation = validateProfileDraft(draft)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }
    const next = sanitizeProfileDraft(draft)
    saveProfile(next)
    userEditedRef.current = false
    setErrors({})
    onClose()
  }, [draft, onClose, saveProfile])

  const applyProfileImage = useCallback(
    async (file: File, kind: ProfileImageKind) => {
      const setError = kind === 'avatar' ? setAvatarError : setBannerError

      setMediaBusy(kind)
      setError(null)
      try {
        const dataUrl = await prepareProfileImageDataUrl(file, kind)
        patchDraft(
          kind === 'avatar'
            ? {
                avatarImageUrl: dataUrl,
                avatarFrame: defaultProfileMediaFrame('avatar'),
              }
            : {
                bannerImageUrl: dataUrl,
                bannerFrame: defaultProfileMediaFrame('banner'),
              },
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not use that image')
      } finally {
        setMediaBusy(null)
      }
    },
    [patchDraft],
  )

  const updateMediaFrame = useCallback(
    (kind: ProfileImageKind, frame: ProfileMediaFrame) => {
      patchDraft(kind === 'avatar' ? { avatarFrame: frame } : { bannerFrame: frame })
    },
    [patchDraft],
  )

  const openBannerPicker = useCallback(() => {
    beginProfileFilePicker()
    bannerInputRef.current?.click()
  }, [])

  const openAvatarPicker = useCallback(() => {
    beginProfileFilePicker()
    fileInputRef.current?.click()
  }, [])

  const handleAvatarFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      endProfileFilePicker()
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      void applyProfileImage(file, 'avatar')
    },
    [applyProfileImage],
  )

  const handleBannerFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      endProfileFilePicker()
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      void applyProfileImage(file, 'banner')
    },
    [applyProfileImage],
  )

  const updateSocial = useCallback(
    (index: number, patch: Partial<ProfileSocialLink>) => {
      userEditedRef.current = true
      setDraft((prev) => ({
        ...prev,
        socials: prev.socials.map((link, i) =>
          i === index ? { ...link, ...patch } : link,
        ),
      }))
      setErrors({})
    },
    [],
  )

  const removeSocial = useCallback((index: number) => {
    userEditedRef.current = true
    setDraft((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }))
    setErrors({})
  }, [])

  const addSocial = useCallback(() => {
    userEditedRef.current = true
    setDraft((prev) => {
      if (prev.socials.length >= SOCIAL_MAX) return prev
      return { ...prev, socials: [...prev.socials, emptySocialLink()] }
    })
    setErrors({})
  }, [])

  const handleFieldFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    const container = formScrollRef.current
    const field = e.currentTarget
    if (!container) return
    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect()
      const fieldRect = field.getBoundingClientRect()
      if (fieldRect.bottom > containerRect.bottom - 12) {
        container.scrollTop += fieldRect.bottom - containerRect.bottom + 12
      } else if (fieldRect.top < containerRect.top + 12) {
        container.scrollTop -= containerRect.top + 12 - fieldRect.top
      }
    })
  }, [])

  if (!mounted) return null

  const saveBubbleTop =
    layout.height > 0 ? layout.top + layout.height + SAVE_BUBBLE_GAP : 0

  return createPortal(
    <>
      <motion.div
        ref={submenuRef}
        data-profile-submenu
        {...(isPhone ? phoneSubmenuSlideMotion : {
          initial: { opacity: 0, scale: 0.96, x: 8 },
          animate: { opacity: 1, scale: 1, x: 0 },
          exit: { opacity: 0, scale: 0.96, x: 8 },
          transition: { duration: 0.18, ease: 'easeOut' },
        })}
        style={{
          ...(isPhone
            ? phoneSubmenuSheetStyle({ display: 'flex', flexDirection: 'column' }, 'right')
            : {
                position: 'fixed',
                top: layout.top,
                left: layout.left,
                width: SUBMENU_WIDTH,
                height: layout.height > 0 ? layout.height : undefined,
              }),
          display: 'flex',
          flexDirection: 'column',
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 45,
          overflow: 'hidden',
        }}
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
      <SubmenuSoundScope>
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
          onClick={() => {
            playSubmenuTap()
            handleClose()
          }}
          onMouseEnter={() => playSubmenuHover()}
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

      <ChromeScrollFade ref={formScrollRef} scrollStyle={{ padding: '0 16px' }}>
        <div style={{ marginBottom: 2 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <MediaChangeTile
              busy={mediaBusy === 'banner'}
              disabled={mediaBusy !== null && mediaBusy !== 'banner'}
              imageUrl={draft.bannerImageUrl}
              frame={draft.bannerFrame ?? defaultProfileMediaFrame('banner')}
              onPickImage={openBannerPicker}
              onFrameChange={(bannerFrame) => updateMediaFrame('banner', bannerFrame)}
              placeholder={
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: defaultBannerGradient,
                  }}
                />
              }
            />
            <MediaChangeTile
              busy={mediaBusy === 'avatar'}
              disabled={mediaBusy !== null && mediaBusy !== 'avatar'}
              imageUrl={draft.avatarImageUrl}
              frame={draft.avatarFrame ?? defaultProfileMediaFrame('avatar')}
              onPickImage={openAvatarPicker}
              onFrameChange={(avatarFrame) => updateMediaFrame('avatar', avatarFrame)}
              placeholder={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    background: draft.avatarColor,
                  }}
                >
                  <span
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {deriveInitial(draft.displayName)}
                  </span>
                </div>
              }
            />
          </div>
          {bannerError && (
            <p style={{ ...fieldErrorStyle, margin: '8px 0 0', textAlign: 'center' }}>
              {bannerError}
            </p>
          )}
          {avatarError && (
            <p style={{ ...fieldErrorStyle, margin: '4px 0 0', textAlign: 'center' }}>
              {avatarError}
            </p>
          )}
        </div>

        <div style={{ ...menuDividerStyle, margin: '10px 0 18px' }} />

        <Field id="profile-display-name" label="Display name" error={errors.displayName}>
          <input
            id="profile-display-name"
            type="text"
            value={draft.displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            onChange={(e) => patchDraft({ displayName: e.target.value })}
            onFocus={handleFieldFocus}
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
              onFocus={handleFieldFocus}
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
            onFocus={handleFieldFocus}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
            placeholder="a line about you"
          />
        </Field>

        <Field
          id="profile-socials"
          label="Social connections"
          hint="Platform name and handle or URL"
          error={errors.socials}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.socials.map((link, index) => (
              <div key={`social-${index}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={link.label}
                  maxLength={SOCIAL_LABEL_MAX_LENGTH}
                  placeholder="instagram"
                  onChange={(e) => updateSocial(index, { label: e.target.value })}
                  onFocus={handleFieldFocus}
                  style={{ ...inputStyle, flex: '0 0 96px' }}
                  aria-label={`Platform ${index + 1}`}
                />
                <input
                  type="text"
                  value={link.value}
                  maxLength={SOCIAL_VALUE_MAX_LENGTH}
                  placeholder="username or URL"
                  onChange={(e) => updateSocial(index, { value: e.target.value })}
                  onFocus={handleFieldFocus}
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  aria-label={`Handle or URL ${index + 1}`}
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => {
                    playSubmenuTap()
                    removeSocial(index)
                  }}
                  onMouseEnter={() => playSubmenuHover()}
                  style={iconButtonStyle}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            {draft.socials.length < SOCIAL_MAX && (
              <button
                type="button"
                onClick={() => {
                  playSubmenuTap()
                  addSocial()
                }}
                onMouseEnter={() => playSubmenuHover()}
                style={{
                  ...secondaryButtonStyle,
                  alignSelf: 'flex-start',
                }}
              >
                <Plus size={14} strokeWidth={2} />
                {chromeLabel('Add link')}
              </button>
            )}
          </div>
        </Field>
      </ChromeScrollFade>
      </SubmenuSoundScope>
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
              ...chromeFrostedMenuStyle,
              fontFamily: font.family,
              color: font.colorPrimary,
              zIndex: 46,
            }}
            className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
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

      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*,.gif,.heic,.heif"
        style={{ display: 'none' }}
        onChange={handleBannerFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif,.heic,.heif"
        style={{ display: 'none' }}
        onChange={handleAvatarFile}
      />
    </>,
    document.body,
  )
}

function MediaChangeTile({
  busy = false,
  disabled = false,
  imageUrl,
  frame,
  onPickImage,
  onFrameChange,
  placeholder,
}: {
  busy?: boolean
  disabled?: boolean
  imageUrl?: string | null
  frame?: ProfileMediaFrame
  onPickImage: () => void
  onFrameChange: (frame: ProfileMediaFrame) => void
  placeholder: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  const handlePickImage = useCallback(() => {
    playSubmenuTap()
    onPickImage()
  }, [onPickImage])

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          height: MEDIA_BUTTON_HEIGHT,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--glass-border)',
          background: 'var(--card-bg)',
        }}
      >
        {imageUrl && frame ? (
          <ProfileMediaFrameEditor
            src={imageUrl}
            frame={frame}
            onChange={onFrameChange}
            onTap={handlePickImage}
          />
        ) : (
          <button
            type="button"
            aria-label="Choose image"
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              handlePickImage()
            }}
            onMouseEnter={() => {
              if (!disabled) setHovered(true)
            }}
            onMouseLeave={() => setHovered(false)}
            style={{
              width: '100%',
              height: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'wait' : 'pointer',
            }}
          >
            {placeholder}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: hovered && !disabled ? 'rgba(20, 30, 50, 0.06)' : 'transparent',
                transition: 'background 0.15s ease',
                pointerEvents: 'none',
              }}
            />
          </button>
        )}
        {busy && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              color: font.colorMuted,
              pointerEvents: 'none',
            }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
              style={{ display: 'flex', lineHeight: 0 }}
            >
              <Loader2 size={14} strokeWidth={2.2} />
            </motion.span>
          </div>
        )}
      </div>
    </div>
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

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: 10,
  border: '1px solid var(--glass-border)',
  background: 'transparent',
  color: font.colorMuted,
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
