-- APPLIED on 2026-09-21 to project digital-flora (sxuxtsbyqjaodyuqebux) as
-- migration 20260921151658_add_gbif_taxonomy_fields, after explicit
-- approval of this exact SQL (CLAUDE.md rule #7). See
-- supabase/migrations/20260921151658_add_gbif_taxonomy_fields.sql for the
-- applied-migration stub. Verified post-apply: 98/98 rows intact, 0 rows
-- with gbif_taxonomy set, all 98 defaulted to taxonomy_status
-- 'manual-unverified'. Kept here unmodified below for its design notes and
-- rollback SQL — do not re-run it.
--
-- Target: public.plants (project digital-flora, sxuxtsbyqjaodyuqebux)
-- Purpose: Phase 2.1/2.2 GBIF taxonomic backbone (digital-flora-priority-1
-- plan). Adds storage for GBIF-sourced taxonomy candidates and a provenance
-- status, without touching any existing column, row, or the photos work
-- from Phase 1.1.
--
-- Design notes:
--   * One jsonb column (gbif_taxonomy) instead of ~10 flat columns
--     (kingdom/phylum/class/order/family/genus/species/...): keeps the
--     schema additive and avoids colliding with the existing `family` text
--     column, which holds the editor's own value, not GBIF's. The app layer
--     is responsible for diffing gbif_taxonomy against latin_name/family
--     and never silently overwriting the editor's values (plan requirement).
--   * taxonomy_status defaults to 'manual-unverified' for all 98 existing
--     rows — matches current reality (nothing has been GBIF-checked yet)
--     and requires zero backfill/migration of existing data.
--   * Both columns are nullable/defaulted — existing INSERT/UPDATE
--     statements in src/db/supabase-catalog.js keep working unmodified.
--
-- Expected gbif_taxonomy shape (documented, not DB-enforced):
-- {
--   "taxon_key": 123456,
--   "scientific_name": "Ajuga reptans L.",
--   "scientific_name_authorship": "L.",
--   "canonical_name": "Ajuga reptans",
--   "rank": "SPECIES",
--   "kingdom": "Plantae", "phylum": "Tracheophyta", "class": "Magnoliopsida",
--   "order": "Lamiales", "family": "Lamiaceae", "genus": "Ajuga", "species": "Ajuga reptans",
--   "taxonomic_status": "ACCEPTED",
--   "accepted_taxon_key": 123456,
--   "source_name": "GBIF",
--   "source_checked_at": "2026-09-21T00:00:00Z"
-- }

begin;

alter table public.plants
  add column if not exists gbif_taxonomy jsonb;

alter table public.plants
  add column if not exists taxonomy_status text not null default 'manual-unverified';

alter table public.plants
  add constraint plants_taxonomy_status_check
  check (taxonomy_status in ('manual-unverified', 'source-suggested', 'editor-confirmed', 'needs-review'));

comment on column public.plants.gbif_taxonomy is
  'GBIF Backbone Taxonomy lookup result for this record, saved only after editor confirmation. Never auto-published as verified fact.';
comment on column public.plants.taxonomy_status is
  'Provenance of the taxonomy fields: manual-unverified | source-suggested | editor-confirmed | needs-review.';

commit;

-- Preflight check (safe to run standalone, read-only): confirms the table
-- and row count are what this migration expects before applying it.
-- select count(*) as plant_count from public.plants; -- expect 98 (as of 2026-09-21)

-- ---------------------------------------------------------------------------
-- ROLLBACK (run only if this migration needs to be reverted)
-- ---------------------------------------------------------------------------
-- begin;
-- alter table public.plants drop constraint if exists plants_taxonomy_status_check;
-- alter table public.plants drop column if exists taxonomy_status;
-- alter table public.plants drop column if exists gbif_taxonomy;
-- commit;
