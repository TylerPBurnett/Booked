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
      // Update metrics only — preserve user data (tags, category, notes)
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
