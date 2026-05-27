import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import {
  AlertCircle,
  Check,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  Pen,
  Plus,
  Redo2,
  Search,
  Smile,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { EmojiPicker, type Emoji } from 'frimousse'
import { generateItemId } from '../canvasItems/itemId'
import { putMediaBlob } from '../media/mediaBlobStore'
import { scheduleMediaBlobGc } from '../media/mediaBlobGc'
import {
  isAcceptedMediaFile,
  prepareMediaFromFile,
} from '../canvasItems/mediaUtils'
import { showMediaImportToast } from '../canvasItems/mediaImportFeedback'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import {
  CHROME_FROSTED_MENU_CLASS,
  chromeFrostedMenuStyle,
  font,
  menuDividerVerticalStyle,
} from '../styles/tokens'
import ChromeScrollFade from '../components/ChromeScrollFade'
import { useScrollFadeEdges } from '../components/useScrollFadeEdges'
import {
  DRAW_TOOL_COLORS,
  DRAW_TOOL_LIGHT_COLOR,
  DRAW_TOOL_SIZE_MAX,
  DRAW_TOOL_SIZE_MIN,
  useUiCustomizationStore,
  UI_FOCUS_SCALE,
} from './uiCustomizationStore'
import { DrawingStrokesSvg } from './DrawingStrokesSvg'
import { UI_PIN_DEFAULT_EMOJI_SIZE, UI_PIN_DEFAULT_SIZE } from './types'
import { strokeToSvgPath, ensureMinimumStrokePoints } from '../drawing/strokePath'
import type { StrokePoint } from '../drawing/types'
import { useToolStore } from '../drawing/toolStore'
import { registerPenMenuCancelDraw } from '../drawing/usePenToolMenu'
import {
  isKlipyConfigured,
  isKlipyRateLimitError,
  searchKlipy,
  type KlipyMediaKind,
  type KlipyMediaResult,
} from './klipyApi'

const TRAY_HEIGHT = 'min(540px, calc(50dvh - 96px))'
const TRAY_TAB_HEIGHT = 36

type TrayTab = 'emoji' | 'image' | 'gif' | 'draw'

interface StagedImage {
  id: string
  mediaId: string
  aspect: number
  objectUrl: string
}

interface UiPinTrayProps {
  open: boolean
}

export default function UiPinTray({ open }: UiPinTrayProps) {
  const [tab, setTab] = useState<TrayTab>('emoji')
  const drawTool = useUiCustomizationStore((s) => s.drawTool)
  const setDrawTool = useUiCustomizationStore((s) => s.setDrawTool)
  const focusedAnchorId = useUiCustomizationStore((s) => s.focusedAnchorId)
  const addPin = useUiCustomizationStore((s) => s.addPin)
  const startPinDrag = useUiCustomizationStore((s) => s.startPinDrag)

  // ─── Image staging (upload only — placement disabled) ────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([])
  const stagedImagesRef = useRef<StagedImage[]>([])
  useEffect(() => {
    stagedImagesRef.current = stagedImages
  }, [stagedImages])
  useEffect(() => {
    return () => {
      stagedImagesRef.current.forEach((img) => URL.revokeObjectURL(img.objectUrl))
      if (stagedImagesRef.current.length > 0) scheduleMediaBlobGc()
    }
  }, [])
  const handleUploadFile = useCallback(async (file: File) => {
    if (!isAcceptedMediaFile(file)) {
      showMediaImportToast('unsupported')
      return
    }
    setUploading(true)
    try {
      const prepared = await Promise.race([
        prepareMediaFromFile(file, { preferMainThread: true }),
        new Promise<Awaited<ReturnType<typeof prepareMediaFromFile>>>(
          (resolve) => {
            globalThis.setTimeout(
              () => resolve({ ok: false, reason: 'processing_failed' }),
              45_000,
            )
          },
        ),
      ])
      if (!prepared.ok) {
        showMediaImportToast(prepared.reason, prepared.fileSize)
        return
      }
      if (prepared.media.kind !== 'image') {
        showMediaImportToast('unsupported')
        return
      }
      const mediaId = generateItemId()
      const saved = await putMediaBlob(mediaId, prepared.media.blob)
      if (!saved) {
        showMediaImportToast('processing_failed')
        return
      }
      const aspect = prepared.media.width / Math.max(1, prepared.media.height)
      const objectUrl = URL.createObjectURL(prepared.media.blob)
      setStagedImages((prev) => [
        ...prev,
        { id: generateItemId(), mediaId, aspect, objectUrl },
      ])
      playSubmenuTap()
    } finally {
      setUploading(false)
    }
  }, [])

  const removeStagedImage = useCallback((id: string) => {
    setStagedImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) URL.revokeObjectURL(target.objectUrl)
      return prev.filter((img) => img.id !== id)
    })
    scheduleMediaBlobGc()
  }, [])

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      void handleUploadFile(file)
    },
    [handleUploadFile],
  )

  // ─── KLIPY search (GIFs + stickers) ───────────────────────────────────
  const [klipyKind, setKlipyKind] = useState<KlipyMediaKind>('gifs')
  const [klipyQuery, setKlipyQuery] = useState('')
  const [klipyResults, setKlipyResults] = useState<KlipyMediaResult[]>([])
  const [klipyHasNext, setKlipyHasNext] = useState(false)
  const [klipyPage, setKlipyPage] = useState(1)
  const [klipyLoadingMore, setKlipyLoadingMore] = useState(false)
  const [klipyStatus, setKlipyStatus] = useState<
    'idle' | 'loading' | 'error' | 'rate_limit' | 'unconfigured'
  >(isKlipyConfigured() ? 'idle' : 'unconfigured')
  const klipyFetchGenRef = useRef(0)

  useEffect(() => {
    if (!open || tab !== 'gif') return
    if (!isKlipyConfigured()) {
      setKlipyStatus('unconfigured')
      setKlipyResults([])
      setKlipyHasNext(false)
      setKlipyPage(1)
      return
    }
    const gen = ++klipyFetchGenRef.current
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      setKlipyStatus('loading')
      setKlipyResults([])
      setKlipyHasNext(false)
      setKlipyPage(1)
      void searchKlipy(klipyKind, klipyQuery, 1, ctrl.signal)
        .then(({ results, hasNext, page }) => {
          if (ctrl.signal.aborted || gen !== klipyFetchGenRef.current) return
          setKlipyResults(results)
          setKlipyHasNext(hasNext)
          setKlipyPage(page)
          setKlipyStatus('idle')
        })
        .catch((err) => {
          if (ctrl.signal.aborted || gen !== klipyFetchGenRef.current) return
          console.warn('[ui-customization] klipy search failed', err)
          setKlipyStatus(isKlipyRateLimitError(err) ? 'rate_limit' : 'error')
        })
    }, klipyQuery ? 220 : 0)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [klipyKind, klipyQuery, tab, open])

  const loadMoreKlipy = useCallback(() => {
    if (
      !open ||
      tab !== 'gif' ||
      !isKlipyConfigured() ||
      !klipyQuery.trim() ||
      !klipyHasNext ||
      klipyLoadingMore ||
      klipyStatus === 'loading' ||
      klipyStatus === 'error' ||
      klipyStatus === 'rate_limit' ||
      klipyStatus === 'unconfigured'
    ) {
      return
    }

    const gen = klipyFetchGenRef.current
    const nextPage = klipyPage + 1
    const ctrl = new AbortController()
    setKlipyLoadingMore(true)

    void searchKlipy(klipyKind, klipyQuery, nextPage, ctrl.signal)
      .then(({ results, hasNext, page }) => {
        if (gen !== klipyFetchGenRef.current) return
        setKlipyResults((prev) => {
          const seen = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          for (const item of results) {
            if (seen.has(item.id)) continue
            seen.add(item.id)
            merged.push(item)
          }
          return merged
        })
        setKlipyHasNext(hasNext)
        setKlipyPage(page)
      })
      .catch((err) => {
        if (gen !== klipyFetchGenRef.current) return
        console.warn('[ui-customization] klipy load-more failed', err)
      })
      .finally(() => {
        if (gen === klipyFetchGenRef.current) {
          setKlipyLoadingMore(false)
        }
      })
  }, [
    klipyHasNext,
    klipyKind,
    klipyLoadingMore,
    klipyPage,
    klipyQuery,
    klipyStatus,
    open,
    tab,
  ])

  // ─── Tray-level add/drag callbacks ───────────────────────────────────────

  const handleEmojiPick = useCallback((char: string) => {
    if (!focusedAnchorId) return
    addPin({ anchorId: focusedAnchorId, offsetX: 0, offsetY: 0, asset: { kind: 'emoji', char }, size: UI_PIN_DEFAULT_EMOJI_SIZE })
    playSubmenuTap()
  }, [addPin, focusedAnchorId])

  const handleEmojiDragStart = useCallback((char: string, x: number, y: number) => {
    startPinDrag({ kind: 'emoji', char }, x, y)
  }, [startPinDrag])

  const handleGifPick = useCallback((item: KlipyMediaResult) => {
    if (!focusedAnchorId) return
    const aspect = item.width / Math.max(1, item.height)
    addPin({ anchorId: focusedAnchorId, offsetX: 0, offsetY: 0, asset: { kind: 'gif', url: item.url, previewUrl: item.previewUrl, aspect }, size: UI_PIN_DEFAULT_SIZE })
    playSubmenuTap()
  }, [addPin, focusedAnchorId])

  const handleGifDragStart = useCallback((item: KlipyMediaResult, x: number, y: number) => {
    const aspect = item.width / Math.max(1, item.height)
    startPinDrag({ kind: 'gif', url: item.url, previewUrl: item.previewUrl, aspect }, x, y, item.previewUrl ?? item.url)
  }, [startPinDrag])

  const handleImagePick = useCallback((img: StagedImage) => {
    if (!focusedAnchorId) return
    addPin({ anchorId: focusedAnchorId, offsetX: 0, offsetY: 0, asset: { kind: 'image', mediaId: img.mediaId, aspect: img.aspect }, size: UI_PIN_DEFAULT_SIZE })
    playSubmenuTap()
  }, [addPin, focusedAnchorId])

  const handleImageDragStart = useCallback((img: StagedImage, x: number, y: number) => {
    startPinDrag({ kind: 'image', mediaId: img.mediaId, aspect: img.aspect }, x, y, img.objectUrl)
  }, [startPinDrag])

  return (
      <motion.div
        data-ui-customization-tray=""
        // Match the news / notifications / + FAB menus' deep frost so the
        // tray sits in the same surface family as the rest of the chrome.
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          width: 'min(540px, calc(100vw - 32px))',
          height: TRAY_HEIGHT,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          overflow: 'hidden',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          style={{
            position: 'absolute',
            left: -9999,
            top: 'auto',
            width: 1,
            height: 1,
            opacity: 0,
            overflow: 'hidden',
          }}
          onChange={onFileInputChange}
        />

        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: 0,
            padding: 6,
            paddingTop: 10,
            height: TRAY_TAB_HEIGHT + 16,
          }}
        >
          <TrayTabButton
            active={tab === 'emoji'}
            icon={Smile}
            label="Emojis"
            onSelect={() => setTab('emoji')}
          />
          <TrayTabButton
            active={tab === 'image'}
            icon={ImageIcon}
            label="Images"
            onSelect={() => setTab('image')}
          />
          <TrayTabButton
            active={tab === 'gif'}
            icon={SquareGifIcon}
            label="GIFs"
            onSelect={() => setTab('gif')}
          />
          <TrayTabButton
            active={tab === 'draw'}
            icon={Pen}
            label="Draw"
            onSelect={() => setTab('draw')}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {tab === 'emoji' && <FullEmojiPicker onPick={handleEmojiPick} onDragStart={handleEmojiDragStart} />}
          {tab === 'image' && (
            <ImageTab
              uploading={uploading}
              onPickFile={() => fileInputRef.current?.click()}
              stagedImages={stagedImages}
              onRemoveStagedImage={removeStagedImage}
              onPickImage={handleImagePick}
              onDragStartImage={handleImageDragStart}
            />
          )}
          {tab === 'gif' && (
            <KlipyMediaGrid
              kind={klipyKind}
              onKindChange={setKlipyKind}
              query={klipyQuery}
              onQueryChange={setKlipyQuery}
              status={klipyStatus}
              results={klipyResults}
              hasMore={klipyHasNext}
              loadingMore={klipyLoadingMore}
              onLoadMore={loadMoreKlipy}
              onPickGif={handleGifPick}
              onDragStartGif={handleGifDragStart}
            />
          )}
          {tab === 'draw' && (
            <DrawTab
              tool={drawTool}
              onToolChange={setDrawTool}
              focusedAnchorId={focusedAnchorId}
              onAddToUi={(asset) => {
                if (!focusedAnchorId) return
                addPin({ anchorId: focusedAnchorId, offsetX: 0, offsetY: 0, asset, size: Math.round(UI_PIN_DEFAULT_SIZE * 3) })
                playSubmenuTap()
              }}
              onDragStartDraw={(asset, x, y) => startPinDrag(asset, x, y)}
            />
          )}
        </div>
      </motion.div>
  )
}

