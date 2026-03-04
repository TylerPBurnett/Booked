# Troubleshooting Guide

Common problems and how to fix them.

---

## Auth & Session

### "No Playwright session found"

The `data/playwright-session.json` file doesn't exist. Run the one-time auth setup:

**Recommended (Cookie-Editor import):**
```bash
# 1. Install Cookie-Editor extension in Chrome: https://cookie-editor.com/
# 2. Go to x.com (logged in) → Cookie-Editor icon → Export → Export as JSON → save file
node server/import-cookies.js ~/Downloads/cookies.json
```

**Alternative (Playwright login):**
```bash
node server/auth.js
# Log in manually in the browser window that opens, then close it
```

---

### "Could not log you in now" (during auth.js)

X's bot detection blocks login through Playwright Chromium. Use the Cookie-Editor import instead:

```bash
node server/import-cookies.js ~/Downloads/cookies.json
```

See [Auth Setup in ARCHITECTURE.md](ARCHITECTURE.md#auth-setup) for the full flow.

---

### "X session expired"

Your `playwright-session.json` cookies have expired (X sessions last 1–3 months). Re-run the auth setup with fresh cookies:

```bash
# Export new cookies from Chrome using Cookie-Editor, then:
node server/import-cookies.js ~/Downloads/cookies.json
```

---

### Sync runs but immediately navigates to login page

Same as session expired — the cookies in `playwright-session.json` are no longer valid. Re-export from Chrome and re-import.

---

## Zero Results

### `{"newBookmarks":0,"totalScraped":0}` with no error

The scraper ran without throwing but captured nothing. Possible causes:

**1. Session not authenticated**
The page loaded but redirected to login *after* the URL check (rare). Verify by temporarily adding a screenshot:
```js
await page.screenshot({ path: '/tmp/booked-debug.png' })
```
Check if `/tmp/booked-debug.png` shows the login page or your bookmarks.

**2. X API response structure changed**
X occasionally restructures their GraphQL responses. Add temporary logging to the response handler:
```js
const timeline = json?.data?.bookmark_timeline_v2?.timeline
console.log('entries:', timeline?.instructions?.[0]?.entries?.length)
```
If entries > 0 but extraction returns 0, read `docs/X_API_NOTES.md` — specifically the "Diagnosing Zero-Bookmark Syncs" section.

**3. Empty bookmark list**
If your X account has no bookmarks (or they were all cleared), the API returns valid responses with 0 entries. Check x.com/i/bookmarks manually.

**4. Rate limiting**
Unlikely in normal use, but if X rate-limits the Bookmarks endpoint, responses return 429. The scraper's response handler silently skips non-200 responses. Add a log for non-OK responses to confirm.

---

## Server Issues

### Port 3333 already in use

```bash
lsof -ti:3333 | xargs kill -9
```

Then restart: `npm run start` from the Booked root.

### Server starts but API calls fail

Check that you're in the right directory:
```bash
cd /Users/tyler/Development/Booked
npm run start
```

In dev mode with hot reload:
```bash
npm run dev
```

### Build errors after editing client code

```bash
cd /Users/tyler/Development/Booked
npm run build
```

This rebuilds `client/dist/`. The server serves this directory in production mode.

---

## Classification

### All bookmarks are "Uncategorized" with no tags

The AI classifier requires `ANTHROPIC_API_KEY`. Without it, the classifier gracefully falls back to `Uncategorized + []` — the app still works, you just don't get auto-tags.

To enable:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
# Add to ~/.zshrc to persist
```

Then re-sync. Existing bookmarks can be re-classified via `POST /api/bookmarks/reclassify` (see IMPROVEMENTS.md).

### Classification is slow

Expected. Each bookmark makes an API call to Claude Haiku with a 150ms delay between requests to avoid rate-limiting. 100 new bookmarks ≈ 15–20 seconds of classification time.

---

## Data

### I accidentally deleted bookmarks or messed up tags

`data/bookmarks.json` is a flat JSON file — you can edit it directly. Open in any editor, find the record by `id` or `url`, and fix the fields. The editable fields are: `category`, `tags`, `notes`, `archived`.

A re-sync will never overwrite your edits — only `metrics` (likes/retweets/replies) are updated on existing records.

### bookmarks.json is getting large

At ~5,000 bookmarks the file stays under 5MB and reads are fast. If you hit performance issues, see the "Migrate from JSON to SQLite" section in IMPROVEMENTS.md — `data.js` is the only file that would change.

### Data location

```
/Users/tyler/Development/Booked/data/
├── bookmarks.json          ← all bookmark records (gitignored)
├── meta.json               ← lastSyncedAt, categories, totalBookmarks (gitignored)
└── playwright-session.json ← auth cookies (gitignored, contains secrets)
```

All three files are gitignored. Back them up manually if needed.

---

## Skill

### `/Booked` skill not found

Skills are loaded at session start. If the skill was created or modified during the current session, start a new Claude Code session.

### Skill exits with "No Playwright session found"

The `sync.sh` script checks for `data/playwright-session.json` before starting. Run the auth setup (see above), then retry.

### AI sort fails with `ANTHROPIC_API_KEY is required`

`/Booked --ai-sort` reclassifies existing bookmarks using Claude. Set your key in `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key
```

Then restart the server and re-run the command.

### Sync completes but browser doesn't open

`sync.sh` calls `open http://localhost:3333` at the end. If the browser doesn't open, navigate there manually. This is cosmetic — the sync itself succeeded.

---

## Debugging Checklist

When something goes wrong, run through this in order:

1. Is the server running? `curl -s http://localhost:3333/api/meta`
2. Does `data/playwright-session.json` exist? `ls -la /Users/tyler/Development/Booked/data/`
3. Does a sync attempt reach the browser? Watch for a Chromium window opening.
4. What does the server log say? Start server in foreground: `node server/index.js`
5. What URL does the page land on after navigation? Add `console.log(page.url())` after `page.goto`.
6. Are GraphQL responses being intercepted? Add `console.log(response.url())` to the response handler.
7. Are entries being extracted? Check `instructions[0].entries.length` from the response JSON.
