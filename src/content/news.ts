import type { NewsPost } from '../types'

type ReleaseSource = {
  version: string
  title: string
  highlights: string[]
}

/** Versions that still show the “new” badge until the user opens News. */
const NEW_RELEASE_VERSIONS = new Set([
  '2.1',
  '2.2',
  '2.3',
  '2.4',
  '2.5',
  '2.6',
])

/** Shipped versions — surfaced under Updates in the news panel. */
const RELEASES: ReleaseSource[] = [
  {
    version: '2.6',
    title: 'Touch, sound & settings polish',
    highlights: [
      'Two-finger tap undo and three-finger redo on the canvas — finger touches only, stylus ignored',
      'Action toasts when a touch gesture fires undo or redo so you get the same feedback as keyboard shortcuts',
      'Speed-reactive resize sound: filtered noise while dragging a handle, pitch and level follow drag speed',
      'Aspect-ratio snap sound when a resize handle snaps to a common proportion',
      'Expanded sound IDs and per-sound gain tuning across menus, items, theme toggles, and continuous SFX',
      'Settings submenu hover hints — pause on a row for half a second to read what that toggle does',
      'Phone canvas edit mode: when off, Plus FAB hides add actions, pen tools disable, and items stay read-only',
      'Canvas edit toggle in the search bar on phone so you can flip edit mode without opening Settings',
      'Pen FAB lasso panel crossfades with the color popover at a fixed height so the toolbar does not jump',
    ],
  },
  {
    version: '2.5',
    title: 'Canvas items, text & menus',
    highlights: [
      'Text blocks auto-grow width and height while you type, without breaking words across lines',
      'Text shrinks back to a tight bounding box when you click away from the block',
      'Z-order menu adds horizontal and vertical alignment controls for stickies, text, and pockets',
      'Restore original import sizing for images and videos from the item menu',
      'Send an item back to the main canvas when you opened it inside a pocket',
      'Grab handles flip to the side with more room near screen edges; larger hit targets on phone',
      'Plus FAB split into Add to canvas (with live pocket counter), Widgets flyout, and Study subjects',
      'Widgets submenu with preview cards: MCQ, SAQ, tutor, exam countdown, todo, leaderboard, forum, UCAT, and more',
      'Canvas right-click in shortcut mode mirrors Plus FAB add options plus the widgets flyout',
      'Z-order menu stays hidden while a lasso selection includes canvas items so controls do not overlap',
    ],
  },
  {
    version: '2.4',
    title: 'Canvas navigation & zoom',
    highlights: [
      'Motion blur on the canvas during fast pan — intensity scales with how quickly you are moving',
      'Light blur during zoom gestures so pinch and wheel zoom feel connected to motion',
      'Trackpad pinch zoom blocked outside the canvas viewport — search bar, FABs, and panels no longer page-zoom',
      'Wheel and pinch zoom anchor to the cursor position inside the canvas',
      'Zoom edge vignette and gentle snap-back when you overshoot minimum zoom',
      'Pinch and multi-touch pan suppress item drag, resize, and handle taps until the gesture ends',
      'Study hub menu focus blocks canvas zoom unless your pointer is over the focus portal',
      'Tap empty canvas clears both normal selection and lasso selection in one gesture',
      'Drag and resize handles hide when another interactive layer would sit on top of them',
    ],
  },
  {
    version: '2.3',
    title: 'UI pins & customize chrome',
    highlights: [
      'Pin emoji, uploaded photos, Klipy GIFs, or pen sketches onto top-bar and FAB anchors',
      'Anchors: brand pill, search bar, news, notifications, profile, pen FAB, and plus FAB',
      'Pin tray with tabs for emoji (picker), photo upload, GIF search, and a mini draw surface',
      'Drag a ghost from the tray onto an anchor to place; pins persist locally with the rest of the workspace',
      'Edit toolbar on a selected pin: drag to rotate, uniform resize, free-form width/height for images and GIFs, delete',
      'Customize mode focuses a chrome anchor to screen center at 1.6× scale with a motion-blur pulse',
      'Drawing pins store multi-stroke SVG with a tight viewBox so rotation stays centered on the ink',
      'Toggle anchor clipping to keep pins inside the chrome bounds',
      'Pin enter/exit animations and frosted styling match other Cutline glass menus',
    ],
  },
  {
    version: '2.2',
    title: 'Study hubs & quick menu',
    highlights: [
      'Quick menu in Settings: right-click the canvas for pen shortcuts or a compact study subject picker',
      'Study subject menu lists the same subjects as the Plus FAB study section',
      'Study hub menu focus zooms the camera into a hub and shows the subject UI in a fixed portal beside the board',
      'Dismiss control and tap outside the portal animate back to the camera position you had before focus',
      'Gentle hint if menu focus is active and you pick a subject that does not have a hub on the canvas yet',
      'New study hubs spawn at a readable size for your current zoom, with stack offsets so they do not pile up',
      'Canvas search includes study hubs — find by paper code, full name, modules, and lectures',
      'Choosing a hub from search can jump straight into menu focus on that item',
      'Study hub widget card with practice picker and subject chrome inside the hub bounds',
    ],
  },
  {
    version: '2.1',
    title: 'Lasso selection',
    highlights: [
      'Lasso tool in the pen palette (shortcut L) — draw a closed loop to select ink and canvas items',
      'Target picker in the pen FAB: choose strokes, stickies, text, or images; choices persist between sessions',
      'Drag the dashed bounding box to move the whole selection; strokes preview live via transform before commit',
      'Floating action bar under the selection: recolor pen or highlighter ink, duplicate, or delete',
      'Mixed pen and highlighter selections get separate recolor buttons on the action bar',
      'Tap inside the selection box to deselect; switching away from lasso clears the selection',
      'Dedicated lasso cursor and dashed loop overlay while you draw',
      'Tap a canvas item in lasso mode to select it directly instead of starting a new loop',
      'Soft frosted blur hugs lasso-selected items; stroke-only selections skip the halo',
      'Easter-egg toast if you try to turn off every lasso target type',
    ],
  },
  {
    version: '2.0',
    title: 'Cutline menu & polish',
    highlights: [
      'Cutline 2.0 dropdown with frosted-glass panels and flyout submenus',
      'Theme picker (light, dark, auto), shortcuts cheat sheet, and sound controls',
      'Canvas search in the top bar to jump to stickies, text, and pockets',
      'Sound effects plus optional background music',
      'Action toasts when you use keyboard shortcuts',
    ],
  },
  {
    version: '1.4',
    title: 'Drawing & tools',
    highlights: [
      'Pen, highlighter, and eraser with strokes saved to the canvas',
      'Floating tool palette and pencil-hold radial tool menu',
      'Per-tool colors with presets and a color popover',
      'Undo and redo for canvas edits',
    ],
  },
  {
    version: '1.3',
    title: 'Canvas items & pockets',
    highlights: [
      'Sticky notes, text blocks, and images you can drag and resize',
      'Pockets — nested boards you can open, work inside, and exit with a transition',
      'Canvas lock: pin the board and sketch on an annotation layer',
      'Duplicate, select-all, delete, and z-order menu for items',
      'Find on canvas via keyboard shortcut',
    ],
  },
  {
    version: '1.2',
    title: 'Look & feel',
    highlights: [
      'Customize panel to tune mesh gradient depth and palette',
      'Light, dark, and system-auto theme modes',
      'Animated mesh background that drifts with your palette',
      'Pan motion dot and trailing vignette while you move the canvas',
    ],
  },
  {
    version: '1.1',
    title: 'Frosted UI shell',
    highlights: [
      'Top bar with notifications, news, and profile panels',
      'Plus FAB to add canvas items and study actions',
      'Shared glass tokens so chrome blurs the canvas behind it',
      'Panel open/close sounds',
    ],
  },
  {
    version: '1.0',
    title: 'Canvas foundation',
    highlights: [
      'Infinite pan and zoom with bounds locked to the board',
      'Pinch and trackpad pan with velocity easing',
      'Workspace, items, and strokes persisted locally',
      'Viewport-fixed UI that stays put while the canvas moves',
    ],
  },
]

