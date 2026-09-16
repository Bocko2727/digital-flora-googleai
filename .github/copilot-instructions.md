# Digital Flora — Copilot working rules

## Repository and branch
- Repository: Bocko2727/digital-flora-googleai
- Work only on `refactor/catalog-foundation` or an explicitly requested feature branch.
- Never modify `main` directly.
- Never merge a pull request, force-push, rewrite Git history, squash commits, or create a production deployment.

## Safety
- Never read, print, commit, log, expose, or request values from `.env`, API keys, tokens, passwords, cookies, service-role keys, or database URLs.
- Never put a server-side secret, including `SUPABASE_SERVICE_ROLE_KEY`, in browser/client code.
- Do not change Supabase schema, migrations, RLS, Auth, Storage bucket visibility/policies, environment variables, Vercel/Netlify settings, or cloud resources without asking first.
- Do not execute UPDATE or DELETE against Supabase production data without asking first.
- Do not delete plants, images, branches, files, deployments, or cloud resources without asking first and showing a rollback plan.
- Do not run `node --env-file=.env scripts/bulk-import-orphan-photos.js` unless explicitly asked for the exact files; it can create duplicate plant records.

## Git discipline
- Before changing files: inspect relevant files and explain the minimal proposed diff.
- Make one focused technical task per commit.
- Before `git add`, `git commit`, or `git push`: show the exact files, diff summary, commit message, and wait for approval.
- Never use `git add .` or `git add -A` without explicit approval.
- Run `git status --short` after work.

## Application behavior
- Architecture: Browser UI → REST API (`server.js`) → Supabase Postgres/Auth/Storage.
- AI analysis must remain server-side only.
- AI botanical results are suggestions, never verified scientific facts.
- Do not make unsupported claims about edibility, toxicity, medical use, or safety.
- Preserve existing legacy photo paths.
- Do not re-scan already verified healthy legacy photos unless a specific regression is being investigated.

## Current state
- Branch: `refactor/catalog-foundation`.
- Main remains protected and unchanged.
- Pagination and page-size selection (12/24/48) are implemented in `index.html`.
- Design includes sticky controls, A–Я jump, back-to-top button, and large/compact/list views.
- Do not replace numbered pagination with infinite scroll or a Load More flow.
- `images/uploads/` and `.vscode/` are local ignored paths.
- `scripts/bulk-import-orphan-photos.js` is committed but must not be run unless explicitly requested.
- Current priority is finishing remaining Day 2 audit/decisions before starting Priority 1.

## Validation
- Use the smallest relevant check first.
- Do not run broad dependency upgrades or `npm audit fix` without explicit approval.
- Do not alter GitHub Actions or deployment workflows without explicit approval.
- If a command could write data, install/update packages, alter Git, use `.env`, call external APIs, or change cloud state, ask for confirmation before running it.