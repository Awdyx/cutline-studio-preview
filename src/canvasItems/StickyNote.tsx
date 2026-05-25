import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import CanvasItemShell from './CanvasItemShell'
import StickyStrokesSvg from './StickyStrokesSvg'
import {
  textAlignmentContainerStyle,
  textAlignmentEditorStyle,
} from './textAlignment'
import { useThemeStore } from '../theme/themeStore'
import { resolveStickyColor, resolveStickyTextColor } from '../theme/paletteGenerator'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { useEditableCanvasTap } from '../canvas/useEditableCanvasTap'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { dismissSelectionForOutsideItemTap } from '../canvas/canvasSelectionDismiss'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import type { StickyCanvasItem } from './types'

const textSaveDelayMs = 400

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
  const stickyBg = resolveStickyColor(effectiveMode)
  const stickyText = resolveStickyTextColor(effectiveMode)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const editableRef = useRef<HTMLDivElement>(null)
  const shouldFocusRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    (text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        useCanvasItemsStore.getState().updateStickyText(item.id, text)
      }, textSaveDelayMs)
    },
    [item.id],
  )

  const commitTextEdit = useCallback(() => {
    const text = editableRef.current?.textContent ?? ''
    useCanvasItemsStore.getState().commitStickyTextEdit(item.id, text)
  }, [item.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = editableRef.current
    if (!el || document.activeElement === el) return
    if (el.textContent !== item.text) {
      el.textContent = item.text
    }
  }, [item.text])

  const focusEditor = useCallback((atEnd = true) => {
    const el = editableRef.current
    if (!el) return
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
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [])

  const flushSaveAndCommit = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    commitTextEdit()
  }, [commitTextEdit])

  useEffect(() => {
    if (!isSelected) setIsEditing(false)
  }, [isSelected])

  useLayoutEffect(() => {
    if (!isEditing || !shouldFocusRef.current) return
    shouldFocusRef.current = false
    focusEditor()
  }, [focusEditor, isEditing])

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
          backgroundColor: stickyBg,
          borderRadius: 4,
        }}
      >
        <StickyStrokesSvg
          stickyId={item.id}
          strokes={item.strokes}
          annotationStrokes={item.annotationStrokes ?? []}
          width={item.width}
          height={item.height}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            ...textAlignmentContainerStyle(item.textAlign),
          }}
        >
          <div
            role="textbox"
            aria-label="Sticky note text"
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
            const text = editableRef.current?.textContent ?? ''
            scheduleSave(text)
          }}
          onBlur={() => {
            setIsEditing(false)
            flushSaveAndCommit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              flushSaveAndCommit()
              stopEditing()
            }
          }}
            style={{
              padding: '28px 14px 14px',
              fontSize: 15,
              lineHeight: 1.35,
              color: stickyText,
              outline: 'none',
              wordBreak: 'break-word',
              pointerEvents: frozen ? 'none' : 'auto',
              ...textAlignmentEditorStyle(item.textAlign),
            }}
            className="sticky-note-editor"
          />
        </div>
      </div>
    </CanvasItemShell>
  )
}
