# Architecture

## Current state

Digital Flora currently contains a root static web client (`index.html`, `sw.js`, `manifest.json`), a Node server entry point (`server.js`), Firebase configuration artifacts, data-review JSON files, image-review assets, and a `src/db` database layer. This is an observed repository layout, not yet a confirmed runtime dependency graph.

## Inventory

- Client entry point: root `index.html`
- Service worker and PWA files: root `sw.js`, `manifest.json`, `icon.svg`
- Server candidate: root `server.js`
- Review data: `data/review-results.json`, `data/review-batch-c189987.json`
- Image-review assets: `images/review/`
- Firebase artifacts: root files and `app/applet/`
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
- Whether root Firebase files and `app/applet/` are both active.
- Whether JavaScript or TypeScript modules under `src/db/` are imported at runtime.
- Whether `server.js` is deployed and which host invokes it.

## Safe migration sequence

1. Establish automated validation while preserving the current file layout.
2. Add a canonical schema and adapters for existing formats.
3. Identify production imports and deployment entry points.
4. Move one category at a time with a manifest of old-to-new paths.
5. Keep old data immutable until import verification and rollback testing succeed.
