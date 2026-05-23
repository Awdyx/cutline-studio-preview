import type { CSSProperties } from 'react'

export type TextAlignH = 'left' | 'center' | 'right'
export type TextAlignV = 'top' | 'center' | 'bottom'

export type ItemTextAlignment = {
  horizontal: TextAlignH
  vertical: TextAlignV
}

export const DEFAULT_TEXT_ALIGNMENT: ItemTextAlignment = {
  horizontal: 'center',
  vertical: 'center',
}

export const DEFAULT_SPACE_NAME_ALIGNMENT: ItemTextAlignment = {
  horizontal: 'left',
  vertical: 'top',
}

export function normalizeTextAlignment(raw: unknown): ItemTextAlignment {
  if (!raw || typeof raw !== 'object') return DEFAULT_TEXT_ALIGNMENT
  const o = raw as Partial<ItemTextAlignment>
  const horizontal: TextAlignH =
    o.horizontal === 'left' || o.horizontal === 'right' ? o.horizontal : 'center'
  const vertical: TextAlignV =
    o.vertical === 'top' || o.vertical === 'bottom' ? o.vertical : 'center'
  return { horizontal, vertical }
}

export function resolveItemTextAlignment(item: {
  type: string
  textAlign?: ItemTextAlignment | unknown
}): ItemTextAlignment {
  if (item.textAlign != null) {
    return normalizeTextAlignment(item.textAlign)
  }
  if (item.type === 'space') return DEFAULT_SPACE_NAME_ALIGNMENT
  if (item.type === 'sticky' || item.type === 'text') return DEFAULT_TEXT_ALIGNMENT
  return DEFAULT_TEXT_ALIGNMENT
}

export function textAlignmentContainerStyle(
  alignment: ItemTextAlignment,
): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    alignItems:
      alignment.horizontal === 'left'
        ? 'flex-start'
        : alignment.horizontal === 'right'
          ? 'flex-end'
          : 'center',
    justifyContent:
      alignment.vertical === 'top'
        ? 'flex-start'
        : alignment.vertical === 'bottom'
          ? 'flex-end'
          : 'center',
  }
}

export function textAlignmentEditorStyle(
  alignment: ItemTextAlignment,
): CSSProperties {
  return {
    width: '100%',
    textAlign: alignment.horizontal,
  }
}
