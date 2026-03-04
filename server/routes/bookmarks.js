import { Router } from 'express'
import { readBookmarks, writeBookmarks, readMeta } from '../data.js'
import { classifyBatch } from '../classifier.js'

const router = Router()

router.get('/', (req, res) => {
  let bookmarks = readBookmarks()
  const { category, tag, archived } = req.query

  if (archived !== 'true') bookmarks = bookmarks.filter(b => !b.archived)
  if (category && category !== 'All') bookmarks = bookmarks.filter(b => b.category === category)
  if (tag) bookmarks = bookmarks.filter(b => b.tags.includes(tag))

  const sort = req.query.sort || 'savedAt_desc'
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

router.post('/reclassify', async (req, res) => {
  const {
    scope = 'all',
    category = null,
    includeArchived = false,
    limit,
    overwriteTags = false,
  } = req.body || {}

  if (!['all', 'uncategorized', 'category'].includes(scope)) {
    return res.status(400).json({ error: 'scope must be one of: all, uncategorized, category' })
  }

  if (scope === 'category' && (!category || typeof category !== 'string')) {
    return res.status(400).json({ error: 'category is required when scope is "category"' })
  }

  if (limit !== undefined) {
    const parsed = Number(limit)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'limit must be a positive integer' })
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({
      error: 'ANTHROPIC_API_KEY is required for AI reclassification',
    })
  }

  const bookmarks = readBookmarks()
  const meta = readMeta()

  let candidates = bookmarks

  if (!includeArchived) {
    candidates = candidates.filter(b => !b.archived)
  }

  if (scope === 'uncategorized') {
    candidates = candidates.filter(b => b.category === 'Uncategorized')
  } else if (scope === 'category') {
    candidates = candidates.filter(b => b.category === category)
  }

  if (limit !== undefined) {
    candidates = candidates.slice(0, Number(limit))
  }

  if (candidates.length === 0) {
    return res.json({
      processed: 0,
      updated: 0,
      scope,
      category: scope === 'category' ? category : null,
      includeArchived,
      overwriteTags,
    })
  }

  try {
    const classified = await classifyBatch(candidates, meta.categories || [])
    const classifiedById = Object.fromEntries(classified.map(c => [c.id, c]))
    let updated = 0

    for (const bookmark of bookmarks) {
      const ai = classifiedById[bookmark.id]
      if (!ai) continue

      bookmark.category = ai.category || 'Uncategorized'
      bookmark.subcategory = ai.subcategory ?? null
      bookmark.aiSuggestedTags = Array.isArray(ai.tags) ? ai.tags : []

      if (
        overwriteTags ||
        !Array.isArray(bookmark.tags) ||
        bookmark.tags.length === 0
      ) {
        bookmark.tags = Array.isArray(ai.tags) ? ai.tags : []
      }

      updated++
    }

    writeBookmarks(bookmarks)

    res.json({
      processed: candidates.length,
      updated,
      scope,
      category: scope === 'category' ? category : null,
      includeArchived,
      overwriteTags,
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'reclassify failed' })
  }
})

router.delete('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  writeBookmarks(bookmarks.filter(b => b.id !== req.params.id))
  res.json({ ok: true })
})

export default router
