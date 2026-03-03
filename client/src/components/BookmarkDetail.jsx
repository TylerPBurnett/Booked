import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

const CATEGORIES = ['Design', 'Dev', 'Tools', 'Threads', 'Reads', 'Uncategorized']

function SectionLabel({ children }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-low">
      {children}
    </label>
  )
}

export function BookmarkDetail({ bookmark, onClose, onUpdate, categories = [] }) {
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState(null)
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    if (bookmark) {
      setTags(bookmark.tags || [])
      setNotes(bookmark.notes || '')
      setCategory(bookmark.category || 'Uncategorized')
      setSubcategory(bookmark.subcategory || null)
    }
  }, [bookmark])

  if (!bookmark) return null

  const save = (patch) => onUpdate(bookmark.id, patch)

  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || tags.includes(tag)) { setNewTag(''); return }
    const updated = [...tags, tag]
    setTags(updated)
    setNewTag('')
    save({ tags: updated })
  }

  const removeTag = (tag) => {
    const updated = tags.filter(t => t !== tag)
    setTags(updated)
    save({ tags: updated })
  }

  const handleCategoryChange = (val) => {
    setCategory(val)
    save({ category: val })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Slide panel */}
      <aside className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-lift border-l border-wire z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-wire shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {bookmark.author?.avatarUrl && (
              <img
                src={bookmark.author.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {bookmark.author?.name}
              </p>
              <p className="text-xs text-ink-low font-mono">
                @{bookmark.author?.handle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-mid hover:text-ink border border-wire hover:border-ink-low bg-float transition-colors"
            >
              View on X
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7M8 1h3m0 0v3M11 1L5.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-low hover:text-ink hover:bg-float border border-transparent hover:border-wire transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 flex flex-col gap-5">
          {/* Tweet content */}
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {bookmark.text}
          </p>

          {/* Media */}
          {bookmark.media?.map((m, i) =>
            m.type === 'image' && (
              <img key={i} src={m.url} alt="" className="w-full rounded-xl" />
            )
          )}

          {/* Metrics + date */}
          <div className="flex items-center gap-4 text-xs text-ink-low font-mono tabular-nums py-1">
            <span>♥ {bookmark.metrics?.likes?.toLocaleString() || 0}</span>
            <span>↻ {bookmark.metrics?.retweets?.toLocaleString() || 0}</span>
            <span className="ml-auto">
              {new Date(bookmark.postedAt || bookmark.bookmarkedAt)
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="border-t border-wire-dim" />

          {/* Category */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Category</SectionLabel>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              className="field"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Subcategory */}
          {(() => {
            const parentCat = categories.find(c => c.name === category)
            if (!parentCat || parentCat.children.length === 0) return null
            return (
              <div className="flex flex-col gap-2">
                <SectionLabel>Subcategory</SectionLabel>
                <select
                  value={subcategory || ''}
                  onChange={e => {
                    const val = e.target.value || null
                    setSubcategory(val)
                    save({ subcategory: val })
                  }}
                  className="field"
                >
                  <option value="">— None —</option>
                  {parentCat.children.map(sub => (
                    <option key={sub.name} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
              </div>
            )
          })()}

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Tags</SectionLabel>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-float border border-wire rounded-md text-ink-mid font-mono"
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-ink-low hover:text-red-400 leading-none transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add tag…"
                className="field flex-1"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-wash text-brand border border-[var(--accent)] border-opacity-30 hover:bg-brand hover:text-white transition-all"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              placeholder="Add a note…"
              rows={4}
              className="field resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-wire shrink-0 flex items-center justify-between">
          <button
            onClick={() => { save({ archived: !bookmark.archived }); onClose() }}
            className="flex items-center gap-1.5 text-xs text-ink-low hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 3.5l.75 8.5h8.5l.75-8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              {bookmark.archived
                ? <path d="M5 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                : <path d="M5 8l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
            {bookmark.archived ? 'Unarchive' : 'Archive'}
          </button>
          <span className="text-xs text-ink-low font-mono">
            bookmarked {new Date(bookmark.bookmarkedAt).toLocaleDateString()}
          </span>
        </div>
      </aside>
    </>
  )
}
