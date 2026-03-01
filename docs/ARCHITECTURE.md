# Booked — Architecture & Repository Guide

## What It Is

Booked is a personal X (Twitter) bookmark manager that runs entirely on your local machine. It has two distinct parts:

1. **A Claude skill** (`/x-bookmarks`) — scrapes your bookmarks from X using your existing Chrome session, classifies them with AI, and saves them locally
2. **A local web app** (`localhost:3333`) — a React UI for browsing, searching, tagging, and managing those bookmarks

The X API charges for bookmark access. Booked bypasses that entirely by intercepting X's own internal GraphQL API responses via Playwright — no API key, no cost, no credentials to manage.

---

## Repository Layout

```
/Users/tyler/Development/Booked/
│
├── package.json              ← Root monorepo (npm workspaces)
├── .env.example              ← Environment variable reference
├── .gitignore
│
├── server/                   ← Express API + scraping + classification
│   ├── index.js              ← App entry point, route mounts, static serving
│   ├── data.js               ← File I/O layer (reads/writes JSON)
│   ├── scraper.js            ← Playwright browser automation
│   ├── classifier.js         ← Claude Haiku AI classification
│   ├── routes/
│   │   ├── bookmarks.js      ← CRUD for bookmark records
│   │   ├── meta.js           ← Metadata + tag management
│   │   └── sync.js           ← Orchestrates scrape → classify → upsert
│   ├── data.test.js          ← Unit tests for upsert merge logic
│   └── api.test.js           ← Integration tests for HTTP endpoints
│
├── client/                   ← React + Vite + Tailwind frontend
│   ├── index.html
│   ├── vite.config.js        ← Vite config + /api proxy to port 3333
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── dist/                 ← Built client (served by Express in production)
│   └── src/
│       ├── main.jsx          ← React entry point
│       ├── index.css         ← Tailwind directives + Google Fonts
│       ├── App.jsx           ← Root component, wires hooks + layout
│       ├── hooks/
│       │   ├── useBookmarks.js    ← Fetch, update, delete, sync
│       │   ├── useFilters.js      ← Category/tag/sort/time filtering
│       │   └── useFuzzySearch.js  ← Fuse.js fuzzy search
│       └── components/
│           ├── Layout.jsx         ← Two-column shell (sidebar + main)
│           ├── Sidebar.jsx        ← Category nav, tag nav, sync button
│           ├── TopBar.jsx         ← Search, sort, time range, media filter
│           ├── BookmarkCard.jsx   ← Card in the grid
│           └── BookmarkDetail.jsx ← Right-side drawer for editing
│
├── data/                     ← Persistent storage (gitignored, created at runtime)
│   ├── bookmarks.json        ← All bookmark records
│   └── meta.json             ← Categories, lastSyncedAt, totalBookmarks
│
└── docs/
    ├── ARCHITECTURE.md       ← This file
    ├── IMPROVEMENTS.md       ← Recommended features and future work
    └── plans/
        ├── 2026-03-01-x-bookmarks-design.md
        └── 2026-03-01-booked-implementation.md
```

The Claude skill lives separately:

```
~/.agents/skills/x-bookmarks/   ← Source (committed to .agents repo)
├── SKILL.md
├── scripts/sync.sh
└── references/fetch-options.md

~/.claude/skills/x-bookmarks    ← Symlink → ../../.agents/skills/x-bookmarks
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code CLI                                             │
│  User types: /x-bookmarks --range=week                      │
└────────────────────────────┬────────────────────────────────┘
                             │ SKILL.md parses flags
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  sync.sh                                                     │
│  1. Starts Express server if not running (port 3333)         │
│  2. POST /api/sync { range: "week" }                         │
│  3. Opens browser to localhost:3333                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Express — routes/sync.js                                    │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │ scraper.js  │ → │ classifier.js│ → │ data.js upsert   │ │
│  │ (Playwright)│   │ (Claude API) │   │ (JSON file)      │ │
│  └─────────────┘   └──────────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  React App — localhost:3333                                  │
│  useBookmarks → GET /api/bookmarks                           │
│  useFilters   → client-side filter/sort                      │
│  useFuzzySearch → Fuse.js on filtered results                │
│  → Grid of BookmarkCards + BookmarkDetail drawer             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Sync Cycle

When you run `/x-bookmarks`:

1. **Parse flags** — SKILL.md extracts `--range`, `--count`, or `--all` and converts to JSON
2. **Start server** — `sync.sh` checks port 3333; starts Express if needed
3. **API call** — `POST /api/sync` with options body
4. **Scrape** — `scraper.js` opens your real Chrome (already logged into X), navigates to `x.com/i/bookmarks`, intercepts the GraphQL API responses as the page loads, scrolls until the stop condition is met
5. **Classify** — `classifier.js` sends each new tweet to Claude Haiku with a strict JSON-only prompt; gets back `{ category, tags }` for each
6. **Upsert** — `data.js` merges incoming bookmarks into `bookmarks.json` by tweet ID. Existing records: only `metrics` updated, all user data (tags, category, notes) preserved. New records: added in full.
7. **Meta update** — `lastSyncedAt` written to `meta.json`
8. **Response** — `{ newBookmarks, totalScraped }` returned to `sync.sh`
9. **Browser** — `open http://localhost:3333` launches the app

