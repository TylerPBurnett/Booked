import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { useTheme, THEMES } from '../context/ThemeContext.jsx'
import { SORT_OPTIONS, TIME_RANGES } from '../hooks/useFilters.js'

const ctrlClass =
  'field cursor-pointer w-auto py-[7px] text-ink-mid hover:text-ink'

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const groups = THEMES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = []
    acc[t.group].push(t)
    return acc
  }, {})

  const current = THEMES.find(t => t.id === theme)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-[7px] rounded-lg text-ink-mid hover:text-ink hover:bg-float transition-colors"
        title={`Theme: ${current?.label}`}
      >
        <span className="relative w-4 h-4 rounded-full border border-wire/60 shrink-0 overflow-hidden">
          <span className="absolute inset-0" style={{ background: current?.bg }} />
          <span className="absolute bottom-0 right-0 w-2 h-2" style={{ background: current?.accent }} />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 p-3 bg-lift border border-wire rounded-xl shadow-xl min-w-[220px]">
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
    </div>
  )
}

export function TopBar({
  query, setQuery,
  sort, setSort,
  timeRange, setTimeRange,
  hasMediaOnly, setHasMediaOnly,
  resultCount,
}) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-wire bg-lift shrink-0">
      {/* Search */}
      <div className="flex-1 flex items-center gap-2.5 bg-float border border-wire rounded-lg px-3 py-[7px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--accent-subtle)] transition-all">
        <svg className="w-4 h-4 text-ink-low shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search bookmarks…"
          className="flex-1 bg-transparent text-sm text-ink placeholder-ink-low outline-none min-w-0"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-ink-low hover:text-ink transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Sort */}
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className={ctrlClass}
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Time range */}
      <select
        value={timeRange}
        onChange={e => setTimeRange(e.target.value)}
        className={ctrlClass}
      >
        {TIME_RANGES.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Media filter */}
      <button
        onClick={() => setHasMediaOnly(!hasMediaOnly)}
        title="Show media only"
        className={clsx(
          'flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-sm border transition-all',
          hasMediaOnly
            ? 'bg-brand-wash border-brand text-brand'
            : 'bg-float border-wire text-ink-low hover:text-ink hover:border-ink-low'
        )}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="5.5" cy="7.5" r="1.5" fill="currentColor"/>
          <path d="M1.5 11l4-3.5 4 3.5 3-2.5 2 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Count */}
      <span className="text-xs text-ink-low shrink-0 min-w-[52px] text-right tabular-nums font-mono">
        {resultCount.toLocaleString()}
      </span>

      {/* Theme picker */}
      <ThemePicker />
    </div>
  )
}
