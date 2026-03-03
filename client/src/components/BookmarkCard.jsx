import { memo } from 'react'
import { clsx } from 'clsx'

const CATEGORY_STYLE = {
  Design:        { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  Dev:           { bg: 'rgba(59,130,246,0.12)',   color: '#60a5fa' },
  Tools:         { bg: 'rgba(16,185,129,0.12)',   color: '#34d399' },
  Threads:       { bg: 'rgba(245,158,11,0.12)',   color: '#fbbf24' },
  Reads:         { bg: 'rgba(239,68,68,0.12)',    color: '#f87171' },
  Uncategorized: { bg: 'rgba(107,114,128,0.1)',   color: '#9ca3af' },
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (days === 0)  return 'today'
  if (days === 1)  return 'yesterday'
  if (days < 7)   return `${days}d ago`
  if (days < 30)  return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatCount(n) {
  if (!n)       return '0'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

export const BookmarkCard = memo(function BookmarkCard({ bookmark, onClick }) {
  const { author, text, tags, category, metrics, media, postedAt } = bookmark
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.Uncategorized

  return (
    <article
      onClick={() => onClick(bookmark.id)}
      className={clsx(
        'group bg-lift border border-wire rounded-xl p-4 flex flex-col gap-3 cursor-pointer',
        'transition-all duration-150 hover:bg-float hover:border-wire hover:shadow-lg hover:shadow-black/5',
      )}
    >
      {/* Author */}
      <div className="flex items-center gap-2.5 min-w-0">
        {author?.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="w-8 h-8 rounded-full shrink-0 bg-float"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-float flex items-center justify-center text-xs text-ink-mid shrink-0 font-mono">
            {author?.handle?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate leading-tight">
            {author?.name || `@${author?.handle}`}
          </p>
          <p className="text-xs text-ink-low font-mono leading-tight">
            @{author?.handle}
          </p>
        </div>
        <span className="text-xs text-ink-low shrink-0 font-mono tabular-nums">
          {formatRelative(postedAt)}
        </span>
      </div>

      {/* Tweet text */}
      <p className="text-sm text-ink-mid leading-relaxed line-clamp-4 flex-1">
        {text}
      </p>

      {/* Media thumbnail */}
      {media?.[0]?.type === 'image' && (
        <img
          src={media[0].url}
          alt=""
          className="w-full h-36 object-cover rounded-lg bg-float"
          loading="lazy"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}

      {/* Tags */}
      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[11px] px-1.5 py-0.5 rounded-md bg-float text-ink-low font-mono"
            >
              #{tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-float text-ink-low font-mono">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-wire-dim mt-auto">
        <span
          className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
          style={{ background: style.bg, color: style.color }}
        >
          {category}
        </span>
        {bookmark.subcategory && (
          <span className="text-[11px] px-2 py-0.5 rounded-md text-ink-low bg-float font-medium">
            {bookmark.subcategory}
          </span>
        )}
        <div className="flex items-center gap-3 text-xs text-ink-low font-mono tabular-nums">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M6 10S1.5 7 1.5 4A2.5 2.5 0 0 1 6 3a2.5 2.5 0 0 1 4.5 1C10.5 7 6 10 6 10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {formatCount(metrics?.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 4h8M7.5 2l2.5 2-2.5 2M10 8H2M4.5 6l-2.5 2 2.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {formatCount(metrics?.retweets)}
          </span>
        </div>
      </div>
    </article>
  )
})
