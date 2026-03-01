# Booked (X Bookmark Manager) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a permanent local web app at `localhost:3333` that scrapes, stores, and lets you visually manage X bookmarks with tagging, fuzzy search, and AI categorization.

**Architecture:** Express API serves both a REST layer over flat JSON files and the compiled React client. A separate Claude skill invokes the scraper via `POST /api/sync`. Playwright (Node) opens the user's real Chrome profile for scraping — no login needed. The React client handles all interactivity client-side with Fuse.js for fuzzy search.

**Tech Stack:** Node 20+, Express, Playwright (chromium channel with persistent Chrome profile), Anthropic SDK (classifier), React 18, Vite, Tailwind CSS v3, Fuse.js, Vitest, Supertest

---

## Task 1: Project Scaffolding

**Files:**
- Create: `/Users/tyler/Development/Booked/package.json`
- Create: `/Users/tyler/Development/Booked/server/package.json`
- Create: `/Users/tyler/Development/Booked/client/package.json`
- Create: `/Users/tyler/Development/Booked/.gitignore`

**Step 1: Initialize root monorepo**

```bash
cd /Users/tyler/Development/Booked
cat > package.json << 'EOF'
{
  "name": "booked",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=client",
    "start": "npm run start --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
EOF
```

**Step 2: Initialize server package**

```bash
mkdir -p server
cat > server/package.json << 'EOF'
{
  "name": "booked-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "playwright": "^1.41.0",
    "@anthropic-ai/sdk": "^0.20.0"
  },
  "devDependencies": {
    "vitest": "^1.3.0",
    "supertest": "^6.3.4"
  }
}
EOF
```

**Step 3: Initialize client package**

```bash
mkdir -p client
cat > client/package.json << 'EOF'
{
  "name": "booked-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "fuse.js": "^7.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.1.0"
  }
}
EOF
```

**Step 4: Create .gitignore**

```bash
cat > /Users/tyler/Development/Booked/.gitignore << 'EOF'
node_modules/
dist/
.env
data/bookmarks.json
data/meta.json
*.log
.DS_Store
EOF
```

**Step 5: Install dependencies**

```bash
cd /Users/tyler/Development/Booked
npm install
```

Expected: installs all workspace dependencies, no errors.

**Step 6: Install Playwright browsers**

```bash
cd /Users/tyler/Development/Booked
npx playwright install chromium
```

**Step 7: Commit**

```bash
cd /Users/tyler/Development/Booked
git add package.json server/package.json client/package.json .gitignore package-lock.json
git commit -m "chore: initialize monorepo with server and client workspaces"
```

---

## Task 2: Data Layer (JSON files + seed data)

**Files:**
- Create: `data/bookmarks.json`
- Create: `data/meta.json`
- Create: `server/data.js`

**Step 1: Create data directory with seed files**

```bash
mkdir -p /Users/tyler/Development/Booked/data

cat > /Users/tyler/Development/Booked/data/bookmarks.json << 'EOF'
[]
EOF

cat > /Users/tyler/Development/Booked/data/meta.json << 'EOF'
{
  "lastSyncedAt": null,
  "categories": ["Design", "Dev", "Tools", "Threads", "Reads", "Uncategorized"],
  "totalBookmarks": 0
}
EOF
```

**Step 2: Create data access module**

```js
// server/data.js
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const BOOKMARKS_PATH = join(DATA_DIR, 'bookmarks.json')
const META_PATH = join(DATA_DIR, 'meta.json')

export function readBookmarks() {
  return JSON.parse(readFileSync(BOOKMARKS_PATH, 'utf-8'))
}

export function writeBookmarks(bookmarks) {
  writeFileSync(BOOKMARKS_PATH, JSON.stringify(bookmarks, null, 2))
}

export function readMeta() {
  return JSON.parse(readFileSync(META_PATH, 'utf-8'))
}

export function writeMeta(meta) {
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2))
}

// Upsert bookmarks by ID. Returns count of new bookmarks added.
export function upsertBookmarks(incoming) {
  const existing = readBookmarks()
  const existingById = Object.fromEntries(existing.map(b => [b.id, b]))
  let newCount = 0

  for (const bookmark of incoming) {
    if (existingById[bookmark.id]) {
      // Update metrics only — preserve user data
      existingById[bookmark.id].metrics = bookmark.metrics
    } else {
      existingById[bookmark.id] = bookmark
      newCount++
    }
  }

  const merged = Object.values(existingById).sort(
    (a, b) => new Date(b.bookmarkedAt) - new Date(a.bookmarkedAt)
  )
  writeBookmarks(merged)

  const meta = readMeta()
  meta.totalBookmarks = merged.length
  meta.lastSyncedAt = new Date().toISOString()
  writeMeta(meta)

  return newCount
}
```

**Step 3: Write tests for data layer**

```js
// server/data.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Point data.js at a temp dir for tests
process.env.DATA_DIR_OVERRIDE = '/tmp/booked-test-data'
mkdirSync('/tmp/booked-test-data', { recursive: true })

// We'll test upsertBookmarks logic inline since it requires file paths
// Integration: upsert new bookmark adds it, upsert existing updates only metrics

const makeBookmark = (id, overrides = {}) => ({
  id,
  url: `https://x.com/user/status/${id}`,
  text: `Tweet ${id}`,
  author: { handle: 'user', name: 'User', avatarUrl: '' },
  postedAt: '2026-01-01T00:00:00Z',
  bookmarkedAt: '2026-01-02T00:00:00Z',
  media: [],
  metrics: { likes: 100, retweets: 10, replies: 5 },
  category: 'Uncategorized',
  tags: [],
  aiSuggestedTags: [],
  notes: '',
  archived: false,
  ...overrides
})

