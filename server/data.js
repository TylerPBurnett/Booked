import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOOKED_DATA_DIR || join(__dirname, '..', 'data')
const BOOKMARKS_PATH = join(DATA_DIR, 'bookmarks.json')
const META_PATH = join(DATA_DIR, 'meta.json')

export function readBookmarks() {
  return JSON.parse(readFileSync(BOOKMARKS_PATH, 'utf-8'))
}

export function writeBookmarks(bookmarks) {
  writeFileSync(BOOKMARKS_PATH, JSON.stringify(bookmarks, null, 2))
}

export function readMeta() {
  const raw = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  const migrated = migrateMeta(raw)
  if (migrated !== raw) writeFileSync(META_PATH, JSON.stringify(migrated, null, 2))
  return migrated
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

// ── Category tree helpers ──────────────────────────────────────

/** Convert old flat string array to new nested format. No-op if already migrated. */
export function migrateMeta(meta) {
  if (!Array.isArray(meta.categories) || meta.categories.length === 0) return meta
  if (typeof meta.categories[0] === 'object') return meta // already migrated
  return {
    ...meta,
    categories: meta.categories.map(name => ({ name, children: [] })),
  }
}

/** Flat list of all category names: parents then their children. */
export function flattenCategories(tree) {
  return tree.flatMap(cat => [cat.name, ...cat.children])
}

/** Return new meta with a category added. Throws if name already exists. */
export function addCategory(meta, name, parent = null) {
  const allNames = flattenCategories(meta.categories)
  if (allNames.includes(name)) throw new Error(`Category "${name}" already exists`)

  if (parent) {
    const parentCat = meta.categories.find(c => c.name === parent)
    if (!parentCat) throw new Error(`Parent category "${parent}" not found`)
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent ? { ...c, children: [...c.children, name] } : c
      ),
    }
  }

  return { ...meta, categories: [...meta.categories, { name, children: [] }] }
}

/** Return new meta with a category removed. Throws on protected names. */
export function removeCategory(meta, name, parent = null) {
  if (name === 'Uncategorized') throw new Error('Cannot delete Uncategorized')

  if (parent) {
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent ? { ...c, children: c.children.filter(ch => ch !== name) } : c
      ),
    }
  }

  return { ...meta, categories: meta.categories.filter(c => c.name !== name) }
}

/** Return new meta with a category renamed. Throws on protected names. */
export function renameCategory(meta, oldName, newName, parent = null) {
  if (oldName === 'Uncategorized') throw new Error('Cannot rename Uncategorized')

  if (parent) {
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent
          ? { ...c, children: c.children.map(ch => (ch === oldName ? newName : ch)) }
          : c
      ),
    }
  }

  return {
    ...meta,
    categories: meta.categories.map(c => (c.name === oldName ? { ...c, name: newName } : c)),
  }
}
