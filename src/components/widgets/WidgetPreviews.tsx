import type { CSSProperties, ReactNode } from 'react'
import { font } from '../../styles/tokens'

const widgetShell: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 14,
  background: 'var(--card-bg)',
  border: '1px solid var(--glass-border)',
  boxShadow: 'var(--glass-shadow)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: font.family,
  color: font.colorPrimary,
  boxSizing: 'border-box',
}

const widgetShellClass = 'ui-chrome-preserve-case'

function WidgetShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={widgetShellClass} style={{ ...widgetShell, ...style }}>
      {children}
    </div>
  )
}

function WidgetBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        padding: '8px 10px 10px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const WIDGET_INSET = '10px 12px 12px'

export function TodoWidgetPreview() {
  const items = [
    { text: 'Review pharm notes', tag: 'CHEM', done: true },
    { text: 'Finish block SAQs', tag: 'CHEM', due: '5pm', today: true },
    { text: 'PHSI lab prep sheet', tag: 'PHSI', due: 'Thu' },
    { text: 'Tutorial 4 group sync', tag: 'HUBS', due: 'Fri' },
  ]
  const doneCount = items.filter((item) => item.done).length
  const progressPct = Math.round((doneCount / items.length) * 100)

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 4, padding: WIDGET_INSET, overflow: 'hidden' }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <p style={{ margin: 0, fontSize: 8, fontWeight: 600, lineHeight: 1.2 }}>Today</p>
            <span
              style={{
                fontSize: 7,
                color: font.colorMuted,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {doneCount}/{items.length} done
            </span>
          </div>
          <div
            style={{
              marginTop: 4,
              height: 3,
              borderRadius: 999,
              background: 'rgba(20, 30, 50, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: 999,
                background: 'var(--ui-accent)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
          {items.map(({ text, tag, done, due, today }) => (
            <div
              key={text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: today && !done ? '2px 5px' : '0 1px',
                margin: today && !done ? '0 -5px' : 0,
                borderRadius: 5,
                background: today && !done ? 'rgba(90, 122, 176, 0.08)' : 'transparent',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  background: done ? 'var(--ui-accent)' : 'transparent',
                  border: done
                    ? 'none'
                    : today
                      ? '1.5px solid var(--ui-accent)'
                      : '1.5px solid rgba(20, 30, 50, 0.18)',
                }}
              >
                {done && (
                  <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden>
                    <path
                      d="M1 3l1.5 1.5L5 1.5"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 7.5,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: done ? font.colorMuted : font.colorPrimary,
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {text}
              </span>
              <span
                style={{
                  fontSize: 6,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: 'rgba(20, 30, 50, 0.06)',
                  color: font.colorMuted,
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {tag}
              </span>
              {!done && due && (
                <span
                  style={{
                    fontSize: 6.5,
                    fontWeight: today ? 600 : 400,
                    color: today ? 'var(--ui-accent)' : font.colorFaint,
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {due}
                </span>
              )}
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function LeaderboardRanksPreview() {
  const podiumOrder = [
    { rank: 2, name: '@kai.surg', score: '2,710', barH: 26, medal: '#a8b0c0' },
    { rank: 1, name: '@maya.bio', score: '2,840', barH: 36, medal: '#d4a017' },
    { rank: 3, name: 'you', score: '2,655', barH: 20, medal: '#c4885a', highlight: true },
  ]
  const rest = [
    { rank: 4, name: '@omar.pharm', score: '2,590' },
    { rank: 5, name: '@priya.bio', score: '2,540' },
  ]

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 4, padding: '6px 8px 8px', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          {podiumOrder.map(({ rank, name, score, barH, medal, highlight }) => (
            <div
              key={rank}
              style={{
                flex: 1,
                maxWidth: rank === 1 ? 52 : 46,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  color: highlight ? 'var(--ui-accent)' : font.colorMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  textAlign: 'center',
                }}
              >
                {name}
              </span>
              <div
                style={{
                  width: '100%',
                  height: barH,
                  borderRadius: '4px 4px 2px 2px',
                  background: highlight
                    ? 'rgba(90, 122, 176, 0.22)'
                    : `linear-gradient(180deg, ${medal}55 0%, ${medal}22 100%)`,
                  border: highlight ? '1px solid rgba(90, 122, 176, 0.35)' : `1px solid ${medal}44`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: 3,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: medal, lineHeight: 1 }}>
                  {rank}
                </span>
              </div>
              <span
                style={{
                  fontSize: 7,
                  fontVariantNumeric: 'tabular-nums',
                  color: font.colorMuted,
                }}
              >
                {score}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rest.map(({ rank, name, score }) => (
            <div
              key={rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 8.5,
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  width: 12,
                  fontWeight: 600,
                  color: font.colorMuted,
                  flexShrink: 0,
                  fontSize: 8,
                }}
              >
                {rank}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: font.colorMuted,
                  fontSize: 8,
                  flexShrink: 0,
                }}
              >
                {score}
              </span>
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

/** Anki-style activity level → muted green cell. */
function heatCellColor(level: number): string {
  if (level <= 0) return 'rgba(20, 30, 50, 0.07)'
  const alpha = [0, 0.18, 0.34, 0.52, 0.78][Math.min(level, 4)]
  return `rgba(48, 120, 88, ${alpha})`
}

export function LeaderboardStreakPreview() {
  /** 4 weeks × 7 days — intensity 0–4, recent week last row. */
  const weeks = [
    [0, 1, 0, 2, 1, 0, 1],
    [1, 2, 2, 1, 3, 2, 1],
    [2, 3, 2, 4, 3, 2, 3],
    [1, 2, 3, 4, 4, 4, 3],
  ]
  const streak = 7

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 8, padding: '8px 10px 10px', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ margin: 0, fontSize: 9, color: font.colorMuted }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: font.colorPrimary, marginRight: 4 }}>
              {streak}
            </span>
            day streak
          </p>
          <span style={{ fontSize: 8, color: font.colorFaint }}>last 28d</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignSelf: 'center',
          }}
        >
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', gap: 2 }}>
              {week.map((level, di) => (
                <div
                  key={di}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: heatCellColor(level),
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function ForumThreadsPreview() {
  const threads = [
    {
      title: 'Best way to revise CE?',
      author: 'maya.bio',
      tag: 'CE',
      tagColor: '#8b9dc3',
      replies: 24,
      ago: '2h',
      pinned: true,
    },
    {
      title: 'Mock exam tips for UCAT VR',
      author: 'kai.surg',
      tag: 'UCAT',
      tagColor: '#6aab6a',
      replies: 11,
      ago: '5h',
    },
    {
      title: 'Sheffield dent cutoff?',
      author: 'priya.dent',
      tag: 'Dent',
      tagColor: '#a86acb',
      replies: 38,
      ago: '1d',
      unread: true,
    },
  ]

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 3, padding: '5px 6px 7px', justifyContent: 'center' }}>
        {threads.map(({ title, author, tag, tagColor, replies, ago, pinned, unread }) => (
          <div
            key={title}
            style={{
              display: 'flex',
              gap: 6,
              padding: '4px 5px',
              borderRadius: 7,
              background: 'rgba(20, 30, 50, 0.035)',
              border: '1px solid rgba(20, 30, 50, 0.05)',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 17,
                height: 17,
                borderRadius: 5,
                flexShrink: 0,
                background: `${tagColor}28`,
                border: `1px solid ${tagColor}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 7.5,
                fontWeight: 700,
                color: tagColor,
                marginTop: 1,
              }}
            >
              {author[0].toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginBottom: 2,
                }}
              >
                {unread && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--ui-accent)',
                      flexShrink: 0,
                    }}
                  />
                )}
                {pinned && (
                  <span
                    style={{
                      fontSize: 6.5,
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      color: font.colorFaint,
                      flexShrink: 0,
                    }}
                  >
                    pin
                  </span>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 9,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {title}
                </p>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: font.colorMuted,
                    flexShrink: 0,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: 'rgba(20, 30, 50, 0.06)',
                  }}
                >
                  {replies}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 7.5,
                  color: font.colorMuted,
                  lineHeight: 1,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{author}
                </span>
                <span style={{ color: font.colorFaint }}>·</span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 6.5,
                    fontWeight: 600,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: `${tagColor}18`,
                    color: tagColor,
                  }}
                >
                  {tag}
                </span>
                <span style={{ color: font.colorFaint }}>·</span>
                <span style={{ flexShrink: 0 }}>{ago}</span>
              </div>
            </div>
          </div>
        ))}
      </WidgetBody>
    </WidgetShell>
  )
}

export function McqWidgetPreview() {
  const options = ['Amylase', 'Lipase', 'Protease', 'Nuclease']
  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 5, justifyContent: 'center' }}>
        <p style={{ margin: 0, fontSize: 9, color: font.colorMuted }}>Daily MCQ · new each session</p>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 500, lineHeight: 1.25 }}>
          Which enzyme breaks down starch?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {options.map((opt, i) => (
            <div
              key={opt}
              style={{
                padding: '3px 5px',
                borderRadius: 6,
                fontSize: 9,
                background: i === 0 ? 'rgba(90, 122, 176, 0.14)' : 'rgba(20, 30, 50, 0.05)',
                border: i === 0 ? '1px solid rgba(90, 122, 176, 0.25)' : '1px solid transparent',
              }}
            >
              {String.fromCharCode(65 + i)}) {opt}
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function SaqWidgetPreview() {
  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 5, padding: '6px 8px 8px', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span
              style={{
                fontSize: 6.5,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'rgba(163, 196, 163, 0.2)',
                color: '#6a9a6a',
                flexShrink: 0,
              }}
            >
              CH
            </span>
            <span
              style={{
                fontSize: 8,
                color: font.colorMuted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Cell biology
            </span>
          </div>
          <span
            style={{
              fontSize: 7.5,
              fontWeight: 600,
              color: font.colorFaint,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            4 marks
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 9, fontWeight: 500, lineHeight: 1.3 }}>
          Describe the role of the Na⁺/K⁺ pump in maintaining resting membrane potential.
        </p>

        <div
          style={{
            borderRadius: 7,
            border: '1px solid rgba(20, 30, 50, 0.08)',
            background: 'rgba(20, 30, 50, 0.025)',
            padding: '5px 6px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minHeight: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 8,
              lineHeight: 1.4,
              color: font.colorPrimary,
            }}
          >
            Uses ATP to export 3 Na⁺ and import 2 K⁺, keeping the interior negative relative to
            ECF...
          </p>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 1,
                background: 'rgba(20, 30, 50, 0.07)',
                borderRadius: 1,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 7,
            color: font.colorFaint,
          }}
        >
          <span>Draft saved</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>38 / 250 words</span>
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function TutorWidgetPreview() {
  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 5, padding: '6px 8px 8px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 5,
              flexShrink: 0,
              background: 'rgba(20, 30, 50, 0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 6.5,
              fontWeight: 600,
              color: font.colorMuted,
            }}
          >
            you
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: '4px 6px',
              borderRadius: '7px 7px 7px 3px',
              background: 'rgba(20, 30, 50, 0.045)',
              border: '1px solid rgba(20, 30, 50, 0.06)',
              fontSize: 8.5,
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            Explain the cardiac cycle
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 5,
              flexShrink: 0,
              background: 'rgba(90, 122, 176, 0.16)',
              border: '1px solid rgba(90, 122, 176, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 7,
              fontWeight: 700,
              color: 'var(--ui-accent)',
            }}
          >
            T
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: '5px 6px',
              borderRadius: '7px 7px 3px 7px',
              background: 'rgba(90, 122, 176, 0.07)',
              border: '1px solid rgba(90, 122, 176, 0.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
                gap: 4,
              }}
            >
              <span style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--ui-accent)' }}>
                @tutor.ce
              </span>
              <span
                style={{
                  fontSize: 6,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: font.colorFaint,
                }}
              >
                drafting
              </span>
            </div>
            <p style={{ margin: '0 0 3px', fontSize: 8, lineHeight: 1.35 }}>
              <span style={{ fontWeight: 600 }}>Systole</span>
              <span style={{ color: font.colorMuted }}> — ventricles contract, AV valves close</span>
            </p>
            <p style={{ margin: 0, fontSize: 8, lineHeight: 1.35 }}>
              <span style={{ fontWeight: 600 }}>Diastole</span>
              <span style={{ color: font.colorMuted }}> — chambers fill, semilunar valves shut</span>
            </p>
            <div
              style={{
                marginTop: 5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 7.5,
                color: font.colorFaint,
              }}
            >
              <span className="widget-chat-typing-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function ExamCountdownPreview() {
  const roadmap = [
    { code: 'CELS', state: 'done' as const },
    { code: 'CHEM', state: 'active' as const, pct: 58 },
    { code: 'PHSI', state: 'next' as const, inDays: 21 },
    { code: 'HUBS', state: 'later' as const, inDays: 35 },
  ]

  return (
    <WidgetShell>
      <WidgetBody
        style={{ gap: 5, padding: WIDGET_INSET, overflow: 'hidden', justifyContent: 'space-between' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 7.5, color: font.colorMuted }}>Exam block · 18 Jun</p>
            <p
              style={{
                margin: '1px 0 0',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              28
              <span style={{ fontSize: 9, fontWeight: 600, color: font.colorMuted, marginLeft: 2 }}>
                days
              </span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 7, color: font.colorFaint }}>focus</p>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'var(--ui-accent)' }}>CHEM</p>
          </div>
        </div>

        <div style={{ position: 'relative', paddingTop: 1 }}>
          <div
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              top: 5,
              height: 2,
              borderRadius: 999,
              background: 'rgba(20, 30, 50, 0.08)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '12%',
              width: '36%',
              top: 5,
              height: 2,
              borderRadius: 999,
              background: 'var(--ui-accent)',
              opacity: 0.55,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            {roadmap.map(({ code, state, ...rest }) => {
              const isDone = state === 'done'
              const isActive = state === 'active'
              const detail =
                isDone ? 'done' : isActive ? `${rest.pct}%` : `${rest.inDays}d`

              return (
                <div
                  key={code}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      boxSizing: 'border-box',
                      background: isDone || isActive ? 'var(--ui-accent)' : 'var(--card-bg)',
                      border:
                        isDone || isActive
                          ? 'none'
                          : '1.5px solid rgba(20, 30, 50, 0.16)',
                      boxShadow: isActive ? '0 0 0 2px rgba(90, 122, 176, 0.2)' : undefined,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 6.5,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      color: isActive ? 'var(--ui-accent)' : isDone ? font.colorPrimary : font.colorMuted,
                    }}
                  >
                    {code}
                  </span>
                  <span
                    style={{
                      fontSize: 6,
                      color: font.colorFaint,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {detail}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function UcatCountdownPreview() {
  const sections = [
    { label: 'VR', score: 680, delta: 15 },
    { label: 'DM', score: 710, delta: 8 },
    { label: 'QR', score: 695, delta: -5 },
    { label: 'AR', score: 720, delta: 22 },
  ]

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 4, padding: WIDGET_INSET, justifyContent: 'space-between', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 7.5, color: font.colorMuted }}>UCAT · 12 Sep 2026</p>
            <p
              style={{
                margin: '1px 0 0',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              42
              <span style={{ fontSize: 10, fontWeight: 600, color: font.colorMuted, marginLeft: 2 }}>
                days
              </span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 7, color: font.colorFaint }}>mock avg</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>701</p>
            <p style={{ margin: '1px 0 0', fontSize: 7, color: '#6aab6a' }}>↑ 12 this week</p>
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 7,
              color: font.colorFaint,
              marginBottom: 3,
            }}
          >
            <span>Prep progress</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>68%</span>
          </div>
          <div
            style={{
              height: 3,
              borderRadius: 999,
              background: 'rgba(20, 30, 50, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '68%',
                height: '100%',
                borderRadius: 999,
                background: 'var(--ui-accent)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {sections.map(({ label, score, delta }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 5px',
                borderRadius: 5,
                background: 'rgba(20, 30, 50, 0.045)',
                border: '1px solid rgba(20, 30, 50, 0.06)',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 7, color: font.colorMuted, lineHeight: 1.2 }}>
                  {label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  {score}
                </p>
              </div>
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: delta >= 0 ? '#6aab6a' : '#c46a6a',
                }}
              >
                {delta >= 0 ? '+' : ''}
                {delta}
              </span>
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}

export function UcatPracticePreview() {
  const options = [
    { key: 'A', text: 'Climate policy', selected: false },
    { key: 'B', text: 'Economic growth', selected: true },
    { key: 'C', text: 'Public health', selected: false },
    { key: 'D', text: 'Trade reform', selected: false },
  ]

  return (
    <WidgetShell>
      <WidgetBody style={{ gap: 3, padding: WIDGET_INSET, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 7,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'rgba(90, 122, 176, 0.16)',
              color: 'var(--ui-accent)',
              flexShrink: 0,
            }}
          >
            VR
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 7,
              color: font.colorMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Timed drill · Q 12/44 · 78% acc
          </span>
          <div
            style={{
              position: 'relative',
              width: 24,
              height: 24,
              flexShrink: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="rgba(20, 30, 50, 0.08)"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="var(--ui-accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 9 * 0.67} ${2 * Math.PI * 9}`}
                transform="rotate(-90 12 12)"
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 6,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: font.colorPrimary,
              }}
            >
              14:32
            </span>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 7.5,
            lineHeight: 1.25,
            color: font.colorPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          The author&apos;s central claim is that urban planning should prioritise…
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {options.map(({ key, text, selected }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 4px',
                borderRadius: 4,
                fontSize: 7,
                background: selected ? 'rgba(90, 122, 176, 0.14)' : 'rgba(20, 30, 50, 0.04)',
                border: selected
                  ? '1px solid rgba(90, 122, 176, 0.28)'
                  : '1px solid rgba(20, 30, 50, 0.05)',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: selected ? 'var(--ui-accent)' : font.colorMuted,
                  flexShrink: 0,
                }}
              >
                {key}
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: selected ? font.colorPrimary : font.colorMuted,
                }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>
      </WidgetBody>
    </WidgetShell>
  )
}
