import { useState } from 'react'
import { clsx } from 'clsx'
import { useTheme, THEMES } from '../context/ThemeContext.jsx'

// ── Category icons ─────────────────────────────────────────────

const CATEGORY_ICONS = {
  All: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Design: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M3 13l2.5-1L13 4.5l-2-2L3 10.5 3 13z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9.5 4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Dev: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M5 4L2 8l3 4M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 3l-3 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Tools: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M10 2a4 4 0 0 0-4 5.5L2.5 11a1.5 1.5 0 1 0 2 2L8 9.5A4 4 0 1 0 10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  Threads: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12v7a1 1 0 0 1-1 1H6l-3 2V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Reads: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M8 4v9M3 4h4a1 1 0 0 1 1 1v7H3V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 5a1 1 0 0 1 1-1h4v8h-4a1 1 0 0 0-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  Uncategorized: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M2 5a2 2 0 0 1 2-2h3l2 2h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
}

const TAGS_ICON = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <path d="M6 2.5L4.5 13.5M11.5 2.5L10 13.5M2.5 6.5h11M2 10h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const SYNC_ICON = (spinning) => (
  <svg className={clsx('w-4 h-4 shrink-0', spinning && 'animate-spin')} viewBox="0 0 16 16" fill="none">
    <path d="M13.5 8A5.5 5.5 0 1 1 9 2.6M9 1v3M9 1L7 3M9 1l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function getCategoryIcon(cat) {
  return CATEGORY_ICONS[cat] || (
    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-[10px] font-bold">
      {cat[0]?.toUpperCase()}
    </span>
  )
}

// ── Tooltip wrapper ────────────────────────────────────────────

function Tip({ label, collapsed, children }) {
  if (!collapsed) return children
  return (
    <div className="relative group/tip w-full">
      {children}
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-2 py-1 bg-float border border-wire rounded-lg text-xs text-ink whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-100 shadow-md">
        {label}
      </span>
    </div>
  )
}

// ── Nav item ───────────────────────────────────────────────────

function NavItem({ label, count, active, onClick, icon, collapsed }) {
  return (
    <Tip label={label} collapsed={collapsed}>
      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-center rounded-lg text-sm transition-colors',
          collapsed
            ? 'justify-center p-2.5'
            : 'justify-between px-2.5 py-1.5',
          active
            ? 'bg-brand-wash text-brand font-semibold'
            : 'text-ink-mid hover:text-ink hover:bg-float'
        )}
      >
        {icon}
        <span
          className={clsx(
            'truncate flex-1 ml-2 transition-[opacity] duration-150',
            collapsed ? 'opacity-0 w-0 overflow-hidden ml-0' : 'opacity-100'
          )}
        >
          {label}
        </span>
        {!collapsed && (
          <span className={clsx(
            'text-xs ml-2 shrink-0 tabular-nums font-mono',
            active ? 'text-brand' : 'text-ink-low'
          )}>
            {count}
          </span>
        )}
      </button>
    </Tip>
  )
}

// ── Theme picker ───────────────────────────────────────────────

