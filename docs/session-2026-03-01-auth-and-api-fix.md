# Session Summary: Auth Overhaul & X API Schema Fix
**Date:** March 1, 2026

## Overview

First live test of the scraper revealed two independent blockers: X's bot detection preventing login through Playwright Chromium, and a silent extraction failure caused by X restructuring their GraphQL user object in early 2025. Both were debugged and fixed. Session also produced a comprehensive documentation layer to make the repo easy for future agents and humans to navigate.

---

## Changes

### Auth: Chrome Profile → Playwright storageState

The original scraper used `chromium.launchPersistentContext()` with a copy of the user's real Chrome profile to inherit their X session. This approach hit two fatal incompatibilities:

- **Running Chrome blocks profile reuse** — macOS prevents a second process from opening the same profile directory
- **`--use-mock-keychain` breaks cookie decryption** — Playwright automatically adds this flag when launching Chrome, which prevents Chrome from accessing the macOS Keychain to decrypt existing cookies

**Fix:** Switched to Playwright's bundled Chromium with `storageState`. Session cookies are exported once (via Cookie-Editor Chrome extension) and saved to `data/playwright-session.json` in Playwright's own format. The scraper loads this file on every run — no Chrome dependency, no keychain issues.

Key change in `server/scraper.js`:
```js
// Before
const context = await chromium.launchPersistentContext(tempProfile, { channel: 'chrome', ... })

// After
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ storageState: SESSION_PATH })
```

**Why Cookie-Editor instead of `auth.js`:** X's bot detection triggers on Playwright Chromium's login flow (`/login` endpoint). The Cookie-Editor approach sidesteps this entirely — cookies are exported from the user's real, already-authenticated Chrome session.

---

### Auth: New Setup Scripts

**`server/import-cookies.js`** — converts a Cookie-Editor JSON export to Playwright `storageState` format and writes `data/playwright-session.json`. Filters to only X/Twitter domain cookies; ignores Google, Claude, etc.

**`server/auth.js`** — Playwright-native login flow as a fallback. Opens Chromium, waits for manual login, saves session via `context.storageState()`. Works if X doesn't trigger bot detection.

---

### Extraction Fix: X API Schema Change (early 2025)

The scraper was intercepting the correct GraphQL endpoint (200 OK, with pagination cursors), but `extractBookmarksFromResponse` returned 0 for every entry. Diagnosed by progressively logging the response structure.

**Root cause:** X moved user identity fields out of `user_results.result.legacy` into a new sub-object `user_results.result.core`. The `profile_image_url_https` moved to `user_results.result.avatar.image_url`.

| Field | Old path | New path |
|-------|----------|----------|
| `screen_name` | `...result.legacy.screen_name` | `...result.core.screen_name` |
| `name` | `...result.legacy.name` | `...result.core.name` |
| `profile_image_url_https` | `...result.legacy.profile_image_url_https` | `...result.avatar.image_url` |

**Fix in `server/scraper.js` — `extractBookmarksFromResponse`:**
```js
// Before (broken)
const user = core?.user_results?.result?.legacy || {}

// After (reads both locations, handles old and new schema)
const userResult = tweetCore?.user_results?.result
const userCore = userResult?.core || {}
const userLegacy = userResult?.legacy || {}
const user = {
  screen_name: userCore.screen_name || userLegacy.screen_name,
  name: userCore.name || userLegacy.name,
  profile_image_url_https: userResult?.avatar?.image_url || userLegacy.profile_image_url_https || ''
}
```

The fix is backward-compatible — fallbacks cover the old schema for any code paths that might encounter it.

---

### Documentation

Three docs produced this session, intended as long-term maintenance references:

**`docs/X_API_NOTES.md`** — Full annotated GraphQL response schema for the Bookmarks endpoint as of March 2026. Includes:
- Complete JSON shape with inline comments
- The breaking change table (old vs new field locations)
- How scroll-based pagination works (cursor entries + X's own frontend)
- `bookmarked_at` timestamp conversion note (seconds, not ms)
- Step-by-step "zero bookmark" diagnosis checklist

**`docs/TROUBLESHOOTING.md`** — Every failure mode encountered across both sessions, with exact commands to resolve each. Sections: Auth & Session, Zero Results, Server Issues, Classification, Data, Skill. Ends with an ordered debugging checklist.

**`docs/ARCHITECTURE.md`** — Added "Auth Setup" section (Option A cookie import, Option B Playwright) and updated the `server/scraper.js` description to reflect the new approach.

---

## Files Modified

| File | Changes |
|------|---------|
| `server/scraper.js` | Replaced Chrome profile copy with Playwright `storageState`; fixed user field extraction for 2025 X API schema; added session-expiry URL check |
| `server/auth.js` | New — Playwright-native one-time login script |
| `server/import-cookies.js` | New — converts Cookie-Editor JSON export → `data/playwright-session.json` |
| `docs/ARCHITECTURE.md` | Added Auth Setup section; updated scraper description |
| `docs/X_API_NOTES.md` | New — full X GraphQL schema reference with breaking change history |
| `docs/TROUBLESHOOTING.md` | New — operational troubleshooting guide |

---

## Debugging Method Used

The extraction bug was found by layered logging — each round narrowing scope:

1. Confirmed GraphQL calls were firing (URL + status in response handler)
2. Confirmed landing URL was not `/login` (session valid)
3. Logged `instructions[0].entries.length` → 22 entries exist
4. Logged `entry[i].entryId` → all start with `tweet-` (filter passes)
5. Made `try/catch` in extractor log instead of swallow silently
6. Logged `Object.keys(result)` → found `core`, `legacy`, `rest_id`
7. Logged `Object.keys(userResult.legacy)` and `Object.keys(userResult.core)` → found `screen_name` had moved to `core`

This approach — instrumenting one layer at a time without assumptions — is the reliable path for any future silent-failure extraction bugs.

---

## Architectural Notes

**`data/playwright-session.json` is the auth credential.** It's gitignored. When it expires (X sessions: 1–3 months), re-export cookies from Chrome using Cookie-Editor and run `import-cookies.js`. The file format is Playwright's `BrowserContext.storageState()` shape: `{ cookies: [...], origins: [] }`.

**X API schema is not stable.** The Bookmarks GraphQL endpoint has changed shape at least once (early 2025) and will change again. `docs/X_API_NOTES.md` is the reference. If extraction breaks silently (sync returns 0 with no error), the diagnostic checklist there is the starting point.

**The extractor's `try/catch` should log on error, not silently swallow.** During debugging we temporarily changed `} catch { return [] }` to `} catch (e) { console.log(e.message); return [] }`. Consider keeping this in production — silent swallowing was what made the schema change so hard to spot.

**Cookie-Editor export includes cookies from all open tabs** (Google, Claude, etc.) — `import-cookies.js` filters to `.x.com` and `.twitter.com` domains only. This is intentional and should stay that way.
