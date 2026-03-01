import { SORT_OPTIONS, TIME_RANGES } from '../hooks/useFilters.js'

export function TopBar({ query, setQuery, sort, setSort, timeRange, setTimeRange, hasMediaOnly, setHasMediaOnly, resultCount }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-800 shrink-0 bg-neutral-950">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search bookmarks..."
        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600 transition-colors"
      />
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none cursor-pointer"
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={timeRange}
        onChange={e => setTimeRange(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none cursor-pointer"
      >
        {TIME_RANGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button
        onClick={() => setHasMediaOnly(!hasMediaOnly)}
        title="Media only"
        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
          hasMediaOnly ? 'bg-neutral-700 border-neutral-600 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'
        }`}
      >
        📷
      </button>
      <span className="text-xs text-neutral-600 shrink-0 min-w-[60px] text-right">{resultCount} items</span>
    </div>
  )
}
