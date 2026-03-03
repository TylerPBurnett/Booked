import { Router } from 'express'
import {
  readMeta, writeMeta, readBookmarks, writeBookmarks,
  addCategory, removeCategory, renameCategory,
} from '../data.js'

const router = Router()

// GET /api/categories — tree with per-node bookmark counts
router.get('/', (req, res) => {
  const meta = readMeta()
  const bookmarks = readBookmarks()

  const countFor = (name) => bookmarks.filter(b => !b.archived && b.category === name).length
  const countSub = (parent, sub) =>
    bookmarks.filter(b => !b.archived && b.category === parent && b.subcategory === sub).length

  const tree = meta.categories.map(cat => ({
    name: cat.name,
    count: countFor(cat.name),
    children: cat.children.map(sub => ({ name: sub, count: countSub(cat.name, sub) })),
  }))

  res.json(tree)
})

// POST /api/categories — create top-level or subcategory
router.post('/', (req, res) => {
  const { name, parent } = req.body
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' })
  }

  let meta = readMeta()
  try {
    meta = addCategory(meta, name.trim(), parent || null)
  } catch (err) {
    return res.status(409).json({ error: err.message })
  }

  writeMeta(meta)
  res.status(201).json({ name: name.trim(), parent: parent || null, children: [] })
})

// PATCH /api/categories/:name — rename (cascades to bookmarks)
router.patch('/:name', (req, res) => {
  const oldName = req.params.name
  const { name: newName, parent } = req.body

  if (!newName) return res.status(400).json({ error: 'name is required' })

  let meta = readMeta()
  try {
    meta = renameCategory(meta, oldName, newName.trim(), parent || null)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // Cascade to bookmarks
  const bookmarks = readBookmarks()
  if (parent) {
    bookmarks.forEach(b => {
      if (b.category === parent && b.subcategory === oldName) b.subcategory = newName.trim()
    })
  } else {
    bookmarks.forEach(b => { if (b.category === oldName) b.category = newName.trim() })
  }

  writeMeta(meta)
  writeBookmarks(bookmarks)
  res.json({ name: newName.trim(), parent: parent || null })
})

// DELETE /api/categories/:name — delete (cascades bookmarks)
router.delete('/:name', (req, res) => {
  const { name } = req.params
  const { parent } = req.query // pass ?parent=Dev when deleting a subcategory

  let meta = readMeta()
  try {
    meta = removeCategory(meta, name, parent || null)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // Cascade bookmarks
  const bookmarks = readBookmarks()
  if (parent) {
    bookmarks.forEach(b => {
      if (b.category === parent && b.subcategory === name) b.subcategory = null
    })
  } else {
    bookmarks.forEach(b => {
      if (b.category === name) { b.category = 'Uncategorized'; b.subcategory = null }
    })
  }

  writeMeta(meta)
  writeBookmarks(bookmarks)
  res.json({ ok: true })
})

export default router
