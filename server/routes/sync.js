import { Router } from 'express'
import { scrapeBookmarks } from '../scraper.js'
import { classifyBatch } from '../classifier.js'
import { upsertBookmarks, readMeta, readBookmarks } from '../data.js'

const router = Router()

router.post('/', async (req, res) => {
  const { range = 'sync', count } = req.body
  const meta = readMeta()
  const knownIds = range === 'sync' ? readBookmarks().map(b => b.id) : []

  try {
    const scraped = await scrapeBookmarks({ range, count, lastSyncedAt: meta.lastSyncedAt, knownIds })

    if (scraped.length === 0) {
      return res.json({ newBookmarks: 0, totalScraped: 0 })
    }

    const classified = await classifyBatch(scraped, meta.categories || [])
    const classifiedById = Object.fromEntries(classified.map(c => [c.id, c]))

    const enriched = scraped.map(b => ({
      ...b,
      category: classifiedById[b.id]?.category || 'Uncategorized',
      subcategory: classifiedById[b.id]?.subcategory ?? null,
      tags: classifiedById[b.id]?.tags || [],
      aiSuggestedTags: classifiedById[b.id]?.tags || [],
    }))

    const newCount = upsertBookmarks(enriched)
    res.json({ newBookmarks: newCount, totalScraped: scraped.length })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
