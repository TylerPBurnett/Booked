import { clsx } from 'clsx'

const CATEGORY_COLORS = {
  Design: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Dev: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Tools: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Threads: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Reads: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Uncategorized: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatCount(n) {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function BookmarkCard({ bookmark, onClick }) {
  const { author, text, tags, category, metrics, media, bookmarkedAt } = bookmark
  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.Uncategorized

  return (
    <article
      onClick={onClick}
      className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:bg-neutral-900/80"
    >
      <div className="flex items-center gap-2">
        {author?.avatarUrl ? (
          <img src={author.avatarUrl} alt={author.name} className="w-7 h-7 rounded-full bg-neutral-800 shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-500 shrink-0 font-mono">
            {author?.handle?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{author?.name || author?.handle}</p>
          <p className="text-xs text-neutral-500">@{author?.handle}</p>
        </div>
        <span className="text-xs text-neutral-600 shrink-0">{formatRelative(bookmarkedAt)}</span>
      </div>

      <p className="text-sm text-neutral-300 leading-relaxed line-clamp-4 flex-1">{text}</p>

      {media?.[0]?.type === 'image' && (
        <img
          src={media[0].url}
          alt=""
          className="w-full h-32 object-cover rounded-lg bg-neutral-800"
          loading="lazy"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}

      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">#{tag}</span>
          ))}
          {tags.length > 4 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">+{tags.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className={clsx('text-xs px-2 py-0.5 rounded-full border', categoryColor)}>{category}</span>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>♥ {formatCount(metrics?.likes)}</span>
          <span>↻ {formatCount(metrics?.retweets)}</span>
        </div>
      </div>
    </article>
  )
}
