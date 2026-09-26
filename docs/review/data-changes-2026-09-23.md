# Production data changes — 2026-09-23

Owner-approved in chat (items 3a–3c of the nightly report,
`docs/review/nightly-report-2026-09-23.md`). Project `sxuxtsbyqjaodyuqebux`,
table `public.plants`. No schema, RLS, Auth or Storage change. No image was
uploaded, moved, overwritten or deleted.

Before: 98 plants, all `taxonomy_status = 'manual-unverified'`, 98 with a photo.
After: 99 plants, all `needs-review`, 99 with a photo.

## 1. `taxonomy_status` backfill (98 rows)

Every record is AI-sourced (spec: `docs/specs/identification-status.md`), so
`manual-unverified` was inaccurate.

```sql
update public.plants set taxonomy_status = 'needs-review', updated_at = now()
where taxonomy_status = 'manual-unverified';   -- 98 rows
```

Rollback (every row was `manual-unverified` before; the IMG_5512 record below is
not part of this rollback and is removed separately if needed):

```sql
update public.plants set taxonomy_status = 'manual-unverified'
where id <> '6ee821e7-f631-42d7-9a36-00a425c7a422';
```

## 2. Group-A AI safety/edibility claims (19 rows, `risks` only)

These are the 19 rows listed in `docs/review/ai-botanical-claims-2026-09-22.md`, group A. Each one
stated or implied that a plant was safe or edible, based only on an AI photo
identification (CLAUDE.md §4.13/§4.14). The new text for all 19 rows is:

> Няма проверени данни за токсичност. Не консумирайте и не използвайте за лечение без потвърждение от специалист.

The update was guarded by `id` and `md5(risks)` of the old text, so a record
edited in the meantime would not have been overwritten. 19/19 rows were updated.

The original texts are saved in `data/backups/risks-backup-2026-09-23.json`
(verified byte-exact against the database via md5 before the update).

Rollback: for each row in the backup, run
`update public.plants set risks = <risks> where id = <id>`. For example, this
script prints the statements:

```bash
node -e 'const b=require("./data/backups/risks-backup-2026-09-23.json");
const q=s=>"$r$"+s+"$r$";
for(const r of b.rows)console.log(`update public.plants set risks = ${q(r.risks)} where id = ${q(r.id)};`)'
```

## 3. IMG_5512 orphan photo → one `needs-review` record

`IMG_5512.jpg` was in Storage (`plant-images`) but in no record. Its AI
identifications conflict:
- *Teucrium polium* (Lamiaceae, medium);
- *Cistus sp.* (Cistaceae, low);
- an AI QA check said "Teucrium, not Cistus";
- re-verification stopped at a Gemini 429.

The record is deliberately conservative:

| Field | Value |
|---|---|
| id | `6ee821e7-f631-42d7-9a36-00a425c7a422` |
| common_name | Подъбиче? (неопределен вид) |
| latin_name | `cf. Teucrium sp.` (genus level, uncertain) |
| family | NULL — the two AI IDs disagree on the family |
| confidence | Неопределимо (AI — противоречиви идентификации) |
| taxonomy_status | `needs-review` |
| photos / source_file | `["IMG_5512.jpg"]` / `IMG_5512.jpg` (existing original, only referenced) |
| recognition | both AI IDs, marked "AI бележка (непроверена)" |
| risks | the neutral text above |
| source_record | provenance JSON (both AI IDs, QA verdict, 429 note) |

A botanist must confirm the species before the status changes.

Rollback: `delete from public.plants where id = '6ee821e7-f631-42d7-9a36-00a425c7a422';`
This deletes only the database row. The Storage file stays untouched either way.

`File_017.png` stays an orphan: there is no identification data for it at all.
