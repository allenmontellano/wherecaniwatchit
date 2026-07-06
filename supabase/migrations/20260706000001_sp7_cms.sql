-- SP7: CMS & data-accuracy layer. Additive; idempotent; staging-first.

-- Confidence layer on availability
do $$ begin
  create type availability_confidence as enum ('high','medium','low');
exception when duplicate_object then null;
end $$;

alter table availability
  add column if not exists confidence availability_confidence not null default 'medium',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- One-time backfill: known-unreliable MOTN Disney+ PH aggregator rows
-- (26 on prod as of 2026-07-06; idempotent re-run safe).
update availability a
set confidence = 'low'
from platforms p
where a.platform_id = p.id
  and p.slug = 'disney'
  and a.region_code = 'PH'
  and a.source in ('api','cron');

-- Title overrides + local titles (no TMDB id)
alter table titles
  add column if not exists metadata_overrides jsonb not null default '{}'::jsonb;
alter table titles alter column tmdb_id drop not null;

-- Flag review provenance
alter table flags
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text check (resolution in ('accepted','rejected'));

create index if not exists idx_availability_confidence on availability(confidence);