## Data Flow: User Interaction

When you click a card and edit it:

1. `BookmarkCard` click → `App.jsx` sets `selectedId`
2. `BookmarkDetail` drawer renders with the selected bookmark
3. User changes category → `onUpdate(id, { category })` fires immediately
4. `useBookmarks.updateBookmark()` sends `PATCH /api/bookmarks/:id`
5. Express reads `bookmarks.json`, updates the allowed fields, writes back
6. Returns updated record → local React state updated immediately
7. Notes save on blur, tags save on add/remove

## Data Flow: Search + Filter

All filtering and search is client-side — no server calls:

```
bookmarks (from API)
  → useFilters (useMemo):
      filter by archived, category, tags, time range, media
      sort by selected field/direction
  → useFuzzySearch (useMemo):
      if query empty → pass through
      if query present → Fuse.js ranks results by weighted match
  → grid renders filtered, sorted, searched results
```

Response is instant — no debounce needed beyond Fuse.js's own performance characteristics.

---

## Key Files

### `server/data.js`

The single source of truth for persistence. All reads and writes to `bookmarks.json` and `meta.json` go through here. The most important function is `upsertBookmarks(incoming)`:

- Reads existing records, keys by tweet ID
- For each incoming bookmark: if it exists, update only `metrics`; if new, add it
- Sort merged result by `bookmarkedAt` descending
- Write back, update `meta.json` counts

This ensures a re-sync never destroys your tags, notes, or category assignments.

### `server/scraper.js`

Uses `chromium.launchPersistentContext()` with your real Chrome user data directory. This means:

- No login required — Chrome already has your X session cookies
- No credentials stored in the app
- If Chrome updates and clears cookies, you just log back into X normally

The scraper listens for responses matching `/graphql/` + `bookmark` in the URL. X's internal GraphQL API returns richer data than the DOM — including the actual `bookmarked_at` Unix timestamp, which is what makes time-range fetching accurate.

Stop conditions:
- `--sync` → stop when oldest bookmark's `bookmarkedAt` < `lastSyncedAt`
- `--range=week/month/year` → stop when oldest bookmark is older than cutoff
- `--count=N` → stop after collecting N unique bookmarks
- `--all` → stop only when scroll stalls (5 consecutive rounds with no new data)

### `server/classifier.js`

Sends each tweet's text (capped at 500 chars) to Claude Haiku with a strict JSON-only system prompt. Returns one of six fixed categories and 2–5 kebab-case tags. Gracefully falls back to `Uncategorized + []` if:
- `ANTHROPIC_API_KEY` is not set
- The API returns non-JSON
- The response has unexpected shape

A 150ms delay between requests prevents rate-limiting on large batch imports.

### `client/src/App.jsx`

The root component owns all top-level state and wires the three hooks together:

```js
const { bookmarks, meta, loading, syncing, sync, updateBookmark } = useBookmarks()
const filters = useFilters(bookmarks)
const { query, setQuery, results } = useFuzzySearch(filters.filtered)
```

`results` is the final array rendered in the grid. `useFilters` runs on `bookmarks`, then `useFuzzySearch` runs on the already-filtered set — both via `useMemo` so they only recompute when their inputs change.

### `client/src/hooks/useFilters.js`

Exports two constants used by `TopBar.jsx`:
- `SORT_OPTIONS` — 6 sort configurations with value strings like `"bookmarkedAt_desc"`
- `TIME_RANGES` — 4 time window options

The sort value format is `"field_direction"` where `field` can be a dot-path like `"metrics.likes"`. The last `_` in the string is used as the separator, so nested field paths work correctly.

---

## Data Model

### Bookmark record (`bookmarks.json`)

```json
{
  "id": "1234567890",
  "url": "https://x.com/username/status/1234567890",
  "text": "Full tweet text (t.co URLs stripped)",
  "author": {
    "handle": "username",
    "name": "Display Name",
    "avatarUrl": "https://pbs.twimg.com/profile_images/..."
  },
  "postedAt": "2026-02-28T10:00:00Z",
  "bookmarkedAt": "2026-02-28T12:00:00Z",
  "media": [
    { "type": "image", "url": "https://pbs.twimg.com/media/..." }
  ],
  "metrics": {
    "likes": 1200,
    "retweets": 340,
    "replies": 89
  },
  "category": "Design",
  "tags": ["figma", "ui-design"],
  "aiSuggestedTags": ["figma", "ui-design"],
  "notes": "User freeform notes",
  "archived": false
}
```

**Field ownership:**

| Field | Set by | Updated by |
|-------|--------|------------|
| `id`, `url`, `text`, `author`, `postedAt`, `bookmarkedAt`, `media` | Scraper | Never (immutable) |
| `metrics` | Scraper | Re-sync (only field updated on existing records) |
| `category`, `tags` | Classifier (initial) | User via PATCH |
| `aiSuggestedTags` | Classifier | Classifier on re-classification |
| `notes`, `archived` | User | User via PATCH |

