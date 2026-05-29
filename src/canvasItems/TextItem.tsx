import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { animate } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { font } from '../styles/tokens'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import CanvasItemShell from './CanvasItemShell'
import {
  ensureEditorCaretAnchor,
  isEditorEmpty,
  isPointerOverTextContent,
  readEditorHtml,
  storedContentToHtml,
} from './textEditorContent'
import { handleTextFormatShortcutEvent } from './textEditorFormat'
import { prepareEditorForTyping, TEXT_ITEM_DEFAULT_FONT_SIZE } from './textEditorFontSize'
import { useTextEditorShortcuts } from './useTextEditorShortcuts'
import { applyTextFormatToAll, formatKindFromShortcutKey } from './textEditorFormat'
import { useTextFormatShortcuts } from './useTextFormatShortcuts'
import {
  textAlignmentContainerStyle,
  textAlignmentEditorStyle,
} from './textAlignment'
import { playSound } from '../sound/playSound'
import { useEditableCanvasTap } from '../canvas/useEditableCanvasTap'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { dismissSelectionForOutsideItemTap } from '../canvas/canvasSelectionDismiss'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import {
  fitTextItemRectAroundCenter,
  measureTextItemContentBounds,
  measureTextItemShrinkBounds,
} from './textItemAutoSize'
import { useCanvasItemResizeStore } from './canvasItemResizeStore'
import { TEXT_BOX_PADDING, type TextCanvasItem } from './types'

const textSaveDelayMs = 400

