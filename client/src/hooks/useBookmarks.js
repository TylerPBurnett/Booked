import { useState, useEffect, useCallback } from 'react'

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [bmRes, metaRes] = await Promise.all([
      fetch('/api/bookmarks?limit=10000'),
      fetch('/api/meta')
    ])
    const bmData = await bmRes.json()
    const metaData = await metaRes.json()
    setBookmarks(bmData.bookmarks)
    setMeta(metaData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateBookmark = useCallback(async (id, patch) => {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    const updated = await res.json()
    setBookmarks(prev => prev.map(b => b.id === id ? updated : b))
    return updated
  }, [])

  const deleteBookmark = useCallback(async (id) => {
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }, [])

  const sync = useCallback(async (options = {}) => {
    setSyncing(true)
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    const result = await res.json()
    await fetchAll()
    setSyncing(false)
    return result
  }, [fetchAll])

  return { bookmarks, meta, loading, syncing, updateBookmark, deleteBookmark, sync, refetch: fetchAll }
}
