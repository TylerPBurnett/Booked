import { describe, it, expect } from 'vitest'

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
