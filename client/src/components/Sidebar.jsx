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
import {
  Folder, FolderOpen, Star, Heart, Bookmark, Tag, Hash, Flag, Pin, Archive, Inbox, Bell,
  Code2, Terminal, Cpu, Globe, Database, Server, Wifi, Lock, Key, Shield, Bug, GitBranch, Package, Wrench, Settings,
  ImageIcon, Video, Music, FileText, BookOpen, Newspaper, Camera, Mic, Film, Tv, Headphones,
  User, Users, Briefcase, Building2, Mail, MessageSquare, Phone, Calendar, Clock, Award, Target, Lightbulb,
  FlaskConical, Atom, Leaf, Sun, Moon, Cloud, Zap, Flame,
  ShoppingCart, DollarSign, Home, Map, Compass, Palette, Scissors, Gamepad2, Rocket, Coffee,
  Layers, LayoutGrid, Link, Smile, Pencil, Truck, Brain, Dumbbell, Plane, GraduationCap,
} from 'lucide-react'

// ── Lucide icon registry ────────────────────────────────────────

const ICON_GROUPS = [
  { label: 'General', icons: [
    { name: 'folder', Icon: Folder }, { name: 'folder-open', Icon: FolderOpen },
    { name: 'star', Icon: Star }, { name: 'heart', Icon: Heart },
    { name: 'bookmark', Icon: Bookmark }, { name: 'tag', Icon: Tag },
    { name: 'hash', Icon: Hash }, { name: 'flag', Icon: Flag },
    { name: 'pin', Icon: Pin }, { name: 'archive', Icon: Archive },
    { name: 'inbox', Icon: Inbox }, { name: 'bell', Icon: Bell },
    { name: 'layers', Icon: Layers }, { name: 'layout-grid', Icon: LayoutGrid },
    { name: 'link', Icon: Link }, { name: 'smile', Icon: Smile },
  ]},
  { label: 'Tech', icons: [
    { name: 'code-2', Icon: Code2 }, { name: 'terminal', Icon: Terminal },
    { name: 'cpu', Icon: Cpu }, { name: 'globe', Icon: Globe },
    { name: 'database', Icon: Database }, { name: 'server', Icon: Server },
    { name: 'wifi', Icon: Wifi }, { name: 'lock', Icon: Lock },
    { name: 'key', Icon: Key }, { name: 'shield', Icon: Shield },
    { name: 'bug', Icon: Bug }, { name: 'git-branch', Icon: GitBranch },
    { name: 'package', Icon: Package }, { name: 'wrench', Icon: Wrench },
    { name: 'settings', Icon: Settings }, { name: 'brain', Icon: Brain },
  ]},
  { label: 'Media', icons: [
    { name: 'image', Icon: ImageIcon }, { name: 'video', Icon: Video },
    { name: 'music', Icon: Music }, { name: 'file-text', Icon: FileText },
    { name: 'book-open', Icon: BookOpen }, { name: 'newspaper', Icon: Newspaper },
    { name: 'camera', Icon: Camera }, { name: 'mic', Icon: Mic },
    { name: 'film', Icon: Film }, { name: 'tv', Icon: Tv },
    { name: 'headphones', Icon: Headphones }, { name: 'pencil', Icon: Pencil },
  ]},
  { label: 'Work', icons: [
    { name: 'user', Icon: User }, { name: 'users', Icon: Users },
    { name: 'briefcase', Icon: Briefcase }, { name: 'building-2', Icon: Building2 },
    { name: 'mail', Icon: Mail }, { name: 'message-square', Icon: MessageSquare },
    { name: 'phone', Icon: Phone }, { name: 'calendar', Icon: Calendar },
    { name: 'clock', Icon: Clock }, { name: 'award', Icon: Award },
    { name: 'target', Icon: Target }, { name: 'lightbulb', Icon: Lightbulb },
    { name: 'graduation-cap', Icon: GraduationCap }, { name: 'truck', Icon: Truck },
  ]},
  { label: 'Lifestyle', icons: [
    { name: 'home', Icon: Home }, { name: 'shopping-cart', Icon: ShoppingCart },
    { name: 'dollar-sign', Icon: DollarSign }, { name: 'coffee', Icon: Coffee },
    { name: 'dumbbell', Icon: Dumbbell }, { name: 'plane', Icon: Plane },
    { name: 'map', Icon: Map }, { name: 'compass', Icon: Compass },
    { name: 'palette', Icon: Palette }, { name: 'scissors', Icon: Scissors },
    { name: 'gamepad-2', Icon: Gamepad2 }, { name: 'rocket', Icon: Rocket },
  ]},
  { label: 'Nature', icons: [
    { name: 'flask-conical', Icon: FlaskConical }, { name: 'atom', Icon: Atom },
    { name: 'leaf', Icon: Leaf }, { name: 'sun', Icon: Sun },
    { name: 'moon', Icon: Moon }, { name: 'cloud', Icon: Cloud },
    { name: 'zap', Icon: Zap }, { name: 'flame', Icon: Flame },
  ]},
]