// ─── Tab chrome ─────────────────────────────────────────────────────────────

function TrayTabButton({
  active,
  icon: Icon,
  label,
  onSelect,
}: {
  active: boolean
  icon: React.ElementType
  label: string
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onPointerDown={(e) => {
        e.stopPropagation()
        playSubmenuTap()
        onSelect()
      }}
      onMouseEnter={() => { setHovered(true); playSubmenuHover() }}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: TRAY_TAB_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        border: 'none',
        borderRadius: 10,
        background: active
          ? 'rgba(20, 30, 50, 0.06)'
          : hovered
            ? 'rgba(20, 30, 50, 0.04)'
            : 'transparent',
        color: active || hovered ? font.colorPrimary : font.colorMuted,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: font.family,
        margin: '0 2px',
        transition: 'background 160ms ease, color 160ms ease',
      }}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  )
}

// ─── Emoji tab ──────────────────────────────────────────────────────────────

function FullEmojiPicker({ onPick, onDragStart }: {
  onPick: (char: string) => void
  onDragStart: (char: string, x: number, y: number) => void
}) {
  const { scrollRef, canScrollUp, canScrollDown, onScroll } =
    useScrollFadeEdges(true)

  return (
    <EmojiPicker.Root
      className="ui-emoji-picker-root"
      columns={9}
      sticky={false}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'transparent',
      }}
    >
      <div style={{ padding: '8px 10px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
            height: 34,
            borderRadius: 16,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
          }}
        >
          <Search size={13} strokeWidth={2} color={font.colorMuted} />
          <EmojiPicker.Search
            placeholder="search emojis"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: font.family,
              fontSize: 13,
              color: font.colorPrimary,
              padding: 0,
            }}
          />
        </div>
      </div>
      <div
        className="chrome-scroll-fade-wrap ui-emoji-scroll-wrap"
        data-fade-top={canScrollUp ? '' : undefined}
        data-fade-bottom={canScrollDown ? '' : undefined}
      >
        <EmojiPicker.Viewport
          ref={scrollRef}
          onScroll={onScroll}
          className="chrome-scroll-fade ui-emoji-viewport"
          style={{ position: 'relative' }}
        >
          <EmojiPicker.Loading
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: font.colorMuted,
              fontFamily: font.family,
              fontSize: 12,
            }}
          >
            loading emojis…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty>
            {({ search }) => (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: font.colorMuted,
                  fontFamily: font.family,
                  fontSize: 12,
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                no emoji for "{search}".
              </div>
            )}
          </EmojiPicker.Empty>
          <EmojiPicker.List
            components={{
              CategoryHeader: ({ category: _category, ...rest }) => (
                <div
                  {...rest}
                  style={{
                    boxSizing: 'border-box',
                    // frimousse inserts a spacer div before each category equal to this
                    // measured height — keep it 1px so rows sit tight under search.
                    // Must stay truthy (>0) or virtualization bails out.
                    height: 1,
                    minHeight: 1,
                    maxHeight: 1,
                    overflow: 'hidden',
                    padding: 0,
                    margin: 0,
                    fontSize: 0,
                    lineHeight: 0,
                  }}
                />
              ),
              Row: ({ children, ...rest }) => (
                <div
                  {...rest}
                  style={{
                    ...(rest.style ?? {}),
                    display: 'flex',
                    padding: '0 6px',
                  }}
                >
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...rest }) => (
                <EmojiPickerCell emoji={emoji} rest={rest} onPick={onPick} onDragStart={onDragStart} />
              ),
            }}
          />
        </EmojiPicker.Viewport>
      </div>
    </EmojiPicker.Root>
  )
}

