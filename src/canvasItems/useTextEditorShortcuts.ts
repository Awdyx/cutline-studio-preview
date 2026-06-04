import { useEffect, useRef, type RefObject } from 'react'
import { startHoldRepeat, type HoldRepeatHandle } from '../hooks/holdRepeat'
import { isRichTextEditorEngaged } from './textEditorContent'
import {
  handleTextFormatShortcutEvent,
  isFormatModifierShortcut,
} from './textEditorFormat'
import {
  changeEditorFontSize,
  FONT_SIZE_BRACKET_KEY_CODES,
  fontSizeDirectionFromKeyboardEvent,
  handleFontSizeShortcutEvent,
  isFontSizeBracketKeyRelease,
  isFontSizeModifierHeld,
  isFontSizeShortcut,
  type FontSizeDirection,
} from './textEditorFontSize'

/** macOS may defer ] keyup until ⌘ is released; OS key-repeat pulses end sooner. */
const BRACKET_PULSE_TIMEOUT_MS = 140

/** Capture-phase Cmd/Ctrl shortcuts while a canvas rich-text editor is active. */
export function useTextEditorShortcuts(
  editorRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  isEditing: boolean,
  defaultFontSize: number,
  onFormatApplied: () => void,
) {
  const fontSizeHoldRef = useRef<HoldRepeatHandle | null>(null)
  const keysDownRef = useRef(new Set<string>())
  const modifierLatchRef = useRef(false)
  const holdDirectionRef = useRef<FontSizeDirection | null>(null)
  const bracketEngagedRef = useRef(false)
  const lastBracketPulseRef = useRef(0)

  useEffect(() => {
    if (!isActive) return

    function stopFontSizeHold() {
      fontSizeHoldRef.current?.stop()
      fontSizeHoldRef.current = null
      holdDirectionRef.current = null
      bracketEngagedRef.current = false
      lastBracketPulseRef.current = 0
    }

    function releaseBracketKeys() {
      bracketEngagedRef.current = false
      for (const code of FONT_SIZE_BRACKET_KEY_CODES) {
        keysDownRef.current.delete(code)
      }
    }

    function pulseBracketShortcut() {
      lastBracketPulseRef.current = performance.now()
    }

    function trackKeyDown(event: KeyboardEvent) {
      keysDownRef.current.add(event.code)
    }

    function trackKeyUp(event: KeyboardEvent) {
      keysDownRef.current.delete(event.code)
      if (
        event.code === 'MetaLeft' ||
        event.code === 'MetaRight' ||
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight'
      ) {
        modifierLatchRef.current = false
      }
    }

    function modifierStillHeld() {
      return isFontSizeModifierHeld(
        keysDownRef.current,
        modifierLatchRef.current,
      )
    }

    function bracketStillHeld() {
      if (!bracketEngagedRef.current) return false
      if (!modifierStillHeld()) return false
      return (
        performance.now() - lastBracketPulseRef.current <
        BRACKET_PULSE_TIMEOUT_MS
      )
    }

    function onBracketKeyUp(event: KeyboardEvent) {
      trackKeyUp(event)
      if (isFontSizeBracketKeyRelease(event)) {
        releaseBracketKeys()
      }
      if (
        event.code === 'MetaLeft' ||
        event.code === 'MetaRight' ||
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight'
      ) {
        modifierLatchRef.current = false
        releaseBracketKeys()
      }
      if (!bracketStillHeld()) stopFontSizeHold()
    }

    function onKeyDown(event: KeyboardEvent) {
      trackKeyDown(event)

      const editor = editorRef.current
      if (!editor) return

      const engaged = isRichTextEditorEngaged(editor, event.target)
      const canHandle = isActive && engaged

      if (isFormatModifierShortcut(event) && canHandle) {
        if (handleTextFormatShortcutEvent(event, editor, onFormatApplied)) {
          event.stopPropagation()
        }
        return
      }

      if (isFontSizeShortcut(event) && canHandle) {
        event.preventDefault()
        event.stopPropagation()
        pulseBracketShortcut()

        if (!event.repeat) {
          handleFontSizeShortcutEvent(
            event,
            editor,
            defaultFontSize,
            onFormatApplied,
          )

          stopFontSizeHold()
          const direction = fontSizeDirectionFromKeyboardEvent(event)
          if (direction) {
            modifierLatchRef.current = event.metaKey || event.ctrlKey
            bracketEngagedRef.current = true
            for (const code of FONT_SIZE_BRACKET_KEY_CODES) {
              keysDownRef.current.delete(code)
            }
            holdDirectionRef.current = direction
            fontSizeHoldRef.current = startHoldRepeat(
              () => {
                const el = editorRef.current
                const dir = holdDirectionRef.current
                if (!el || !dir) {
                  stopFontSizeHold()
                  return
                }
                if (!bracketStillHeld()) {
                  stopFontSizeHold()
                  return
                }
                if (changeEditorFontSize(el, dir, defaultFontSize)) {
                  onFormatApplied()
                }
              },
              { whileActive: bracketStillHeld },
            )
          }
        } else if (!bracketStillHeld()) {
          stopFontSizeHold()
        }
        return
      }

      if (!isEditing || !editor.isContentEditable) return
      if (!engaged) return
    }

    function onWindowBlur() {
      keysDownRef.current.clear()
      modifierLatchRef.current = false
      stopFontSizeHold()
    }

    function onBlur() {
      keysDownRef.current.clear()
      modifierLatchRef.current = false
      stopFontSizeHold()
    }

    const editor = editorRef.current
    if (isEditing) {
      editor?.addEventListener('blur', onBlur)
    }

    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onBracketKeyUp, true)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      keysDownRef.current.clear()
      modifierLatchRef.current = false
      stopFontSizeHold()
      editor?.removeEventListener('blur', onBlur)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onBracketKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [editorRef, isActive, isEditing, defaultFontSize, onFormatApplied])
}