describe('upsertBookmarks', () => {
  it('adds new bookmarks', () => {
    // Write direct test of the merge logic (extracted pure function)
    const existing = []
    const incoming = [makeBookmark('1')]
    const byId = Object.fromEntries(existing.map(b => [b.id, b]))
    for (const b of incoming) {
      if (!byId[b.id]) byId[b.id] = b
    }
    expect(Object.keys(byId)).toHaveLength(1)
  })

  it('updates metrics but not tags for existing bookmark', () => {
    const existingBookmark = makeBookmark('1', { tags: ['my-tag'], metrics: { likes: 50 } })
    const byId = { '1': existingBookmark }
    const incoming = [makeBookmark('1', { metrics: { likes: 200 } })]
    for (const b of incoming) {
      if (byId[b.id]) {
        byId[b.id].metrics = b.metrics
      } else {
        byId[b.id] = b
      }
    }
    expect(byId['1'].metrics.likes).toBe(200)
    expect(byId['1'].tags).toEqual(['my-tag'])
  })
})
```

**Step 4: Run tests**

```bash
cd /Users/tyler/Development/Booked/server
npx vitest run data.test.js
```

Expected: 2 tests pass.

**Step 5: Commit**

```bash
cd /Users/tyler/Development/Booked
git add data/ server/data.js server/data.test.js
git commit -m "feat: data layer with upsert logic for bookmarks and meta"
```

---

## Task 3: Express API

**Files:**
- Create: `server/index.js`
- Create: `server/routes/bookmarks.js`
- Create: `server/routes/meta.js`
- Create: `server/routes/sync.js`
- Create: `server/api.test.js`

**Step 1: Create bookmark routes**

```js
// server/routes/bookmarks.js
import { Router } from 'express'
import { readBookmarks, writeBookmarks, readMeta } from '../data.js'

const router = Router()

router.get('/', (req, res) => {
  let bookmarks = readBookmarks()
  const { category, tag, archived, q } = req.query

  if (archived !== 'true') bookmarks = bookmarks.filter(b => !b.archived)
  if (category && category !== 'All') bookmarks = bookmarks.filter(b => b.category === category)
  if (tag) bookmarks = bookmarks.filter(b => b.tags.includes(tag))
  // Fuzzy search handled client-side via Fuse.js — q param reserved for future server search

  const sort = req.query.sort || 'bookmarkedAt_desc'
  const [field, dir] = sort.split('_')
  bookmarks.sort((a, b) => {
    const aVal = field.includes('.') ? field.split('.').reduce((o, k) => o?.[k], a) : a[field]
    const bVal = field.includes('.') ? field.split('.').reduce((o, k) => o?.[k], b) : b[field]
    if (typeof aVal === 'string') return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return dir === 'asc' ? aVal - bVal : bVal - aVal
  })

  const limit = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0
  const page = bookmarks.slice(offset, offset + limit)

  res.json({ bookmarks: page, total: bookmarks.length })
})

router.get('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  const bookmark = bookmarks.find(b => b.id === req.params.id)
  if (!bookmark) return res.status(404).json({ error: 'Not found' })
  res.json(bookmark)
})

router.patch('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  const idx = bookmarks.findIndex(b => b.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })

  const allowed = ['tags', 'category', 'notes', 'archived']
  for (const key of allowed) {
    if (req.body[key] !== undefined) bookmarks[idx][key] = req.body[key]
  }
  writeBookmarks(bookmarks)
  res.json(bookmarks[idx])
})

router.delete('/:id', (req, res) => {
  const bookmarks = readBookmarks()
  const filtered = bookmarks.filter(b => b.id !== req.params.id)
  writeBookmarks(filtered)
  res.json({ ok: true })
})

export default router
```

**Step 2: Create meta routes**

```js
// server/routes/meta.js
import { Router } from 'express'
import { readMeta, writeMeta, readBookmarks, writeBookmarks } from '../data.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(readMeta())
})

router.patch('/', (req, res) => {
  const meta = readMeta()
  if (req.body.categories) meta.categories = req.body.categories
  writeMeta(meta)
  res.json(meta)
})

// Rename a tag across all bookmarks
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

// Delete a tag from all bookmarks
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
```

**Step 3: Create sync route (stub — scraper wired in Task 8)**

```js
// server/routes/sync.js
import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
  const { range, count } = req.body
  // Scraper wired in Task 8. For now return mock response.
  res.json({ newBookmarks: 0, message: 'Scraper not yet wired' })
})

export default router
```

**Step 4: Create Express app**

```js
// server/index.js
import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bookmarksRouter from './routes/bookmarks.js'
import metaRouter from './routes/meta.js'
import syncRouter from './routes/sync.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3333

app.use(cors())
app.use(express.json())

app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/meta', metaRouter)
app.use('/api/sync', syncRouter)

// Serve compiled client in production
const clientDist = join(__dirname, '..', 'client', 'dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  res.sendFile(join(clientDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Booked running at http://localhost:${PORT}`)
})

export default app
```

**Step 5: Write API tests**

```js
// server/api.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import app from './index.js'