function EmojiPickerCell({
  emoji,
  rest,
  onPick,
  onDragStart,
}: {
  emoji: Emoji & { isActive: boolean }
  rest: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    style?: React.CSSProperties
  }
  onPick: (char: string) => void
  onDragStart: (char: string, x: number, y: number) => void
}) {
  const { style: restStyle, onClick: _onClick, ...restProps } = rest
  return (
    <button
      type="button"
      {...restProps}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDragStart(emoji.emoji, e.clientX, e.clientY)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onPick(emoji.emoji)
      }}
      style={{
        ...(restStyle ?? {}),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'calc((100% - 18px) / 9)',
        flexShrink: 0,
        aspectRatio: '1 / 1',
        border: 'none',
        borderRadius: 8,
        margin: 1,
        padding: 0,
        background: 'transparent',
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '70%',
          height: '70%',
          borderRadius: 6,
          background: emoji.isActive
            ? 'rgba(20, 30, 50, 0.08)'
            : 'transparent',
          fontSize: 22,
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji',
          transition: 'background-color 120ms ease',
        }}
      >
        {emoji.emoji}
      </span>
    </button>
  )
}

// ─── Image tab ──────────────────────────────────────────────────────────────

const IMG_H = 104
const IMG_MARGIN = 10
const NUDGE = 20

