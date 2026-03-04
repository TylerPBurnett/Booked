import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

const SYNC_ICON_IDLE = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 8A5.5 5.5 0 1 1 9 2.6M9 1v3M9 1L7 3M9 1l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const SYNC_ICON_SPINNING = (
  <div className="animate-spin w-4 h-4 shrink-0">
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 8A5.5 5.5 0 1 1 9 2.6M9 1v3M9 1L7 3M9 1l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
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

// ── Category menu ──────────────────────────────────────────────

function CategoryMenu({ onRename, onAddSub, onChangeIcon, onChangeColor, onDelete, onClose, depth }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl py-1 min-w-[160px]"
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => { onRename(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-mid hover:text-ink hover:bg-float transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none">
          <path d="M2 10l2-1 5-5-1-1-5 5-1 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M8 2l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        Rename
      </button>

      {depth === 0 && onAddSub && (
        <button
          onClick={() => { onAddSub(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-mid hover:text-ink hover:bg-float transition-colors text-left"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add subcategory
        </button>
      )}

      <button
        onClick={() => { onChangeIcon(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-mid hover:text-ink hover:bg-float transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 6.5c.4.8 1 1.5 2 1.5s1.6-.7 2-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="4.5" cy="4.5" r=".75" fill="currentColor"/>
          <circle cx="7.5" cy="4.5" r=".75" fill="currentColor"/>
        </svg>
        Change icon
      </button>

      <button
        onClick={() => { onChangeColor(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-mid hover:text-ink hover:bg-float transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none">
          <path d="M6 1.5a4.5 4.5 0 1 0 4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M8 1l1 1-4.5 4.5L3 7l.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <circle cx="10" cy="9.5" r="1.5" fill="currentColor" fillOpacity=".5" stroke="currentColor" strokeWidth="1"/>
        </svg>
        Change color
      </button>

      <div className="border-t border-wire-dim mx-2 my-0.5" />

      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none">
          <path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Delete
      </button>
    </div>
  )
}

// ── Emoji picker ──────────────────────────────────────────────

const CATEGORY_EMOJIS = [
  '📁', '📂', '⭐', '❤️', '🔥', '💡', '🎯', '🚀',
  '💻', '🎨', '📝', '📚', '🔧', '🎵', '📷', '🌍',
  '💰', '🏠', '🎮', '📱', '🔒', '✅', '📌', '💬',
  '🧪', '📊', '🗂️', '💼', '🎁', '🔗', '📖', '✨',
]

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl p-2 w-[220px]">
      <div className="grid grid-cols-8 gap-1">
        {CATEGORY_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => onSelect(emoji)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-float text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button onClick={() => onSelect(null)}
        className="w-full mt-1.5 text-xs text-ink-low hover:text-ink-mid py-1 rounded hover:bg-float transition-colors">
        Reset to default
      </button>
    </div>
  )
}

// ── Color picker ──────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#a3a3a3',
]

function ColorPicker({ onSelect, currentColor, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl p-2">
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORY_COLORS.map(color => (
          <button key={color} onClick={() => onSelect(color)}
            className={clsx('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
              currentColor === color ? 'border-ink scale-110' : 'border-transparent'
            )}
            style={{ background: color }}
          />
        ))}
      </div>
      <button onClick={() => onSelect(null)}
        className="w-full mt-1.5 text-xs text-ink-low hover:text-ink-mid py-1 rounded hover:bg-float transition-colors">
        Reset
      </button>
    </div>
  )
}

// ── Category row ───────────────────────────────────────────────

function CategoryRow({
  name, count, active, depth, expanded, hasChildren,
  onClick, onToggleExpand,
  onAdd, onRename, onDelete,
  onAddSub = null,
  onChangeIcon = null,
  onChangeColor = null,
  onUpdateCategory = null,
  icon = null,
  color = null,
  collapsed: sidebarCollapsed,
  dragHandleListeners = null,
  dragHandleAttributes = {},
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(name)
  const [confirming, setConfirming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setEditing(false)
  }

  const isProtected = name === 'Uncategorized' || name === 'All'

  if (sidebarCollapsed) {
    if (depth > 0) return null
    return (
      <Tip label={name} collapsed>
        <button
          onClick={onClick}
          className={clsx(
            'w-full flex justify-center p-2.5 rounded-lg transition-colors',
            active ? 'bg-brand-wash text-brand' : 'text-ink-mid hover:text-ink hover:bg-float'
          )}
        >
          <span className="shrink-0" style={color && !icon ? { color } : undefined}>
            {icon
              ? <span className="w-4 h-4 flex items-center justify-center text-sm relative">
                  {icon}
                  {color && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-lift" style={{ background: color }} />}
                </span>
              : getCategoryIcon(name)
            }
          </span>
        </button>
      </Tip>
    )
  }

  return (
    <div className="group/row relative">
      {editing ? (
        <div className="flex items-center px-2 py-1">
          <input
            ref={inputRef}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setEditVal(name); setEditing(false) }
            }}
            onBlur={commitRename}
            className="flex-1 bg-float border border-brand rounded-md px-2 py-0.5 text-sm text-ink outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center rounded-lg overflow-hidden">
          {depth === 0 && (hasChildren ? (
            <button
              onClick={onToggleExpand}
              className="p-1 shrink-0 text-ink-low hover:text-ink-mid transition-colors"
            >
              <svg className={clsx('w-3 h-3 transition-transform', expanded && 'rotate-90')} viewBox="0 0 10 10" fill="none">
                <path d="M3.5 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          ))}

          {depth === 0 && !isProtected && dragHandleListeners && (
            <button
              {...dragHandleListeners}
              {...dragHandleAttributes}
              className="cursor-grab active:cursor-grabbing p-1 shrink-0 text-ink-low opacity-0 group-hover/row:opacity-100 hover:text-ink-mid transition-opacity touch-none"
              onClick={e => e.stopPropagation()}
            >
              <svg className="w-3 h-3" viewBox="0 0 8 14" fill="currentColor">
                <circle cx="2" cy="2"  r="1.2"/><circle cx="6" cy="2"  r="1.2"/>
                <circle cx="2" cy="7"  r="1.2"/><circle cx="6" cy="7"  r="1.2"/>
                <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
              </svg>
            </button>
          )}

          <button
            onClick={onClick}
            className={clsx(
              'flex-1 flex items-center gap-2 py-1.5 text-sm transition-colors text-left min-w-0',
              depth === 1 ? 'pl-1 pr-2' : 'pr-2',
              active ? 'text-brand font-semibold' : 'text-ink-mid hover:text-ink'
            )}
          >
            {depth === 0
              ? <span className="shrink-0" style={color && !icon ? { color } : undefined}>
                  {icon
                    ? <span className="w-4 h-4 flex items-center justify-center text-sm relative">
                        {icon}
                        {color && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-lift" style={{ background: color }} />}
                      </span>
                    : getCategoryIcon(name)
                  }
                </span>
              : <svg className="w-3.5 h-3.5 shrink-0 flex-none opacity-60" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 4.5C1.5 3.67 2.17 3 3 3h2.38l1.24 1.5H11c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
            }
            <span className="truncate">{name}</span>
          </button>

          {/* Count / 3-dot menu swap */}
          <div className="relative ml-auto shrink-0 flex items-center pr-2">
            {isProtected ? (
              <span className={clsx(
                'text-xs tabular-nums font-mono',
                active ? 'text-brand' : 'text-ink-low'
              )}>
                {count}
              </span>
            ) : (
              <>
                <span className={clsx(
                  'text-xs tabular-nums font-mono transition-opacity duration-100',
                  'group-hover/row:opacity-0',
                  active ? 'text-brand' : 'text-ink-low'
                )}>
                  {count}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-100 text-ink-low hover:text-ink"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="8" cy="13" r="1.5"/>
                  </svg>
                </button>
                {menuOpen && (
                  <CategoryMenu
                    depth={depth}
                    onRename={() => { setEditVal(name); setEditing(true) }}
                    onAddSub={depth === 0 ? onAddSub : null}
                    onChangeIcon={() => setEmojiPickerOpen(true)}
                    onChangeColor={() => setColorPickerOpen(true)}
                    onDelete={() => setConfirming(true)}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
                {emojiPickerOpen && (
                  <EmojiPicker
                    onSelect={(emoji) => { if (onUpdateCategory) onUpdateCategory(name, { icon: emoji }); setEmojiPickerOpen(false) }}
                    onClose={() => setEmojiPickerOpen(false)}
                  />
                )}
                {colorPickerOpen && (
                  <ColorPicker
                    currentColor={color}
                    onSelect={(c) => { if (onUpdateCategory) onUpdateCategory(name, { color: c }); setColorPickerOpen(false) }}
                    onClose={() => setColorPickerOpen(false)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {confirming && (
        <div className="mx-2 mb-1 p-2 bg-float border border-wire rounded-lg text-xs text-ink-mid">
          <p className="mb-1.5 font-medium text-ink">Delete "{name}"?</p>
          <p className="text-ink-low mb-2">
            {depth === 0
              ? 'Bookmarks will move to Uncategorized.'
              : `Bookmarks will move to the parent category.`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(); setConfirming(false) }}
              className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 hover:bg-wire rounded-md text-ink-mid transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add input ──────────────────────────────────────────────────

function AddInput({ placeholder, onAdd, onCancel }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])

  const commit = () => {
    const trimmed = val.trim()
    if (trimmed) onAdd(trimmed)
    else onCancel()
  }

  return (
    <div className="px-2 py-1">
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={onCancel}
        placeholder={placeholder}
        className="w-full bg-float border border-brand rounded-md px-2 py-1 text-sm text-ink placeholder-ink-low outline-none"
      />
    </div>
  )
}

// ── Sortable category row (DnD wrapper) ────────────────────────

function SortableCategoryRow({ id, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <CategoryRow
        {...props}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  )
}

// ── Animated collapse ──────────────────────────────────────────

function AnimatedCollapse({ open, children }) {
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight)
  })

  return (
    <div
      style={{ maxHeight: open ? height : 0 }}
      className="overflow-hidden transition-[max-height] duration-150 ease-out"
    >
      <div ref={ref}>{children}</div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────

export function Sidebar({
  bookmarks, meta,
  category, setCategory,
  subcategory, setSubcategory,
  selectedTags, setSelectedTags,
  syncing, onSync,
  collapsed,
  categories,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onUpdateCategory,
}) {
  const [expandedCats, setExpandedCats] = useState({})
  const [addingTop, setAddingTop] = useState(false)
  const [addingSub, setAddingSub] = useState(null)
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const draggable = categories.filter(c => c.name !== 'Uncategorized')
  const uncategorized = categories.find(c => c.name === 'Uncategorized')
  const activeCategory = draggable.find(c => c.name === activeId)

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = draggable.findIndex(c => c.name === active.id)
    const newIndex = draggable.findIndex(c => c.name === over.id)
    const reordered = arrayMove(draggable, oldIndex, newIndex)
    const newOrder = [...reordered.map(c => c.name), ...(uncategorized ? ['Uncategorized'] : [])]
    if (onReorderCategories) onReorderCategories(newOrder)
  }

  const toggleExpand = (name) =>
    setExpandedCats(prev => ({ ...prev, [name]: !prev[name] }))

  const tagCounts = bookmarks.reduce((acc, b) => {
    b.tags?.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {})
  const sortedTags = Object.entries(tagCounts).sort(([,a],[,b]) => b-a).slice(0, 20)

  const allCount = bookmarks.filter(b => !b.archived).length

  return (
    <div className="relative flex flex-col h-full overflow-hidden">

      {/* Logo */}
      <div className={clsx('shrink-0 flex items-center py-5', collapsed ? 'justify-center px-0' : 'px-4 gap-2.5')}>
        <div className="w-7 h-7 rounded-lg bg-brand-wash flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-brand" viewBox="0 0 16 16" fill="none">
            <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className={clsx('font-semibold text-ink text-[15px] tracking-tight transition-[opacity] duration-150 whitespace-nowrap', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
          Booked
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-2 space-y-0.5 px-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-2.5 mb-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-low">Library</p>
            <button
              onClick={() => setAddingTop(true)}
              className="p-0.5 rounded text-ink-low hover:text-ink-mid hover:bg-float transition-colors"
              title="Add category"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        {collapsed && <div className="h-2" />}

        {/* All */}
        <NavItem
          label="All"
          count={allCount}
          active={category === 'All'}
          onClick={() => { setCategory('All'); setSubcategory(null) }}
          icon={getCategoryIcon('All')}
          collapsed={collapsed}
        />

        {/* Category tree */}
        {!collapsed ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={draggable.map(c => c.name)}
              strategy={verticalListSortingStrategy}
            >
              {draggable.map(cat => (
                <div key={cat.name}>
                  <SortableCategoryRow
                    id={cat.name}
                    name={cat.name}
                    count={cat.count}
                    active={category === cat.name && !subcategory}
                    depth={0}
                    expanded={expandedCats[cat.name]}
                    hasChildren={true}
                    onClick={() => { setCategory(cat.name); setSubcategory(null) }}
                    onToggleExpand={() => toggleExpand(cat.name)}
                    onAdd={null}
                    onRename={(newName) => onRenameCategory(cat.name, newName)}
                    onDelete={() => onDeleteCategory(cat.name)}
                    onAddSub={() => setAddingSub(cat.name)}
                    onUpdateCategory={onUpdateCategory}
                    icon={cat.icon ?? null}
                    color={cat.color ?? null}
                    collapsed={false}
                  />
                  <AnimatedCollapse open={!!expandedCats[cat.name]}>
                    <div className="ml-[22px] pl-3 border-l border-wire-dim space-y-0.5 pt-0.5 pb-1">
                      {cat.children.map(sub => (
                        <CategoryRow
                          key={sub.name}
                          name={sub.name}
                          count={sub.count}
                          active={category === cat.name && subcategory === sub.name}
                          depth={1}
                          expanded={false}
                          hasChildren={false}
                          onClick={() => { setCategory(cat.name); setSubcategory(sub.name) }}
                          onToggleExpand={null}
                          onAdd={null}
                          onRename={(newName) => onRenameCategory(sub.name, newName, cat.name)}
                          onDelete={() => onDeleteCategory(sub.name, cat.name)}
                          onAddSub={null}
                          onUpdateCategory={onUpdateCategory}
                          icon={sub.icon ?? null}
                          color={sub.color ?? null}
                          collapsed={false}
                        />
                      ))}
                      {addingSub === cat.name ? (
                        <AddInput
                          placeholder="Subcategory name…"
                          onAdd={(name) => { onCreateCategory(name, cat.name); setAddingSub(null) }}
                          onCancel={() => setAddingSub(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingSub(cat.name)}
                          className="w-full flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-lg text-xs text-ink-low hover:text-ink-mid hover:bg-float transition-colors"
                        >
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none">
                            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Add subcategory
                        </button>
                      )}
                    </div>
                  </AnimatedCollapse>
                </div>
              ))}
            </SortableContext>

            <DragOverlay>
              {activeCategory && (
                <div className="bg-lift border border-wire rounded-lg shadow-xl opacity-95">
                  <CategoryRow
                    name={activeCategory.name}
                    count={activeCategory.count}
                    active={false}
                    depth={0}
                    expanded={false}
                    hasChildren={activeCategory.children.length > 0}
                    onClick={() => {}}
                    onToggleExpand={null}
                    onAdd={null}
                    onRename={null}
                    onDelete={null}
                    icon={activeCategory.icon ?? null}
                    color={activeCategory.color ?? null}
                    collapsed={false}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <>
            {draggable.map(cat => (
              <CategoryRow
                key={cat.name}
                name={cat.name}
                count={cat.count}
                active={category === cat.name && !subcategory}
                depth={0}
                expanded={false}
                hasChildren={false}
                onClick={() => { setCategory(cat.name); setSubcategory(null) }}
                onToggleExpand={null}
                onAdd={null}
                onRename={null}
                onDelete={null}
                icon={cat.icon ?? null}
                color={cat.color ?? null}
                collapsed={true}
              />
            ))}
          </>
        )}

        {/* Uncategorized — always pinned last, never draggable */}
        {uncategorized && (
          <CategoryRow
            name="Uncategorized"
            count={uncategorized.count}
            active={category === 'Uncategorized' && !subcategory}
            depth={0}
            expanded={false}
            hasChildren={false}
            onClick={() => { setCategory('Uncategorized'); setSubcategory(null) }}
            onToggleExpand={null}
            onAdd={null}
            onRename={null}
            onDelete={null}
            collapsed={collapsed}
          />
        )}

        {/* Add top-level category */}
        {!collapsed && addingTop && (
          <AddInput
            placeholder="Category name…"
            onAdd={(name) => { onCreateCategory(name); setAddingTop(false) }}
            onCancel={() => setAddingTop(false)}
          />
        )}

        {/* Tags */}
        {!collapsed && sortedTags.length > 0 && (
          <>
            <div className="border-t border-wire-dim my-3 mx-1" />
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2">Tags</p>
            {sortedTags.map(([tag, count]) => (
              <NavItem
                key={tag}
                label={`#${tag}`}
                count={count}
                active={selectedTags.includes(tag)}
                onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                icon={TAGS_ICON}
                collapsed={false}
              />
            ))}
          </>
        )}

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
              className={clsx('flex items-center gap-2 rounded-lg text-xs font-medium bg-float hover:bg-wire/10 text-ink-mid hover:text-ink border border-wire transition-all disabled:opacity-50', collapsed ? 'w-full justify-center p-2.5' : 'w-full px-3 py-2')}
            >
              {syncing ? SYNC_ICON_SPINNING : SYNC_ICON_IDLE}
              <span className={clsx('transition-[opacity] duration-150 whitespace-nowrap', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
                {syncing ? 'Syncing…' : 'Sync bookmarks'}
              </span>
            </button>
          </Tip>
        </div>
      </div>
    </div>
  )
}
