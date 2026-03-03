# Booked — Scaling Notes

Notes on the current architecture's limits and what would need to change to handle larger bookmark libraries.

---

## Current Reality (X Free Tier)

X free accounts cap bookmarks at roughly **800–1,000**. At that scale the app works fine as-is. These notes are for if that changes — X Premium reportedly removes the cap, and the limit has historically shifted.

---

## Bottlenecks by Component

### 1. Classifier — the biggest problem

`classifier.js` processes bookmarks **sequentially**, one at a time with a 150ms delay between each call.

| Library size | Classification time |
|---|---|
| 500 | ~5 min |
| 1,000 | ~11 min |
| 5,000 | ~54 min |
| 10,000 | ~1.8 hours |

**Fix:** Run concurrent Haiku calls with a concurrency limit (e.g., 10 at a time) instead of serial. `p-limit` or a simple semaphore implementation would work.

```js
// rough shape of the change
import pLimit from 'p-limit'
const limit = pLimit(10)

const results = await Promise.all(
  bookmarks.map(bm => limit(() => classifyBookmark(bm.text, bm.author.handle)))
)
```

At 10x concurrency, 10k bookmarks drops from ~1.8 hours to ~11 minutes. The Anthropic API rate limit for Haiku is generous — 10 concurrent calls is safe.

---

### 2. Scraper — slow but functional

The scraper scrolls the page and waits 2 seconds per scroll to let the network response arrive. For 10k bookmarks (~500 scroll pages) that's ~16 minutes of wait time before classification even starts.

Additional risks on long runs:
- **False stall detection**: currently stops after 5 consecutive rounds with no new bookmarks. A slow network response during a long run can trigger this early.
- **Session expiry**: the Playwright session may expire mid-run on a very long scrape.
- **No resume**: if it fails at 8k bookmarks, you start over.

**Fixes:**
- Increase stall threshold from 5 rounds to something like 15 for `--all` mode.
- Add a checkpoint file — periodically write scraped bookmarks to disk and resume from there if interrupted.
- Reduce scroll wait from 2s to 1.5s (risky — network responses need time to arrive; test before reducing).

---

### 3. Storage — will degrade past ~5k

`data.js` uses a flat JSON file (`bookmarks.json`) read and written in full on every operation. At 10k pretty-printed bookmarks the file is ~15–20MB.

**Problems at scale:**
- `readBookmarks()` loads the entire file into memory on every API request.
- `upsertBookmarks()` reads + rewrites the full file on every sync.
- Search (`?q=`) runs Fuse.js over the entire in-memory array — fine at 1k, slow at 10k.

**Fix:** Migrate to SQLite with `better-sqlite3`. It's zero-config (embedded, no server), keeps the "just works" property, and gives proper indexing and FTS5 full-text search. `data.js` is the only module that touches storage, so the swap is contained.

```
data/bookmarks.db  ← replaces bookmarks.json
```

The IMPROVEMENTS.md doc already notes this as a technical debt item.

---

### 4. Client pagination — cosmetic but noticeable

The React client fetches bookmarks with `limit=500`. At 1k bookmarks this is two fetches; at 10k it's fetching everything at once.

**Fix:** Virtual scrolling via `@tanstack/react-virtual` — render only the visible cards. The server already supports `limit` and `offset`, so cursor-based pagination is also viable. IMPROVEMENTS.md covers this.

---

## Recommended Upgrade Order

If you end up wanting to scale:

1. **Parallel classifier** — highest impact, ~1 day of work. Changes only `classifier.js`.
2. **SQLite storage** — second highest impact, ~2 days. Changes only `data.js` and server startup.
3. **Scraper checkpointing** — only matters if scrapes are failing mid-run. Add after hitting the problem.
4. **Virtual scrolling** — polish, do last.

---

## X Free Tier Bookmark Limit

As of early 2026, X free accounts appear to cap bookmarks at around **800**. The scraper's `--all` flag will naturally stop when X stops returning more. No code change needed to handle the limit — it's enforced by X's API, not the scraper.

If you upgrade to X Premium and the cap goes away, revisit the classifier parallelism change first — that's where the time goes.