function clampPos(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi))
}

function DraggableImage({
  img,
  pos,
  containerRef,
  onDragEnd,
  onRemove,
  onPick,
  onDragStart,
}: {
  img: StagedImage
  pos: { x: number; y: number }
  containerRef: React.RefObject<HTMLDivElement>
  onDragEnd: (id: string, x: number, y: number) => void
  onRemove: (id: string) => void
  onPick: (img: StagedImage) => void
  onDragStart: (img: StagedImage, x: number, y: number) => void
}) {
  const mx = useMotionValue(pos.x)
  const my = useMotionValue(pos.y)
  const imgW = Math.round(IMG_H * Math.min(Math.max(img.aspect, 0.5), 2.8))

  // Spring to new position when nudged by external state changes
  useEffect(() => {
    animate(mx, pos.x, { type: 'spring', stiffness: 320, damping: 28 })
    animate(my, pos.y, { type: 'spring', stiffness: 320, damping: 28 })
  }, [pos.x, pos.y])

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.06}
      dragConstraints={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        x: mx,
        y: my,
        width: imgW,
        height: IMG_H,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
        background: 'rgba(20, 30, 50, 0.04)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.13)',
        cursor: 'grab',
        touchAction: 'none',
      }}
      whileDrag={{ scale: 1.05, boxShadow: '0 10px 28px rgba(0,0,0,0.22)', zIndex: 20, cursor: 'grabbing' }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 }}
      onClick={(e) => { e.stopPropagation(); onPick(img) }}
      onPointerDown={(e) => { e.stopPropagation(); onDragStart(img, e.clientX, e.clientY) }}
      onDragEnd={() => onDragEnd(img.id, mx.get(), my.get())}
    >
      <img
        src={img.objectUrl}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
      />
      <button
        type="button"
        aria-label="Remove image"
        onClick={(e) => { e.stopPropagation(); onRemove(img.id) }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 5, right: 5,
          width: 20, height: 20, borderRadius: '50%',
          border: 'none',
          background: 'rgba(10, 12, 18, 0.62)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
      >
        <X size={11} strokeWidth={2.6} />
      </button>
    </motion.div>
  )
}

