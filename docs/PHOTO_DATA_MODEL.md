# Photo data model — Phase 1.1 decision

Scope: `plants.photos` and the photo upload/display path only. This is a
separate, narrower document from `docs/DATA_MODEL.md`, which describes an
aspirational whole-record schema that does not match the live `public.plants`
table. This file describes the *actual* live contract, verified against the
running Supabase project (`digital-flora`, `sxuxtsbyqjaodyuqebux`) and the
code paths that read/write it, and proposes the smallest additive change that
satisfies the Phase 1 photo requirements without breaking anything live.

## 1. Current live contract (verified, not guessed)

- `public.plants.photos` is a `jsonb` array of plain strings. Two formats
  coexist:
  - Legacy: a bare filename, e.g. `"File_006.png"` (from the original
    `data/review-results.json` import).
  - Current: a full public Storage URL, e.g.
    `https://sxuxtsbyqjaodyuqebux.supabase.co/storage/v1/object/public/plant-images/plants/{plantId}/{uuid}.jpg`.
- Write path: `src/storage/supabase-images.js` `storePlantImage()` — decodes
  a validated data-URI (JPEG/PNG/WebP, magic-byte checked, ≤5MB), uploads
  **one file, unmodified**, to the public `plant-images` bucket at
  `plants/{plantId}/{uuid}.{ext}`. No resize, no thumbnail, no compression,
  no EXIF stripping happens today.
- `server.js` `POST /api/plants/:id/photos` appends the new URL to the end
  of the existing `photos` array (`src/db/supabase-catalog.js`
  `updateSupabasePlant`). Order = upload order.
- Read/display path (`index.html`): `p.photos[0]` is the card/cover image
  (implicit "primary" by array position — there is no `is_primary` field).
  The detail modal cycles through `p.photos` with wraparound
  (`(photo + d + p.photos.length) % p.photos.length`). Every position in the
  array is rendered with the same URL for card, modal and edit form — there
  is no optimized/thumbnail distinction today.
- There is **no separate `photos` table** — photos live entirely inside the
  `plants.photos` jsonb array. `original`/`optimized`/`thumbnail` variants,
  per-photo metadata, and provenance do not exist in the schema today.

Verified live state (read-only SQL, 2026-09-21): 98 plants, 120 distinct
referenced photo entries, 122 stored objects in `plant-images`, 0 orphan
references, 2 known-unused files (`File_017.png`, `IMG_5512.jpg` — left
untouched per project rules).

## 2. Target model from the Phase 1 plan

The plan (`digital-flora-priority-1-integrations-plan.md`, 1.1) asks for,
per image: `original`, `optimized`, `thumbnail`, `ai_enhanced` (optional),
`metadata`, `provenance`, `is_primary`.

## 3. Proposed approach: additive, not a rewrite of `photos`

Do **not** change the shape or meaning of `plants.photos`. It keeps working
exactly as today (array of URLs/filenames, order = display order, index 0 =
cover) — this is what keeps legacy records and the current upload/display
code working unmodified.

Add a new, separate, nullable-by-default column instead, e.g.
`plants.photo_meta jsonb not null default '[]'`, holding one entry per photo
that has been processed or annotated, keyed by the existing URL/object key
so it can be joined against `photos` without renaming anything:

```json
[
  {
    "photo_ref": "plants/{plantId}/{uuid}.jpg",
    "original": "plants/{plantId}/{uuid}.jpg",
    "optimized": null,
    "thumbnail": null,
    "ai_enhanced": null,
    "metadata": { "width": null, "height": null, "mime": "image/jpeg", "bytes": null, "status": "original_only" },
    "provenance": "original",
    "is_primary": false
  }
]
```

Why this shape:
- **Zero migration for existing data.** All 98 plants start with
  `photo_meta = '[]'`; the UI/API fall back to today's behavior
  (`photos[0]` = primary) when there is no `photo_meta` entry for a photo —
  satisfies the plan's "новият upload flow може да продължи да работи с
  legacy records".
- **Original never overwritten.** `photos` (and the Storage object it
  points to) stays the untouched original; `photo_meta.optimized`/
  `thumbnail` reference *new*, separate Storage objects created by the
  "Подобри качество" button (Phase 1.3) — matches the plan's non-destructive
  requirement and the project's absolute-boundary rule against
  overwriting/deleting originals.
- **`is_primary` becomes explicit** instead of implicit-by-array-index, but
  defaults to matching current behavior (`photos[0]`) so nothing visibly
  changes until an editor picks a different primary.
- **No change to the public/private bucket model.** Everything stays in the
  current public `plant-images` bucket; this document does not propose a
  private-bucket/signed-URL migration (that is explicitly out of scope per
  the project's stop list).

This is a **proposal only** — no migration has been written or applied. Per
project rules, applying it requires a separate step with exact SQL, a
rollback plan, and explicit confirmation before running anything against the
production database.

## 4. Blocking decision found for Phase 1.2 (flagging now, not deciding)

`package.json` has **no image-processing library** (no `sharp`, no `jimp`,
nothing else capable of resize/re-encode/EXIF strip). `storePlantImage()`
today only validates and passes bytes through unchanged. Phase 1.2
(optimized/thumbnail generation, EXIF stripping) cannot be implemented
without either:
- adding a new dependency (blocked by project rule #10 — requires explicit
  approval before `npm install` of anything), or
- hand-rolling resize/re-encode without a library, which is not realistic
  for JPEG/PNG/WebP.

This is not something to resolve silently in 1.1 — it needs an explicit
decision from you before Phase 1.2 can start (which library, and your
approval to install it).

## 5. What this document does *not* do

- No schema change applied.
- No new dependency added.
- No change to the public bucket / signed-URL model.
- No change to `src/storage/supabase-images.js`, `src/db/supabase-catalog.js`,
  or `index.html` — all current behavior is unchanged.
