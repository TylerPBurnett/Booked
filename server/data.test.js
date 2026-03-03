import { describe, it, expect } from 'vitest'
import {
  migrateMeta,
  flattenCategories,
  addCategory,
  removeCategory,
  renameCategory,
} from './data.js'

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

// Test the upsert merge logic as pure functions (no file I/O needed)
function mergeBookmarks(existing, incoming) {
  const byId = Object.fromEntries(existing.map(b => [b.id, b]))
  let newCount = 0
  for (const b of incoming) {
    if (byId[b.id]) {
      byId[b.id].metrics = b.metrics
    } else {
      byId[b.id] = b
      newCount++
    }
  }
  return { merged: Object.values(byId), newCount }
}

describe('upsert merge logic', () => {
  it('adds new bookmarks', () => {
    const { merged, newCount } = mergeBookmarks([], [makeBookmark('1')])
    expect(merged).toHaveLength(1)
    expect(newCount).toBe(1)
  })

  it('updates metrics but preserves tags for existing bookmark', () => {
    const existing = [makeBookmark('1', { tags: ['my-tag'], metrics: { likes: 50 } })]
    const incoming = [makeBookmark('1', { metrics: { likes: 200 } })]
    const { merged, newCount } = mergeBookmarks(existing, incoming)
    expect(merged[0].metrics.likes).toBe(200)
    expect(merged[0].tags).toEqual(['my-tag'])
    expect(newCount).toBe(0)
  })

  it('handles mixed new and existing bookmarks', () => {
    const existing = [makeBookmark('1')]
    const incoming = [makeBookmark('1', { metrics: { likes: 999 } }), makeBookmark('2')]
    const { merged, newCount } = mergeBookmarks(existing, incoming)
    expect(merged).toHaveLength(2)
    expect(newCount).toBe(1)
  })
})

describe('migrateMeta', () => {
  it('converts flat string array to nested objects', () => {
    const old = { categories: ['Design', 'Dev'], totalBookmarks: 0 }
    const result = migrateMeta(old)
    expect(result.categories).toEqual([
      { name: 'Design', children: [] },
      { name: 'Dev',    children: [] },
    ])
  })

  it('is a no-op if already in new format', () => {
    const already = { categories: [{ name: 'Design', children: [] }] }
    expect(migrateMeta(already).categories[0]).toEqual({ name: 'Design', children: [] })
  })
})

describe('flattenCategories', () => {
  it('returns flat list of all names (parents + children)', () => {
    const tree = [
      { name: 'Dev', children: ['Frontend', 'Backend'] },
      { name: 'Design', children: [] },
    ]
    expect(flattenCategories(tree)).toEqual(['Dev', 'Frontend', 'Backend', 'Design'])
  })
})

describe('addCategory', () => {
  it('adds a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = addCategory(meta, 'Design')
    expect(result.categories).toHaveLength(2)
    expect(result.categories[1].name).toBe('Design')
  })

  it('adds a subcategory under a parent', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = addCategory(meta, 'Frontend', 'Dev')
    expect(result.categories[0].children).toContain('Frontend')
  })

  it('throws if name already exists', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    expect(() => addCategory(meta, 'Dev')).toThrow()
  })
})

describe('removeCategory', () => {
  it('removes a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }, { name: 'Design', children: [] }] }
    const result = removeCategory(meta, 'Dev')
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].name).toBe('Design')
  })

  it('removes a subcategory string from its parent', () => {
    const meta = { categories: [{ name: 'Dev', children: ['Frontend', 'Backend'] }] }
    const result = removeCategory(meta, 'Frontend', 'Dev')
    expect(result.categories[0].children).not.toContain('Frontend')
  })

  it('throws if trying to remove Uncategorized', () => {
    const meta = { categories: [{ name: 'Uncategorized', children: [] }] }
    expect(() => removeCategory(meta, 'Uncategorized')).toThrow()
  })
})

describe('renameCategory', () => {
  it('renames a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = renameCategory(meta, 'Dev', 'Engineering')
    expect(result.categories[0].name).toBe('Engineering')
  })

  it('renames a subcategory within its parent', () => {
    const meta = { categories: [{ name: 'Dev', children: ['Frontend'] }] }
    const result = renameCategory(meta, 'Frontend', 'FE', 'Dev')
    expect(result.categories[0].children).toContain('FE')
    expect(result.categories[0].children).not.toContain('Frontend')
  })

  it('throws if trying to rename Uncategorized', () => {
    const meta = { categories: [{ name: 'Uncategorized', children: [] }] }
    expect(() => renameCategory(meta, 'Uncategorized', 'Other')).toThrow()
  })
})
