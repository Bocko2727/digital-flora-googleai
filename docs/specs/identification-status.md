# Spec: identification provenance status (T7)

## Why
`confidence` is free text, so an editor can type anything and AI output can look verified. CLAUDE.md §4.13 requires an explicit provenance status: manual / source-suggested / editor-confirmed / needs-review.

## Finding: no new column needed
Migration `20260921151658_add_gbif_taxonomy_fields.sql` already added `public.plants.taxonomy_status`:
- `text not null default 'manual-unverified'`;
- CHECK: `manual-unverified | source-suggested | editor-confirmed | needs-review`.

No application code used it. Adding an `identification_status` column would duplicate it, so this change wires up the existing column. **No schema change, no migration, no RLS change.** The existing plants RLS policies (editor/admin write, admin delete, public read) already cover it.

## Behaviour
| Where | Change |
|---|---|
| `GET /api/plants` (`src/db/plants.js`) | returns `taxonomyStatus` |
| `POST /api/plants` | optional `taxonomyStatus`, default `manual-unverified`; invalid value → 400 `INVALID_PLANT_INPUT` |
| `PUT /api/plants/:id` | `taxonomyStatus` is updatable by editor/admin; invalid value → 400 |
| Upload flow (AI analysis) | new records are created with `needs-review` |
| Detail modal | „Статус на идентификацията: <label>“ replaces the static „Наблюдаван образец“ |
| Editor form | dropdown with the 4 statuses |

Labels:
- `manual-unverified` → Ръчно въведено, непроверено
- `source-suggested` → Предложено от източник
- `editor-confirmed` → Потвърдено от редактор
- `needs-review` → За преглед

## Tests
- `tests/taxonomy-status.test.js`: allowed set matches the DB CHECK; invalid values rejected.
- `tests/e2e/taxonomy-status.spec.js`: the modal label, the dropdown pre-select, and the PUT body carries the chosen status.

## Backfill — NOT executed, needs owner approval (production data, CLAUDE.md §4.8)
Current production (2026-09-22): all 98 rows are `manual-unverified`, and all 98 are AI-sourced:
- 60 AI archive labels (`high/medium/low`);
- 28 AI display labels;
- 9 numeric AI scores;
- 1 „Вероятно (Vision анализ)“.

`manual-unverified` is therefore inaccurate for every row.

```sql
-- Backup first (rollback source):
create table if not exists public.plants_taxonomy_status_backup_20260923 as
  select id, taxonomy_status from public.plants;
-- Backfill:
update public.plants set taxonomy_status = 'needs-review', updated_at = now()
where taxonomy_status = 'manual-unverified';
-- Verify: expect 98 needs-review, 0 manual-unverified
select taxonomy_status, count(*) from public.plants group by 1;
-- Rollback:
update public.plants p set taxonomy_status = b.taxonomy_status
from public.plants_taxonomy_status_backup_20260923 b where b.id = p.id;
```
The backup table is itself a schema addition. Alternatively, the rollback can rely on the fact that every row was `manual-unverified` before (`update … set taxonomy_status='manual-unverified'`).