function releaseToPost(release: ReleaseSource): NewsPost {
  return {
    id: `release-${release.version}`,
    category: 'update',
    title: release.title,
    version: release.version,
    highlights: release.highlights,
    isNew: NEW_RELEASE_VERSIONS.has(release.version),
  }
}

const BLOG_POSTS: NewsPost[] = [
  {
    id: 'study-menu-focus',
    category: 'blog',
    title: 'Study menu focus without losing the board',
    summary:
      'Zooming into a hub, parking the subject menu in a portal, and snapping back when you are done.',
    date: 'May 26, 2026',
    isNew: true,
  },
  {
    id: 'lasso-on-infinite-canvas',
    category: 'blog',
    title: 'Lasso on an infinite canvas',
    summary:
      'Freeform selection, mixed ink and items, and a blur that follows the loop instead of dimming everything.',
    date: 'May 22, 2026',
    isNew: true,
  },
  {
    id: 'study-pockets',
    category: 'blog',
    title: 'How we designed study pockets',
    summary:
      'Why nested boards beat infinite canvases when you are revising for exams.',
    date: 'May 12, 2026',
    isNew: false,
  },
  {
    id: 'sound-design',
    category: 'blog',
    title: 'Sound design on the canvas',
    summary:
      'Subtle audio cues for menus, tools, and pocket transitions without breaking focus.',
    date: 'Apr 28, 2026',
  },
]

/** Product blogs and release updates shown to all users in the news panel. */
export const NEWS_POSTS: NewsPost[] = [
  ...BLOG_POSTS,
  ...RELEASES.map(releaseToPost),
]
