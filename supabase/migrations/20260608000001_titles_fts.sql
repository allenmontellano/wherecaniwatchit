-- Full-text search: weighted generated tsvector (title A, synopsis B, genres C, cast D),
-- a GIN index, and a ranked search RPC. "cast" is a reserved word -> quoted.
alter table titles add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(synopsis, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(genres, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce("cast", '{}'), ' ')), 'D')
  ) stored;

create index if not exists idx_titles_search_vector on titles using gin (search_vector);

create or replace function search_titles_fts(q text, y int, lim int)
returns setof titles
language sql
stable
as $$
  select t.*
  from titles t
  where t.search_vector @@ websearch_to_tsquery('english', q)
    and (y is null or t.release_year = y)
  order by
    (lower(t.title) = lower(q)) desc,
    ts_rank(t.search_vector, websearch_to_tsquery('english', q)) desc,
    t.imdb_rating desc nulls last
  limit lim;
$$;

grant execute on function search_titles_fts(text, int, int) to anon, authenticated, service_role;