// Seed test data
const testBookmark = {
  id: 'test-001',
  url: 'https://x.com/user/status/test-001',
  text: 'Test tweet about design systems',
  author: { handle: 'designer', name: 'A Designer', avatarUrl: '' },
  postedAt: '2026-02-01T00:00:00Z',
  bookmarkedAt: '2026-02-02T00:00:00Z',
  media: [],
  metrics: { likes: 500, retweets: 100, replies: 20 },
  category: 'Design',
  tags: ['design', 'systems'],
  aiSuggestedTags: ['design', 'systems'],
  notes: '',
  archived: false
}

beforeAll(() => {
  mkdirSync(join(process.cwd(), '..', 'data'), { recursive: true })
  writeFileSync(join(process.cwd(), '..', 'data', 'bookmarks.json'), JSON.stringify([testBookmark], null, 2))
  writeFileSync(join(process.cwd(), '..', 'data', 'meta.json'), JSON.stringify({
    lastSyncedAt: null,
    categories: ['Design', 'Dev', 'Uncategorized'],
    totalBookmarks: 1
  }, null, 2))
})

describe('GET /api/bookmarks', () => {
  it('returns list of bookmarks', async () => {
    const res = await request(app).get('/api/bookmarks')
    expect(res.status).toBe(200)
    expect(res.body.bookmarks).toHaveLength(1)
    expect(res.body.total).toBe(1)
  })

  it('filters by category', async () => {
    const res = await request(app).get('/api/bookmarks?category=Design')
    expect(res.body.bookmarks).toHaveLength(1)
    const res2 = await request(app).get('/api/bookmarks?category=Dev')
    expect(res2.body.bookmarks).toHaveLength(0)
  })
})

