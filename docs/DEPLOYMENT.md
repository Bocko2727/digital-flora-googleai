# Deployment Plan

## Current finding

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
