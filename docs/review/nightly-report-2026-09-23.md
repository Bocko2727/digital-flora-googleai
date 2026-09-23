# Nightly QA follow-up — 2026-09-23 (autonomous session)

## T1 — Pre-deploy check (read-only)
- **Branches diverged.** `refactor/catalog-foundation` (production) and `main` have different histories: main carries the squash of PR #1. Main has 14 commits the production branch lacks; the production branch has 85 that main lacks by history but not by content. A fast-forward is impossible, and a plain `git merge` conflicts in 8 files.
- **Content:** production ⊂ main. The only differences are main's newer work (PR #12, docs PRs #8/#10), plus the old generic 2,800-line `SKILL.md` on production, which #8 replaced on purpose. No `supabase/` difference, so the Supabase GitHub integration applies no migration on deploy.
- **Vercel env vars (names only):**
  - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: Production, Preview and Development.
  - `SUPABASE_DB_URL`: Production and Preview.
  - `SUPABASE_SERVICE_ROLE_KEY`: Production and Preview.
  - All required variables are present.
- Findings:
  - `SUPABASE_SERVICE_ROLE_KEY` (Production) and `MCP_SERVER_TOKEN` are stored as *encrypted*, not *sensitive*, so Vercel flags them `readable-secret`. Recommend re-saving both as Sensitive (owner action).
  - **No `GEMINI_API_KEY` / Kilo key** exists in any Vercel environment. On production, AI analysis in `/api/upload` therefore fails, and uploading a new plant fails at the AI step. This is a product decision (paid) → owner.
  - No `SUPABASE_DB_CA_CERT`, so the DB TLS connection runs in relaxed mode (`rejectUnauthorized:false`). Adding it is free: copy the CA from the Supabase dashboard into a Vercel env var → owner.

## T2 — Deploy to production: PREPARED, NOT EXECUTED (needs owner "yes")
Production must receive main's exact tree without a force-push. Run after the PRs you want live are merged into main:
```bash
git fetch origin
TREE=$(git rev-parse origin/main^{tree})
C=$(git commit-tree "$TREE" -p origin/refactor/catalog-foundation -p origin/main \
     -m "deploy: sync refactor/catalog-foundation with main ($(git rev-parse --short origin/main))")
git diff --quiet origin/main "$C" && echo "tree identical to main"
git push origin "$C":refactor/catalog-foundation   # fast-forward of the prod branch, no --force
```
Live checks after the deployment is READY:
1. `GET /api/plants` → header `X-Catalog-Source: supabase`, 98 items, no AI item labelled „Потвърдено“.
2. `POST /api/upload` without a token → 401.
3. Vercel `get_runtime_errors` for 30–60 min → no new error clusters.

Rollback: promote the previous production deployment `dpl_5ZZUW3BGDxXkmCJVGAHLCmEZBEaQ` (Vercel → Deployments → … → Promote), or push a revert commit to the branch.

## T3 — Vercel deployments (read-only)
None of the 8 deployments marked for manual deletion is deleted yet: 3kkjn6, EGJwSn, 9RQVFs, 5TVmfn, 79bdwP, 8ZXjKm, EDB6TU, DoXMx7. Current production `5ZZUW3` is READY. New previews made after `.vercelignore` are small.

## T8 — Orphan photos (read-only; no action taken)
| File | In Storage | In plants.photos | AI identifications |
|---|---|---|---|
| IMG_5512.jpg | yes, 5.4 MB, 2026-09-16 | no | `review-results.json`: *Teucrium polium* (medium); `.bak`: *Cistus sp.* (low); `full_qa.md`: QA verdict **NO** (Teucrium, not Cistus); `fix_log.txt`: re-verification stopped by Gemini 429 (prepaid credits depleted) |
| File_017.png | yes, 1.5 MB, 2026-09-14 | no | none in the repo; `bulk-import-orphan-photos.js` excludes it as "handled separately" |

Options:
1. **Recommended for IMG_5512:** create one record with `taxonomy_status='needs-review'`, latin name „Teucrium sp.“ (genus level; the QA check agreed on Teucrium), and a note with both conflicting AI IDs. An owner/botanist confirms the species.
2. Keep both as orphans until a botanist looks. This is the recommended choice for File_017, which has no identification data at all.
3. Delete them. Not recommended: originals, irreversible (§4.9).

## T14 — Image fallback repo
`server.js` fetches missing images from `raw.githubusercontent.com/Bocko2727/digitalflora/main/…`. That repo **exists and is public** (e.g. `IMG_5763.jpg` → 200). It is a different repo from this one, and a missing image costs up to 3 outbound requests × 5 s.