export default function TextItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: TextCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldFocusRef = useRef(false)
  const selectAllOnFocusRef = useRef(false)
  const pendingInitialCharRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorEmpty, setEditorEmpty] = useState(item.text.length === 0)
  const [isEditing, setIsEditing] = useState(false)
  const isSelected = useItemSelected(item.id)
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === item.id)
  const wasResizingRef = useRef(false)
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
        useCanvasItemsStore.getState().updateTextItemText(item.id, html)
      }, textSaveDelayMs)
    },
    [item.id],
  )

  const commitTextEdit = useCallback(() => {
    const el = editorRef.current
    const html = el ? readEditorHtml(el) : ''
    useCanvasItemsStore.getState().commitTextItemEdit(item.id, html)
  }, [item.id])

  const flushSaveAndCommit = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    commitTextEdit()
  }, [commitTextEdit])

  const syncAutoSize = useCallback(() => {
    const el = editorRef.current
    if (!el || !isEditing) return

    const store = useCanvasItemsStore.getState()
    const current = store.items.find((entry) => entry.id === item.id)
    if (!current || current.type !== 'text') return

    const { width, height } = measureTextItemContentBounds(
      el,
      current.width,
      current.height,
    )
    if (current.width === width && current.height === height) return

    const next = fitTextItemRectAroundCenter(
      current.x,
      current.y,
      current.width,
      current.height,
      width,
      height,
    )
    store.updateItemRect(item.id, next.x, next.y, next.width, next.height, {
      persist: false,
    })
  }, [isEditing, item.id])

  const syncFromStore = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const html = storedContentToHtml(item.text)
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }
    setEditorEmpty(isEditorEmpty(el))
  }, [item.text])

  const focusEditor = useCallback((atEnd = true) => {
    const el = editorRef.current
    if (!el) return
    if (isEditorEmpty(el)) {
      prepareEditorForTyping(el, TEXT_ITEM_DEFAULT_FONT_SIZE)
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
    editorRef.current?.blur()
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

  const notifyFormatApplied = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    scheduleSave(readEditorHtml(el))
    setEditorEmpty(isEditorEmpty(el))
    syncAutoSize()
  }, [scheduleSave, syncAutoSize])

  useTextFormatShortcuts(editorRef, isEditing, notifyFormatApplied)
  useTextEditorShortcuts(
    editorRef,
    isEditing,
    TEXT_ITEM_DEFAULT_FONT_SIZE,
    notifyFormatApplied,
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    syncFromStore()
  }, [item.id])

  // Snap to fit only if text has escaped the box (box is too small for content)
  useEffect(() => {
    if (isResizing) {
      wasResizingRef.current = true
      return
    }
    if (!wasResizingRef.current) return
    wasResizingRef.current = false

    const el = editorRef.current
    if (!el) return
    const store = useCanvasItemsStore.getState()
    const current = store.items.find((entry) => entry.id === item.id)
    if (!current || current.type !== 'text') return

    const { width, height } = measureTextItemShrinkBounds(el)
    // Only snap if content overflows — box is already big enough, leave it alone
    if (current.width >= width && current.height >= height) return

    const next = fitTextItemRectAroundCenter(
      current.x,
      current.y,
      current.width,
      current.height,
      Math.max(width, current.width),
      Math.max(height, current.height),
    )
    store.updateItemRect(item.id, next.x, next.y, next.width, next.height)
  }, [isResizing, item.id])

  useEffect(() => {
    if (isSelected) return
    setIsEditing(false)

    // Shrink box to fit content when deselecting (only shrinks, never grows)
    const el = editorRef.current
    if (!el) return
    const store = useCanvasItemsStore.getState()
    const current = store.items.find((entry) => entry.id === item.id)
    if (!current || current.type !== 'text') return

    const { width, height } = measureTextItemShrinkBounds(el)
    if (width >= current.width && height >= current.height) return

    const next = fitTextItemRectAroundCenter(
      current.x,
      current.y,
      current.width,
      current.height,
      Math.min(width, current.width),
      Math.min(height, current.height),
    )
    store.updateItemRect(item.id, next.x, next.y, next.width, next.height)
  }, [isSelected, item.id])

  useLayoutEffect(() => {
    if (!isEditing || !shouldFocusRef.current) return
    shouldFocusRef.current = false
    if (selectAllOnFocusRef.current) {
      selectAllOnFocusRef.current = false
      const el = editorRef.current
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
      const el = editorRef.current
      if (!el) return
      prepareEditorForTyping(el, TEXT_ITEM_DEFAULT_FONT_SIZE)
      el.focus({ preventScroll: true })
      document.execCommand('insertText', false, char)
    } else {
      focusEditor()
    }
  }, [focusEditor, isEditing, notifyFormatApplied])

  useLayoutEffect(() => {
    syncAutoSize()
  }, [editorEmpty, isEditing, syncAutoSize])

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
          const el = editorRef.current
          if (el) {
            const html = applyTextFormatToAll(el, formatKind)
            if (html != null) {
              useCanvasItemsStore.getState().updateTextItemText(item.id, html)
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
    if (frozen) return
    if (pendingEditorFocusId !== item.id) return
    if (!useCanvasItemsStore.getState().takePendingEditorFocus(item.id)) return
    beginEditing(true)
  }, [beginEditing, frozen, item.id, pendingEditorFocusId])

  useEffect(() => {
    const el = editorRef.current
    if (!el || document.activeElement === el) return
    syncFromStore()
  }, [item.text, syncFromStore])

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = editorRef.current
      if (!el) return
      if (!el.contains(e.target as Node) && document.activeElement === el) {
        el.blur()
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, { capture: true })
    return () =>
      document.removeEventListener('pointerdown', onDocPointerDown, { capture: true })
  }, [])

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
    >
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            ...textAlignmentContainerStyle(item.textAlign),
          }}
        >
          <div
            role="textbox"
            aria-label="Canvas text"
            aria-multiline
            ref={editorRef}
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
              const editor = editorRef.current
              if (
                !editor ||
                !isPointerOverTextContent(editor, e.clientX, e.clientY)
              ) {
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
            const el = editorRef.current
            if (!el) return
            scheduleSave(readEditorHtml(el))
            setEditorEmpty(isEditorEmpty(el))
            syncAutoSize()
          }}
          onBlur={() => {
            syncAutoSize()
            setIsEditing(false)
            flushSaveAndCommit()
          }}
          onKeyDown={(e) => {
            const editor = editorRef.current
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
              padding: TEXT_BOX_PADDING,
              fontSize: TEXT_ITEM_DEFAULT_FONT_SIZE,
              lineHeight: 1.45,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'visible',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              outline: 'none',
              background: 'transparent',
              boxSizing: 'border-box',
              cursor: frozen ? 'default' : 'text',
              pointerEvents: frozen ? 'none' : 'auto',
              ...textAlignmentEditorStyle(item.textAlign),
              maxWidth: '100%',
            }}
            className={`canvas-text-editor${editorEmpty ? ' canvas-text-editor--empty' : ''}`}
          />
        </div>
    </CanvasItemShell>
  )
}
