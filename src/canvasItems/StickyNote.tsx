import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { animate, AnimatePresence, motion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import CanvasItemShell from './CanvasItemShell'
import StickyEmbeddedImages from './StickyEmbeddedImages'
import StickyEmbeddedImageOverflow from './StickyEmbeddedImageOverflow'
import StickyStrokesSvg from './StickyStrokesSvg'
import {
  ensureEditorCaretAnchor,
  isEditorEmpty,
  isPointerOverTextContent,
  isStoredTextEmpty,
  readEditorHtml,
  storedContentToHtml,
} from './textEditorContent'
import { playSound } from '../sound/playSound'
import { handleTextFormatShortcutEvent } from './textEditorFormat'
import { prepareEditorForTyping, STICKY_DEFAULT_FONT_SIZE } from './textEditorFontSize'
import { applyTextFormatToAll, formatKindFromShortcutKey } from './textEditorFormat'
import { useTextFormatShortcuts } from './useTextFormatShortcuts'
import { useTextEditorShortcuts } from './useTextEditorShortcuts'
import {
  textAlignmentContainerStyle,
  textAlignmentEditorStyle,
} from './textAlignment'
import { useThemeStore } from '../theme/themeStore'
import { resolveStickyColorById, resolveStickyTextColor } from '../theme/paletteGenerator'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { useEditableCanvasTap } from '../canvas/useEditableCanvasTap'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { dismissSelectionForOutsideItemTap } from '../canvas/canvasSelectionDismiss'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useStickyDropStore } from './stickyDropStore'
import {
  StickyDropConfirmChrome,
  StickyDropGhost,
  StickyDropHoverChrome,
} from './StickyDropChrome'
import { stickyHasInk, STICKY_TEXT_INSET, isImageInSticky, type StickyCanvasItem } from './types'

const textSaveDelayMs = 400
const stickyEmptyHint = 'click here to type'
const stickyEmptyHintTransition = { duration: 0.2, ease: 'easeOut' as const }
const stickyEmptyHintOpacity = 0.4
const stickyEmptyHintOpacityWithInk = stickyEmptyHintOpacity * 0.5