function ThemePicker({ collapsed }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const groups = THEMES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = []
    acc[t.group].push(t)
    return acc
  }, {})

  const current = THEMES.find(t => t.id === theme)

  if (collapsed) {
    return (
      <Tip label={`Theme: ${current?.label}`} collapsed>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex justify-center p-2.5 rounded-lg text-ink-mid hover:bg-float transition-colors"
        >
          <span className="relative w-4 h-4 rounded-full border border-wire/60 shrink-0 overflow-hidden">
            <span className="absolute inset-0" style={{ background: current?.bg }} />
            <span className="absolute bottom-0 right-0 w-2 h-2" style={{ background: current?.accent }} />
          </span>
        </button>
        {open && (
          <div className="absolute left-full bottom-0 ml-3 z-50 p-3 bg-lift border border-wire rounded-xl shadow-xl min-w-[220px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-3">Theme</p>
            {Object.entries(groups).map(([group, groupThemes]) => (
              <div key={group} className="mb-3 last:mb-0">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-low mb-1.5">{group}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {groupThemes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setOpen(false) }}
                      title={t.label}
                      className={clsx(
                        'relative h-7 rounded-md overflow-hidden border transition-all',
                        theme === t.id
                          ? 'border-brand ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-elevated)]'
                          : 'border-wire hover:border-ink-mid'
                      )}
                      style={{ background: t.bg }}
                    >
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-md" style={{ background: t.accent }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Tip>
    )
  }

  return (
    <div className="px-3 pb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-1.5 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-low group-hover:text-ink-mid transition-colors">
          Appearance
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-mid">
          <span className="w-3 h-3 rounded-full border border-wire/60 shrink-0" style={{ background: current?.bg }} />
          <span className="text-[11px]">{current?.label}</span>
          <svg className={clsx('w-3 h-3 transition-transform text-ink-low', open && 'rotate-180')} viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-2 pb-1 space-y-3">
          {Object.entries(groups).map(([group, groupThemes]) => (
            <div key={group}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-low mb-1.5 px-0.5">{group}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {groupThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setOpen(false) }}
                    title={t.label}
                    className={clsx(
                      'relative h-7 rounded-md overflow-hidden border transition-all',
                      theme === t.id
                        ? 'border-brand ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-elevated)]'
                        : 'border-wire hover:border-ink-mid'
                    )}
                    style={{ background: t.bg }}
                  >
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-md" style={{ background: t.accent }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────

export function Sidebar({
  bookmarks, meta,
  category, setCategory,
  selectedTags, setSelectedTags,
  syncing, onSync,
  collapsed,
}) {
  const categories = ['All', ...(meta?.categories || [])]

  const tagCounts = bookmarks.reduce((acc, b) => {
    b.tags?.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {})

  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)

  const categoryCounts = bookmarks.reduce((acc, b) => {
    if (!b.archived) acc[b.category] = (acc[b.category] || 0) + 1
    return acc
  }, {})

  const toggleTag = (tag) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

  return (
    <div className="relative flex flex-col h-full overflow-hidden">

      {/* Logo */}
      <div className={clsx('shrink-0 flex items-center py-5', collapsed ? 'justify-center px-0' : 'px-4 gap-2.5')}>
        <div className="w-7 h-7 rounded-lg bg-brand-wash flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-brand" viewBox="0 0 16 16" fill="none">
            <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className={clsx(
          'font-semibold text-ink text-[15px] tracking-tight transition-[opacity] duration-150 whitespace-nowrap',
          collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
        )}>
          Booked
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-2 space-y-0.5 px-2">
        {!collapsed && (
          <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2 pt-1">
            Library
          </p>
        )}
        {collapsed && <div className="h-2" />}

        {categories.map(cat => (
          <NavItem
            key={cat}
            label={cat}
            count={cat === 'All' ? bookmarks.filter(b => !b.archived).length : (categoryCounts[cat] || 0)}
            active={category === cat}
            onClick={() => setCategory(cat)}
            icon={getCategoryIcon(cat)}
            collapsed={collapsed}
          />
        ))}

        {/* Tags — hidden when collapsed */}
        {!collapsed && sortedTags.length > 0 && (
          <>
            <div className="border-t border-wire-dim my-3 mx-1" />
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2">
              Tags
            </p>
            {sortedTags.map(([tag, count]) => (
              <NavItem
                key={tag}
                label={`#${tag}`}
                count={count}
                active={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
                icon={TAGS_ICON}
                collapsed={false}
              />
            ))}
          </>
        )}

        {/* Tags icon hint when collapsed */}
        {collapsed && sortedTags.length > 0 && (
          <>
            <div className="border-t border-wire-dim my-2 mx-2" />
            <Tip label="Tags" collapsed>
              <button className="w-full flex justify-center p-2.5 rounded-lg text-ink-low hover:text-ink-mid hover:bg-float transition-colors">
                {TAGS_ICON}
              </button>
            </Tip>
          </>
        )}
      </div>

      {/* Footer */}
      <div className={clsx('shrink-0 border-t border-wire-dim pt-3 space-y-1', collapsed ? 'px-2' : '')}>
        <ThemePicker collapsed={collapsed} />
        <div className={clsx('pb-4', collapsed ? 'px-0' : 'px-3')}>
          <Tip label={syncing ? 'Syncing…' : 'Sync bookmarks'} collapsed={collapsed}>
            <button
              onClick={() => onSync({ range: 'sync' })}
              disabled={syncing}
              className={clsx(
                'flex items-center gap-2 rounded-lg text-xs font-medium bg-float hover:bg-wire/10 text-ink-mid hover:text-ink border border-wire transition-all disabled:opacity-50',
                collapsed ? 'w-full justify-center p-2.5' : 'w-full px-3 py-2'
              )}
            >
              {SYNC_ICON(syncing)}
              <span className={clsx(
                'transition-[opacity] duration-150 whitespace-nowrap',
                collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              )}>
                {syncing ? 'Syncing…' : 'Sync bookmarks'}
              </span>
            </button>
          </Tip>
        </div>
      </div>
    </div>
  )
}