const ICON_MAP = Object.fromEntries(ICON_GROUPS.flatMap(g => g.icons.map(i => [i.name, i.Icon])))

function LucideIcon({ name, className }) {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon className={className} /> : null
}

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

// ── Category menu ──────────────────────────────────────────────

function CategoryMenu({ onRename, onAddSub, onChangeIcon, onChangeColor, onDelete, onClose, depth, anchorRect }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Position below the anchor button, right-aligned
  const style = anchorRect ? {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.max(8, Math.min(anchorRect.right - 160, window.innerWidth - 168)),
  } : {}

  return (
    <div
      ref={ref}
      className="z-[100] bg-lift border border-wire rounded-xl shadow-xl py-1 min-w-[160px]"
      style={style}
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

// ── Icon picker ────────────────────────────────────────────────

function IconPicker({ onSelect, currentIcon, onClose, anchorRect }) {
  const ref = useRef(null)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => { inputRef.current?.focus() }, [])

  const style = anchorRect ? {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.max(8, Math.min(anchorRect.right - 252, window.innerWidth - 260)),
  } : {}

  const q = query.toLowerCase()
  const filtered = q
    ? ICON_GROUPS.flatMap(g => g.icons).filter(i => i.name.includes(q))
    : null

  return (
    <div ref={ref} className="z-[100] bg-lift border border-wire rounded-xl shadow-xl w-[252px]" style={style}
      onClick={e => e.stopPropagation()}>
      {/* Search */}
      <div className="px-2 pt-2 pb-1">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="w-full bg-float border border-wire rounded-md px-2 py-1 text-xs text-ink placeholder-ink-low outline-none focus:border-brand"
        />
      </div>

      {/* Icon grid */}
      <div className="overflow-y-auto max-h-[220px] px-2 pb-2 scrollbar-thin">
        {filtered ? (
          filtered.length === 0
            ? <p className="text-xs text-ink-low py-4 text-center">No icons found</p>
            : <div className="grid grid-cols-8 gap-0.5 pt-1">
                {filtered.map(({ name, Icon }) => (
                  <IconBtn key={name} name={name} Icon={Icon} active={currentIcon === name} onSelect={onSelect} />
                ))}
              </div>
        ) : (
          ICON_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-low pt-2 pb-1 px-0.5">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.icons.map(({ name, Icon }) => (
                  <IconBtn key={name} name={name} Icon={Icon} active={currentIcon === name} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-wire-dim mx-2" />
      <button onClick={() => onSelect(null)}
        className="w-full text-xs text-ink-low hover:text-ink-mid py-1.5 rounded-b-xl hover:bg-float transition-colors">
        Reset to default
      </button>
    </div>
  )
}

function IconBtn({ name, Icon, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(name)}
      title={name}
      className={clsx(
        'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
        active ? 'bg-brand-wash text-brand' : 'text-ink-mid hover:bg-float hover:text-ink'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

// ── Color picker ──────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#a3a3a3',
]

function ColorPicker({ onSelect, currentColor, onClose, anchorRect }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const style = anchorRect ? {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.max(8, Math.min(anchorRect.right - 170, window.innerWidth - 178)),
  } : {}

  return (
    <div ref={ref} className="z-[100] bg-lift border border-wire rounded-xl shadow-xl p-2" style={style}>
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
  onRename, onDelete,
  onAddSub = null,
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
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const inputRef = useRef(null)
  const dotBtnRef = useRef(null)

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
          <span className="shrink-0" style={color ? { color } : undefined}>
            {icon ? <LucideIcon name={icon} className="w-4 h-4 shrink-0" /> : getCategoryIcon(name)}
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
        <div className="flex items-center rounded-lg">
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

          <button
            onClick={onClick}
            {...(dragHandleListeners ?? {})}
            {...(dragHandleAttributes ?? {})}
            className={clsx(
              'flex-1 flex items-center gap-2 py-1.5 text-sm transition-colors text-left min-w-0 select-none',
              depth === 1 ? 'pl-1 pr-2' : 'pr-2',
              active ? 'text-brand font-semibold' : 'text-ink-mid hover:text-ink',
              dragHandleListeners && !isProtected ? 'cursor-grab active:cursor-grabbing' : ''
            )}
          >
            {depth === 0
              ? <span className="shrink-0" style={color ? { color } : undefined}>
                  {icon ? <LucideIcon name={icon} className="w-4 h-4 shrink-0" /> : getCategoryIcon(name)}
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
                  ref={dotBtnRef}
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = dotBtnRef.current?.getBoundingClientRect()
                    if (rect) setAnchorRect(rect)
                    setMenuOpen(o => !o)
                  }}
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
                    anchorRect={anchorRect}
                    onRename={() => { setEditVal(name); setEditing(true) }}
                    onAddSub={depth === 0 ? onAddSub : null}
                    onChangeIcon={() => setIconPickerOpen(true)}
                    onChangeColor={() => setColorPickerOpen(true)}
                    onDelete={() => setConfirming(true)}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
                {iconPickerOpen && (
                  <IconPicker
                    anchorRect={anchorRect}
                    currentIcon={icon}
                    onSelect={(iconName) => { if (onUpdateCategory) onUpdateCategory(name, { icon: iconName }); setIconPickerOpen(false) }}
                    onClose={() => setIconPickerOpen(false)}
                  />
                )}
                {colorPickerOpen && (
                  <ColorPicker
                    anchorRect={anchorRect}
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

// ── Sortable wrappers (DnD) ────────────────────────────────────

function SortableCategoryRow({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <CategoryRow {...props} dragHandleListeners={listeners} dragHandleAttributes={attributes} />
    </div>
  )
}

function SortableSubcategoryRow({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <CategoryRow {...props} dragHandleListeners={listeners} dragHandleAttributes={attributes} />
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
  onReorderSubcategories,
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
    if (String(active.id).includes('::')) {
      // Subcategory drag
      const [parentName, subName] = String(active.id).split('::')
      const [overParent, overSub] = String(over.id).split('::')
      if (parentName !== overParent) return
      const parentCat = draggable.find(c => c.name === parentName)
      if (!parentCat) return
      const children = parentCat.children.map(c => c.name)
      const reordered = arrayMove(children, children.indexOf(subName), children.indexOf(overSub))
      if (onReorderSubcategories) onReorderSubcategories(parentName, reordered)
    } else {
      // Top-level drag
      const oldIndex = draggable.findIndex(c => c.name === active.id)
      const newIndex = draggable.findIndex(c => c.name === over.id)
      const reordered = arrayMove(draggable, oldIndex, newIndex)
      const newOrder = [...reordered.map(c => c.name), ...(uncategorized ? ['Uncategorized'] : [])]
      if (onReorderCategories) onReorderCategories(newOrder)
    }
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
                    onRename={(newName) => onRenameCategory(cat.name, newName)}
                    onDelete={() => onDeleteCategory(cat.name)}
                    onAddSub={() => setAddingSub(cat.name)}
                    onUpdateCategory={onUpdateCategory}
                    icon={cat.icon ?? null}
                    color={cat.color ?? null}
                    collapsed={false}
                  />
                  <AnimatedCollapse open={!!expandedCats[cat.name]}>
                    <div className="ml-[30px] pl-3 border-l border-wire-dim space-y-0.5 pt-0.5 pb-1">
                      <SortableContext
                        items={cat.children.map(sub => `${cat.name}::${sub.name}`)}
                        strategy={verticalListSortingStrategy}
                      >
                      {cat.children.map(sub => (
                        <SortableSubcategoryRow
                          key={sub.name}
                          id={`${cat.name}::${sub.name}`}
                          name={sub.name}
                          count={sub.count}
                          active={category === cat.name && subcategory === sub.name}
                          depth={1}
                          expanded={false}
                          hasChildren={false}
                          onClick={() => { setCategory(cat.name); setSubcategory(sub.name) }}
                          onToggleExpand={null}
                          onRename={(newName) => onRenameCategory(sub.name, newName, cat.name)}
                          onDelete={() => onDeleteCategory(sub.name, cat.name)}
                          onAddSub={null}
                          onUpdateCategory={onUpdateCategory}
                          icon={sub.icon ?? null}
                          color={sub.color ?? null}
                          collapsed={false}
                        />
                      ))}
                      </SortableContext>
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
              {activeId && (() => {
                if (String(activeId).includes('::')) {
                  const [parentName, subName] = String(activeId).split('::')
                  const parentCat = draggable.find(c => c.name === parentName)
                  const sub = parentCat?.children.find(c => c.name === subName)
                  if (!sub) return null
                  return (
                    <div className="bg-lift border border-wire rounded-lg shadow-xl opacity-95">
                      <CategoryRow name={sub.name} count={sub.count} active={false} depth={1}
                        expanded={false} hasChildren={false} onClick={() => {}} onToggleExpand={null}
                        onRename={null} onDelete={null} icon={sub.icon ?? null} color={sub.color ?? null} collapsed={false} />
                    </div>
                  )
                }
                const cat = draggable.find(c => c.name === activeId)
                if (!cat) return null
                return (
                  <div className="bg-lift border border-wire rounded-lg shadow-xl opacity-95">
                    <CategoryRow name={cat.name} count={cat.count} active={false} depth={0}
                      expanded={false} hasChildren={cat.children.length > 0} onClick={() => {}} onToggleExpand={null}
                      onRename={null} onDelete={null} icon={cat.icon ?? null} color={cat.color ?? null} collapsed={false} />
                  </div>
                )
              })()}
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
      <div className={clsx('shrink-0 border-t border-wire-dim pt-3', collapsed ? 'px-2' : '')}>
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
