import { Router } from 'express'
import {
  readMeta, writeMeta, readBookmarks, writeBookmarks,
  addCategory, removeCategory, renameCategory, reorderCategories,
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
    icon: cat.icon ?? null,
    color: cat.color ?? null,
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

// PATCH /api/categories/:name — rename (cascades to bookmarks) or update icon/color
router.patch('/:name', (req, res) => {
  const oldName = req.params.name
  const { name: newName, parent, icon, color } = req.body

  // If only icon/color update (no rename), skip cascade
  if ((icon !== undefined || color !== undefined) && (!newName || newName === oldName)) {
    const meta = readMeta()
    const cat = meta.categories.find(c => c.name === oldName)
    if (!cat) return res.status(404).json({ error: 'Category not found' })
    if (icon !== undefined) cat.icon = icon
    if (color !== undefined) cat.color = color
    writeMeta(meta)
    return res.json({ ok: true })
  }

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

// PUT /api/categories/reorder — reorder top-level categories
router.put('/reorder', (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of category names' })
  }

  let meta = readMeta()
  try {
    meta = reorderCategories(meta, order)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  writeMeta(meta)
  res.json({ ok: true })
})

export default router
