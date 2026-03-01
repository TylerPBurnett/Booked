import { Router } from 'express'
import { readMeta, writeMeta, readBookmarks, writeBookmarks } from '../data.js'

const router = Router()

router.get('/', (req, res) => res.json(readMeta()))

router.patch('/', (req, res) => {
  const meta = readMeta()
  if (req.body.categories) meta.categories = req.body.categories
  writeMeta(meta)
  res.json(meta)
})

router.post('/tags/rename', (req, res) => {
  const { from, to } = req.body
  if (!from || !to) return res.status(400).json({ error: 'from and to required' })
  const bookmarks = readBookmarks()
  bookmarks.forEach(b => {
    b.tags = b.tags.map(t => t === from ? to : t)
    b.aiSuggestedTags = b.aiSuggestedTags.map(t => t === from ? to : t)
  })
  writeBookmarks(bookmarks)
  res.json({ ok: true })
})

router.post('/tags/delete', (req, res) => {
  const { tag } = req.body
  if (!tag) return res.status(400).json({ error: 'tag required' })
  const bookmarks = readBookmarks()
  bookmarks.forEach(b => {
    b.tags = b.tags.filter(t => t !== tag)
    b.aiSuggestedTags = b.aiSuggestedTags.filter(t => t !== tag)
  })
  writeBookmarks(bookmarks)
  res.json({ ok: true })
})

export default router
