-- Fuzzy matching for misspellings via pg_trgm (similarity threshold 0.3).
create extension if not exists pg_trgm;

create index if not exists idx_titles_title_trgm on titles using gin (title gin_trgm_ops);

create or replace function search_titles_fuzzy(q text, y int, lim int, threshold real default 0.3)
returns setof titles
language sql
stable
as $$
  select t.*
  from titles t
  where similarity(t.title, q) >= threshold
    and (y is null or t.release_year = y)
  order by similarity(t.title, q) desc, t.imdb_rating desc nulls last
  limit lim;
$$;

grant execute on function search_titles_fuzzy(text, int, int, real) to anon, authenticated, service_role;
