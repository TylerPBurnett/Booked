import { useState, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: [
    { name: 'text', weight: 0.5 },
    { name: 'author.handle', weight: 0.2 },
    { name: 'author.name', weight: 0.1 },
    { name: 'tags', weight: 0.15 },
    { name: 'notes', weight: 0.05 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
}

export function useFuzzySearch(items) {
  const [query, setQuery] = useState('')
  const fuse = useMemo(() => new Fuse(items, FUSE_OPTIONS), [items])
  const results = useMemo(() => {
    if (!query.trim()) return items
    return fuse.search(query).map(r => r.item)
  }, [fuse, items, query])
  const handleQuery = useCallback((q) => setQuery(q), [])
  return { query, setQuery: handleQuery, results }
}