### Metadata (`meta.json`)

```json
{
  "lastSyncedAt": "2026-03-01T09:00:00Z",
  "categories": ["Design", "Dev", "Tools", "Threads", "Reads", "Uncategorized"],
  "totalBookmarks": 874
}
```

`lastSyncedAt` is the key field that makes incremental sync (`--sync`) work. It's written by `upsertBookmarks()` after every successful sync.

---

## API Reference

All endpoints served at `http://localhost:3333/api/`.

### Bookmarks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookmarks` | List bookmarks. Query params: `category`, `tag`, `archived`, `sort`, `limit`, `offset` |
| GET | `/api/bookmarks/:id` | Single bookmark |
| PATCH | `/api/bookmarks/:id` | Update `tags`, `category`, `notes`, or `archived` |
| DELETE | `/api/bookmarks/:id` | Remove from local store (not from X) |

**Sort values for GET `/api/bookmarks`:**
- `bookmarkedAt_desc` (default)
- `bookmarkedAt_asc`
- `postedAt_desc`
- `metrics.likes_desc`
- `metrics.retweets_desc`
- `author.handle_asc`

### Meta

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meta` | Fetch metadata (categories, lastSyncedAt, totalBookmarks) |
| PATCH | `/api/meta` | Update category list |
| POST | `/api/meta/tags/rename` | Rename a tag across all bookmarks. Body: `{ from, to }` |
| POST | `/api/meta/tags/delete` | Remove a tag from all bookmarks. Body: `{ tag }` |

### Sync

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync` | Trigger full sync. Body: `{ range?, count? }` |

---

## Running the App

**Development (hot reload on both sides):**
```bash
cd /Users/tyler/Development/Booked
npm run dev
# Server: http://localhost:3333 (node --watch)
# Client: http://localhost:5173 (Vite, proxies /api to 3333)
```

**Production:**
```bash
cd /Users/tyler/Development/Booked
npm run start
# Serves built client from client/dist at http://localhost:3333
```

**Rebuild client after frontend changes:**
```bash
npm run build
```

**Run tests:**
```bash
cd server && NODE_ENV=test npx vitest run
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | No | — | Enables AI tag/category classification. Without it, all bookmarks import as "Uncategorized" with no tags — still fully functional. |
| `CHROME_USER_DATA` | No | `~/Library/Application Support/Google/Chrome` | Path to Chrome user data directory. Override if you use a non-default Chrome profile location. |
| `PORT` | No | `3333` | HTTP port for the Express server. |

Add to `~/.zshrc`:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## The Claude Skill

**Location:** `~/.agents/skills/x-bookmarks/` (symlinked to `~/.claude/skills/x-bookmarks`)

**Invocation:**
```
/x-bookmarks                  ← incremental sync (default)
/x-bookmarks --sync           ← same as above, explicit
/x-bookmarks --range=week     ← bookmarks saved in last 7 days
/x-bookmarks --range=month    ← last 30 days
/x-bookmarks --range=year     ← last 365 days
/x-bookmarks --count=50       ← last 50 bookmarks by bookmark date
/x-bookmarks --all            ← full history (slow, use once)
```

The skill file (`SKILL.md`) instructs Claude to parse the flag, call `scripts/sync.sh` with the appropriate JSON body, and report the result. The shell script handles server startup, API call, and browser launch.

**First run:** Use `--all` to import full history. Subsequent runs use `--sync` (the default) which only fetches what's new since the last run.

**Auth:** No setup required. The scraper opens your actual Chrome browser window, which is already logged into X. If you're not logged in, Chrome will show the X login page — log in and re-run.

---

## Tech Decisions

**Why flat JSON files instead of SQLite/Postgres?**
No setup, no daemon, no migrations. Easy to inspect (`cat data/bookmarks.json`), backup (copy the file), or edit manually. At thousands of bookmarks the file stays under a few MB. If it ever gets slow, SQLite is a straightforward upgrade with no API changes.

**Why client-side search instead of server-side?**
With bookmarks loaded once at startup (limit 500), Fuse.js search is instant with no round-trips. The server already has a `?q` param stub for future server-side search if the collection grows large enough to matter.

**Why Playwright with `launchPersistentContext` instead of `browser-use`?**
Network response interception requires programmatic access to page events. The browser-use CLI doesn't expose this level of control. `launchPersistentContext` with the real Chrome directory gives us both session reuse and full Playwright API access.

**Why Claude Haiku for classification?**
Fast and cheap. The classification task (categorize a tweet into 6 buckets, suggest 2–5 tags) is well within Haiku's capability. At 150ms per request, a batch of 100 new bookmarks completes in ~20 seconds. Classification is optional — the app works without an API key.

**Why ESM throughout?**
Both server and client use `"type": "module"`. Consistent import syntax, no CommonJS/ESM interop issues, aligns with Vite's requirements.
