import { chromium } from 'playwright'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_PATH = path.join(__dirname, '..', 'data', 'playwright-session.json')
const INCREMENTAL_KNOWN_STREAK_LIMIT = 40

function buildStopCondition(range, count, lastSyncedAt) {
  if (count) return { mode: 'count', limit: parseInt(count, 10) }
  if (range === 'all') return { mode: 'all' }
  if (range === 'sync') return { mode: 'incremental' }
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
        const tweetCore = result?.core || result?.tweet?.core
        const legacy = result?.legacy || result?.tweet?.legacy
        const userResult = tweetCore?.user_results?.result

        // X moved screen_name/name from user.legacy → user.core in early 2025
        const userCore = userResult?.core || {}
        const userLegacy = userResult?.legacy || {}
        const user = {
          screen_name: userCore.screen_name || userLegacy.screen_name,
          name: userCore.name || userLegacy.name,
          profile_image_url_https: userResult?.avatar?.image_url || userLegacy.profile_image_url_https || ''
        }

        if (!legacy || !user.screen_name) return null

        const id = result?.rest_id || result?.tweet?.rest_id
        if (!id) return null

        const bookmarkedAt = legacy.bookmarked_at
          ? new Date(legacy.bookmarked_at * 1000).toISOString()
          : new Date(legacy.created_at).toISOString()

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

export async function scrapeBookmarks({ range = 'sync', count, lastSyncedAt, knownIds = [] } = {}) {
  if (!existsSync(SESSION_PATH)) {
    throw new Error(
      'No Playwright session found. Run this first:\n' +
      '  node /Users/tyler/Development/Booked/server/auth.js\n' +
      'Then log in to X in the browser window that opens.'
    )
  }

  const stopCondition = buildStopCondition(range, count, lastSyncedAt)
  const bookmarksById = new Map()
  const knownIdSet = new Set(knownIds)
  let knownStreak = 0

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ storageState: SESSION_PATH })
  const page = await context.newPage()

  page.on('response', async (response) => {
    const url = response.url()
    if (!url.includes('/graphql/') || !url.toLowerCase().includes('bookmark')) return
    if (!response.ok()) return
    try {
      const json = await response.json()
      const extracted = extractBookmarksFromResponse(json)
      for (const bm of extracted) {
        if (bookmarksById.has(bm.id)) continue
        bookmarksById.set(bm.id, bm)

        if (stopCondition.mode === 'incremental') {
          if (knownIdSet.has(bm.id)) knownStreak++
          else knownStreak = 0
        }
      }
    } catch { /* not JSON */ }
  })

  try {
    await page.goto('https://x.com/i/bookmarks', { waitUntil: 'networkidle', timeout: 30000 })
  } catch { /* networkidle timeout — continue */ }

  // If session expired, X redirects to login
  const currentUrl = page.url()
  if (currentUrl.includes('/login') || currentUrl.includes('/flow/login')) {
    await browser.close()
    throw new Error(
      'X session expired. Re-run auth:\n' +
      '  node /Users/tyler/Development/Booked/server/auth.js'
    )
  }

  let stalledRounds = 0
  while (stalledRounds < 5) {
    const countBefore = bookmarksById.size

    if (stopCondition.mode === 'count' && bookmarksById.size >= stopCondition.limit) break

    if (stopCondition.mode === 'incremental' && knownStreak >= INCREMENTAL_KNOWN_STREAK_LIMIT) break

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

  await browser.close()

  const results = Array.from(bookmarksById.values())

  if (stopCondition.mode === 'count') return results.slice(0, stopCondition.limit)
  if (stopCondition.mode === 'since') return results.filter(b => new Date(b.bookmarkedAt) >= stopCondition.cutoff)
  return results
}
