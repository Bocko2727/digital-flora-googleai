# Contributing to Digital Flora

## Branching

- Do not commit directly to `main`.
- Use focused branches. The catalog-foundation work uses `refactor/catalog-foundation`.
- Keep commits small, reversible and single-purpose.

## Commit messages

Use conventional prefixes: `chore:`, `docs:`, `refactor:`, `test:` and `fix:`.

## Plant content workflow

1. Add or import material as `draft`.
2. Preserve source images and raw AI output as provenance.
3. Add or improve structured record fields.
4. Run schema, image-path, duplicate-ID and safety-claim validation.
5. Have an editor review taxonomy, sources and risk content.
6. Publish only after the publication gate passes.

## Pull requests

Every pull request should state: scope, affected files, data impact, tests/validation run, risks, rollout plan and rollback plan. Do not include credentials, service-account files or environment-variable values in code, logs or screenshots.

## Safety

Never state that a plant is edible, medicinal or safe for people or animals without a supported identification and a source appropriate to that claim. Report uncertain identifications as uncertain.
