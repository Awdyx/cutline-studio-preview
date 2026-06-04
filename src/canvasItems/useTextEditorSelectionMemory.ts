import { useEffect, type RefObject } from 'react'
import { isRichTextEditorEngaged } from './textEditorContent'
import { formatKindFromShortcutKey } from './textEditorFormat'
import {
  fontSizeDirectionFromKeyboardEvent,
  isFontSizeShortcut,
} from './textEditorFontSize'
import { rememberEditorSelection } from './textEditorSelectionBookmark'

function isFormatOrFontSizeKey(event: KeyboardEvent): boolean {
  if (formatKindFromShortcutKey(event.key, event.shiftKey)) return true
  if (isFontSizeShortcut(event)) return true
  if (fontSizeDirectionFromKeyboardEvent(event)) return true
  return false
}

/** Remember the last in-editor highlight so ⌘ shortcuts survive focus/⌘ key quirks. */
export function useTextEditorSelectionMemory(
  editorRef: RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  useEffect(() => {
    if (!isActive) return

    function rememberIfEngaged() {
      const editor = editorRef.current
      if (!editor) return
      if (!isRichTextEditorEngaged(editor)) return
      rememberEditorSelection(editor)
    }

    function onPointerUp(event: PointerEvent) {
      const editor = editorRef.current
      if (!editor) return
      if (!editor.contains(event.target as Node)) return
      rememberEditorSelection(editor)
    }

    function onModifierKeyDown(event: KeyboardEvent) {
      const editor = editorRef.current
      if (!editor) return
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === 'Meta' || event.key === 'Control') {
        rememberIfEngaged()
        return
      }
      if (isFormatOrFontSizeKey(event)) rememberIfEngaged()
    }

    document.addEventListener('selectionchange', rememberIfEngaged)
    document.addEventListener('keydown', onModifierKeyDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    return () => {
      document.removeEventListener('selectionchange', rememberIfEngaged)
      document.removeEventListener('keydown', onModifierKeyDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [editorRef, isActive])
}
