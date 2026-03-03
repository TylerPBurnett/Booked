import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

// Mock the scraper so POST /api/sync doesn't launch Chrome during tests
vi.mock('./scraper.js', () => ({
  scrapeBookmarks: vi.fn().mockResolvedValue([])
}))

// Use an isolated temp directory — NEVER write to the real data/ folder
const TEST_DATA_DIR = join(tmpdir(), `booked-test-${Date.now()}`)
process.env.BOOKED_DATA_DIR = TEST_DATA_DIR

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  mkdirSync(TEST_DATA_DIR, { recursive: true })
  writeFileSync(join(TEST_DATA_DIR, 'bookmarks.json'), JSON.stringify([testBookmark], null, 2))
  writeFileSync(join(TEST_DATA_DIR, 'meta.json'), JSON.stringify({
    lastSyncedAt: null,
    categories: [
      { name: 'Design', children: [] },
      { name: 'Dev',    children: ['Frontend'] },
      { name: 'Uncategorized', children: [] },
    ],
    totalBookmarks: 1
  }, null, 2))
})

// Lazy import app AFTER seeding data
let app
beforeAll(async () => {
  const mod = await import('./index.js')
  app = mod.default
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
  it('updates tags and notes but preserves metrics', async () => {
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

describe('POST /api/sync', () => {
  it('returns stub response', async () => {
    const res = await request(app).post('/api/sync').send({})
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('newBookmarks')
  })
})

describe('GET /api/categories', () => {
  it('returns category tree with counts', async () => {
    const res = await request(app).get('/api/categories')
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('children')
    expect(res.body[0]).toHaveProperty('count')
  })
})

describe('POST /api/categories', () => {
  it('creates a top-level category', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Tools' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Tools')
  })

  it('creates a subcategory under an existing parent', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Backend', parent: 'Dev' })
    expect(res.status).toBe(201)
    expect(res.body.parent).toBe('Dev')
  })

  it('returns 409 if name already exists', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Design' })
    expect(res.status).toBe(409)
  })

  it('returns 400 if name is missing', async () => {
    const res = await request(app).post('/api/categories').send({})
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/categories/:name', () => {
  it('renames a category', async () => {
    const res = await request(app)
      .patch('/api/categories/Tools')
      .send({ name: 'Tooling' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Tooling')
  })

  it('returns 400 trying to rename Uncategorized', async () => {
    const res = await request(app)
      .patch('/api/categories/Uncategorized')
      .send({ name: 'Other' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/categories/:name', () => {
  it('deletes a category', async () => {
    const res = await request(app).delete('/api/categories/Tooling')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 trying to delete Uncategorized', async () => {
    const res = await request(app).delete('/api/categories/Uncategorized')
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/categories/reorder', () => {
  it('reorders categories', async () => {
    // Seed state has: Design, Dev (with Frontend child), Uncategorized
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev', 'Design', 'Uncategorized'] })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app).get('/api/categories')
    expect(check.body[0].name).toBe('Dev')
  })

  it('returns 400 if order is missing names', async () => {
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev'] })
    expect(res.status).toBe(400)
  })

  it('returns 400 if an unknown name is supplied', async () => {
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev', 'Design', 'Uncategorized', 'Ghost'] })
    expect(res.status).toBe(400)
  })
})
