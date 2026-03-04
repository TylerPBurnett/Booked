import { useState, useEffect, useCallback } from 'react'

export function useCategories() {
  const [categories, setCategories] = useState([])

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/categories')
    if (res.ok) setCategories(await res.json())
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const createCategory = useCallback(async (name, parent = null) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const renameCategory = useCallback(async (name, newName, parent = null) => {
    const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, parent }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const deleteCategory = useCallback(async (name, parent = null) => {
    const url = parent
      ? `/api/categories/${encodeURIComponent(name)}?parent=${encodeURIComponent(parent)}`
      : `/api/categories/${encodeURIComponent(name)}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const updateCategory = useCallback(async (name, patch) => {
    const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const reorderCategories = useCallback(async (nameOrder) => {
    // Optimistic update — reorder local state immediately
    setCategories(prev => {
      const byName = Object.fromEntries(prev.map(c => [c.name, c]))
      return nameOrder.map(n => byName[n]).filter(Boolean)
    })

    const res = await fetch('/api/categories/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: nameOrder }),
    })
    if (!res.ok) {
      // Revert on failure
      await fetch_()
      throw new Error((await res.json()).error)
    }
  }, [fetch_])

  return { categories, createCategory, renameCategory, updateCategory, deleteCategory, reorderCategories, refetch: fetch_ }
}
