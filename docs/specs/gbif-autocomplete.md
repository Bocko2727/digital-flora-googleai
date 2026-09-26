# Spec: GBIF autocomplete for the Latin name (T10, P2)
What it does: while an editor types the Latin name, the form suggests matching accepted names from the GBIF Backbone Taxonomy (with family). Picking one fills the name and family and marks the record `taxonomy_status = 'source-suggested'` until the editor confirms it.

Done when:
- Typing ≥ 3 characters in `#e_lname` (debounced 300 ms) shows up to 8 suggestions from `https://api.gbif.org/v1/species/suggest?q=<text>&limit=8`. Each suggestion shows canonicalName, rank, status and family.
- Picking a suggestion:
  - fills latin name and family;
  - stores `{key, scientificName, canonicalName, rank, status, family, kingdom, fetchedAt}` in `gbif_taxonomy` (the column already exists);
  - sets `taxonomyStatus = 'source-suggested'`.
- Only an explicit editor action sets `editor-confirmed` (the dropdown from PR #17).
- GBIF being slow or down never blocks saving. The form works without suggestions and shows a small „GBIF недостъпен“ note.
- Tests mock GBIF with `page.route`; standard runs never call GBIF (CLAUDE.md §7).

Not included: Pl@ntNet photo identification, iNaturalist context, automatic re-classification of existing records, synonym resolution beyond showing `status`.

Touches: the editor form in `index.html`, `PUT /api/plants/:id` (accept `gbifTaxonomy` jsonb, validated shape, max size), `src/db/supabase-catalog.js` FIELD_MAP, and the CSP (`connect-src` add `https://api.gbif.org`) — or a server-side proxy `GET /api/taxonomy/suggest` with caching.

Constraints:
- GBIF is free, needs no key and has no terms to accept, but it is a new external API → owner approval (§4.10).
- **Recommended:** a server-side proxy with an in-memory LRU cache (24 h) and a rate limit. The browser then never calls GBIF directly, the CSP stays tight, and caching and mocking are easier.
- [BLOCKED in the nightly sandbox] `api.gbif.org` is blocked by the environment's egress policy, so no live check was possible. Verify it on a Vercel preview.

Needs schema change: no. `gbif_taxonomy jsonb` and `taxonomy_status` already exist (migration 20260921151658).
Depends on: PR #17 (taxonomy_status wiring).
