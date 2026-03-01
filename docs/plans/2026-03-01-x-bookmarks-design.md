# Design: X Bookmark Manager ("Booked")

**Date:** 2026-03-01
**Status:** Approved — ready for implementation

---

## Overview

A permanent local web app (`localhost:3333`) for managing X (Twitter) bookmarks. A Claude skill handles data fetching via browser automation; the app handles everything else — browsing, tagging, categorizing, searching, sorting.

Two concerns, cleanly separated:
- **Skill** = data fetcher (scrapes X, classifies, writes to disk)
- **App** = product you use (always running, full UI)

---

## Why Not the X API?

X's bookmarks API requires a paid tier. Instead, the skill uses `browser-use --browser real` to piggyback the user's existing Chrome session — no credentials stored, no auth setup, no API key.

---

## Project Location

```
/Users/tyler/Development/Booked/
├── docs/plans/                    ← design docs and implementation plans
├── server/
│   ├── index.js                   ← Express API (CRUD + serve client build)
│   ├── scraper.js                 ← browser-use orchestration + network interception
│   └── classifier.js              ← Claude API call for AI tag suggestions
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BookmarkCard.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── SortControls.jsx
│   │   │   ├── TagManager.jsx
│   │   │   └── BookmarkDetail.jsx
│   │   ├── hooks/
│   │   │   ├── useFuzzySearch.js
│   │   │   ├── useFilters.js
│   │   │   └── useBookmarks.js
│   │   └── App.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
├── data/
│   ├── bookmarks.json             ← all bookmark records
│   └── meta.json                  ← categories, tags, last-synced timestamp
└── package.json                   ← npm workspaces: [server, client]
```

---

## The Skill

**Location:** `~/.claude/skills/x-bookmarks/SKILL.md`

**Invocation:**
```
/x-bookmarks --sync            ← default: everything since last run
/x-bookmarks --range=week      ← bookmarks saved in last 7 days
/x-bookmarks --range=month     ← bookmarks saved in last 30 days
/x-bookmarks --range=year      ← bookmarks saved in last 365 days
/x-bookmarks --count=100       ← last N bookmarks regardless of date
/x-bookmarks --all             ← full history (slow, use once)
```

**What the skill does, in order:**

1. **Check Chrome** — confirm `browser-use --browser real` can reach X. If the user isn't logged in, prompt them to log in first.
2. **Open bookmarks** — navigate to `x.com/i/bookmarks` using the real Chrome session.
3. **Network interception** — intercept X's internal GraphQL `/Bookmarks` API responses as the page loads. These include `bookmarked_at` timestamps and full tweet metadata not available in the DOM.
4. **Scroll + collect** — scroll until the requested range or count is satisfied. Stop condition:
   - `--sync`: stop when `bookmarked_at < meta.lastSyncedAt`
   - `--range=*`: stop when `bookmarked_at < now - range`
   - `--count=N`: stop after collecting N unique bookmarks
   - `--all`: scroll to end of list
5. **Classify** — for each new bookmark, send tweet text to Claude and receive: suggested tags (array) + primary category (string). Existing user-set tags/categories are never overwritten.
6. **Upsert** — write to `data/bookmarks.json` using tweet ID as primary key. New bookmarks appended. Existing bookmarks: update `metrics` only; preserve `tags`, `category`, `notes`.
7. **Update meta** — write `lastSyncedAt = now` to `meta.json`.
8. **Open app** — launch `localhost:3333` in the browser.

---

## Data Model

### `data/bookmarks.json`

Array of bookmark objects:

```json
{
  "id": "1234567890",
  "url": "https://x.com/username/status/1234567890",
  "text": "Full tweet text content here...",
  "author": {
    "handle": "username",
    "name": "Display Name",
    "avatarUrl": "https://pbs.twimg.com/..."
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
  "tags": ["figma", "ui", "tools"],
  "aiSuggestedTags": ["figma", "ui", "tools"],
  "notes": "user freeform notes",
  "archived": false
}
```

### `data/meta.json`

```json
{
  "lastSyncedAt": "2026-03-01T09:00:00Z",
  "categories": ["Design", "Dev", "Tools", "Threads", "Reads", "Uncategorized"],
  "totalBookmarks": 874
}
```

