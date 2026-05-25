import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Newspaper } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, CHROME_PRESERVE_CASE_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../styles/tokens'
import { phonePanelSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { isSwapChromeMenuTarget } from './chromeMenuDismiss'
import { partitionNewOld, PanelNewOldDivider } from './PanelNewOldDivider'
import ChromeScrollFade from './ChromeScrollFade'
import type { NewsPost, NewsTab } from '../types'

interface NewsPanelProps {
  isOpen: boolean
  onClose: () => void
  posts: NewsPost[]
  panelSeenNewsIds: Set<string>
  activeTab: NewsTab
  onTabChange: (tab: NewsTab) => void
  onPostClick: (id: string) => void
}

const TABS: { key: NewsTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'updates', label: 'Updates' },
]

const panelTone = {
  title: font.colorPrimary,
  tabActive: font.colorPrimary,
  tabInactive: font.colorMuted,
  rowHover: 'rgba(20, 30, 50, 0.04)',
} as const

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: 64,
  right: 124,
  width: 360,
  maxHeight: 'min(72vh, 520px)',
  ...chromeFrostedMenuStyle,
  fontFamily: font.family,
  color: font.colorPrimary,
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const categoryLabel: Record<NewsPost['category'], string> = {
  blog: 'Blog',
  update: 'Update',
}

function NewsRow({ post, onClick }: { post: NewsPost; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const hasHighlights = (post.highlights?.length ?? 0) > 0

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        width: '100%',
        padding: '12px 16px',
        background: hovered ? panelTone.rowHover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 150ms ease',
        fontFamily: font.family,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        {post.version && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--ui-accent)',
            }}
          >
            v{post.version}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: post.version ? font.colorMuted : 'var(--ui-accent)',
            textTransform: 'lowercase',
          }}
        >
          {chromeLabel(categoryLabel[post.category])}
        </span>
        {post.date && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: font.colorMuted,
              flexShrink: 0,
            }}
          >
            {post.date}
          </span>
        )}
      </div>
      <p
        className={CHROME_PRESERVE_CASE_CLASS}
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: font.colorPrimary,
          lineHeight: 1.35,
        }}
      >
        {post.title}
      </p>
      {hasHighlights ? (
        <ul
          style={{
            margin: '2px 0 0',
            paddingLeft: 18,
            listStyle: 'disc',
          }}
        >
          {post.highlights!.map((item) => (
            <li
              key={item}
              style={{
                fontSize: 13,
                lineHeight: 1.45,
                color: font.colorMuted,
                marginBottom: 4,
              }}
            >
              {chromeLabel(item)}
            </li>
          ))}
        </ul>
      ) : (
        post.summary && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: font.colorMuted,
              lineHeight: 1.45,
            }}
          >
            {post.summary}
          </p>
        )
      )}
    </button>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 10,
      }}
    >
      <Newspaper size={22} color={font.colorFaint} strokeWidth={1.5} />
      <p style={{ margin: 0, fontSize: 13, color: font.colorMuted }}>
        {chromeLabel('No posts in this section yet.')}
      </p>
    </div>
  )
}

export default function NewsPanel({
  isOpen,
  onClose,
  posts,
  panelSeenNewsIds,
  activeTab,
  onTabChange,
  onPostClick,
}: NewsPanelProps) {
  const isPhone = useIsPhoneLayout()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-panel-trigger]') &&
        !isSwapChromeMenuTarget(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  const filtered = posts.filter((post) => {
    if (activeTab === 'blogs') return post.category === 'blog'
    if (activeTab === 'updates') return post.category === 'update'
    return true
  })
  const isNewPost = (post: NewsPost) =>
    !!post.isNew && !panelSeenNewsIds.has(post.id)
  const { newItems, oldItems } = partitionNewOld(filtered, isNewPost)

  return (
    <motion.div
      ref={panelRef}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      style={{
        ...(isPhone ? phonePanelSheetStyle(undefined, 'right') : cardBase),
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        color: font.colorPrimary,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      {...(isPhone ? phoneSubmenuSlideMotion : {
        initial: { opacity: 0, scale: 0.96, y: -4 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: -4 },
        transition: { duration: 0.18, ease: 'easeOut' },
      })}
    >
      <div
        style={{
          padding: '16px 16px 0',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: panelTone.title }}>
          {chromeLabel('News')}
        </span>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: font.colorMuted,
            lineHeight: 1.4,
          }}
        >
          {chromeLabel('Blogs, release notes, and product updates')}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '10px 16px 4px',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === key
                  ? '2px solid var(--ui-tab-underline)'
                  : '2px solid transparent',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === key ? 600 : 400,
              color:
                activeTab === key ? panelTone.tabActive : panelTone.tabInactive,
              fontFamily: font.family,
              transition: 'color 150ms ease',
            }}
          >
            {chromeLabel(label)}
          </button>
        ))}
      </div>

      <ChromeScrollFade observeDeps={[activeTab, filtered.length]}>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {newItems.map((post) => (
              <NewsRow
                key={post.id}
                post={post}
                onClick={() => onPostClick(post.id)}
              />
            ))}
            {newItems.length > 0 && oldItems.length > 0 && (
              <PanelNewOldDivider label="Older posts" />
            )}
            {oldItems.map((post) => (
              <NewsRow
                key={post.id}
                post={post}
                onClick={() => onPostClick(post.id)}
              />
            ))}
          </>
        )}
      </ChromeScrollFade>
    </motion.div>
  )
}