export default function StickyNote({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: StickyCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const stickyBg = resolveStickyColorById(item.color, effectiveMode)
  const stickyText = resolveStickyTextColor(effectiveMode)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const editableRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldFocusRef = useRef(false)
  const selectAllOnFocusRef = useRef(false)
  const pendingInitialCharRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorEmpty, setEditorEmpty] = useState(() => isStoredTextEmpty(item.text))
  const [isEditing, setIsEditing] = useState(false)
  const isSelected = useItemSelected(item.id)
  const activeStickyStroke = useCanvasItemsStore(
    (s) =>
      s.activeStickyStroke?.stickyId === item.id
        ? s.activeStickyStroke.stroke
        : null,
  )
  const hasInkOnSticky = stickyHasInk(item, activeStickyStroke)
  const dropHoverStickyId = useStickyDropStore((s) => s.hover?.stickyId ?? null)
  const dropConfirmStickyId = useStickyDropStore((s) => s.confirmPulseStickyId)
  const dropConfirmNonce = useStickyDropStore((s) => s.confirmPulseNonce)
  const dropGhost = useStickyDropStore((s) =>
    s.hover?.stickyId === item.id ? s.hover.ghostItem : null,
  )
  const isDropHoverTarget = dropHoverStickyId === item.id
  const isDropConfirmTarget = dropConfirmStickyId === item.id
  const [embeddedHandleHost, setEmbeddedHandleHost] = useState<HTMLElement | null>(null)

  const { onGrabPointerDown } = useCanvasItemDrag(item.id)
  const isPhone = useIsPhoneLayout()
  const canvasEditEnabled = useCanvasEditStore((s) => s.enabled)
  const moveBlocked = isPhone && !canvasEditEnabled
  const areaPointer = useCanvasItemAreaPointer({
    itemId: item.id,
    isSelected,
    frozen,
    moveBlocked,
    onGrabPointerDown,
  })
  const scheduleSave = useCallback(
    (html: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        useCanvasItemsStore.getState().updateStickyText(item.id, html)
      }, textSaveDelayMs)
    },
    [item.id],
  )

  const commitTextEdit = useCallback(() => {
    const el = editableRef.current
    const html = el ? readEditorHtml(el) : ''
    useCanvasItemsStore.getState().commitStickyTextEdit(item.id, html)
  }, [item.id])

  const syncFromStore = useCallback(() => {
    const el = editableRef.current
    if (!el) return
    const html = storedContentToHtml(item.text)
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }
    setEditorEmpty(isEditorEmpty(el))
  }, [item.text])

  const notifyFormatApplied = useCallback(() => {
    const el = editableRef.current
    if (!el) return
    setEditorEmpty(isEditorEmpty(el))
    scheduleSave(readEditorHtml(el))
  }, [scheduleSave])

  useTextFormatShortcuts(editableRef, isEditing, notifyFormatApplied)
  useTextEditorShortcuts(
    editableRef,
    isEditing,
    STICKY_DEFAULT_FONT_SIZE,
    notifyFormatApplied,
  )

  useEffect(() => {
    syncFromStore()
  }, [item.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = editableRef.current
    if (!el || document.activeElement === el) return
    syncFromStore()
  }, [item.text, syncFromStore])

  const focusEditor = useCallback((atEnd = true) => {
    const el = editableRef.current
    if (!el) return
    if (isEditorEmpty(el)) {
      prepareEditorForTyping(el, STICKY_DEFAULT_FONT_SIZE)
      el.focus({ preventScroll: true })
      return
    }
    el.focus({ preventScroll: true })
    if (!atEnd) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const beginEditing = useCallback((focus = true) => {
    setIsEditing(true)
    if (focus) shouldFocusRef.current = true
  }, [])

  const stopEditing = useCallback(() => {
    setIsEditing(false)
    editableRef.current?.blur()
  }, [])

  const editorTap = useEditableCanvasTap({
    focusOnTouchStart: () => isEditing,
    onFocus: () => focusEditor(),
    onTap: (e) => {
      if (dismissSelectionForOutsideItemTap(item.id)) return
      useCanvasItemsStore.getState().selectItem(item.id, e.shiftKey)
      beginEditing(true)
    },
    onPanCancel: stopEditing,
  })

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = editableRef.current
      if (!el) return
      if (!el.contains(e.target as Node) && document.activeElement === el) {
        el.blur()
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, { capture: true })
    return () =>
      document.removeEventListener('pointerdown', onDocPointerDown, { capture: true })
  }, [])

  const flushSaveAndCommit = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    commitTextEdit()
  }, [commitTextEdit])

  useEffect(() => {
    if (!isSelected || isEditing || frozen) return

    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept when the pen/tool palette is open
      if (useShortcutUiStore.getState().toolPaletteOpen) return

      const mod = e.metaKey || e.ctrlKey
      const key = e.key

      // Always pass through: modifier-only, Escape, Delete/Backspace, Tab
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(key)) return
      if (key === 'Escape' || key === 'Tab') return
      if (!mod && (key === 'Delete' || key === 'Backspace')) return

      // Pass through item-level canvas shortcuts
      if (mod) {
        const k = key.toLowerCase()
        if (k === 'z') return          // undo / redo
        if (k === 'd') return          // duplicate
        if (k === 'c' || k === 'x') return  // copy / cut
        if (k === 'l') return          // toggle lock

        // ⌘A → enter edit mode + select all
        if (k === 'a') {
          e.preventDefault()
          e.stopPropagation()
          selectAllOnFocusRef.current = true
          beginEditing(true)
          return
        }

        // ⌘B / ⌘I / ⌘U / ⌘⇧X → apply format to all text silently (no edit mode)
        const formatKind = formatKindFromShortcutKey(k, e.shiftKey)
        if (formatKind) {
          e.preventDefault()
          e.stopPropagation()
          const el = editableRef.current
          if (el) {
            const html = applyTextFormatToAll(el, formatKind)
            if (html != null) {
              useCanvasItemsStore.getState().updateStickyText(item.id, html)
            }
          }
          return
        }

        // All other ⌘ combos (⌘I, ⌘E, ⌘S, ⌘K, ⌘F …) → swallow
        e.stopPropagation()
        return
      }

      // Plain printable character → start typing immediately
      if (key.length === 1 && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        pendingInitialCharRef.current = key
        beginEditing(true)
        return
      }

      // Everything else (P, D, H, L, E …) → swallow so canvas shortcuts don't fire
      e.stopPropagation()
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [isSelected, isEditing, frozen, beginEditing])

  const pendingEditorFocusId = useCanvasItemsStore((s) => s.pendingEditorFocusId)

  useEffect(() => {
    if (!isSelected) setIsEditing(false)
  }, [isSelected])

  useEffect(() => {
    if (frozen) return
    if (pendingEditorFocusId !== item.id) return
    if (!useCanvasItemsStore.getState().takePendingEditorFocus(item.id)) return
    beginEditing(true)
  }, [beginEditing, frozen, item.id, pendingEditorFocusId])

  useLayoutEffect(() => {
    if (!isEditing || !shouldFocusRef.current) return
    shouldFocusRef.current = false
    if (selectAllOnFocusRef.current) {
      selectAllOnFocusRef.current = false
      const el = editableRef.current
      if (!el) return
      ensureEditorCaretAnchor(el)
      el.focus({ preventScroll: true })
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    } else if (pendingInitialCharRef.current) {
      const char = pendingInitialCharRef.current
      pendingInitialCharRef.current = null
      const el = editableRef.current
      if (!el) return
      prepareEditorForTyping(el, STICKY_DEFAULT_FONT_SIZE)
      el.focus({ preventScroll: true })
      document.execCommand('insertText', false, char)
    } else {
      focusEditor()
    }
  }, [focusEditor, isEditing, notifyFormatApplied])

  const showEmptyHint = editorEmpty && isSelected && !isEditing && !frozen

  const canvasItems = useCanvasItemsStore((s) => s.items)
  const hasEmbeddedImages = useMemo(
    () =>
      canvasItems.some(
        (entry) =>
          entry.type === 'image' &&
          isImageInSticky(entry) &&
          entry.stickyId === item.id,
      ),
    [canvasItems, item.id],
  )

  const textPointerEvents = frozen
    ? 'none'
    : isEditing || !hasEmbeddedImages
      ? 'auto'
      : 'none'

  const onFacePointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasEmbeddedImages || isEditing || frozen) return
      if (e.pointerType === 'pen') return
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return

      const editor = editableRef.current
      if (!editor || !isPointerOverTextContent(editor, e.clientX, e.clientY)) {
        return
      }

      if (!isSelected) return

      if (e.pointerType === 'mouse' && e.button === 2) {
        areaPointer.onPointerDown(e)
        e.stopPropagation()
        return
      }

      onGrabPointerDown(e, {
        onReleaseWithoutDrag: () => beginEditing(true),
      })
      e.stopPropagation()
    },
    [
      areaPointer,
      beginEditing,
      frozen,
      hasEmbeddedImages,
      isEditing,
      isSelected,
      onGrabPointerDown,
    ],
  )

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
      forceLift={isDropHoverTarget}
    >
      <StickyEmbeddedImageOverflow
        stickyId={item.id}
        stickyWidth={item.width}
        stickyHeight={item.height}
      />
      <div
        ref={setEmbeddedHandleHost}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      />
      <div
        onPointerDownCapture={onFacePointerDownCapture}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          overflow: 'hidden',
          borderRadius: 4,
          backgroundColor: stickyBg,
          transition: 'background-color 320ms ease',
        }}
      >
        <AnimatePresence initial={false}>
          {isDropHoverTarget && !isDropConfirmTarget ? (
            <StickyDropHoverChrome key="sticky-drop-hover" />
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {isDropConfirmTarget ? (
            <StickyDropConfirmChrome key={`sticky-drop-confirm-${dropConfirmNonce}`} />
          ) : null}
        </AnimatePresence>
        <StickyStrokesSvg
          stickyId={item.id}
          strokes={item.strokes}
          annotationStrokes={item.annotationStrokes ?? []}
          width={item.width}
          height={item.height}
        />
        {dropGhost ? <StickyDropGhost key={dropGhost.id} ghost={dropGhost} /> : null}
        <StickyEmbeddedImages
          stickyId={item.id}
          transformRef={transformRef}
          onItemResizeStateChange={onItemResizeStateChange}
          handlesPortal={embeddedHandleHost}
        />
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            ...textAlignmentContainerStyle(item.textAlign),
          }}
        >
          <AnimatePresence initial={false}>
            {showEmptyHint ? (
              <motion.div
                key="sticky-empty-hint"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={stickyEmptyHintTransition}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 0,
                  pointerEvents: 'none',
                  ...textAlignmentContainerStyle(item.textAlign),
                }}
              >
                <motion.span
                  animate={{
                    opacity: hasInkOnSticky
                      ? stickyEmptyHintOpacityWithInk
                      : stickyEmptyHintOpacity,
                  }}
                  transition={stickyEmptyHintTransition}
                  style={{
                    padding: STICKY_TEXT_INSET,
                    fontSize: STICKY_DEFAULT_FONT_SIZE,
                    lineHeight: 1.35,
                    color: stickyText,
                    width: '100%',
                    ...textAlignmentEditorStyle(item.textAlign),
                  }}
                >
                  {stickyEmptyHint}
                </motion.span>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div
            role="textbox"
            aria-label="Sticky note text"
            aria-multiline
            ref={editableRef}
            contentEditable={!frozen && isEditing}
            spellCheck={false}
            suppressContentEditableWarning
            tabIndex={isEditing ? 0 : -1}
            enterKeyHint="done"
            onPointerDown={(e) => {
              if (e.pointerType === 'pen') {
                e.preventDefault()
                return
              }
              if (e.pointerType === 'mouse' && e.button === 2) {
                areaPointer.onPointerDown(e)
                return
              }
              if (isSelected && !isEditing && !frozen) {
                onGrabPointerDown(e, {
                  onReleaseWithoutDrag: () => beginEditing(true),
                })
                return
              }
              if (isEditing) {
                editorTap.onPointerDown(e)
                return
              }
              areaPointer.onPointerDown(e)
            }}
            onPointerMove={
              isEditing ? editorTap.onPointerMove : areaPointer.onPointerMove
            }
            onPointerUp={isEditing ? editorTap.onPointerUp : areaPointer.onPointerUp}
            onPointerCancel={
              isEditing ? editorTap.onPointerCancel : areaPointer.onPointerCancel
            }
            onContextMenu={areaPointer.onContextMenu}
          onInput={() => {
            const el = editableRef.current
            if (!el) return
            setEditorEmpty(isEditorEmpty(el))
            scheduleSave(readEditorHtml(el))
          }}
          onBlur={() => {
            setIsEditing(false)
            flushSaveAndCommit()
          }}
          onKeyDown={(e) => {
            const editor = editableRef.current
            if (editor && handleTextFormatShortcutEvent(e, editor, notifyFormatApplied)) {
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              flushSaveAndCommit()
              stopEditing()
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              playSound('textCommit')
              flushSaveAndCommit()
              const el = containerRef.current
              if (el) {
                animate(el, { scale: [1, 0.96, 1], opacity: [1, 0.55, 1] }, { duration: 0.22, ease: 'easeOut' })
                  .then(() => stopEditing())
              } else {
                stopEditing()
              }
            }
          }}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: STICKY_TEXT_INSET,
              fontSize: STICKY_DEFAULT_FONT_SIZE,
              lineHeight: 1.35,
              color: stickyText,
              outline: 'none',
              wordBreak: 'break-word',
              pointerEvents: textPointerEvents,
              ...textAlignmentEditorStyle(item.textAlign),
            }}
            className={`canvas-text-editor sticky-note-editor${editorEmpty ? ' canvas-text-editor--empty' : ''}`}
          />
        </div>
      </div>
    </CanvasItemShell>
  )
}
