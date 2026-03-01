import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
  // Scraper wired in Task 11. Stub response for now.
  res.json({ newBookmarks: 0, totalScraped: 0, message: 'Scraper not yet wired' })
})

export default router