function StagedImageGrid({
  images,
  onRemove,
  onPickFile,
  onPickImage,
  onDragStartImage,
}: {
  images: StagedImage[]
  onRemove: (id: string) => void
  onPickFile: () => void
  onPickImage: (img: StagedImage) => void
  onDragStartImage: (img: StagedImage, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Place new images randomly; nudge existing ones
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return
    const { w, h } = size

    setPositions((prev) => {
      const newImages = images.filter((img) => !prev[img.id])

      const next: Record<string, { x: number; y: number }> = {}
      for (const img of images) {
        if (prev[img.id]) next[img.id] = prev[img.id]
      }

      if (newImages.length === 0) return next

      for (const img of images) {
        if (!next[img.id]) continue
        const imgW = Math.round(IMG_H * Math.min(Math.max(img.aspect, 0.5), 2.8))
        next[img.id] = {
          x: clampPos(next[img.id].x + (Math.random() - 0.5) * NUDGE * 2, IMG_MARGIN, w - imgW - IMG_MARGIN),
          y: clampPos(next[img.id].y + (Math.random() - 0.5) * NUDGE * 2, IMG_MARGIN, h - IMG_H - IMG_MARGIN),
        }
      }

      for (const img of newImages) {
        const imgW = Math.round(IMG_H * Math.min(Math.max(img.aspect, 0.5), 2.8))
        next[img.id] = {
          x: clampPos(IMG_MARGIN + Math.random() * (w - imgW - IMG_MARGIN * 2), IMG_MARGIN, w - imgW - IMG_MARGIN),
          y: clampPos(IMG_MARGIN + Math.random() * (h - IMG_H - IMG_MARGIN * 2), IMG_MARGIN, h - IMG_H - IMG_MARGIN),
        }
      }

      return next
    })
  }, [images, size])

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [id]: { x, y } }))
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onPickFile() } }}
    >
      <AnimatePresence>
        {images.map((img) => {
          const pos = positions[img.id]
          if (!pos) return null
          return (
            <DraggableImage
              key={img.id}
              img={img}
              pos={pos}
              containerRef={containerRef}
              onDragEnd={handleDragEnd}
              onRemove={onRemove}
              onPick={onPickImage}
              onDragStart={onDragStartImage}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function ImageTab({
  uploading,
  onPickFile,
  stagedImages,
  onRemoveStagedImage,
  onPickImage,
  onDragStartImage,
}: {
  uploading: boolean
  onPickFile: () => void
  stagedImages: StagedImage[]
  onRemoveStagedImage: (id: string) => void
  onPickImage: (img: StagedImage) => void
  onDragStartImage: (img: StagedImage, x: number, y: number) => void
}) {
  return (
    <div style={{ height: '100%', padding: 12, boxSizing: 'border-box', minHeight: 0 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Tap to upload an image or GIF"
        onClick={(e) => {
          if (uploading) return
          onPickFile()
        }}
        onKeyDown={(e) => {
          if (uploading) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickFile() }
        }}
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          borderRadius: 14,
          border: '1px dashed var(--glass-border)',
          background: 'rgba(20, 30, 50, 0.025)',
          boxSizing: 'border-box',
          cursor: uploading ? 'wait' : 'pointer',
          position: 'relative',
        }}
      >
        {stagedImages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p
              onClick={(e) => { if (uploading) return; e.stopPropagation(); onPickFile() }}
              style={{
                margin: 0, fontSize: 12, color: font.colorMuted, opacity: 0.6,
                textAlign: 'center', lineHeight: 1.4, fontFamily: font.family,
                padding: 12, cursor: uploading ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {uploading ? (
                <><Loader2 size={13} className="ui-customize-spin" strokeWidth={2.2} />preparing…</>
              ) : (
                'tap anywhere to upload image / gif'
              )}
            </p>
          </div>
        ) : (
          <div
            style={{ flex: 1, position: 'relative', minHeight: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget && !uploading) { e.stopPropagation(); onPickFile() } }}
          >
            <StagedImageGrid images={stagedImages} onRemove={onRemoveStagedImage} onPickFile={onPickFile} onPickImage={onPickImage} onDragStartImage={onDragStartImage} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KLIPY tab (GIFs + stickers) ───────────────────────────────────────────

function KlipyKindToggle({
  kind,
  onKindChange,
}: {
  kind: KlipyMediaKind
  onKindChange: (kind: KlipyMediaKind) => void
}) {
  const options: { id: KlipyMediaKind; label: string }[] = [
    { id: 'gifs', label: 'gifs' },
    { id: 'stickers', label: 'stickers' },
  ]

  return (
    <div
      role="tablist"
      aria-label="KLIPY content type"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        height: 34,
        borderRadius: 16,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {options.map((option) => {
        const active = kind === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (active) return
              playSubmenuTap()
              onKindChange(option.id)
            }}
            onMouseEnter={() => playSubmenuHover()}
            style={{
              height: '100%',
              border: 'none',
              borderRadius: 11,
              padding: '0 12px',
              fontFamily: font.family,
              fontSize: 13,
              fontWeight: 500,
              cursor: active ? 'default' : 'pointer',
              background: active ? 'rgba(20, 30, 50, 0.07)' : 'transparent',
              color: active ? font.colorPrimary : font.colorMuted,
              transition: 'background 140ms ease, color 140ms ease',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function KlipyLoadSentinel({
  enabled,
  rootRef,
  onVisible,
}: {
  enabled: boolean
  rootRef: React.RefObject<HTMLDivElement | null>
  onVisible: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible()
        }
      },
      { root, rootMargin: '160px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled, onVisible, rootRef])

  return (
    <div
      ref={sentinelRef}
      aria-hidden
      style={{ height: 1, width: '100%', pointerEvents: 'none' }}
    />
  )
}

function KlipyMediaGrid({
  kind,
  onKindChange,
  query,
  onQueryChange,
  status,
  results,
  hasMore,
  loadingMore,
  onLoadMore,
  onPickGif,
  onDragStartGif,
}: {
  kind: KlipyMediaKind
  onKindChange: (kind: KlipyMediaKind) => void
  query: string
  onQueryChange: (q: string) => void
  status: 'idle' | 'loading' | 'error' | 'rate_limit' | 'unconfigured'
  results: KlipyMediaResult[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onPickGif: (item: KlipyMediaResult) => void
  onDragStartGif: (item: KlipyMediaResult, x: number, y: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '8px 10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
            height: 34,
            borderRadius: 16,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
          }}
        >
          <Search size={13} strokeWidth={2} color={font.colorMuted} />
          <input
            type="text"
            placeholder="search KLIPY"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: font.family,
              fontSize: 13,
              color: font.colorPrimary,
            }}
          />
        </div>
        <KlipyKindToggle kind={kind} onKindChange={onKindChange} />
      </div>

      <ChromeScrollFade
        ref={scrollRef}
        observeDeps={[status, results.length, kind, loadingMore, hasMore]}
        contentPadY={4}
        scrollStyle={{ flex: 1, minHeight: 0 }}
        contentStyle={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {status === 'loading' && results.length === 0 && (
          <KlipyTabState
            icon={<Loader2 size={16} className="ui-customize-spin" strokeWidth={2.2} color={font.colorMuted} />}
            text="searching…"
          />
        )}
        {status === 'unconfigured' && (
          <KlipyTabState
            icon={<AlertCircle size={16} strokeWidth={2} color={font.colorMuted} />}
            text="add VITE_KLIPY_APP_KEY to your .env file to enable GIFs and stickers."
          />
        )}
        {status === 'error' && (
          <KlipyTabState
            icon={<AlertCircle size={16} strokeWidth={2} color={font.colorMuted} />}
            text="couldn't reach KLIPY. check your connection or try again."
          />
        )}
        {status === 'rate_limit' && (
          <KlipyTabState
            icon={<AlertCircle size={16} strokeWidth={2} color={font.colorMuted} />}
            text="klipy rate limit hit — wait a minute, then reload. testing keys allow 100 requests/hour."
          />
        )}
        {status !== 'error' && status !== 'rate_limit' && status !== 'unconfigured' && results.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}
            >
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label="Add to UI element"
                  onPointerDown={(e) => { e.stopPropagation(); onDragStartGif(item, e.clientX, e.clientY) }}
                  onClick={(e) => { e.stopPropagation(); onPickGif(item) }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 10,
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    background: 'rgba(20, 30, 50, 0.04)',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.04)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = ''
                    e.currentTarget.style.boxShadow = ''
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      pointerEvents: 'none',
                      filter: 'saturate(0.8)',
                    }}
                  />
                </button>
              ))}
            </div>
            <KlipyLoadSentinel
              enabled={
                hasMore &&
                !loadingMore &&
                status !== 'loading' &&
                status !== 'error' &&
                status !== 'rate_limit' &&
                status !== 'unconfigured'
              }
              rootRef={scrollRef}
              onVisible={onLoadMore}
            />
          </>
        )}
        {loadingMore && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 4px',
            }}
          >
            <Loader2
              size={16}
              className="ui-customize-spin"
              strokeWidth={2.2}
              color={font.colorMuted}
            />
          </div>
        )}
        {status === 'idle' && results.length === 0 && (
          <KlipyTabState
            icon={<Check size={16} strokeWidth={2} color={font.colorMuted} />}
            text="no results — try a different search."
          />
        )}
      </ChromeScrollFade>

    </div>
  )
}

function KlipyTabState({
  icon,
  text,
}: {
  icon: React.ReactNode
  text: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: font.colorMuted,
        fontFamily: font.family,
        fontSize: 12,
        padding: 24,
        textAlign: 'center',
      }}
    >
      {icon}
      <span style={{ opacity: 0.6 }}>{text}</span>
    </div>
  )
}

