import { useState, useMemo, useEffect } from 'react'

export const SORT_OPTIONS = [
  { value: 'postedAt_desc', label: 'Posted (newest)' },
  { value: 'postedAt_asc', label: 'Posted (oldest)' },
  { value: 'metrics.likes_desc', label: 'Most liked' },
  { value: 'metrics.retweets_desc', label: 'Most retweeted' },
  { value: 'author.handle_asc', label: 'Author A–Z' },
]

export const TIME_RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
]

function getVal(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

export function useFilters(bookmarks) {
  const [category, setCategory] = useState('All')
  const [subcategory, setSubcategory] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [sort, setSort] = useState('postedAt_desc')
  const [timeRange, setTimeRange] = useState('all')
  const [hasMediaOnly, setHasMediaOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => { setSubcategory(null) }, [category])

  const filtered = useMemo(() => {
    let result = [...bookmarks]
    if (!showArchived) result = result.filter(b => !b.archived)
    if (category !== 'All') {
      result = result.filter(b => b.category === category)
      if (subcategory) result = result.filter(b => b.subcategory === subcategory)
    }
    if (selectedTags.length > 0) result = result.filter(b => selectedTags.every(t => b.tags.includes(t)))
    if (hasMediaOnly) result = result.filter(b => b.media?.length > 0)

    if (timeRange !== 'all') {
      const days = { week: 7, month: 30, year: 365 }[timeRange]
      const cutoff = new Date(Date.now() - days * 86400000)
      result = result.filter(b => new Date(b.postedAt) >= cutoff)
    }

    const lastUnderscore = sort.lastIndexOf('_')
    const field = sort.slice(0, lastUnderscore)
    const dir = sort.slice(lastUnderscore + 1)

    result.sort((a, b) => {
      const aVal = getVal(a, field)
      const bVal = getVal(b, field)
      if (typeof aVal === 'string') return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0)
    })

    return result
  }, [bookmarks, category, subcategory, selectedTags, sort, timeRange, hasMediaOnly, showArchived])

  return {
    filtered, category, setCategory, subcategory, setSubcategory,
    selectedTags, setSelectedTags,
    sort, setSort, timeRange, setTimeRange,
    hasMediaOnly, setHasMediaOnly, showArchived, setShowArchived,
  }
}
