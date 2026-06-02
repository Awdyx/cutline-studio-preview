import { useEffect, type RefObject } from 'react'
import { isRichTextEditorEngaged } from './textEditorContent'
import { rememberEditorSelection } from './textEditorSelectionBookmark'

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

    function onMetaKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Meta') return
      rememberIfEngaged()
    }

    document.addEventListener('selectionchange', rememberIfEngaged)
    document.addEventListener('keydown', onMetaKeyDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    return () => {
      document.removeEventListener('selectionchange', rememberIfEngaged)
      document.removeEventListener('keydown', onMetaKeyDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [editorRef, isActive])
}
