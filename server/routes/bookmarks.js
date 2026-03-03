import { Router } from 'express'
import { readBookmarks, writeBookmarks } from '../data.js'

const router = Router()

router.get('/', (req, res) => {
  let bookmarks = readBookmarks()
  const { category, tag, archived } = req.query

  if (archived !== 'true') bookmarks = bookmarks.filter(b => !b.archived)
  if (category && category !== 'All') bookmarks = bookmarks.filter(b => b.category === category)
  if (tag) bookmarks = bookmarks.filter(b => b.tags.includes(tag))

  const sort = req.query.sort || 'bookmarkedAt_desc'
  const lastUnderscore = sort.lastIndexOf('_')
  const field = sort.slice(0, lastUnderscore)
  const dir = sort.slice(lastUnderscore + 1)

  bookmarks.sort((a, b) => {
    const getVal = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)
    const aVal = getVal(a, field)
    const bVal = getVal(b, field)
    if (typeof aVal === 'string') return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0)
  })

  const limit = parseInt(req.query.limit) || 200
  const offset = parseInt(req.query.offset) || 0
  res.json({ bookmarks: bookmarks.slice(offset, offset + limit), total: bookmarks.length })
})

router.get('/:id', (req, res) => {
  const bookmark = readBookmarks().find(b => b.id === req.params.id)
  if (!bookmark) return res.status(404).json({ error: 'Not found' })
  res.json(bookmark)
})

router.patch('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  const idx = bookmarks.findIndex(b => b.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  const allowed = ['tags', 'category', 'subcategory', 'notes', 'archived']
  for (const key of allowed) {
    if (req.body[key] !== undefined) bookmarks[idx][key] = req.body[key]
  }
  writeBookmarks(bookmarks)
  res.json(bookmarks[idx])
})

router.delete('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  writeBookmarks(bookmarks.filter(b => b.id !== req.params.id))
  res.json({ ok: true })
})

export default router
