import { useState, useEffect, useRef, useCallback } from 'react'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { useBookmarks } from './hooks/useBookmarks.js'
import { useFilters } from './hooks/useFilters.js'
import { useCategories } from './hooks/useCategories.js'
import { useFuzzySearch } from './hooks/useFuzzySearch.js'
import { Layout } from './components/Layout.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { TopBar } from './components/TopBar.jsx'
import { BookmarkCard } from './components/BookmarkCard.jsx'
import { BookmarkDetail } from './components/BookmarkDetail.jsx'

function BookedApp() {
  const { bookmarks, meta, loading, syncing, sync, updateBookmark } = useBookmarks()
  const filters = useFilters(bookmarks)
  const { categories, createCategory, renameCategory: renameCat, deleteCategory, reorderCategories } = useCategories()
  const { query, setQuery, results } = useFuzzySearch(filters.filtered)
  const [selectedId, setSelectedId] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('booked-sidebar-collapsed') === 'true' } catch { return false }
  })

  const toggleSidebar = () => setSidebarCollapsed(prev => {
    const next = !prev
    try { localStorage.setItem('booked-sidebar-collapsed', String(next)) } catch {}
    return next
  })

  const handleCardClick = useCallback((id) => setSelectedId(id), [])

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
        collapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
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
            collapsed={sidebarCollapsed}
            categories={categories}
            subcategory={filters.subcategory}
            setSubcategory={filters.setSubcategory}
            onCreateCategory={createCategory}
            onRenameCategory={renameCat}
            onDeleteCategory={deleteCategory}
            onReorderCategories={reorderCategories}
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
            <span className="text-ink-low text-sm font-mono animate-pulse">loading bookmarks…</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-ink-mid text-sm">No bookmarks found.</p>
            <p className="text-ink-low text-xs font-mono">
              Run{' '}
              <code className="px-2 py-0.5 bg-lift border border-wire rounded text-brand">
                /x-bookmarks --sync
              </code>{' '}
              to fetch from X
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {results.slice(0, visibleCount).map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  onClick={handleCardClick}
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
        categories={categories}
      />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BookedApp />
    </ThemeProvider>
  )
}
