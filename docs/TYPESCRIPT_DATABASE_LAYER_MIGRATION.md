# Runtime TypeScript Database-Layer Migration Plan

## Scope

This document plans a runtime migration for `src/db/` only. It does not delete or rename any `.js` or `.ts` file, change Supabase schema/RLS/Auth/Storage, migrate catalog data, or change deployment settings.

## Current state

- `server.js` is JavaScript and currently imports JavaScript modules from `src/db/`.
- `src/db/` contains parallel JavaScript and TypeScript modules from an incomplete TypeScript migration.
- `src/db/plants.js` is an active runtime dependency: it supplies `getSupabasePlants()` to `server.js`. It must not be removed as a generic duplicate.
- Supabase catalog reads use the JavaScript runtime path.

## Recommended strategy

Adopt a staged full runtime migration to TypeScript, compiling to a separate ignored output directory such as `dist/`. TypeScript becomes the source of truth only after parity testing; Node runs compiled JavaScript from `dist/`, not TypeScript through a production loader.

This is preferred over a permanent JavaScript consolidation because it preserves type checking for database contracts, avoids runtime TypeScript loaders, and gives an explicit cutover/rollback boundary.

## Stages

1. Add a `tsconfig.json` that emits `src/` and `server` runtime modules to `dist/` without changing the existing start command.
2. Port one low-risk database module at a time, preserving exported API shape and adding focused unit tests for its input/output mapping.
3. Port `plants` last because it is active and contains Cloud SQL fallback, JSON seed compatibility, and Supabase mapping behavior.
4. Add a CI type-check and a build smoke test while retaining current JavaScript runtime execution.
5. Change the runtime entry point to compiled output in a single dedicated deployment/runtime commit.
6. Only after a release window with parity evidence, remove superseded source files in separately traced and reviewed cleanup commits.

## Test plan

- Compile with `tsc --noEmit` during the adoption phase and `tsc` before a runtime cutover.
- Preserve existing QA: `node scripts/qa/validate-plant-data.js`, `node scripts/qa/scan-secrets.js`, and `node --test tests/plant-data-validation.test.js`.
- Add unit tests for `getSupabasePlants()` field mapping, confidence normalization, missing optional values, and empty/unavailable database behavior.
- Run HTTP checks against `GET /api/plants`; after Auth work lands, run role-matrix tests for catalog write endpoints.
- Run `npx fallow audit --format json --quiet` and a per-file trace before deleting any legacy module.

## Rollback

Before runtime cutover, rollback means removing the new build/type-check wiring while the current JavaScript runtime remains unchanged. After cutover, rollback means reverting only the dedicated runtime-entry commit to execute the known-good JavaScript entry point. Do not roll back by deleting catalog data, images, Supabase resources, or migrations.
