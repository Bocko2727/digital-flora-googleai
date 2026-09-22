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
