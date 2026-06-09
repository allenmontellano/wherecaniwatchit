# Sub-project 2 — Search Quality Pipeline (Tasks J + K + L + M)

**Date:** 2026-06-08
**Phase:** 3
**Status:** Design approved — ready for implementation plan
**Branch:** `feat/search-quality`

## Goal

Replace the current single-layer `ILIKE` title search with a layered, relevance-ranked
pipeline that tolerates abbreviations, filler words, misspellings, and multi-word
queries, and falls back to TMDB for unknown titles. Built and verified on staging
before production.

## Non-goals

- No UI changes. The API/response shape (`SyncedResult[]`) is unchanged.
- No new external services. TMDB fallback (M) already exists; we wire FTS/fuzzy in front of it.
- No connection pooling, cache headers, analytics, or load testing (later sub-projects).

## Decisions (locked during brainstorming)

1. **FTS query builder:** `websearch_to_tsquery('english', q)` — never errors on raw input,
   ANDs terms, supports quotes/negation. (Chosen over raw `to_tsquery`, which is brittle.)
2. **Execution:** Postgres **RPC functions** (`search_titles_fts`, `search_titles_fuzzy`)
   encapsulate ranking, the 0.3 trigram threshold, and ordering in SQL — one round-trip each.
3. **`search_vector`:** a **generated STORED `tsvector`** column (auto-maintained, no triggers,
   backfills on creation).
4. **Field weights:** title **A**, synopsis **B**, genres **C**, **cast D** (cast moved from C
   to D so it is strictly the lowest-signal field; combined with the exact-title boost this
   prevents a cast match from ever surfacing ahead of a direct title match).
5. **Normalizer returns a year filter:** `normalizeSearch(raw) → { query, year }`; `year` becomes
   a `release_year` filter in the RPCs, not just a stripped string.
6. **Test split:** TS layers (normalizer, `computeSearch` fall-through) are unit-tested (vitest,
   node); SQL relevance (FTS ranking, trigram misspellings) is verified by an integration
   script run against **staging** (no local Postgres in the test runner).
7. **Approval gates:** each migration applies to **staging first** (pause for approval), is
   verified, then to **production** (separate approval). Never prod before staging.

## Architecture

### Pipeline (`lib/search.ts` `computeSearch`, rewired)

```
raw query
  → normalizeSearch(raw)            (L) → { query, year }
  → cache lookup (key includes year)
  → searchByFts(query, year, limit) (J) websearch_to_tsquery, ranked
  → if 0 results → searchByFuzzy(query, year, limit)  (K) pg_trgm similarity ≥ 0.3
  → if 0 results → searchTMDB(query) (M) → quota-gated syncTitle()   [already built]
  → if 0 results → empty state
  → cache non-empty results + return
```

Each layer returns `SyncedResult[]`, so `computeSearch` falls through on empty. The
TMDB→seed step (M) is unchanged except that it now receives the normalized query and
only runs after FTS+fuzzy miss.

### Components

- **`lib/query-normalizer.ts` (new)** — `normalizeSearch(raw: string): { query: string; year: number | null }`.
  One normalizer, two consumers: search (this) and the cache key. Pipeline of pure steps:
  lowercase/trim → expand abbreviation (whole-string match) → strip filler phrases →
  extract+strip trailing year → strip season/episode suffix → collapse whitespace.
  - **Abbreviations (~25):** P&R, GoT, HIMYM, TBBT, AoT, LOTR, HOTD, TWD, BB, BCS, plus
    ~15 more popular ones (e.g. SVU, ASOUE, ATLA, F1, JJK, MHA, OITNB, IASIP, B99, SW,
    HP, POTC, F&F, MI, DBZ). Exact final list enumerated in the plan.
  - **Filler stripping:** `where can i watch`, `can i watch`, `watch`, `streaming`,
    `is on`, `available on`, `is`, and a trailing `on <platform>` pattern
    (e.g. `is parasite on netflix` → `parasite`).
  - **Year suffix:** trailing 19xx/20xx → `{ query, year }` (e.g. `Parasite 2019`).
  - **Season/episode suffix:** `season N`, `s<N>`, `episode N`, `ep N` → stripped.

- **`lib/cache.ts` (modified)** — the cache key derives from the normalized `{query, year}`
  (so `Parasite 2019` and `parasite` cache distinctly). Today's `normalizeQuery` is replaced
  by `normalizeSearch`; `searchCacheKey` keeps the `${appEnv()}:search:` prefix and appends
  the year when present.

