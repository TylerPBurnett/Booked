import { chromium } from 'playwright'
import os from 'os'
import path from 'path'

// Reuse the user's existing Chrome profile — already logged into X
const CHROME_USER_DATA = process.env.CHROME_USER_DATA ||
  path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')

function buildStopCondition(range, count, lastSyncedAt) {
  if (count) return { mode: 'count', limit: parseInt(count) }
  if (range === 'all') return { mode: 'all' }
  if (range === 'sync' && lastSyncedAt) return { mode: 'since', cutoff: new Date(lastSyncedAt) }
  const days = { week: 7, month: 30, year: 365 }[range] || 30
  return { mode: 'since', cutoff: new Date(Date.now() - days * 86400000) }
}

function extractBookmarksFromResponse(json) {
  try {
    const instructions =
      json?.data?.bookmark_timeline_v2?.timeline?.instructions ||
      json?.data?.bookmarks?.timeline?.instructions ||
      []

    return instructions
      .flatMap(i => i.entries || [])
      .filter(e => e?.entryId?.startsWith('tweet-'))
      .map(entry => {
        const result = entry?.content?.itemContent?.tweet_results?.result
        const core = result?.core || result?.tweet?.core
        const legacy = result?.legacy || result?.tweet?.legacy
        const user = core?.user_results?.result?.legacy || {}

        if (!legacy || !user.screen_name) return null

        const id = result?.rest_id || result?.tweet?.rest_id
        if (!id) return null

        const bookmarkedAt = legacy.bookmarked_at
          ? new Date(legacy.bookmarked_at * 1000).toISOString()
          : new Date().toISOString()

        const media = (legacy.extended_entities?.media || legacy.entities?.media || []).map(m => ({
          type: m.type === 'photo' ? 'image' : m.type,
          url: (m.media_url_https || m.url || '').replace('http://', 'https://')
        }))

        return {
          id,
          url: `https://x.com/${user.screen_name}/status/${id}`,
          text: (legacy.full_text || legacy.text || '').replace(/https:\/\/t\.co\/\S+/g, '').trim(),
          author: {
            handle: user.screen_name,
            name: user.name || user.screen_name,
            avatarUrl: (user.profile_image_url_https || '').replace('_normal', '_bigger')
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
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function scrapeBookmarks({ range = 'sync', count, lastSyncedAt } = {}) {
  const stopCondition = buildStopCondition(range, count, lastSyncedAt)
  const bookmarksById = new Map()

  const context = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    channel: 'chrome',
    headless: false,
    args: ['--profile-directory=Default', '--no-first-run', '--no-default-browser-check'],
  })

  const page = await context.newPage()

  page.on('response', async (response) => {
    const url = response.url()
    if (!url.includes('/graphql/') || !url.toLowerCase().includes('bookmark')) return
    if (!response.ok()) return
    try {
      const json = await response.json()
      const extracted = extractBookmarksFromResponse(json)
      for (const bm of extracted) {
        if (!bookmarksById.has(bm.id)) bookmarksById.set(bm.id, bm)
      }
    } catch { /* not JSON */ }
  })

  try {
    await page.goto('https://x.com/i/bookmarks', { waitUntil: 'networkidle', timeout: 30000 })
  } catch { /* networkidle timeout on slow connections — continue */ }

  let stalledRounds = 0
  while (stalledRounds < 5) {
    const countBefore = bookmarksById.size

    if (stopCondition.mode === 'count' && bookmarksById.size >= stopCondition.limit) break

    if (stopCondition.mode === 'since' && bookmarksById.size > 0) {
      const oldest = Array.from(bookmarksById.values()).reduce((a, b) =>
        new Date(a.bookmarkedAt) < new Date(b.bookmarkedAt) ? a : b
      )
      if (new Date(oldest.bookmarkedAt) < stopCondition.cutoff) break
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    bookmarksById.size === countBefore ? stalledRounds++ : (stalledRounds = 0)
  }

  await context.close()

  let results = Array.from(bookmarksById.values())
  results.sort((a, b) => new Date(b.bookmarkedAt) - new Date(a.bookmarkedAt))

  if (stopCondition.mode === 'count') return results.slice(0, stopCondition.limit)
  if (stopCondition.mode === 'since') return results.filter(b => new Date(b.bookmarkedAt) >= stopCondition.cutoff)
  return results
}
