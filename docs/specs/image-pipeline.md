# Spec: Image pipeline — original / optimized / thumbnail (T9, P1)
What it does: every plant photo is stored once as the untouched original, plus a web-optimized copy for the detail view and a small thumbnail for the grid. The catalog then loads fast on a phone and originals are never altered.

Done when:
- A new upload through `POST /api/plants/:id/photos` produces three Storage objects:
  - `plants/<id>/original/<uuid>.<ext>` — bytes identical to the upload, verified by SHA-256;
  - `plants/<id>/optimized/<uuid>.webp` — longest side ≤ 1600 px, around 200–400 KB;
  - `plants/<id>/thumb/<uuid>.webp` — longest side ≤ 400 px, around 20–40 KB.
- `photos[]` keeps one entry per photo. It becomes an object `{original, optimized, thumb, sha256, uploadedBy, uploadedAt, source: 'upload', processing: 'resize-v1'}`, while legacy string entries are still accepted (backward compatible). The grid uses `thumb`, the modal uses `optimized`, and a link opens `original`.
- A legacy photo (bare filename or plain URL) keeps rendering exactly as today.
- e2e: the grid `<img>` uses the thumbnail URL. The fallback still works when the thumbnail is missing.

Not included:
- Reprocessing the ~98 existing legacy photos (bulk legacy processing needs separate approval, §4.9/§4.12).
- „Подобри качество“ / AI enhancement (P3). Only a disabled placeholder button with a tooltip.
- Private bucket / signed URLs.

Touches: `src/storage/supabase-images.js`, `POST /api/plants/:id/photos`, `resolvePhotoUrl` and card/modal rendering in `index.html`, `appendSupabasePlantPhoto` (it must append an object).

Constraints:
- **Option A (recommended, zero new deps):** resize in the browser with `<canvas>` (the upload flow already does this for AI), then send original + optimized + thumb in one request. The server validates each part with `parsePlantImageDataUri` (magic bytes and size).
- **Option B:** server-side `sharp`. This is a new dependency with a native binary, affects Vercel bundle size and needs owner approval (§4.10).
- The Storage bucket `plant-images` already restricts MIME type and size (migration 20260908114244). Check that WebP is allowed.
- The body limit is 8 MB. Three parts fit: original ≤ 5 MB decoded ≈ 6.7 MB base64. Otherwise use separate requests.

Needs schema change: no. `photos` is already jsonb; objects inside it are a data-format change and need backward-compatible reads.

Provenance: `sha256` together with `uploadedBy`/`uploadedAt`/`processing` makes each derived file traceable to its untouched original (CLAUDE.md §3 P1).
