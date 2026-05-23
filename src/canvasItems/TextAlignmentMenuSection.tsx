import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Minus,
} from 'lucide-react'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { ItemTextAlignment, TextAlignH, TextAlignV } from './textAlignment'

function AlignToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseEnter={() => playSubmenuHover()}
      onClick={() => runSubmenuClick(onClick)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 0',
        border: 'none',
        borderRadius: 8,
        background: active ? 'rgba(20, 30, 50, 0.1)' : 'transparent',
        color: active ? font.colorPrimary : font.colorMuted,
        cursor: 'pointer',
      }}
      className="canvas-item-z-menu-row"
    >
      {children}
    </button>
  )
}

export default function TextAlignmentMenuSection({
  itemId,
  alignment,
  showVertical = true,
}: {
  itemId: string
  alignment: ItemTextAlignment
  showVertical?: boolean
}) {
  const setItemTextAlignment = useCanvasItemsStore((s) => s.setItemTextAlignment)

  function setHorizontal(horizontal: TextAlignH) {
    setItemTextAlignment(itemId, { ...alignment, horizontal })
  }

  function setVertical(vertical: TextAlignV) {
    setItemTextAlignment(itemId, { ...alignment, vertical })
  }

  const iconProps = { size: 16, strokeWidth: 2 }
  const labelStyle = {
    margin: showVertical ? '6px 14px 4px' : '6px 14px 0',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.4px',
    color: font.colorMuted,
  } as const
  const horizontalRowStyle = {
    display: 'flex',
    gap: 4,
    padding: showVertical ? '0 6px 4px' : '12px 6px',
  } as const

  return (
    <>
      <p style={labelStyle}>
        {chromeLabel('Text align')}
      </p>
      <div style={horizontalRowStyle}>
        <AlignToggle
          active={alignment.horizontal === 'left'}
          label="Align left"
          onClick={() => setHorizontal('left')}
        >
          <AlignLeft {...iconProps} />
        </AlignToggle>
        <AlignToggle
          active={alignment.horizontal === 'center'}
          label="Align center"
          onClick={() => setHorizontal('center')}
        >
          <AlignCenter {...iconProps} />
        </AlignToggle>
        <AlignToggle
          active={alignment.horizontal === 'right'}
          label="Align right"
          onClick={() => setHorizontal('right')}
        >
          <AlignRight {...iconProps} />
        </AlignToggle>
      </div>
      {showVertical && (
        <div style={{ display: 'flex', gap: 4, padding: '0 6px 8px' }}>
          <AlignToggle
            active={alignment.vertical === 'top'}
            label="Align top"
            onClick={() => setVertical('top')}
          >
            <ArrowUpToLine {...iconProps} />
          </AlignToggle>
          <AlignToggle
            active={alignment.vertical === 'center'}
            label="Align middle"
            onClick={() => setVertical('center')}
          >
            <Minus {...iconProps} />
          </AlignToggle>
          <AlignToggle
            active={alignment.vertical === 'bottom'}
            label="Align bottom"
            onClick={() => setVertical('bottom')}
          >
            <ArrowDownToLine {...iconProps} />
          </AlignToggle>
        </div>
      )}
      <div style={{ ...menuDividerStyle, margin: '0 10px 4px' }} />
    </>
  )
}
