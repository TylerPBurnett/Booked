import { useState, useEffect } from 'react'

const CATEGORIES = ['Design', 'Dev', 'Tools', 'Threads', 'Reads', 'Uncategorized']

export function BookmarkDetail({ bookmark, onClose, onUpdate }) {
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    if (bookmark) {
      setTags(bookmark.tags || [])
      setNotes(bookmark.notes || '')
      setCategory(bookmark.category || 'Uncategorized')
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
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-neutral-900 border-l border-neutral-800 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            {bookmark.author?.avatarUrl && (
              <img src={bookmark.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-sm font-medium text-white">@{bookmark.author?.handle}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={bookmark.url} target="_blank" rel="noreferrer"
              className="text-xs text-neutral-500 hover:text-white transition-colors">
              View on X ↗
            </a>
            <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <p className="text-neutral-200 leading-relaxed text-sm whitespace-pre-wrap">{bookmark.text}</p>

          {bookmark.media?.map((m, i) => m.type === 'image' && (
            <img key={i} src={m.url} alt="" className="w-full rounded-lg" />
          ))}

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Category</label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Tags</label>
            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 bg-neutral-800 rounded-md text-neutral-300">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="text-neutral-500 hover:text-red-400 leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500"
              />
              <button onClick={addTag} className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-white transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              placeholder="Add a note..."
              rows={4}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none resize-none focus:border-neutral-500"
            />
          </div>

          <div className="flex gap-4 text-sm text-neutral-500">
            <span>♥ {bookmark.metrics?.likes?.toLocaleString() || 0} likes</span>
            <span>↻ {bookmark.metrics?.retweets?.toLocaleString() || 0} retweets</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex justify-between items-center shrink-0">
          <button
            onClick={() => { save({ archived: !bookmark.archived }); onClose() }}
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            {bookmark.archived ? '↩ Unarchive' : '📦 Archive'}
          </button>
          <span className="text-xs text-neutral-700">{new Date(bookmark.bookmarkedAt).toLocaleDateString()}</span>
        </div>
      </aside>
    </>
  )
}
