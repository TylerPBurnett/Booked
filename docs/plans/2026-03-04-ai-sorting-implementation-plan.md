# Implementation Plan: AI Sorting in `/Booked`

**Date:** 2026-03-04  
**Status:** Proposed  
**Goal:** Make AI sorting reliable, user-controlled, and scalable for both daily maintenance and full taxonomy redesign.

## 1. Product Shape

Use two explicit skill modes:

1. `/Booked --ai-sort` for conservative maintenance in the existing taxonomy.
2. `/Booked --ai-rebuild` for full taxonomy redesign with approval before apply.

This prevents high-risk "full reset" behavior from running in normal day-to-day sorting.

## 2. Data Model Additions

Add these fields to bookmark records:

- `aiConfidence: number | null`
- `aiSuggestedCategory: string | null`
- `aiSuggestedSubcategory: string | null`
- `aiClassifiedAt: string | null`
- `aiModel: string | null`
- `aiPromptVersion: string | null`

Purpose:

- Preserve AI provenance for review and debugging.
- Keep suggested destination visible when bookmark is sent to Triage.

## 3. Taxonomy Profile

Create `data/taxonomy-profile.json`:

```json
{
  "thresholds": {
    "autoApply": 0.85,
    "triage": 0.65
  },
  "protectedCategories": [],
  "sortingMode": "conservative"
}
```

Rules:

- If file is missing, server uses defaults above.
- `protectedCategories` blocks auto-reclassification for matching existing bookmark categories.
- `sortingMode` initially supports `conservative` only; reserved for future policies.

## 4. Classification Decision Policy

Given classifier output `{ category, subcategory, tags, confidence }`:

1. `confidence >= autoApply`  
   Apply `category/subcategory` directly.
2. `triage <= confidence < autoApply`  
   Set `category = "Triage"` and `subcategory = null`, while storing `aiSuggestedCategory` and `aiSuggestedSubcategory`.
3. `confidence < triage`  
   Set/keep `category = "Uncategorized"` and `subcategory = null`.

Tag behavior:

- Preserve existing `tags` by default.
- Replace tags only when `overwriteTags=true`.
- Always update `aiSuggestedTags`.

## 5. System Categories

Treat these as reserved system categories:

- `Uncategorized`
- `Triage`

Enforcement:

- Always present in category tree.
- Cannot be deleted.
- Cannot be renamed.
- Always rendered last, with `Uncategorized` final.

## 6. API Changes

## 6.1 Extend `POST /api/bookmarks/reclassify`

Add request fields:

- `dryRun?: boolean`
- `scope?: "all" | "uncategorized" | "category"`
- `category?: string`
- `limit?: number`
- `includeArchived?: boolean`
- `overwriteTags?: boolean`

Add response payload:

- `processed`
- `updated`
- `mode`
- `dryRun`
- `summary` with counts by outcome: `autoApplied`, `triaged`, `uncategorizedFallback`, `skippedProtected`
- `sample` with small set of proposed changes

Dry-run behavior:

- Computes and returns proposed changes.
- Writes nothing to disk.

## 6.2 Add `PUT /api/categories/replace`

Purpose:

- Atomically replace top-level category tree during `--ai-rebuild`.

Request:

```json
{
  "categories": [
    { "name": "Dev", "children": ["Frontend", "Backend"] },
    { "name": "Design", "children": ["UI", "Motion"] }
  ],
  "dryRun": false
}
```

Rules:

- Request must not include `Uncategorized` or `Triage`; server appends both.
- Validate uniqueness across all names.
- On apply, reset all bookmarks to `category="Uncategorized"` and `subcategory=null`.
- Write meta and bookmarks atomically.

Dry-run behavior:

- Returns validation and impact counts.
- Writes nothing.

## 6.3 Add `POST /api/bookmarks/reclassify/bulk-apply`

Purpose:

- Avoid agent sending one PATCH per bookmark.
- Allow batched server-side assignment for reliability.

Request:

```json
{
  "assignments": [
    {
      "id": "123",
      "category": "Dev",
      "subcategory": "Frontend",
      "aiSuggestedTags": ["react"],
      "aiConfidence": 0.91
    }
  ],
  "overwriteTags": false
}
```

Behavior:

- Validates assignment categories against current meta.
- Applies in a single write cycle.
- Returns applied count and rejects invalid entries.

## 7. Classifier Changes

Update `server/classifier.js` prompt and parsing:

- Require output JSON keys: `category`, `subcategory`, `tags`, `confidence`.
- Clamp confidence to `[0,1]`.
- Fallback confidence to `0` on parse errors.
- Include prompt version constant for traceability.

## 8. Skill Changes (`~/.agents/skills/Booked/SKILL.md`)

Support explicit command families:

1. `--ai-sort[=all|uncategorized|category:NAME]`
2. `--ai-rebuild`
3. `--dry-run`
4. Existing flags: `--limit`, `--include-archived`, `--overwrite-tags`

Execution flow:

1. `--ai-sort`  
   Call `POST /api/bookmarks/reclassify` directly.
2. `--ai-rebuild`  
   Fetch all bookmarks in pages, propose taxonomy in chat, revise on feedback, run categories replace dry-run, require explicit "apply", then apply and trigger batch reclassification.
3. `--help|--usage|--commands`  
   Print usage doc and exit.

## 9. UI Follow-Up (after backend/skill)

Add a focused Triage workflow:

- Sidebar `Triage` category with count.
- Card chips showing suggested target category/subcategory.
- Quick actions: Accept suggestion, change target, or keep uncategorized.
- "Apply all high-confidence suggestions" action.

This is not required for phase-1 backend delivery, but is required for complete user loop.

## 10. Test Plan

Server unit tests:

- `replaceCategoryTree` validation and reserved category enforcement.
- Decision policy mapping by confidence bands.
- Protected category skip behavior.

Server integration tests:

- `POST /api/bookmarks/reclassify` with dry-run and apply.
- `PUT /api/categories/replace` with dry-run and apply.
- `POST /api/bookmarks/reclassify/bulk-apply`.
- Idempotent reruns for rebuild operations.

Skill verification:

- `/Booked --ai-sort --dry-run`
- `/Booked --ai-sort=uncategorized`
- `/Booked --ai-rebuild --dry-run`

## 11. Rollout Sequence

1. Add data model fields and migration-safe reads.
2. Add taxonomy profile defaults and loader.
3. Extend classifier with confidence.
4. Upgrade `reclassify` endpoint with decision policy and dry-run.
5. Add `categories/replace` endpoint with dry-run and safeguards.
6. Add bulk-apply endpoint.
7. Update skill for `--ai-rebuild` flow.
8. Add docs and usage examples.
9. Add triage UI.

## 12. Acceptance Criteria

1. `/Booked --ai-sort --dry-run` returns actionable preview without writes.
2. `/Booked --ai-sort` applies confidence policy and preserves manual tags by default.
3. `/Booked --ai-rebuild` proposes taxonomy, waits for approval, then applies atomically.
4. Interruptions can be recovered safely via `--ai-sort=uncategorized`.
5. All new server tests pass.
