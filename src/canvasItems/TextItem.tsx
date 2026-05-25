import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { font } from '../styles/tokens'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import CanvasItemShell from './CanvasItemShell'
import {
  ensureEditorCaretAnchor,
  isEditorEmpty,
  isPointerOverTextContent,
  readEditorHtml,
  storedContentToHtml,
} from './textEditorContent'
import {
  applyTextFormat,
  formatKindFromShortcutKey,
  isFormatModifierShortcut,
} from './textEditorFormat'
import {
  textAlignmentContainerStyle,
  textAlignmentEditorStyle,
} from './textAlignment'
import { useEditableCanvasTap } from '../canvas/useEditableCanvasTap'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { dismissSelectionForOutsideItemTap } from '../canvas/canvasSelectionDismiss'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import type { TextCanvasItem } from './types'

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
  const shouldFocusRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorEmpty, setEditorEmpty] = useState(item.text.length === 0)
  const [isEditing, setIsEditing] = useState(false)
  const isSelected = useItemSelected(item.id)
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
    ensureEditorCaretAnchor(el)
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

  const applyFormatShortcut = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isFormatModifierShortcut(e)) return false

      const kind = formatKindFromShortcutKey(e.key, e.shiftKey)
      if (!kind) return false

      e.preventDefault()
      applyTextFormat(kind)

      const el = editorRef.current
      if (el) {
        scheduleSave(readEditorHtml(el))
        setEditorEmpty(isEditorEmpty(el))
      }
      return true
    },
    [scheduleSave],
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    syncFromStore()
  }, [item.id])

  useEffect(() => {
    if (!isSelected) setIsEditing(false)
  }, [isSelected])

  useLayoutEffect(() => {
    if (!isEditing || !shouldFocusRef.current) return
    shouldFocusRef.current = false
    focusEditor()
  }, [focusEditor, isEditing])

  useEffect(() => {
    if (frozen) return
    if (!useCanvasItemsStore.getState().takePendingEditorFocus(item.id)) return
    beginEditing(true)
  }, [beginEditing, frozen, item.id])

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
          }}
          onBlur={() => {
            setIsEditing(false)
            flushSaveAndCommit()
          }}
          onKeyDown={(e) => {
            if (applyFormatShortcut(e)) return
            if (e.key === 'Escape') {
              e.preventDefault()
              flushSaveAndCommit()
              stopEditing()
            }
          }}
            style={{
              padding: '0 2px',
              fontSize: 16,
              lineHeight: 1.45,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'visible',
              wordBreak: 'break-word',
              outline: 'none',
              background: 'transparent',
              boxSizing: 'border-box',
              cursor: frozen ? 'default' : 'text',
              pointerEvents: frozen ? 'none' : 'auto',
              ...textAlignmentEditorStyle(item.textAlign),
              maxWidth: '100%',
              width: 'fit-content',
            }}
            className={`canvas-text-editor${editorEmpty ? ' canvas-text-editor--empty' : ''}`}
          />
        </div>
    </CanvasItemShell>
  )
}
