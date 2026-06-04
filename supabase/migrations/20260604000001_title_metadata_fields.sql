-- Add richer title metadata pulled from TMDB (used by the title detail + result cards).
-- All nullable + additive — safe to apply to an existing DB; sync backfills on next sync.
alter table titles
  add column if not exists network text,
  add column if not exists "cast" text[],
  add column if not exists creators text[],
  add column if not exists origin_country text,
  add column if not exists episode_count int,
  add column if not exists status text,
  add column if not exists original_language text,
  add column if not exists content_rating text;