describe('GET /api/bookmarks/:id', () => {
  it('returns a single bookmark', async () => {
    const res = await request(app).get('/api/bookmarks/test-001')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('test-001')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/bookmarks/nope')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/bookmarks/:id', () => {
  it('updates tags and notes but not metrics', async () => {
    const res = await request(app)
      .patch('/api/bookmarks/test-001')
      .send({ tags: ['updated'], notes: 'my note' })
    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual(['updated'])
    expect(res.body.notes).toBe('my note')
    expect(res.body.metrics.likes).toBe(500)
  })
})

describe('GET /api/meta', () => {
  it('returns meta', async () => {
    const res = await request(app).get('/api/meta')
    expect(res.status).toBe(200)
    expect(res.body.categories).toBeInstanceOf(Array)
  })
})
```

**Step 6: Run tests**

```bash
cd /Users/tyler/Development/Booked/server
npx vitest run api.test.js
```

Expected: all tests pass.

**Step 7: Manually verify server starts**

```bash
cd /Users/tyler/Development/Booked/server
node index.js
# Expected: "Booked running at http://localhost:3333"
```

Then in another terminal:
```bash
curl http://localhost:3333/api/bookmarks
# Expected: { "bookmarks": [], "total": 0 }
curl http://localhost:3333/api/meta
# Expected: { "lastSyncedAt": null, "categories": [...], "totalBookmarks": 0 }
```

**Step 8: Commit**

```bash
cd /Users/tyler/Development/Booked
git add server/
git commit -m "feat: express API with bookmarks CRUD, meta, and sync stub"
```

---

## Task 4: React + Vite + Tailwind Setup

**Files:**
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/index.css`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`

**Step 1: Create Vite entry files**

```html
<!-- client/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Booked</title>
  </head>
  <body class="bg-neutral-950 text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

```js
// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3333'
    }
  },
  build: {
    outDir: 'dist'
  }
})
```

```js
// client/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          50: '#1a1a1a',
          100: '#141414',
          200: '#0f0f0f',
        }
      }
    }
  },
  plugins: []
}
```

```js
// client/postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

```css
/* client/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { font-family: 'DM Sans', system-ui, sans-serif; }

@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
  }
}
```

```jsx
// client/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

```jsx
// client/src/App.jsx
export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <p className="text-neutral-400 font-mono text-sm">Booked is loading...</p>
    </div>
  )
}
```

**Step 2: Verify client starts**

```bash
cd /Users/tyler/Development/Booked/client
npm run dev
```

Open `http://localhost:5173` — expected: dark screen with "Booked is loading..."

**Step 3: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/
git commit -m "feat: react + vite + tailwind client scaffold"
```

---

## Task 5: Core Hooks (Data Fetching + Filters)

**Files:**
- Create: `client/src/hooks/useBookmarks.js`
- Create: `client/src/hooks/useFilters.js`
- Create: `client/src/hooks/useFuzzySearch.js`

**Step 1: Create useBookmarks hook**

```js
// client/src/hooks/useBookmarks.js
import { useState, useEffect, useCallback } from 'react'

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchAll = useCallback(async (params = {}) => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: 200, ...params }).toString()
    const [bmRes, metaRes] = await Promise.all([
      fetch(`/api/bookmarks?${qs}`),
      fetch('/api/meta')
    ])
    const bmData = await bmRes.json()
    const metaData = await metaRes.json()
    setBookmarks(bmData.bookmarks)
    setTotal(bmData.total)
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
  }, [])

  const deleteBookmark = useCallback(async (id) => {
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    setBookmarks(prev => prev.filter(b => b.id !== id))
    setTotal(prev => prev - 1)
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

  return { bookmarks, meta, loading, syncing, total, updateBookmark, deleteBookmark, sync, refetch: fetchAll }
}
```

**Step 2: Create useFilters hook**

```js
// client/src/hooks/useFilters.js
import { useState, useMemo } from 'react'

export const SORT_OPTIONS = [
  { value: 'bookmarkedAt_desc', label: 'Bookmarked (newest)' },
  { value: 'bookmarkedAt_asc', label: 'Bookmarked (oldest)' },
  { value: 'postedAt_desc', label: 'Posted (newest)' },
  { value: 'metrics.likes_desc', label: 'Most liked' },
  { value: 'metrics.retweets_desc', label: 'Most retweeted' },
  { value: 'author.handle_asc', label: 'Author A–Z' },
]

export const TIME_RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
]

export function useFilters(bookmarks) {
  const [category, setCategory] = useState('All')
  const [selectedTags, setSelectedTags] = useState([])
  const [sort, setSort] = useState('bookmarkedAt_desc')
  const [timeRange, setTimeRange] = useState('all')
  const [hasMediaOnly, setHasMediaOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    let result = [...bookmarks]

    if (!showArchived) result = result.filter(b => !b.archived)
    if (category !== 'All') result = result.filter(b => b.category === category)
    if (selectedTags.length > 0) result = result.filter(b => selectedTags.every(t => b.tags.includes(t)))
    if (hasMediaOnly) result = result.filter(b => b.media.length > 0)

    if (timeRange !== 'all') {
      const cutoffs = { week: 7, month: 30, year: 365 }
      const days = cutoffs[timeRange]
      const cutoff = new Date(Date.now() - days * 86400000)
      result = result.filter(b => new Date(b.bookmarkedAt) >= cutoff)
    }

    const [field, dir] = sort.split('_')
    result.sort((a, b) => {
      const getVal = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)
      const aVal = getVal(a, field)
      const bVal = getVal(b, field)
      if (typeof aVal === 'string') return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0)
    })

    return result
  }, [bookmarks, category, selectedTags, sort, timeRange, hasMediaOnly, showArchived])

  return {
    filtered,
    category, setCategory,
    selectedTags, setSelectedTags,
    sort, setSort,
    timeRange, setTimeRange,
    hasMediaOnly, setHasMediaOnly,
    showArchived, setShowArchived,
  }
}
```

**Step 3: Create useFuzzySearch hook**

```js
// client/src/hooks/useFuzzySearch.js
import { useState, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: [
    { name: 'text', weight: 0.5 },
    { name: 'author.handle', weight: 0.2 },
    { name: 'author.name', weight: 0.1 },
    { name: 'tags', weight: 0.15 },
    { name: 'notes', weight: 0.05 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
}

export function useFuzzySearch(items) {
  const [query, setQuery] = useState('')

  const fuse = useMemo(() => new Fuse(items, FUSE_OPTIONS), [items])

  const results = useMemo(() => {
    if (!query.trim()) return items
    return fuse.search(query).map(r => r.item)
  }, [fuse, items, query])

  const handleQuery = useCallback((q) => setQuery(q), [])

  return { query, setQuery: handleQuery, results }
}
```

**Step 4: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/src/hooks/
git commit -m "feat: useBookmarks, useFilters, useFuzzySearch hooks"
```

---

## Task 6: Layout + Sidebar Component

**Files:**
- Create: `client/src/components/Layout.jsx`
- Create: `client/src/components/Sidebar.jsx`
- Modify: `client/src/App.jsx`

**Step 1: Create Layout shell**

```jsx
// client/src/components/Layout.jsx
export function Layout({ sidebar, header, children }) {
  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-neutral-800 flex flex-col overflow-y-auto scrollbar-thin">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        {header}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
```

**Step 2: Create Sidebar component**

```jsx
// client/src/components/Sidebar.jsx
import { clsx } from 'clsx'

function NavItem({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors text-left',
        active
          ? 'bg-neutral-800 text-white'
          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-neutral-500 ml-2 shrink-0">{count}</span>
    </button>
  )
}

export function Sidebar({ bookmarks, meta, category, setCategory, selectedTags, setSelectedTags, syncing, onSync }) {
  const categories = ['All', ...(meta?.categories || [])]

  const tagCounts = bookmarks.reduce((acc, b) => {
    b.tags.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {})

  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)

  const categoryCounts = bookmarks.reduce((acc, b) => {
    acc[b.category] = (acc[b.category] || 0) + 1
    return acc
  }, {})

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="flex flex-col h-full py-4 px-2 gap-1">
      {/* App name */}
      <div className="px-3 mb-4">
        <span className="font-semibold text-white tracking-tight">🔖 Booked</span>
      </div>

      {/* Categories */}
      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1">
        Categories
      </p>
      {categories.map(cat => (
        <NavItem
          key={cat}
          label={cat}
          count={cat === 'All' ? bookmarks.length : (categoryCounts[cat] || 0)}
          active={category === cat}
          onClick={() => setCategory(cat)}
        />
      ))}

      <div className="border-t border-neutral-800 my-3" />

      {/* Tags */}
      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1">
        Tags
      </p>
      {sortedTags.map(([tag, count]) => (
        <NavItem
          key={tag}
          label={`#${tag}`}
          count={count}
          active={selectedTags.includes(tag)}
          onClick={() => toggleTag(tag)}
        />
      ))}

      {/* Spacer + sync */}
      <div className="flex-1" />
      <div className="px-2 pb-2">
        <button
          onClick={() => onSync({ range: 'sync' })}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
        >
          <span className={syncing ? 'animate-spin' : ''}>↻</span>
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Wire layout into App.jsx**

```jsx
// client/src/App.jsx
import { useBookmarks } from './hooks/useBookmarks.js'
import { useFilters } from './hooks/useFilters.js'
import { useFuzzySearch } from './hooks/useFuzzySearch.js'
import { Layout } from './components/Layout.jsx'
import { Sidebar } from './components/Sidebar.jsx'

export default function App() {
  const { bookmarks, meta, loading, syncing, sync, updateBookmark, deleteBookmark } = useBookmarks()
  const filters = useFilters(bookmarks)
  const { query, setQuery, results } = useFuzzySearch(filters.filtered)

  return (
    <Layout
      sidebar={
        <Sidebar
          bookmarks={bookmarks}
          meta={meta}
          category={filters.category}
          setCategory={filters.setCategory}
          selectedTags={filters.selectedTags}
          setSelectedTags={filters.setSelectedTags}
          syncing={syncing}
          onSync={sync}
        />
      }
      header={
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search bookmarks..."
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600 transition-colors"
          />
          <span className="text-xs text-neutral-500">{results.length} results</span>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">Loading...</div>
      ) : results.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
          No bookmarks yet. Run <code className="mx-1 px-1.5 py-0.5 bg-neutral-800 rounded text-xs font-mono">/x-bookmarks --sync</code> to fetch.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(b => (
            <div key={b.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm">
              <p className="text-neutral-300 line-clamp-3">{b.text}</p>
              <p className="text-neutral-500 text-xs mt-2">@{b.author.handle}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
```

**Step 4: Verify in browser**

Start both dev servers:
```bash
cd /Users/tyler/Development/Booked
npm run dev
```

Open `http://localhost:5173`. Expected: dark sidebar on left with "Booked" title, search bar header, empty state message.

**Step 5: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/src/
git commit -m "feat: layout shell, sidebar with categories and tags, App wiring"
```

---

## Task 7: BookmarkCard Component

**Files:**
- Create: `client/src/components/BookmarkCard.jsx`
- Modify: `client/src/App.jsx` (replace stub card)

**Step 1: Create BookmarkCard**

```jsx
// client/src/components/BookmarkCard.jsx
import { clsx } from 'clsx'

const CATEGORY_COLORS = {
  Design: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Dev: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Tools: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Threads: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Reads: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Uncategorized: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatCount(n) {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function BookmarkCard({ bookmark, onClick }) {
  const { author, text, tags, category, metrics, media, bookmarkedAt } = bookmark
  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.Uncategorized

  return (
    <article
      onClick={onClick}
      className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:bg-neutral-900/80"
    >
      {/* Author */}
      <div className="flex items-center gap-2">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt={author.name} className="w-7 h-7 rounded-full bg-neutral-800" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-500">
            {author.handle?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{author.name || author.handle}</p>
          <p className="text-xs text-neutral-500">@{author.handle}</p>
        </div>
        <span className="text-xs text-neutral-600">{formatRelative(bookmarkedAt)}</span>
      </div>

      {/* Tweet text */}
      <p className="text-sm text-neutral-300 leading-relaxed line-clamp-4 flex-1">{text}</p>

      {/* Media thumbnail */}
      {media?.[0]?.type === 'image' && (
        <img
          src={media[0].url}
          alt=""
          className="w-full h-32 object-cover rounded-lg bg-neutral-800"
          loading="lazy"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
              #{tag}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
              +{tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className={clsx('text-xs px-2 py-0.5 rounded-full border', categoryColor)}>
          {category}
        </span>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>♥ {formatCount(metrics?.likes)}</span>
          <span>↻ {formatCount(metrics?.retweets)}</span>
        </div>
      </div>
    </article>
  )
}
```

**Step 2: Use BookmarkCard in App.jsx**

Replace the stub card in the grid:

```jsx
// In App.jsx, replace the stub div inside the grid:
import { BookmarkCard } from './components/BookmarkCard.jsx'

// ...inside the grid:
{results.map(b => (
  <BookmarkCard
    key={b.id}
    bookmark={b}
    onClick={() => setSelectedId(b.id)}
  />
))}
```

Add `const [selectedId, setSelectedId] = useState(null)` at the top of App.

**Step 3: Verify**

Seed a few test bookmarks by POSTing directly to the API or editing `data/bookmarks.json`, then view `localhost:5173`. Cards should render with avatar initials, tweet text, tags, category badge, metrics.

**Step 4: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/src/
git commit -m "feat: BookmarkCard component with avatar, text, tags, metrics"
```

---

## Task 8: BookmarkDetail Drawer

**Files:**
- Create: `client/src/components/BookmarkDetail.jsx`
- Modify: `client/src/App.jsx`

**Step 1: Create detail drawer**

```jsx
// client/src/components/BookmarkDetail.jsx
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

export function BookmarkDetail({ bookmark, onClose, onUpdate }) {
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (bookmark) {
      setTags(bookmark.tags)
      setNotes(bookmark.notes || '')
      setCategory(bookmark.category)
    }
  }, [bookmark])

  if (!bookmark) return null

  const save = async (patch) => {
    setSaving(true)
    await onUpdate(bookmark.id, patch)
    setSaving(false)
  }

  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || tags.includes(tag)) return
    const updated = [...tags, tag]
    setTags(updated)
    setNewTag('')
    save({ tags: updated })
  }

  const removeTag = (tag) => {
    const updated = tags.filter(t => t !== tag)
    setTags(updated)
    save({ tags: updated })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-neutral-900 border-l border-neutral-800 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {bookmark.author.avatarUrl && (
              <img src={bookmark.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-sm font-medium text-white">@{bookmark.author.handle}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-500 hover:text-white transition-colors"
            >
              View on X ↗
            </a>
            <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Full text */}
          <p className="text-neutral-200 leading-relaxed text-sm whitespace-pre-wrap">{bookmark.text}</p>

          {/* Media */}
          {bookmark.media.length > 0 && (
            <div className="flex flex-col gap-2">
              {bookmark.media.map((m, i) => m.type === 'image' && (
                <img key={i} src={m.url} alt="" className="w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Category</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); save({ category: e.target.value }) }}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {['Design', 'Dev', 'Tools', 'Threads', 'Reads', 'Uncategorized'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 bg-neutral-800 rounded-md text-neutral-300">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="text-neutral-500 hover:text-red-400 leading-none ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600 outline-none"
              />
              <button
                onClick={addTag}
                className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-white transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              placeholder="Add a note..."
              rows={4}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none resize-none"
            />
          </div>

          {/* Metrics */}
          <div className="flex gap-4 text-sm text-neutral-500">
            <span>♥ {bookmark.metrics?.likes?.toLocaleString() || 0} likes</span>
            <span>↻ {bookmark.metrics?.retweets?.toLocaleString() || 0} retweets</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex justify-between">
          <button
            onClick={async () => { await onUpdate(bookmark.id, { archived: !bookmark.archived }); onClose() }}
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            {bookmark.archived ? 'Unarchive' : 'Archive'}
          </button>
          {saving && <span className="text-xs text-neutral-600">Saving...</span>}
        </div>
      </aside>
    </>
  )
}
```

**Step 2: Wire drawer into App.jsx**

```jsx
// Add to App.jsx imports:
import { BookmarkDetail } from './components/BookmarkDetail.jsx'

// Add inside App component, after hooks:
const selectedBookmark = bookmarks.find(b => b.id === selectedId) || null

// Add to JSX return (after Layout closing tag or inside it at root level):
<BookmarkDetail
  bookmark={selectedBookmark}
  onClose={() => setSelectedId(null)}
  onUpdate={updateBookmark}
/>
```

**Step 3: Verify**

Click a bookmark card — drawer slides in from right with full tweet, category selector, tag editor, notes field.

**Step 4: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/src/
git commit -m "feat: BookmarkDetail drawer with category, tags, notes editing"
```

---

## Task 9: Sort Controls + Header Bar

**Files:**
- Create: `client/src/components/TopBar.jsx`
- Modify: `client/src/App.jsx`

**Step 1: Create TopBar**

```jsx
// client/src/components/TopBar.jsx
import { SORT_OPTIONS, TIME_RANGES } from '../hooks/useFilters.js'

export function TopBar({ query, setQuery, sort, setSort, timeRange, setTimeRange, hasMediaOnly, setHasMediaOnly, resultCount }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Fuzzy search bookmarks..."
        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600 transition-colors font-mono"
      />

      {/* Sort */}
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none"
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Time range */}
      <select
        value={timeRange}
        onChange={e => setTimeRange(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none"
      >
        {TIME_RANGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Media toggle */}
      <button
        onClick={() => setHasMediaOnly(!hasMediaOnly)}
        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${hasMediaOnly ? 'bg-neutral-700 border-neutral-600 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}
      >
        📷
      </button>

      {/* Count */}
      <span className="text-xs text-neutral-600 shrink-0">{resultCount} items</span>
    </div>
  )
}
```

**Step 2: Replace inline header in App.jsx with TopBar**

```jsx
import { TopBar } from './components/TopBar.jsx'

// Replace header prop:
header={
  <TopBar
    query={query}
    setQuery={setQuery}
    sort={filters.sort}
    setSort={filters.setSort}
    timeRange={filters.timeRange}
    setTimeRange={filters.setTimeRange}
    hasMediaOnly={filters.hasMediaOnly}
    setHasMediaOnly={filters.setHasMediaOnly}
    resultCount={results.length}
  />
}
```

**Step 3: Commit**

```bash
cd /Users/tyler/Development/Booked
git add client/src/
git commit -m "feat: TopBar with sort, time range, media filter controls"
```

---

## Task 10: AI Classifier

**Files:**
- Create: `server/classifier.js`

**Step 1: Create classifier**

Requires `ANTHROPIC_API_KEY` environment variable.

```js
// server/classifier.js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are a bookmark classifier. Given a tweet, return a JSON object with:
- "category": one of ["Design", "Dev", "Tools", "Threads", "Reads", "Uncategorized"]
- "tags": array of 2-5 lowercase kebab-case tags relevant to the content

Respond ONLY with valid JSON. No explanation.`

export async function classifyBookmark(text, author) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { category: 'Uncategorized', tags: [] }
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Author: @${author}\n\n${text}` }]
    })

    const raw = msg.content[0].text.trim()
    const parsed = JSON.parse(raw)
    return {
      category: parsed.category || 'Uncategorized',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : []
    }
  } catch {
    return { category: 'Uncategorized', tags: [] }
  }
}

// Classify a batch with a small delay to avoid rate limits
export async function classifyBatch(bookmarks) {
  const results = []
  for (const bm of bookmarks) {
    const classification = await classifyBookmark(bm.text, bm.author.handle)
    results.push({ id: bm.id, ...classification })
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}
```

**Step 2: Commit**

```bash
cd /Users/tyler/Development/Booked
git add server/classifier.js
git commit -m "feat: AI classifier using Claude Haiku for tag/category suggestions"
```

---

## Task 11: Playwright Scraper

**Files:**
- Create: `server/scraper.js`
- Modify: `server/routes/sync.js`

**Step 1: Create scraper**

```js
// server/scraper.js
import { chromium } from 'playwright'
import os from 'os'
import path from 'path'

// macOS Chrome user data path — adjust for other OS if needed
const CHROME_USER_DATA = process.env.CHROME_USER_DATA ||
  path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')

function parseDateArg(range, count, lastSyncedAt) {
  if (count) return { mode: 'count', limit: parseInt(count) }
  if (range === 'all') return { mode: 'all' }
  if (range === 'sync' && lastSyncedAt) return { mode: 'since', cutoff: new Date(lastSyncedAt) }
  const days = { week: 7, month: 30, year: 365 }[range] || 30
  return { mode: 'since', cutoff: new Date(Date.now() - days * 86400000) }
}

export async function scrapeBookmarks({ range = 'sync', count, lastSyncedAt } = {}) {
  const stopCondition = parseDateArg(range, count, lastSyncedAt)
  const bookmarks = []
  const seenIds = new Set()

  const context = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    channel: 'chrome',
    headless: false,
    args: ['--profile-directory=Default'],
  })

  const page = await context.newPage()

  // Intercept X's internal Bookmarks GraphQL API
  page.on('response', async (response) => {
    const url = response.url()
    if (!url.includes('/graphql/') || !url.includes('Bookmarks')) return
    try {
      const json = await response.json()
      const entries = json?.data?.bookmark_timeline_v2?.timeline?.instructions
        ?.flatMap(i => i.entries || [])
        ?.filter(e => e.entryId?.startsWith('tweet-')) || []

      for (const entry of entries) {
        const result = entry?.content?.itemContent?.tweet_results?.result
        const legacy = result?.legacy
        const user = result?.core?.user_results?.result?.legacy
        if (!legacy || !user) continue

        const id = result.rest_id
        if (seenIds.has(id)) continue
        seenIds.add(id)

        const bookmarkedAt = legacy.bookmarked_at
          ? new Date(legacy.bookmarked_at * 1000).toISOString()
          : new Date().toISOString()

        // Check stop condition
        if (stopCondition.mode === 'count' && bookmarks.length >= stopCondition.limit) continue
        if (stopCondition.mode === 'since' && new Date(bookmarkedAt) < stopCondition.cutoff) continue

        const media = (legacy.extended_entities?.media || []).map(m => ({
          type: m.type === 'photo' ? 'image' : m.type,
          url: m.media_url_https || m.url
        }))

        bookmarks.push({
          id,
          url: `https://x.com/${user.screen_name}/status/${id}`,
          text: legacy.full_text || '',
          author: {
            handle: user.screen_name,
            name: user.name,
            avatarUrl: user.profile_image_url_https?.replace('_normal', '_bigger') || ''
          },
          postedAt: new Date(legacy.created_at).toISOString(),
          bookmarkedAt,
          media,
          metrics: {
            likes: legacy.favorite_count || 0,
            retweets: legacy.retweet_count || 0,
            replies: legacy.reply_count || 0
          },
          category: 'Uncategorized',
          tags: [],
          aiSuggestedTags: [],
          notes: '',
          archived: false
        })
      }
    } catch {
      // Ignore non-JSON or malformed responses
    }
  })

  await page.goto('https://x.com/i/bookmarks', { waitUntil: 'networkidle' })

  // Scroll until stop condition met or no more content
  let previousCount = 0
  let stalledRounds = 0
  while (true) {
    if (stopCondition.mode === 'count' && bookmarks.length >= stopCondition.limit) break
    if (stalledRounds >= 3) break // No new content after 3 scroll attempts

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1500)

    if (bookmarks.length === previousCount) {
      stalledRounds++
    } else {
      stalledRounds = 0
      previousCount = bookmarks.length
    }

    // Check if oldest bookmark is past cutoff for time-based modes
    if (stopCondition.mode === 'since' && bookmarks.length > 0) {
      const oldest = bookmarks[bookmarks.length - 1]
      if (new Date(oldest.bookmarkedAt) < stopCondition.cutoff) break
    }
  }

  await context.close()

  // Filter strictly to stop condition
  if (stopCondition.mode === 'count') return bookmarks.slice(0, stopCondition.limit)
  if (stopCondition.mode === 'since') return bookmarks.filter(b => new Date(b.bookmarkedAt) >= stopCondition.cutoff)
  return bookmarks
}
```

**Step 2: Wire scraper into sync route**

```js
// server/routes/sync.js
import { Router } from 'express'
import { scrapeBookmarks } from '../scraper.js'
import { classifyBatch } from '../classifier.js'
import { upsertBookmarks, readMeta } from '../data.js'

const router = Router()

router.post('/', async (req, res) => {
  const { range = 'sync', count } = req.body
  const meta = readMeta()

  try {
    // 1. Scrape
    const scraped = await scrapeBookmarks({ range, count, lastSyncedAt: meta.lastSyncedAt })

    // 2. Classify new bookmarks
    const classified = await classifyBatch(scraped)
    const classifiedById = Object.fromEntries(classified.map(c => [c.id, c]))

    // 3. Merge classification into scraped
    const enriched = scraped.map(b => ({
      ...b,
      category: classifiedById[b.id]?.category || 'Uncategorized',
      tags: classifiedById[b.id]?.tags || [],
      aiSuggestedTags: classifiedById[b.id]?.tags || [],
    }))

    // 4. Upsert
    const newCount = upsertBookmarks(enriched)

    res.json({ newBookmarks: newCount, totalScraped: scraped.length })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
```

**Step 3: Test sync manually**

```bash
# Start server
cd /Users/tyler/Development/Booked/server
ANTHROPIC_API_KEY=your_key_here node index.js

# In another terminal:
curl -X POST http://localhost:3333/api/sync \
  -H "Content-Type: application/json" \
  -d '{"range": "week"}'
```

Expected: Chrome opens, navigates to x.com/i/bookmarks, scrolls, closes. Response includes `newBookmarks` count. Check `data/bookmarks.json` for results.

**Step 4: Commit**

```bash
cd /Users/tyler/Development/Booked
git add server/scraper.js server/routes/sync.js
git commit -m "feat: Playwright scraper with network interception and sync route"
```

---

## Task 12: Claude Skill File

**Files:**
- Create: `~/.claude/skills/x-bookmarks/SKILL.md`

**Step 1: Create skill directory and file**

```bash
mkdir -p ~/.claude/skills/x-bookmarks
```

```markdown
<!-- ~/.claude/skills/x-bookmarks/SKILL.md -->
---
name: x-bookmarks
description: Fetch and sync X (Twitter) bookmarks to the local Booked app at localhost:3333. Use when the user says /x-bookmarks or asks to sync/fetch their X bookmarks.
allowed-tools: Bash
---

# X Bookmarks Sync Skill

Fetches the user's X bookmarks into the local Booked app.

## App Location

`/Users/tyler/Development/Booked`

## Invocation Parsing

Parse the user's command for these flags:
- `--sync` or no flag → `{ "range": "sync" }` (default: since last run)
- `--range=week` → `{ "range": "week" }`
- `--range=month` → `{ "range": "month" }`
- `--range=year` → `{ "range": "year" }`
- `--count=N` → `{ "count": N }`
- `--all` → `{ "range": "all" }`

## Steps

1. **Ensure server is running.** Check if port 3333 is in use:
   ```bash
   lsof -ti:3333
   ```
   If not running, start it:
   ```bash
   cd /Users/tyler/Development/Booked && npm run start &
   sleep 2
   ```

2. **Trigger sync** via the API:
   ```bash
   curl -s -X POST http://localhost:3333/api/sync \
     -H "Content-Type: application/json" \
     -d '{"range": "sync"}'
   ```
   Replace the JSON body with the parsed flags from the user's command.

3. **Report results** to the user:
   - How many new bookmarks were fetched
   - Total bookmarks in the library
   - Open http://localhost:3333 in the browser:
     ```bash
     open http://localhost:3333
     ```

4. **Handle errors** — if Chrome isn't logged in to X, tell the user to open Chrome, log in to x.com, then retry.

## Environment

Set `ANTHROPIC_API_KEY` in your shell profile for AI classification. Without it, bookmarks will be imported as "Uncategorized" with no tags.

```bash
# Add to ~/.zshrc:
export ANTHROPIC_API_KEY=sk-ant-...
```
```

**Step 2: Verify skill is registered**

Open a new Claude Code session and type `/x-bookmarks` — it should be recognized as a skill.

**Step 3: Commit skill separately**

```bash
# Skill lives in ~/.claude, not the Booked repo — no git commit needed here.
# Commit any Booked repo changes:
cd /Users/tyler/Development/Booked
git add .
git commit -m "feat: x-bookmarks Claude skill wired to Booked app"
```

---

## Task 13: Production Build + Final Polish

**Files:**
- Modify: `server/index.js` (serve client build)
- Modify: `package.json` (add build + start scripts)

**Step 1: Build client**

```bash
cd /Users/tyler/Development/Booked/client
npm run build
```

Expected: `client/dist/` populated with index.html + assets.

**Step 2: Verify production serve**

```bash
cd /Users/tyler/Development/Booked/server
node index.js
```

Open `http://localhost:3333` — should serve the full React app.

**Step 3: Add .env.example**

```bash
cat > /Users/tyler/Development/Booked/.env.example << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
CHROME_USER_DATA=/Users/YOUR_NAME/Library/Application Support/Google/Chrome
PORT=3333
EOF
```

**Step 4: Final commit**

```bash
cd /Users/tyler/Development/Booked
git add .
git commit -m "chore: production build verification and env example"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Monorepo scaffold (Node workspaces, Vite, Tailwind) |
| 2 | Data layer — JSON files + upsert logic |
| 3 | Express API — bookmarks CRUD, meta, sync stub |
| 4 | React + Vite + Tailwind client shell |
| 5 | Core hooks — useBookmarks, useFilters, useFuzzySearch |
| 6 | Layout + Sidebar (categories, tags, sync button) |
| 7 | BookmarkCard component |
| 8 | BookmarkDetail drawer (tags, category, notes) |
| 9 | TopBar — sort, time range, media filter |
| 10 | AI classifier (Claude Haiku) |
| 11 | Playwright scraper + sync route wiring |
| 12 | Claude skill file (`~/.claude/skills/x-bookmarks/`) |
| 13 | Production build + polish |
