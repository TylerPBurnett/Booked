import { clsx } from 'clsx'

function NavItem({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors text-left',
        active ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-neutral-500 ml-2 shrink-0">{count}</span>
    </button>
  )
}

export function Sidebar({ bookmarks, meta, category, setCategory, selectedTags, setSelectedTags, syncing, onSync }) {
  const categories = ['All', ...(meta?.categories || [])]

  const tagCounts = bookmarks.reduce((acc, b) => {
    b.tags?.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {})

  const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 20)

  const categoryCounts = bookmarks.reduce((acc, b) => {
    if (!b.archived) acc[b.category] = (acc[b.category] || 0) + 1
    return acc
  }, {})

  const toggleTag = (tag) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <div className="flex flex-col h-full py-4 px-2 gap-1">
      <div className="px-3 mb-4">
        <span className="font-semibold text-white tracking-tight text-base">🔖 Booked</span>
      </div>

      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1">Categories</p>
      {categories.map(cat => (
        <NavItem
          key={cat}
          label={cat}
          count={cat === 'All' ? bookmarks.filter(b => !b.archived).length : (categoryCounts[cat] || 0)}
          active={category === cat}
          onClick={() => setCategory(cat)}
        />
      ))}

      {sortedTags.length > 0 && (
        <>
          <div className="border-t border-neutral-800 my-3" />
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1">Tags</p>
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

      <div className="flex-1" />
      <div className="px-2 pb-2">
        <button
          onClick={() => onSync({ range: 'sync' })}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
        >
          <span className={syncing ? 'animate-spin inline-block' : ''}>↻</span>
          {syncing ? 'Syncing...' : 'Sync bookmarks'}
        </button>
      </div>
    </div>
  )
}