**Deduplication:** tweet `id` is the primary key. On upsert, if `id` already exists: update `metrics`, skip all other fields unless they are still at defaults (i.e. user hasn't touched them).

---

## Web App

### Stack

- **Frontend:** React 18 + Tailwind CSS + Vite
- **Backend:** Express (serves API + static client build)
- **Search:** Fuse.js (client-side fuzzy search across text, author, tags)
- **State:** React hooks + `useBookmarks` custom hook (fetches from Express API)
- **Port:** 3333

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🔖 Booked               [🔍 fuzzy search................] [⚙] │
├──────────────┬──────────────────────────────────────────────┤
│              │  Sort: [Bookmarked ▾]  View: [■■ ☰]  874 items│
│  CATEGORIES  ├──────────────────────────────────────────────┤
│  All    874  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  Design 120  │  │ @handle  │  │ @handle  │  │ @handle  │   │
│  Dev    234  │  │ tweet... │  │ tweet... │  │ tweet... │   │
│  Tools   89  │  │ #tag #tag│  │ #tag     │  │ #tag #tag│   │
│  Threads  45 │  │ ♥ 1.2k  │  │ ♥ 340   │  │ ♥ 89    │   │
│  Reads   67  │  └──────────┘  └──────────┘  └──────────┘   │
│  Uncat.  319 │                                              │
│              │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  TAGS        │  │ ...      │  │ ...      │  │ ...      │   │
│  figma    34 │  └──────────┘  └──────────┘  └──────────┘   │
│  react    28 │                                              │
│  swift    19 │                                              │
│  design   45 │                [Load more]                   │
│  + New tag   │                                              │
│              │                                              │
│  [↻ Sync]    │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Bookmark Card

Each card shows:
- Author avatar + handle + display name
- Tweet text (truncated, expandable)
- Media thumbnail if present
- Tags as chips (clickable to filter)
- Category badge
- Metrics (likes, retweets)
- Relative bookmarked date ("3 days ago")

Click a card → **detail drawer** (slides in from right):
- Full tweet text
- All media full-size
- Notes field (free-form, auto-saved)
- Tag editor (add/remove tags)
- Category selector
- Link to original tweet

### Search

Fuse.js configured to search across:
- `text` (tweet content) — highest weight
- `author.handle` + `author.name`
- `tags`
- `notes`

Results ranked by fuzzy match score. Debounced 150ms.

### Sort Options

| Option | Field |
|--------|-------|
| Bookmarked (newest) | `bookmarkedAt` desc |
| Bookmarked (oldest) | `bookmarkedAt` asc |
| Posted (newest) | `postedAt` desc |
| Most liked | `metrics.likes` desc |
| Most retweeted | `metrics.retweets` desc |
| Author A–Z | `author.handle` asc |

### Filter Options

- Category (sidebar — single select)
- Tag (sidebar — multi select)
- Time range dropdown (this week / this month / this year / all time)
- Has media (toggle)
- Archived (toggle, off by default)

### Bulk Operations

Shift+click to multi-select cards. Toolbar appears:
- Add tag to selected
- Set category for selected
- Archive selected
- Export selected (JSON)

### Tag / Category Management (Settings modal)

- Rename tag or category
- Merge two tags
- Delete tag (clears from all bookmarks)
- Reorder categories
- View tag usage counts

---

## Express API

```
GET    /api/bookmarks          ← list (supports ?category, ?tag, ?q, ?sort, ?limit, ?offset)
GET    /api/bookmarks/:id      ← single bookmark
PATCH  /api/bookmarks/:id      ← update tags, category, notes, archived
DELETE /api/bookmarks/:id      ← remove from local store (not from X)

GET    /api/meta               ← categories, tags, lastSyncedAt, totalBookmarks
PATCH  /api/meta               ← update category list

POST   /api/sync               ← trigger a sync (calls scraper.js) — used by skill and UI sync button
```

---

## Skill File

The skill at `~/.claude/skills/x-bookmarks/SKILL.md` instructs Claude to:
1. Parse the flag(s) from the invocation
2. Use `browser-use --browser real` to execute the scraper script
3. Report how many new bookmarks were fetched and classified
4. Open `localhost:3333`

The scraper logic lives in `server/scraper.js` — the skill just invokes it via the Express API or directly via node.

---

## Non-Goals (explicitly out of scope)

- Syncing back to X (read-only, local management only)
- Multiple X accounts
- Mobile UI
- Cloud sync or backup
- Real-time X API integration

---

## Open Questions (deferred)

- If `browser-use --browser real` can't intercept network traffic due to HTTPS/CSP, fallback to DOM scraping with relative-date parsing for sort order only (no precise `bookmarkedAt`)
- Rate at which X throttles rapid scrolling — may need configurable scroll delay
