import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOOKED_DATA_DIR || join(__dirname, '..', 'data')
const BOOKMARKS_PATH = join(DATA_DIR, 'bookmarks.json')
const META_PATH = join(DATA_DIR, 'meta.json')

function compareSavedOrder(a, b) {
  const aSavedAt = new Date(a.savedAt || a.bookmarkedAt || a.postedAt || 0).getTime()
  const bSavedAt = new Date(b.savedAt || b.bookmarkedAt || b.postedAt || 0).getTime()
  if (bSavedAt !== aSavedAt) return bSavedAt - aSavedAt

  const aSeq = Number.isFinite(a.savedSeq) ? a.savedSeq : Number.MAX_SAFE_INTEGER
  const bSeq = Number.isFinite(b.savedSeq) ? b.savedSeq : Number.MAX_SAFE_INTEGER
  return aSeq - bSeq
}

function migrateBookmarks(bookmarks) {
  let changed = false

  const migrated = bookmarks.map((bookmark, index) => {
    let next = bookmark

    if (!next.savedAt) {
      next = { ...next, savedAt: next.bookmarkedAt || next.postedAt || new Date().toISOString() }
      changed = true
    }

    if (!Number.isFinite(next.savedSeq)) {
      next = { ...next, savedSeq: index }
      changed = true
    }

    return next
  })

  if (changed) migrated.sort(compareSavedOrder)
  return { migrated, changed }
}

export function readBookmarks() {
  const raw = JSON.parse(readFileSync(BOOKMARKS_PATH, 'utf-8'))
  const { migrated, changed } = migrateBookmarks(raw)
  if (changed) writeBookmarks(migrated)
  return migrated
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
  const savedAtForSync = new Date().toISOString()
  let incomingSeq = 0

  for (const bookmark of incoming) {
    if (existingById[bookmark.id]) {
      // Update metrics only — preserve user data (tags, category, notes)
      existingById[bookmark.id].metrics = bookmark.metrics
    } else {
      existingById[bookmark.id] = {
        ...bookmark,
        savedAt: bookmark.savedAt || savedAtForSync,
        savedSeq: Number.isFinite(bookmark.savedSeq) ? bookmark.savedSeq : incomingSeq,
      }
      incomingSeq++
      newCount++
    }
  }

  const merged = Object.values(existingById).sort(compareSavedOrder)
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

  let changed = false
  let categories = meta.categories

  // Phase 1: convert old flat string array to object format
  if (typeof categories[0] === 'string') {
    categories = categories.map(name => ({ name, children: [] }))
    changed = true
  }

  // Phase 2: ensure every category object has icon and color fields
  if (categories.some(c => c.icon === undefined || c.color === undefined)) {
    categories = categories.map(c => ({
      ...c,
      icon: c.icon ?? null,
      color: c.color ?? null,
    }))
    changed = true
  }

  return changed ? { ...meta, categories } : meta
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

  return { ...meta, categories: [...meta.categories, { name, icon: null, color: null, children: [] }] }
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

/** Return new meta with categories reordered. nameOrder must list every category name exactly once. */
export function reorderCategories(meta, nameOrder) {
  if (nameOrder.length !== meta.categories.length) {
    throw new Error('order must include all categories')
  }
  if (new Set(nameOrder).size !== nameOrder.length) {
    throw new Error('nameOrder contains duplicate names')
  }
  const byName = Object.fromEntries(meta.categories.map(c => [c.name, c]))
  for (const name of nameOrder) {
    if (!byName[name]) throw new Error(`Unknown category "${name}"`)
  }
  const uncatIdx = nameOrder.indexOf('Uncategorized')
  if (uncatIdx !== -1 && uncatIdx !== nameOrder.length - 1) {
    throw new Error('Uncategorized must remain last')
  }
  return { ...meta, categories: nameOrder.map(n => byName[n]) }
}
