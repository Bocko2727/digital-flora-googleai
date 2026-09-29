# Deployment Plan

## Current state (verified 2026-09-27)

- Vercel project `digital-flora-googleai` exists (framework `node`, Node 24.x), linked to this repository.
- Production deployments come from `main` (Production Branch since 2026-09-26 ~06:10 UTC; before that `refactor/catalog-foundation`, last build `da85adc`). Every merge into `main` deploys production; other branches get Preview deployments.
- `vercel.json` pins `installCommand: "npm ci"`: the project settings skip the install step, and without it every function crashes with `Cannot find package 'express'` (the 2026-09-26 outage).
- `server.js` default-exports the Express app; Vercel serves that export and the app does not listen on a port there.
- Database: from Vercel, `SUPABASE_DB_URL` must be the Supavisor Transaction pooler URI (`aws-*.pooler.supabase.com:6543`). The direct host `db.<ref>.supabase.co` is IPv6-only and fails with `getaddrinfo ENOTFOUND`. When the pool cannot connect, reads, role lookups and writes use the Supabase Data API instead (`src/db/supabase-rest.js`).
- `.github/workflows/static.yml` also deploys a static-only copy to GitHub Pages on every push to `main`.
- `CLAUDE.md` §2 is the maintained source for this section; the plan below is the original 2026-08-17 recommendation.

## Original finding (2026-08-17)

No Vercel project for Digital Flora was found during the 2026-08-17 inventory. No deployment resource has been created or modified.

## Recommended path

1. Keep GitHub as the code source of truth.
2. Make the application reproducible locally with documented install, development, lint, test and validation commands.
3. Add a pull-request CI gate before connecting hosting.
4. After the application entry point is confirmed, create one Vercel project linked to `Bocko2727/digital-flora-googleai`. This is a separate, explicitly approved action.
5. Use Preview deployments for pull requests and Production deployment only from `main` after merge.
6. Configure only named environment variables in Vercel; never commit their values.

## Environment configuration

- Store runtime secrets in the hosting provider's environment-variable store.
- Use distinct Preview and Production values when necessary.
- Do not expose server-only values through client-side bundles.
- Rotate a credential if it is ever committed, even if it was later removed.

## Rollout

- Validate the production build from a preview deployment.
- Check application routes, image loading, service worker behavior and data-validation output.
- Promote only an approved commit.

## Rollback

- Redeploy the prior known-good deployment.
- Revert the related Git commit through a pull request; do not edit production data as a substitute for a code rollback.
- Keep migration manifests and backups until the rollback window ends.