// ─── Draw tab helpers ────────────────────────────────────────────────────────

/**
 * Compute the tight axis-aligned bounding box of all `<path>` elements inside
 * the given SVG, with a small padding. Falls back to the full SVG bounds if
 * getBBox fails or there are no paths.
 */
function computeStrokesBBox(
  svgEl: SVGSVGElement,
  padding = 8,
): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  svgEl.querySelectorAll<SVGPathElement>('path').forEach((path) => {
    try {
      const bbox = path.getBBox()
      if (bbox.width === 0 && bbox.height === 0) return
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    } catch {
      // getBBox() can throw in some edge cases (hidden element, etc.)
    }
  })

  const fallbackW = svgEl.clientWidth || 100
  const fallbackH = svgEl.clientHeight || 100

  if (minX === Infinity) {
    return { minX: 0, minY: 0, width: fallbackW, height: fallbackH }
  }

  const paddedMinX = Math.max(0, minX - padding)
  const paddedMinY = Math.max(0, minY - padding)
  const paddedMaxX = Math.min(fallbackW, maxX + padding)
  const paddedMaxY = Math.min(fallbackH, maxY + padding)

  return {
    minX: paddedMinX,
    minY: paddedMinY,
    width: Math.max(1, paddedMaxX - paddedMinX),
    height: Math.max(1, paddedMaxY - paddedMinY),
  }
}

function buildDrawingAsset(
  svgEl: SVGSVGElement,
  strokes: TrayStroke[],
): import('./types').UiPinAsset {
  const bbox = computeStrokesBBox(svgEl)
  return {
    kind: 'drawing',
    strokes: strokes.map((s) => ({
      path: s.path,
      color: s.color,
      tool: s.tool,
      opacity: s.opacity,
    })),
    viewBoxWidth: bbox.width,
    viewBoxHeight: bbox.height,
    ...(bbox.minX !== 0 ? { viewBoxMinX: bbox.minX } : {}),
    ...(bbox.minY !== 0 ? { viewBoxMinY: bbox.minY } : {}),
  }
}

// ─── Draw tab ───────────────────────────────────────────────────────────────

function DrawSizeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number
  max: number
  value: number
  onChange: (size: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const range = max - min
  const ratio = range > 0 ? (value - min) / range : 0
  const fillOpacity = 0.28 + ratio * 0.72

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = barRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(min + Math.round(t * range))
    },
    [min, onChange, range],
  )

  useEffect(() => {
    const el = barRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 0.5) return
      const direction = delta > 0 ? -1 : 1
      onChange(Math.min(max, Math.max(min, value + direction)))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [max, min, onChange, value])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDragging(true)
    setFromClientX(e.clientX)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setFromClientX(e.clientX)
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(max, value + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(min, value - 1))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        width: 132,
        marginLeft: 'auto',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: font.colorFaint,
          flexShrink: 0,
          width: 28,
        }}
      >
        size
      </span>
      <div
        ref={barRef}
        className="tool-settings-size-bar"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(value)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          touchAction: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: '100%',
            height: 8,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'var(--tool-settings-track-bg)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${ratio * 100}%`,
              borderRadius: 999,
              background: 'var(--tool-settings-size-fill)',
              opacity: fillOpacity,
              transition: dragging
                ? 'none'
                : 'width 80ms ease-out, opacity 80ms ease-out',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Draw tab local history ────────────────────────────────────────────────
type TrayStroke = {
  id: string
  color: string
  size: number
  path: string
  tool: 'pen' | 'highlighter'
  opacity?: number
}
type TrayDrawState = { strokes: TrayStroke[]; past: TrayStroke[][]; future: TrayStroke[][] }
type TrayDrawAction =
  | { type: 'COMMIT'; stroke: TrayStroke }
  | { type: 'ERASE'; id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' }

function trayDrawReducer(s: TrayDrawState, a: TrayDrawAction): TrayDrawState {
  if (a.type === 'COMMIT') return { strokes: [...s.strokes, a.stroke], past: [...s.past, s.strokes], future: [] }
  if (a.type === 'ERASE') return { strokes: s.strokes.filter(st => st.id !== a.id), past: [...s.past, s.strokes], future: [] }
  if (a.type === 'UNDO' && s.past.length) return { strokes: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.strokes, ...s.future] }
  if (a.type === 'REDO' && s.future.length) return { strokes: s.future[0], past: [...s.past, s.strokes], future: s.future.slice(1) }
  if (a.type === 'CLEAR') return { strokes: [], past: s.strokes.length ? [...s.past, s.strokes] : s.past, future: [] }
  return s
}

