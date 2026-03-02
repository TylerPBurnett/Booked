# X GraphQL API Notes

This document captures the current shape of X's internal Bookmarks GraphQL API as of March 2026. It exists because the response schema has changed before and will change again — this is the reference for debugging extraction failures.

---

## Endpoint

```
GET https://x.com/i/api/graphql/{operationId}/Bookmarks
```

The `operationId` hash changes with X deploys but the path always contains `/graphql/` and `Bookmarks`. The scraper matches on both substrings.

**Query params** (URL-encoded):
- `variables` — JSON with `count` (20), optional `cursor` for pagination
- `features` — JSON feature flags (large, changes frequently, doesn't affect parsing)

---

## Response Shape (current as of March 2026)

```
{
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            type: "TimelineAddEntries",
            entries: [ ...TweetEntry, ...CursorEntry ]
          }
        ],
        responseObjects: { ... }
      }
    }
  }
}
```

**Alternate path** (older API versions, kept as fallback):
```
data.bookmarks.timeline.instructions
```

---

## Entry Types

Each `instructions[].entries[]` item has:
- `entryId` — string. Tweet entries start with `tweet-`. Cursor entries start with `cursor-top-` or `cursor-bottom-`.
- `content` — varies by entry type

The scraper filters to `entryId.startsWith('tweet-')`.

---

## Tweet Entry Shape

```
entry {
  entryId: "tweet-{tweetId}"
  content: {
    __typename: "TimelineTimelineItem"
    entryType: "TimelineTimelineItem"
    itemContent: {
      __typename: "TimelineTweet"
      itemType: "TimelineTweet"
      tweetDisplayType: "Tweet"
      tweet_results: {
        result: {
          __typename: "Tweet"
          rest_id: "{tweetId}"
          core: {
            user_results: {
              result: {  ← THE USER OBJECT
                __typename: "User"
                rest_id: "{userId}"
                id: "{userId}"
                core: {                           ← screen_name/name here (NEW as of 2025)
                  screen_name: "handle"
                  name: "Display Name"
                  created_at: "Mon Jan 01 00:00:00 +0000 2020"
                }
                legacy: {                         ← stats/metadata here (NOT screen_name)
                  default_profile: bool
                  description: "bio"
                  followers_count: 1234
                  friends_count: 567
                  statuses_count: 890
                  profile_banner_url: "..."
                  ... (no screen_name, no name, no profile_image_url_https)
                }
                avatar: {
                  image_url: "https://pbs.twimg.com/profile_images/.../photo_normal.jpg"
                }
                is_blue_verified: bool
                profile_image_shape: "Circle"
              }
            }
          }
          legacy: {                               ← THE TWEET DATA
            full_text: "tweet content..."
            created_at: "Mon Jan 01 00:00:00 +0000 2026"
            bookmarked_at: 1234567890            ← Unix timestamp (seconds), reliable
            favorite_count: 1200
            retweet_count: 340
            reply_count: 89
            extended_entities: {
              media: [
                {
                  type: "photo" | "video" | "animated_gif"
                  media_url_https: "https://pbs.twimg.com/media/..."
                }
              ]
            }
            entities: {
              media: [ ... ]                     ← fallback if extended_entities absent
              urls: [ ... ]                      ← t.co shortlinks (scrubbed from text)
            }
          }
          source: "..."
          views: { count: "1234", state: "EnabledWithCount" }
        }
      }
    }
  }
}
```

---

## Breaking Change: User Fields (early 2025)

X moved user identity fields out of `user.legacy` into a new `user.core` sub-object.

| Field | Old location (pre-2025) | New location |
|-------|------------------------|--------------|
| `screen_name` | `user_results.result.legacy.screen_name` | `user_results.result.core.screen_name` |
| `name` | `user_results.result.legacy.name` | `user_results.result.core.name` |
| `profile_image_url_https` | `user_results.result.legacy.profile_image_url_https` | `user_results.result.avatar.image_url` |
| `created_at` | `user_results.result.legacy.created_at` | `user_results.result.core.created_at` |

The scraper's `extractBookmarksFromResponse` reads both locations with fallback:

```js
const userCore = userResult?.core || {}
const userLegacy = userResult?.legacy || {}
const user = {
  screen_name: userCore.screen_name || userLegacy.screen_name,
  name: userCore.name || userLegacy.name,
  profile_image_url_https: userResult?.avatar?.image_url || userLegacy.profile_image_url_https || ''
}
```

This handles both old and new schema versions without breaking.

---

## Pagination

Cursor entries in the `entries` array look like:

```json
{
  "entryId": "cursor-bottom-123456",
  "content": {
    "entryType": "TimelineTimelineCursor",
    "value": "HBbOzfaV8q2ryTMAAA==",
    "cursorType": "Bottom"
  }
}
```

X's client sends the cursor value as `variables.cursor` to fetch the next page. The scraper doesn't manually paginate — it scrolls the page and lets X's own frontend trigger the next API call, which the scraper intercepts. This is why the scroll loop works.

---

## `bookmarked_at` Timestamp

`legacy.bookmarked_at` is a Unix timestamp in **seconds** (not milliseconds). Conversion:

```js
new Date(legacy.bookmarked_at * 1000).toISOString()
```

This field is only present on bookmarked tweets (not on retweets, etc.). The scraper falls back to `new Date().toISOString()` if absent.

---

## Diagnosing Zero-Bookmark Syncs

If a sync returns `{"newBookmarks":0,"totalScraped":0}` with no error:

1. **Check URL after navigation** — if it contains `/login` or `/flow/login`, session expired. Re-run auth.

2. **Check if GraphQL calls are being intercepted** — add a `console.log` to the response handler for any URL containing `/graphql/`. If no Bookmark calls appear, X may be serving a cached page or the session isn't authenticated.

3. **Check entry count** — if calls are intercepted but entries are 0, X may be serving an empty response (rate limit, account issue).

4. **Check `entryId` format** — if entries exist but none start with `tweet-`, X changed their entry ID format. Update the filter.

5. **Check user fields** — if entries exist and `entryId` starts with `tweet-` but extraction returns null, check if `screen_name` moved again. Add logging:
   ```js
   console.log(Object.keys(userResult?.core || {}))
   console.log(Object.keys(userResult?.legacy || {}))
   ```
   Look for where `screen_name` is now and update the extractor.

---

## What Does NOT Change

- The endpoint path structure (contains `/graphql/` and `Bookmarks`)
- The top-level `data.bookmark_timeline_v2.timeline.instructions` path
- `entryId` prefixes (`tweet-`, `cursor-top-`, `cursor-bottom-`)
- `tweet_results.result.legacy` for tweet content (`full_text`, `created_at`, etc.)
- `tweet_results.result.rest_id` for tweet ID
- `bookmarked_at` being a Unix timestamp in seconds