- **`lib/search-db.ts` (modified)** — replace `searchLocalTitles` (ILIKE) with:
  - `searchByFts(query, year, limit): Promise<SyncedResult[]>` → `rpc('search_titles_fts', …)`
  - `searchByFuzzy(query, year, limit): Promise<SyncedResult[]>` → `rpc('search_titles_fuzzy', …)`
  Both reuse the existing availability join + `groupAvailabilityByRegion` to assemble results
  from the ranked title rows the RPC returns.

- **`lib/search.ts` (modified)** — `computeSearch` calls normalizer then the FTS→fuzzy→TMDB cascade.

### Migrations (side-effecting — approval-gated)

- **Migration J — `…_titles_fts.sql`:**
  ```sql
  alter table titles add column search_vector tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
      setweight(to_tsvector('english', coalesce(synopsis,'')), 'B') ||
      setweight(to_tsvector('english', array_to_string(coalesce(genres,'{}'), ' ')), 'C') ||
      setweight(to_tsvector('english', array_to_string(coalesce("cast",'{}'), ' ')), 'D')
    ) stored;
  create index idx_titles_search_vector on titles using gin (search_vector);
  ```
  Plus `search_titles_fts(q text, y int, lim int)` returning ranked `titles` rows:
  `where search_vector @@ websearch_to_tsquery('english', q) and (y is null or release_year = y)`
  `order by (lower(title)=lower(q)) desc, ts_rank(search_vector, websearch_to_tsquery('english',q)) desc, imdb_rating desc nulls last limit lim`.
  (`"cast"` is quoted — reserved word.)

- **Migration K — `…_titles_trgm.sql`:**
  ```sql
  create extension if not exists pg_trgm;
  create index idx_titles_title_trgm on titles using gin (title gin_trgm_ops);
  ```
  Plus `search_titles_fuzzy(q text, y int, lim int, threshold real default 0.3)`:
  `where similarity(title, q) >= threshold and (y is null or release_year = y)`
  `order by similarity(title, q) desc, imdb_rating desc nulls last limit lim`.

### Error handling

- RPC errors throw inside `searchByFts`/`searchByFuzzy`; `computeSearch` already wraps the
  cascade in try/catch → `source:'error'` notice (unchanged behavior, never throws to caller).
- Empty/notice/error results are never cached (existing rule preserved).

## Testing (TDD — failing test first)

- **`lib/query-normalizer.test.ts`** — every abbreviation, every filler phrase/example
  (`where can i watch severance`→`severance`, `is parasite on netflix`→`parasite`),
  year extraction (`Parasite 2019`→`{parasite,2019}`), season/episode stripping
  (`Severance season 2`→`severance`).
- **`lib/search.test.ts`** — `computeSearch` fall-through with the DB layer mocked:
  FTS hit returns first; FTS empty → fuzzy; fuzzy empty → TMDB; all empty → empty state.
- **`lib/search-db.test.ts`** — `searchByFts`/`searchByFuzzy` map RPC rows + availability
  join correctly (mocked supabase `rpc`).
- **Integration (`scripts/search-quality-check.ts`, run against staging)** — real RPC calls
  for the SQL-dependent cases: exact match, partial match, multi-word (`parks recreation`→
  `Parks and Recreation`), case-insensitive, zero-result→fuzzy, and misspellings
  (`Severence`→`Severance`, `Parasyte`→`Parasite`, `Brakeing Bad`→`Breaking Bad`). Doubles as
  the Phase 3 "20 test searches" quality check.
- Full `vitest run` green before marking any task complete.

## Success criteria

- `parks recreation` → "Parks and Recreation"; `Severence` → "Severance";
  `is parasite on netflix` → "Parasite"; `Parasite 2019` → "Parasite" (2019);
  exact title matches rank above partial; unknown titles fall back to TMDB + seed.
- All unit tests green; staging integration script passes the documented cases.

## Rollout / ordering

1. Build all code + migrations on `feat/search-quality` (TDD).
2. **Approval → apply migrations J & K to staging**; run integration script; spot-check.
3. Merge `feat/search-quality` → `staging`; verify on `staging.wherecaniwatchit.info`.
4. **Approval → apply migrations J & K to production**, then merge → `master` (prod deploy).

## Open dependency

- Migrations apply via the same Supabase CLI `db push` path used in Sub-project 1
  (direct connection; staging password already in `.env.staging.local`; production via the
  prod connection, requested at the prod gate).
