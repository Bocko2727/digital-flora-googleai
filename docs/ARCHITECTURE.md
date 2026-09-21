# Architecture

## Current state

Digital Flora currently contains a root static web client (`index.html`, `sw.js`, `manifest.json`), a Node server entry point (`server.js`), data-review JSON files, image-review assets, and a `src/db` database layer. The browser catalog UI uses the server REST API; Supabase is the target managed backend for the ongoing migration.

## Inventory

- Client entry point: root `index.html`
- Service worker and PWA files: root `sw.js`, `manifest.json`, `icon.svg`
- Server candidate: root `server.js`
- Review data: `data/review-results.json`, `data/review-batch-c189987.json`
- Image-review assets: `images/review/`
- Database candidates: `src/db/` with parallel JavaScript and TypeScript modules
- Automation: root scripts plus `scripts/`

## Architecture principles

1. GitHub is the source of truth for application code, documentation, schemas, validation logic and versioned draft/import data.
2. A published plant record must have one canonical, documented storage location. This decision is pending runtime verification.
3. Images must be referenced by stable relative paths or stable object identifiers; source files are never silently deleted or renamed.
4. AI output is evidence for a draft, not a published botanical fact.
5. The UI must consume a normalized published-record projection, not raw AI output.
6. Environment-specific configuration is supplied only through environment variables or the hosting-provider secret store.

## Target layout

```text
src/
  client/
  server/
  components/
  services/
  db/
public/
  images/
  icon.svg
  manifest.json
  sw.js
data/
  published/
  drafts/
  imports/
  archive/
scripts/
  qa/
  import/
  migration/
docs/
tests/
.github/workflows/
```

This is a migration target, not a directive to move existing files. Every move needs a file mapping, reference update, validation run and rollback path.

## Decisions pending verification

- Which module or service is the runtime source for plant profiles.
- Which Supabase services and policies are required before the managed backend becomes the catalog source of truth.
- Whether JavaScript or TypeScript modules under `src/db/` are imported at runtime.
- Whether `server.js` is deployed and which host invokes it.

## Accepted risks

- **`drizzle-kit` esbuild dev-server vulnerability (moderate, GHSA-67mh-4wv8-2f99).**
  `drizzle-kit` (devDependency, `^0.31.10`) depends on the deprecated
  `@esbuild-kit/esm-loader` package, which pulls a vulnerable `esbuild`
  (dev server accepts requests from any website while running). Checked
  2026-09-21: the latest available `drizzle-kit` release in this major line
  (`0.31.11`) still depends on the same `@esbuild-kit/esm-loader` chain, so
  there is no non-breaking fix today. `npm audit`'s only offered fix is a
  downgrade to `drizzle-kit@0.18.1` (13 minor versions back,
  `isSemVerMajor: true`), which risks breaking the schema/migration
  tooling for a dev-only exposure (the vulnerable code only runs while a
  developer has `drizzle-kit`'s local dev process open; it is never part of
  the deployed server or client bundle). Decision: leave as-is, revisit when
  `drizzle-kit` ships a release without `@esbuild-kit/esm-loader`.

## Safe migration sequence

1. Establish automated validation while preserving the current file layout.
2. Add a canonical schema and adapters for existing formats.
3. Identify production imports and deployment entry points.
4. Move one category at a time with a manifest of old-to-new paths.
5. Keep old data immutable until import verification and rollback testing succeed.
