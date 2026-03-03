import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bookmarksRouter from './routes/bookmarks.js'
import metaRouter from './routes/meta.js'
import syncRouter from './routes/sync.js'
import categoriesRouter from './routes/categories.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3333

app.use(cors())
app.use(express.json())

app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/meta', metaRouter)
app.use('/api/sync', syncRouter)
app.use('/api/categories', categoriesRouter)

// Serve compiled client in production
const clientDist = join(__dirname, '..', 'client', 'dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'))
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Booked running at http://localhost:${PORT}`))
}

export default app
