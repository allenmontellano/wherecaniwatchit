-- Ranking tuning: down-rank supplementary content (featurettes, reunions, specials,
-- "making of", etc.) so canonical titles win ambiguous queries. Re-creates
-- search_titles_fts with a new sort key ABOVE ts_rank. The penalty only re-orders;
-- it never filters a row out. Exact title match still ranks first. The trigger,
-- search_vector column, and GIN index from 20260608000001 are unchanged.
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
    (t.title ~* '(behind the scenes|making of|paleyfest|featurette|deleted scene|bloopers?|gag reel|\mextras?\M|\mclips?\M|sneak peek|first look|red carpet|press conference|panel|\mreunions?\M|\mspecials?\M)') asc,
    ts_rank(t.search_vector, websearch_to_tsquery('english', q)) desc,
    t.imdb_rating desc nulls last
  limit lim;
$$;

grant execute on function search_titles_fts(text, int, int) to anon, authenticated, service_role;
