import { useState, useEffect, useRef } from 'react'
import { useBookmarks } from './hooks/useBookmarks.js'
import { useFilters } from './hooks/useFilters.js'
import { useFuzzySearch } from './hooks/useFuzzySearch.js'
import { Layout } from './components/Layout.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { TopBar } from './components/TopBar.jsx'
import { BookmarkCard } from './components/BookmarkCard.jsx'
import { BookmarkDetail } from './components/BookmarkDetail.jsx'

export default function App() {
  const { bookmarks, meta, loading, syncing, sync, updateBookmark } = useBookmarks()
  const filters = useFilters(bookmarks)
  const { query, setQuery, results } = useFuzzySearch(filters.filtered)
  const [selectedId, setSelectedId] = useState(null)

  const selectedBookmark = bookmarks.find(b => b.id === selectedId) || null

  const PAGE_SIZE = 100
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [results])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(n => n + PAGE_SIZE)
    }, { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [results])

  return (
    <>
      <Layout
        sidebar={
          <Sidebar
            bookmarks={bookmarks}
            meta={meta}
            category={filters.category}
            setCategory={filters.setCategory}
            selectedTags={filters.selectedTags}
            setSelectedTags={filters.setSelectedTags}
            syncing={syncing}
            onSync={sync}
          />
        }
        header={
          <TopBar
            query={query}
            setQuery={setQuery}
            sort={filters.sort}
            setSort={filters.setSort}
            timeRange={filters.timeRange}
            setTimeRange={filters.setTimeRange}
            hasMediaOnly={filters.hasMediaOnly}
            setHasMediaOnly={filters.setHasMediaOnly}
            resultCount={results.length}
          />
        }
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-500 text-sm font-mono animate-pulse">Loading bookmarks...</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-neutral-500 text-sm">No bookmarks yet.</p>
            <p className="text-neutral-600 text-xs font-mono">
              Run <code className="px-1.5 py-0.5 bg-neutral-800 rounded">/x-bookmarks --sync</code> to fetch from X
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {results.slice(0, visibleCount).map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  onClick={() => setSelectedId(b.id)}
                />
              ))}
            </div>
            {visibleCount < results.length && (
              <div ref={sentinelRef} className="h-8" />
            )}
          </>
        )}
      </Layout>

      <BookmarkDetail
        bookmark={selectedBookmark}
        onClose={() => setSelectedId(null)}
        onUpdate={updateBookmark}
      />
    </>
  )
}