function DrawTab({
  tool,
  onToolChange,
  focusedAnchorId: _focusedAnchorId,
  onAddToUi,
  onDragStartDraw,
}: {
  tool: { color: string; size: number }
  onToolChange: (tool: { color?: string; size?: number }) => void
  focusedAnchorId: string | null
  onAddToUi: (asset: import('./types').UiPinAsset) => void
  onDragStartDraw: (asset: import('./types').UiPinAsset, x: number, y: number) => void
}) {
  const [drawState, dispatch] = useReducer(trayDrawReducer, { strokes: [], past: [], future: [] })
  const [activePath, setActivePath] = useState<string | null>(null)
  const toolMode = useToolStore((s) => s.mode)
  const svgRef = useRef<SVGSVGElement>(null)
  const pts = useRef<StrokePoint[]>([])
  const activeTool = useRef({ color: tool.color, size: tool.size, isErase: false, isHighlighter: false })
  const drawing = useRef(false)
  const hovered = useRef(false)    // SVG canvas area
  const tabHovered = useRef(false) // whole draw tab panel
  const spaceHeld = useRef(false)
  const lastMouse = useRef<{ x: number; y: number } | null>(null)

  const getPos = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null
  }

  const makePath = (complete: boolean) =>
    strokeToSvgPath(
      {
        id: '',
        points: pts.current,
        color: activeTool.current.color,
        size: activeTool.current.size,
        tool: activeTool.current.isHighlighter ? 'highlighter' : 'pen',
      },
      complete,
    ) || null

  // Refs so the stable useEffect can call the current-render versions
  const startRef = useRef<(x: number, y: number, p: number) => void>(null!)
  const endRef = useRef<() => void>(null!)
  const moveRef = useRef<(x: number, y: number, clientX?: number, clientY?: number) => void>(null!)

  startRef.current = (x, y, p) => {
    const mode = useToolStore.getState().mode
    activeTool.current = {
      color: tool.color,
      size: tool.size,
      isErase: mode === 'erase',
      isHighlighter: mode === 'highlighter',
    }
    pts.current = [{ x, y, pressure: p }]
    drawing.current = true
    setActivePath(null)
  }

  endRef.current = () => {
    if (!drawing.current) return
    drawing.current = false
    if (activeTool.current.isErase) { pts.current = []; setActivePath(null); return }
    const finalPts = ensureMinimumStrokePoints(pts.current, 3)
    const tool = activeTool.current.isHighlighter ? 'highlighter' : 'pen'
    const path =
      strokeToSvgPath(
        {
          id: '',
          points: finalPts,
          color: activeTool.current.color,
          size: activeTool.current.size,
          tool,
        },
        true,
      ) || null
    pts.current = []
    setActivePath(null)
    if (!path) return
    dispatch({
      type: 'COMMIT',
      stroke: {
        id: generateItemId(),
        color: activeTool.current.color,
        size: activeTool.current.size,
        path,
        tool,
      },
    })
  }

  moveRef.current = (x, y, clientX?, clientY?) => {
    if (!drawing.current) return
    if (activeTool.current.isErase && clientX != null && clientY != null) {
      const els = document.elementsFromPoint(clientX, clientY)
      const hit = els.find(el => el.hasAttribute('data-stroke-id'))
      if (hit) dispatch({ type: 'ERASE', id: hit.getAttribute('data-stroke-id')! })
      return
    }
    pts.current = [...pts.current, { x, y, pressure: 0.5 }]
    setActivePath(makePath(false))
  }

  // Cancel in-progress stroke when the pen tool pill menu opens
  useEffect(() => {
    return registerPenMenuCancelDraw(() => {
      drawing.current = false
      pts.current = []
      setActivePath(null)
    })
  }, [])

  // Keyboard shortcuts + spacebar + mouse move for space-draw
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+Z → undo, Cmd+Shift+Z → redo (only when draw tab is hovered)
      if (meta && e.code === 'KeyZ' && tabHovered.current) {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) dispatch({ type: 'REDO' })
        else dispatch({ type: 'UNDO' })
        return
      }

      if (e.code !== 'Space' || e.repeat || !hovered.current || drawing.current) return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (!lastMouse.current) return
      e.preventDefault()
      spaceHeld.current = true
      startRef.current(lastMouse.current.x, lastMouse.current.y, 0.5)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !spaceHeld.current) return
      spaceHeld.current = false
      endRef.current()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!spaceHeld.current) return
      moveRef.current(e.clientX - (svgRef.current?.getBoundingClientRect().left ?? 0), e.clientY - (svgRef.current?.getBoundingClientRect().top ?? 0), e.clientX, e.clientY)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('mousemove', onMouseMove)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getPos(e.clientX, e.clientY)
    if (pos) startRef.current(pos.x, pos.y, e.pressure || 0.5)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pos = getPos(e.clientX, e.clientY)
    if (!pos) return
    lastMouse.current = pos
    if (!drawing.current) return
    moveRef.current(pos.x, pos.y, e.clientX, e.clientY)
  }

  const onPointerUp = () => endRef.current()
  const onPointerCancel = () => { drawing.current = false; pts.current = []; setActivePath(null) }

  const canUndo = drawState.past.length > 0
  const canRedo = drawState.future.length > 0

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        boxSizing: 'border-box',
      }}
      onPointerEnter={() => { tabHovered.current = true }}
      onPointerLeave={() => { tabHovered.current = false }}
    >
      {/* colour + size toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 6px 0',
          width: '100%',
        }}
      >
        <div
          role="radiogroup"
          aria-label="pen colour"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'nowrap',
            flexShrink: 0,
          }}
        >
          {DRAW_TOOL_COLORS.map((color) => {
            const active = tool.color === color
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`pen color ${color}`}
                onClick={() => {
                  onToolChange({ color })
                  playSubmenuTap()
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: color,
                  cursor: 'pointer',
                  padding: 0,
                  border: 'none',
                  outline: active
                    ? '2px solid var(--ui-text)'
                    : '1px solid rgba(20, 30, 50, 0.12)',
                  outlineOffset: active ? 1 : 0,
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  transition:
                    'outline-color 140ms ease, transform 140ms cubic-bezier(0.32, 1.4, 0.55, 1)',
                  boxShadow:
                    color === DRAW_TOOL_LIGHT_COLOR
                      ? 'inset 0 0 0 1px rgba(20, 30, 50, 0.22)'
                      : 'none',
                }}
              />
            )
          })}
        </div>
        <DrawSizeSlider
          min={DRAW_TOOL_SIZE_MIN}
          max={DRAW_TOOL_SIZE_MAX}
          value={tool.size}
          onChange={(size) => onToolChange({ size })}
        />
      </div>

      {/* drawing canvas */}
      <div
        data-ui-draw-canvas=""
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 14,
          border: '1px dashed var(--glass-border)',
          background: 'rgba(20, 30, 50, 0.025)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onPointerEnter={() => { hovered.current = true }}
        onPointerLeave={() => { hovered.current = false }}
      >
        <DrawingStrokesSvg
          ref={svgRef}
          strokes={drawState.strokes}
          activeStroke={
            activePath
              ? {
                  path: activePath,
                  color: activeTool.current.color,
                  tool: activeTool.current.isHighlighter ? 'highlighter' : 'pen',
                }
              : null
          }
          interactive
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      </div>

      {/* bottom bar — single unified card */}
      <div
        data-draw-tab-pill=""
        style={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.45)',
          border: '1px solid var(--glass-border)',
          padding: '6px 8px',
          gap: 4,
        }}
      >
        {/* Undo / Redo */}
        {(
          [
            { label: 'Undo', Icon: Undo2, enabled: canUndo, action: () => dispatch({ type: 'UNDO' }) },
            { label: 'Redo', Icon: Redo2, enabled: canRedo, action: () => dispatch({ type: 'REDO' }) },
          ] as const
        ).map(({ label, Icon, enabled, action }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={action}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: font.colorPrimary,
              cursor: enabled ? 'pointer' : 'default',
              opacity: enabled ? 1 : 0.35,
              transition: 'opacity 140ms ease',
              flexShrink: 0,
            }}
          >
            <Icon size={15} strokeWidth={2} />
          </button>
        ))}

        <div style={menuDividerVerticalStyle} />

        {/* Tool buttons: pen / highlighter / eraser */}
        {(
          [
            { mode: 'pen' as const, Icon: Pen, label: 'Pen' },
            { mode: 'highlighter' as const, Icon: Highlighter, label: 'Highlighter' },
            { mode: 'erase' as const, Icon: Eraser, label: 'Eraser' },
          ] as const
        ).map(({ mode, Icon, label }) => {
          const active = toolMode === mode
          return (
            <button
              key={mode}
              type="button"
              aria-label={label}
              onClick={() => useToolStore.getState().setMode(mode)}
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: 8,
                background: active ? 'var(--ui-divider-vertical)' : 'transparent',
                color: font.colorPrimary,
                cursor: 'pointer',
                transition: 'background 140ms ease',
                flexShrink: 0,
              }}
            >
              <Icon size={15} strokeWidth={2} />
            </button>
          )
        })}

        <div style={menuDividerVerticalStyle} />

        {/* Clear canvas */}
        <button
          type="button"
          aria-label="Clear canvas"
          onClick={() => dispatch({ type: 'CLEAR' })}
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: font.colorPrimary,
            cursor: drawState.strokes.length > 0 ? 'pointer' : 'default',
            opacity: drawState.strokes.length > 0 ? 1 : 0.35,
            transition: 'opacity 140ms ease',
            flexShrink: 0,
          }}
        >
          <Trash2 size={15} strokeWidth={2} />
        </button>

        {/* Vertical divider before add-to-ui */}
        <div style={menuDividerVerticalStyle} />

        {/* Add to UI — fills remaining space inside the same card */}
        <button
          type="button"
          aria-label="Add to UI"
          disabled={drawState.strokes.length === 0}
          onPointerDown={(e) => {
            if (drawState.strokes.length === 0) return
            e.stopPropagation()
            const svgEl = svgRef.current
            if (!svgEl) return
            onDragStartDraw(buildDrawingAsset(svgEl, drawState.strokes), e.clientX, e.clientY)
          }}
          onClick={(e) => {
            if (drawState.strokes.length === 0) return
            e.stopPropagation()
            const svgEl = svgRef.current
            if (!svgEl) return
            onAddToUi(buildDrawingAsset(svgEl, drawState.strokes))
          }}
          style={{
            flex: 1,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: drawState.strokes.length > 0 ? font.colorPrimary : font.colorMuted,
            fontFamily: font.family,
            fontSize: 13,
            fontWeight: 600,
            cursor: drawState.strokes.length > 0 ? 'pointer' : 'default',
            opacity: drawState.strokes.length > 0 ? 1 : 0.4,
            transition: 'opacity 140ms ease, color 140ms ease',
          }}
        >
          <Plus size={13} strokeWidth={2.4} />
          add to ui
        </button>
      </div>
    </div>
  )
}

function SquareGifIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10v4" />
      <path d="M11 10v4" />
      <path d="M15 14v-4h2.5" />
      <path d="M15 12h2" />
    </svg>
  )
}
