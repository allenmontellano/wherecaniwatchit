-- Full-text search: a weighted tsvector column (title A, synopsis B, genres C, cast D),
-- maintained by a trigger. A GENERATED column can't be used here because
-- array_to_string over genres/cast is not treated as IMMUTABLE; a trigger has no
-- such restriction. "cast" is a reserved word -> quoted.
alter table titles add column if not exists search_vector tsvector;

create or replace function titles_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.synopsis, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.genres, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new."cast", '{}'), ' ')), 'D');
  return new;
end;
$$;

drop trigger if exists titles_search_vector_trg on titles;
create trigger titles_search_vector_trg
  before insert or update of title, synopsis, genres, "cast" on titles
  for each row execute function titles_search_vector_update();

-- Backfill existing rows.
update titles set search_vector =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(synopsis, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(genres, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce("cast", '{}'), ' ')), 'D');

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