Recommendation: since all catalog photos resolve to Supabase Storage in the UI, remove the GitHub fallback (keep the SVG placeholder), or point it at this repo. This is a small code PR; not done tonight because it changes image behaviour on production and needs your decision.

## T15 — Recommendations
- (a) `gemini-review.yml` auto-ran on every push to `images/review/**` and spent Gemini credits → **PR #18** makes it manual-only (free, reduces cost).
- (b) Legacy Cloud SQL code: `src/db/index.js`, `users.js`, `drive.js`, `schema.js`, `getSqlPlants`/`insertSqlPlant`/`updateSqlPlant`/`deleteSqlPlant`/`seedPlantsIfEmpty` in `plants.js`, all `.ts` duplicates, `drizzle.config.ts`, and the `drizzle-orm`/`drizzle-kit` deps. Nothing on the live path needs them: `SQL_HOST` is unset on Vercel. Proposal: remove them in one PR together with the `/api/users/sync` and `/api/drive/log` endpoints. It deletes legacy files, so it waits for your yes (§4.9).
- (c) Leaked Password Protection is **Pro plan only** (Supabase docs) → paid → not enabled. Free alternative: Auth → minimum password length ≥ 10 plus required character classes. That is a production Auth change → your yes.
- (d) `screenshot-baseline.yml`: not run tonight. Baselines should be generated **after** the UI PRs (#13, #17, CSP) are merged, otherwise they are stale immediately.

## Other findings
- `data/review-batch-c189987.json` is **invalid JSON**: a missing comma between objects around line 124/125. It is a legacy data file and was left unchanged.
- The server refuses to serve `/` from any path containing a dot-directory (`sendFile … dotfiles:'deny'`), so e2e can't run from `.claude/worktrees/…`. Harmless in production.
- The service worker reloaded the page on first visit → fixed in **PR #14**.
- `api.gbif.org` is blocked by this sandbox's egress policy, so the GBIF spec (T10) was not live-checked.

## Results table (end of session)
| Task | Status | Link |
|---|---|---|
| T1 pre-deploy check | done (report above) | #19 |
| T2 deploy | **prepared, waiting for owner** | commands above |
| T3 Vercel quota | done: nothing deleted yet | above |
| T4 e2e for PR #12 behaviour | done, 8 tests | #15 |
| T5 mobile overflow flake | root cause = SW first-load reload (no real overflow) → fixed in #14; extra race fixed | #14, #20 |
| T6 AI-text label + claims review list | done | #13 |
| T7 identification status | done, no migration (existing `taxonomy_status`); backfill waiting | #17 |
| T8 orphan photos | trace done, no action | above |
| T9 image pipeline | spec | #19 |
| T10 GBIF autocomplete | spec (live check blocked by sandbox egress) | #19 |
| T11 CSP without 'unsafe-inline' | done, 42/42 handlers | #21 |
| T12 lint + validator test | done | #16 |
| T13 server pagination | spec | #19 |
| T14 image fallback repo | recommendation | above |
| T15 recommendations | (a) done in #18; (b)(c) waiting; (d) after UI merges | #18 |

## Waiting for owner approval
1. **Merge** (yours). Recommended order:
   - #14 (SW reload fix; stabilises e2e) → #20 → #16 → #15 → #13 → #17 → #18 → #19;
   - then #21 (CSP) last. I will first merge `main` into #21 and move the #13/#17 changes into `app.js`.
2. **Deploy** to production: commands in T2, after the merges.
3. **Supabase data**:
   - backfill `taxonomy_status` → `needs-review` (98 rows, SQL in #17);
   - rewrite the group-A AI safety/edibility texts (list in #13);
   - IMG_5512 → needs-review record (T8, option 1).
4. **Settings (production)**:
   - Vercel: re-save `SUPABASE_SERVICE_ROLE_KEY` and `MCP_SERVER_TOKEN` as Sensitive;
   - add `SUPABASE_DB_CA_CERT`;
   - Supabase Auth: password minimum length and character classes.
5. **Paid** (yours to decide): a Gemini key on Vercel, needed for AI analysis when uploading a new plant; Leaked Password Protection (Pro plan).
6. **Legacy deletion**: the Cloud SQL code (T15b), and removing or redirecting the GitHub image fallback (T14).
7. **Manual**: delete the 8 old Vercel deployments.

## Guarantees for this session
- No merge.
- No production deploy.
- No schema, RLS, Auth or Storage change.
- No INSERT/UPDATE/DELETE on production data; only read-only SELECTs.
- No original image touched or deleted.
- No force-push or history rewrite.
- No secrets displayed or committed; env vars were read by name only.
- No paid AI/API calls.
- No AI text presented as verified botanical fact.
