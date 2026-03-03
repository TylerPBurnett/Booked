import { useState } from 'react'
import { clsx } from 'clsx'
import { useTheme, THEMES } from '../context/ThemeContext.jsx'

function NavItem({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
        active
          ? 'bg-brand-wash text-brand font-semibold'
          : 'text-ink-mid hover:text-ink hover:bg-float'
      )}
    >
      <span className="truncate">{label}</span>
      <span className={clsx(
        'text-xs ml-2 shrink-0 tabular-nums font-mono',
        active ? 'text-brand' : 'text-ink-low'
      )}>
        {count}
      </span>
    </button>
  )
}

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const groups = THEMES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = []
    acc[t.group].push(t)
    return acc
  }, {})

  const current = THEMES.find(t => t.id === theme)

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
          <span
            className="w-3 h-3 rounded-full border border-wire/60 shrink-0"
            style={{ background: current?.bg }}
          />
          <span className="text-[11px]">{current?.label}</span>
          <svg
            className={clsx('w-3 h-3 transition-transform text-ink-low', open && 'rotate-180')}
            viewBox="0 0 10 6" fill="none"
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-2 pb-1 space-y-3">
          {Object.entries(groups).map(([group, groupThemes]) => (
            <div key={group}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-low mb-1.5 px-0.5">
                {group}
              </p>
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
                    <span
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-md"
                      style={{ background: t.accent }}
                    />
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

export function Sidebar({ bookmarks, meta, category, setCategory, selectedTags, setSelectedTags, syncing, onSync }) {
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-wash flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-brand" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z"
                fill="currentColor" fillOpacity="0.2"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-semibold text-ink text-[15px] tracking-tight">Booked</span>
        </div>
      </div>

      {/* Nav — scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2 pt-1">
          Library
        </p>
        {categories.map(cat => (
          <NavItem
            key={cat}
            label={cat}
            count={
              cat === 'All'
                ? bookmarks.filter(b => !b.archived).length
                : (categoryCounts[cat] || 0)
            }
            active={category === cat}
            onClick={() => setCategory(cat)}
          />
        ))}

        {sortedTags.length > 0 && (
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
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-wire-dim pt-3 space-y-3">
        <ThemePicker />
        <div className="px-3 pb-4">
          <button
            onClick={() => onSync({ range: 'sync' })}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-float hover:bg-wire/10 text-ink-mid hover:text-ink border border-wire transition-all disabled:opacity-50"
          >
            <svg
              className={clsx('w-3.5 h-3.5 shrink-0', syncing && 'animate-spin')}
              viewBox="0 0 16 16" fill="none"
            >
              <path
                d="M13.5 8A5.5 5.5 0 1 1 9 2.6M9 1v3M9 1L7 3M9 1l2 2"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            {syncing ? 'Syncing…' : 'Sync bookmarks'}
          </button>
        </div>
      </div>
    </div>
  )
}
