# Search Quality Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ILIKE title search with a layered, relevance-ranked pipeline: normalize → Postgres full-text (FTS) → pg_trgm fuzzy → TMDB fallback.

**Architecture:** A pure query normalizer (`lib/query-normalizer.ts`) returns `{ query, year }`. `computeSearch` calls it, then cascades through two Postgres RPCs (`search_titles_fts`, `search_titles_fuzzy`) and finally the existing TMDB→seed step. A generated `tsvector` column (title A, synopsis B, genres C, cast D) + GIN index power FTS; a pg_trgm GIN index powers fuzzy (threshold 0.3).

**Tech Stack:** Next.js 16, TypeScript strict, Vitest (node), Supabase (Postgres FTS + pg_trgm), Supabase CLI for migrations.

**Reference spec:** `docs/superpowers/specs/2026-06-08-search-quality-pipeline-design.md`

---

## File Structure

- **Create** `lib/query-normalizer.ts` — `normalizeSearch(raw) → { query, year }`; abbreviations, filler, on-platform strip, year + season/episode extraction.
- **Create** `lib/query-normalizer.test.ts` — exhaustive unit tests.
- **Modify** `lib/cache.ts` — drop `ABBREVIATIONS`/`normalizeQuery`; add `slugify`; `searchCacheKey(query, year)`.
- **Modify** `lib/cache.test.ts` — replace normalizeQuery tests with slugify/key tests.
- **Modify** `lib/search-db.ts` — replace `searchLocalTitles` with `searchByFts` + `searchByFuzzy` (RPC) sharing an `assembleResults` helper.
- **Modify** `lib/search-db.test.ts` — add mapping tests for the two new functions (mocked supabase).
- **Modify** `lib/search.ts` — `computeSearch` cascade FTS→fuzzy→TMDB; `performSearch` uses `normalizeSearch`.
- **Modify** `lib/search.test.ts` — mock `searchByFts`/`searchByFuzzy`; add fuzzy fall-through test.
- **Create** `supabase/migrations/20260608000001_titles_fts.sql` — generated column + GIN + `search_titles_fts`.
- **Create** `supabase/migrations/20260608000002_titles_trgm.sql` — pg_trgm + trgm index + `search_titles_fuzzy`.
- **Create** `scripts/search-quality-check.ts` — staging integration script (real RPCs).

**Ordering:** code+migration files (Tasks 1–7, TDD) → apply migrations to staging + verify (Task 8, GATED) → deploy staging (Task 9) → apply to prod + deploy (Task 10, GATED).

---

## Task 1: Query normalizer (L)

**Files:**
- Create: `lib/query-normalizer.ts`
- Test: `lib/query-normalizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/query-normalizer.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeSearch } from './query-normalizer'

const q = (s: string) => normalizeSearch(s).query
const y = (s: string) => normalizeSearch(s).year

describe('normalizeSearch — abbreviations (whole-string)', () => {
  it.each([
    ['P&R', 'parks and recreation'],
    ['got', 'game of thrones'],
    ['HIMYM', 'how i met your mother'],
    ['tbbt', 'the big bang theory'],
    ['AoT', 'attack on titan'],
    ['lotr', 'the lord of the rings'],
    ['HOTD', 'house of the dragon'],
    ['twd', 'the walking dead'],
    ['bb', 'breaking bad'],
    ['bcs', 'better call saul'],
    ['f&f', 'fast and furious'],
    ['ahs', 'american horror story'],
  ])('%s -> %s', (input, expected) => {
    expect(q(input)).toBe(expected)
  })

  it('only expands whole-string matches, not substrings', () => {
    expect(q('abba')).toBe('abba') // contains "bb" but is not the abbreviation
  })
})

describe('normalizeSearch — filler stripping', () => {
  it('strips leading "where can i watch"', () => {
    expect(q('where can i watch severance')).toBe('severance')
  })
  it('strips "is ... on <platform>"', () => {
    expect(q('is parasite on netflix')).toBe('parasite')
  })
  it('strips leading "watch"', () => {
    expect(q('watch the office')).toBe('the office')
  })
  it('strips trailing "streaming"', () => {
    expect(q('severance streaming')).toBe('severance')
  })
  it('does NOT strip "on" from a legitimate title', () => {
    expect(q('on the road')).toBe('on the road')
    expect(q('watch on the road')).toBe('on the road')
    expect(q('lost on you')).toBe('lost on you')
  })
})

describe('normalizeSearch — year + season/episode suffixes', () => {
  it('extracts a trailing year as a filter', () => {
    expect(normalizeSearch('Parasite 2019')).toEqual({ query: 'parasite', year: 2019 })
  })
  it('leaves query without a year as year=null', () => {
    expect(normalizeSearch('parasite')).toEqual({ query: 'parasite', year: null })
  })
  it('strips season/episode suffixes', () => {
    expect(q('Severance season 2')).toBe('severance')
    expect(q('severance s2')).toBe('severance')
    expect(q('the bear episode 3')).toBe('the bear')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/query-normalizer.test.ts`
Expected: FAIL — cannot find module `./query-normalizer`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/query-normalizer.ts
export interface NormalizedQuery {
  query: string
  year: number | null
}

// Whole-string abbreviations (the entire query must equal the key).
const ABBREVIATIONS: Record<string, string> = {
  'p&r': 'parks and recreation',
  got: 'game of thrones',
  himym: 'how i met your mother',
  tbbt: 'the big bang theory',
  aot: 'attack on titan',
  lotr: 'the lord of the rings',
  hotd: 'house of the dragon',
  twd: 'the walking dead',
  bb: 'breaking bad',
  bcs: 'better call saul',
  svu: 'law and order special victims unit',
  asoue: 'a series of unfortunate events',
  atla: 'avatar the last airbender',
  jjk: 'jujutsu kaisen',
  mha: 'my hero academia',
  oitnb: 'orange is the new black',
  iasip: "it's always sunny in philadelphia",
  b99: 'brooklyn nine nine',
  sw: 'star wars',
  hp: 'harry potter',
  potc: 'pirates of the caribbean',
  'f&f': 'fast and furious',
  mi: 'mission impossible',
  dbz: 'dragon ball z',
  ahs: 'american horror story',
}

// Known streaming platforms (+ aliases), longest forms first so multi-word
// aliases win. Used only for the anchored trailing "on <platform>" strip.
const PLATFORMS = [
  'netflix',
  'disney plus', 'disney\\+', 'disney',
  'prime video', 'amazon prime', 'prime', 'amazon',
  'hbo max', 'hbo', 'max',
  'hulu',
  'apple tv\\+', 'apple tv', 'apple',
  'paramount plus', 'paramount\\+', 'paramount',
  'peacock', 'crunchyroll', 'stan', 'binge',
].join('|')

// Trailing "(connector) <platform>": connectors longest-first.
const ON_PLATFORM = new RegExp(
  `\\s+(?:available on|streaming on|is on|now on|on)\\s+(?:${PLATFORMS})\\s*$`,
  'i'
)
const SEASON_EPISODE = /\s+(?:season\s+\d+|s\d+|episode\s+\d+|ep\s+\d+|part\s+\d+)\s*$/i
const LEADING_FILLER = /^(?:where can i watch|where to watch|can i watch|how to watch|watch|is)\s+/i
const TRAILING_FILLER = /\s+(?:streaming|online|free)\s*$/i
const TRAILING_YEAR = /\s+(19|20)\d{2}\s*$/

export function normalizeSearch(raw: string): NormalizedQuery {
  let s = raw.toLowerCase().trim().replace(/\s+/g, ' ')

  const expanded = ABBREVIATIONS[s]
  if (expanded) return { query: expanded, year: null }

  let year: number | null = null
  const ym = s.match(TRAILING_YEAR)
  if (ym) {
    year = parseInt(ym[0].trim(), 10)
    s = s.slice(0, ym.index).trim()
  }

  s = s.replace(SEASON_EPISODE, '').trim()
  s = s.replace(ON_PLATFORM, '').trim()
  s = s.replace(LEADING_FILLER, '').trim()
  s = s.replace(TRAILING_FILLER, '').trim()
  s = s.replace(/\s+/g, ' ').trim()

  return { query: s, year }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/query-normalizer.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/query-normalizer.ts lib/query-normalizer.test.ts
git commit -m "feat: add query normalizer with abbreviations, filler, year/season parsing"
```

---

## Task 2: Move normalization out of cache; key by {query, year}

**Files:**
- Modify: `lib/cache.ts`
- Modify: `lib/cache.test.ts`

- [ ] **Step 1: Update the tests**

In `lib/cache.test.ts`, the `normalizeQuery` abbreviation tests now live in Task 1. Remove any `normalizeQuery` import/tests from this file and replace the key tests. Keep the `afterEach(() => vi.unstubAllEnvs())` and env-isolation test from before. The key assertions become:

```ts
import { searchCacheKey, titleCacheKey } from './cache'

it('slugifies and namespaces a search key', () => {
  expect(searchCacheKey('Parks and Recreation')).toBe('production:search:parks-and-recreation')
})

it('appends the year when present', () => {
  expect(searchCacheKey('Parasite', 2019)).toBe('production:search:parasite-2019')
})

it('prefixes title keys with the environment', () => {
  expect(titleCacheKey('abc-123')).toBe('production:title:abc-123')
})

it('isolates staging keys from production', () => {
  vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
  expect(searchCacheKey('severance')).toBe('staging:search:severance')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/cache.test.ts`
Expected: FAIL — `searchCacheKey` doesn't accept a year / `normalizeQuery` import removed.

- [ ] **Step 3: Update `lib/cache.ts`**

Remove the `ABBREVIATIONS` constant and the `normalizeQuery` function. Replace them with a local `slugify`, and update `searchCacheKey`:

```ts
import { appEnv } from './env'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function searchCacheKey(query: string, year: number | null = null): string {
  const slug = slugify(query)
  return `${appEnv()}:search:${year ? `${slug}-${year}` : slug}`
}
```

Leave `titleCacheKey`, TTLs, and `getCached`/`setCached`/`delCached` unchanged.

- [ ] **Step 4: Run tests + full suite**

Run: `npm test -- lib/cache.test.ts && npm test`
Expected: cache tests PASS. The full suite may show failures in `search.test.ts` (it references the old shape) — that's expected and fixed in Task 6. If any OTHER file imports `normalizeQuery` from cache, update it to import `normalizeSearch` from `@/lib/query-normalizer` (grep: `git grep -n normalizeQuery`).

- [ ] **Step 5: Commit**

```bash
git add lib/cache.ts lib/cache.test.ts
git commit -m "refactor: key search cache by normalized query + year; drop cache-local normalizer"
```

---

## Task 3: Migration J — FTS column, index, RPC

**Files:**
- Create: `supabase/migrations/20260608000001_titles_fts.sql`

(No unit test — SQL behavior is verified by the staging integration script in Task 7/8. Writing the file is not a side effect; applying it is, and is gated in Task 8.)

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Verify it parses (dry, no apply)**

Run: `git grep -c "search_titles_fts" supabase/migrations/20260608000001_titles_fts.sql`
Expected: prints `2` (function defined + granted). (Real execution happens against staging in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608000001_titles_fts.sql
git commit -m "feat: migration for FTS search_vector column, GIN index, and ranked RPC"
```

---

## Task 4: Migration K — pg_trgm extension, index, fuzzy RPC

**Files:**
- Create: `supabase/migrations/20260608000002_titles_trgm.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Verify it parses (dry, no apply)**

Run: `git grep -c "search_titles_fuzzy" supabase/migrations/20260608000002_titles_trgm.sql`
Expected: prints `2`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608000002_titles_trgm.sql
git commit -m "feat: migration for pg_trgm fuzzy matching index and RPC"
```

---

## Task 5: `searchByFts` + `searchByFuzzy` (replace `searchLocalTitles`)

**Files:**
- Modify: `lib/search-db.ts`
- Test: `lib/search-db.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/search-db.test.ts`:

```ts
import { vi } from 'vitest'
import { searchByFts, searchByFuzzy } from './search-db'

function mockSupabase(titleRows: unknown[], availRows: unknown[]) {
  const availChain = {
    select: () => availChain,
    in: () => availChain,
    eq: () => Promise.resolve({ data: availRows, error: null }),
  }
  return {
    rpc: vi.fn().mockResolvedValue({ data: titleRows, error: null }),
    from: vi.fn().mockReturnValue(availChain),
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'

const aTitle = { id: 't1', tmdb_id: 1, title: 'The Matrix', type: 'movie' }

describe('searchByFts', () => {
  it('calls the FTS rpc with query/year/limit and assembles availability', async () => {
    const sb = mockSupabase([aTitle], [{ title_id: 't1', region_code: 'US', platform: { slug: 'netflix' } }])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    const res = await searchByFts('the matrix', null, 5)
    expect(sb.rpc).toHaveBeenCalledWith('search_titles_fts', { q: 'the matrix', y: null, lim: 5 })
    expect(res).toHaveLength(1)
    expect(res[0].title.id).toBe('t1')
    expect(res[0].availabilityByRegion).toEqual({ US: ['netflix'] })
  })
  it('returns [] when the rpc yields no rows', async () => {
    const sb = mockSupabase([], [])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    expect(await searchByFts('nope', null, 5)).toEqual([])
  })
})

describe('searchByFuzzy', () => {
  it('calls the fuzzy rpc with threshold 0.3', async () => {
    const sb = mockSupabase([aTitle], [])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    await searchByFuzzy('the matric', 2003, 5)
    expect(sb.rpc).toHaveBeenCalledWith('search_titles_fuzzy', { q: 'the matric', y: 2003, lim: 5, threshold: 0.3 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/search-db.test.ts`
Expected: FAIL — `searchByFts`/`searchByFuzzy` are not exported.

- [ ] **Step 3: Implement in `lib/search-db.ts`**

Remove `searchLocalTitles`. Keep `groupAvailabilityByRegion` and its types. Add a shared `assembleResults` plus the two RPC functions:

```ts
async function assembleResults(
  supabase: ReturnType<typeof createAdminClient>,
  titles: Title[]
): Promise<SyncedResult[]> {
  if (titles.length === 0) return []
  const ids = titles.map((t) => t.id)
  const { data: avail, error } = await supabase
    .from('availability')
    .select('title_id, region_code, platform:platforms(slug)')
    .in('title_id', ids)
    .eq('available', true)
  if (error) throw new Error(`Local availability load failed: ${error.message}`)
  const grouped = groupAvailabilityByRegion((avail ?? []) as AvailabilityJoinRow[])
  return titles.map((title) => ({ title, availabilityByRegion: grouped.get(title.id) ?? {} }))
}

export async function searchByFts(query: string, year: number | null, limit: number): Promise<SyncedResult[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('search_titles_fts', { q: query, y: year, lim: limit })
  if (error) throw new Error(`FTS search failed: ${error.message}`)
  return assembleResults(supabase, (data ?? []) as Title[])
}

export async function searchByFuzzy(query: string, year: number | null, limit: number): Promise<SyncedResult[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('search_titles_fuzzy', { q: query, y: year, lim: limit, threshold: 0.3 })
  if (error) throw new Error(`Fuzzy search failed: ${error.message}`)
  return assembleResults(supabase, (data ?? []) as Title[])
}
```

Ensure imports at top include `Title` and `SyncedResult` (already present) and `createAdminClient` (already present).

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- lib/search-db.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/search-db.ts lib/search-db.test.ts
git commit -m "feat: FTS and fuzzy search-db functions backed by Postgres RPCs"
```

---

## Task 6: Rewire `computeSearch` cascade

**Files:**
- Modify: `lib/search.ts`
- Modify: `lib/search.test.ts`

- [ ] **Step 1: Update the tests**

In `lib/search.test.ts`, replace the search-db mock and add a fuzzy fall-through test:

```ts
vi.mock('@/lib/search-db', () => ({ searchByFts: vi.fn(), searchByFuzzy: vi.fn() }))
vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  searchCacheKey: (q: string, y?: number | null) => `search:${q}:${y ?? ''}`,
  SEARCH_TTL: 3600,
}))
```

Update the imports line `import { searchLocalTitles } from '@/lib/search-db'` to:
```ts
import { searchByFts, searchByFuzzy } from '@/lib/search-db'
```

Update existing cases that referenced `searchLocalTitles` to `searchByFts` (the "returns DB results", "returns empty when neither", "does not call MOTN", "seeds on-demand", "local lookup fails", and "caches non-empty" cases). For each, also set the fuzzy mock to return `[]` so the cascade reaches the intended layer, e.g.:

```ts
it('returns DB results without TMDB/MOTN when found locally', async () => {
  vi.mocked(searchByFts).mockResolvedValueOnce([synced(makeTitle())])
  const res = await performSearch('inception')
  expect(res.results).toHaveLength(1)
  expect(res.source).toBe('db')
  expect(searchTMDB).not.toHaveBeenCalled()
  expect(syncTitle).not.toHaveBeenCalled()
})
```

Add a new fuzzy fall-through test:

```ts
it('falls back to fuzzy search when FTS finds nothing', async () => {
  vi.mocked(searchByFts).mockResolvedValueOnce([])
  vi.mocked(searchByFuzzy).mockResolvedValueOnce([synced(makeTitle())])
  const res = await performSearch('incepton')
  expect(res.results).toHaveLength(1)
  expect(res.source).toBe('db')
  expect(searchTMDB).not.toHaveBeenCalled()
})
```

For the "neither DB nor TMDB", "does not call MOTN", and "seeds on-demand" cases, set BOTH `searchByFts` and `searchByFuzzy` to resolve `[]` before the TMDB mock, e.g.:
```ts
vi.mocked(searchByFts).mockResolvedValueOnce([])
vi.mocked(searchByFuzzy).mockResolvedValueOnce([])
vi.mocked(searchTMDB).mockResolvedValueOnce([tmdbHit])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/search.test.ts`
Expected: FAIL — `searchByFts`/`searchByFuzzy` not used by `search.ts` yet.

- [ ] **Step 3: Update `lib/search.ts`**

Replace the imports and `performSearch`/`computeSearch`:

```ts
import { searchByFts, searchByFuzzy } from '@/lib/search-db'
import { normalizeSearch } from '@/lib/query-normalizer'
```
(remove the `searchLocalTitles` import)

`performSearch`:
```ts
export async function performSearch(rawQuery: string): Promise<SearchResponse> {
  const { query, year } = normalizeSearch(rawQuery)
  if (query.length < MIN_QUERY) return { results: [], query, source: 'db' }

  const cacheKey = searchCacheKey(query, year)
  const cached = await getCached<SearchResponse>(cacheKey)
  if (cached) return cached

  const result = await computeSearch(query, year)
  if (result.results.length > 0 && !result.notice && result.source !== 'error') {
    await setCached(cacheKey, result, SEARCH_TTL)
  }
  return result
}
```

`computeSearch` — replace the step-1 DB lookup with the FTS→fuzzy cascade; keep steps 2–4 (TMDB + quota + seed) exactly as they are, but call them with `query`:
```ts
async function computeSearch(query: string, year: number | null): Promise<SearchResponse> {
  try {
    // 1. Local relevance search: FTS first, then fuzzy fallback. Zero MOTN calls.
    const fts = await searchByFts(query, year, MAX_RESULTS)
    if (fts.length > 0) return { results: fts, query, source: 'db' }

    const fuzzy = await searchByFuzzy(query, year, MAX_RESULTS)
    if (fuzzy.length > 0) return { results: fuzzy, query, source: 'db' }

    // 2. Not in DB — check TMDB (free, unlimited).
    const tmdbResults = await searchTMDB(query)
    // ...unchanged from here down (quota gate, on-demand seed, timeout, catch)...
```
Keep the rest of `computeSearch` (TMDB empty check, quota gate, seeding race, timeout notice, catch block) byte-for-byte as it currently is.

- [ ] **Step 4: Run tests + full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/search.ts lib/search.test.ts
git commit -m "feat: cascade search FTS -> fuzzy -> TMDB with normalized query + year"
```

---

## Task 7: Staging integration script

**Files:**
- Create: `scripts/search-quality-check.ts`

- [ ] **Step 1: Write the script**

```ts
import { performSearch } from '@/lib/search'

interface Case { q: string; expect: string }
const CASES: Case[] = [
  { q: 'the matrix', expect: 'The Matrix' },
  { q: 'matrix', expect: 'The Matrix' },
  { q: 'THE MATRIX', expect: 'The Matrix' },
  { q: 'the devil wears prada', expect: 'The Devil Wears Prada' },
  { q: 'devil wears', expect: 'The Devil Wears Prada' },
  { q: 'mortal kombat', expect: 'Mortal Kombat' },
  { q: 'demon slayer', expect: 'Demon Slayer' },
  { q: 'the matric', expect: 'The Matrix' },     // fuzzy: missing letter
  { q: 'mortl kombat', expect: 'Mortal Kombat' }, // fuzzy: missing letter
  { q: 'the devil wears prda', expect: 'The Devil Wears Prada' }, // fuzzy
]

async function main() {
  let pass = 0
  for (const c of CASES) {
    const res = await performSearch(c.q)
    const titles = res.results.map((r) => r.title.title)
    const ok = titles.some((t) => t.toLowerCase() === c.expect.toLowerCase())
    console.log(`${ok ? 'PASS' : 'FAIL'}  "${c.q}" (${res.source}) -> [${titles.join(', ') || '∅'}]  expect "${c.expect}"`)
    if (ok) pass++
  }
  console.log(`\n${pass}/${CASES.length} passed`)
  if (pass < CASES.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

> The expected titles assume the 50-title staging seed includes them. After running, adjust `CASES` to titles actually present in staging if any expectation is absent for a non-search reason (note which, don't mask real failures).

- [ ] **Step 2: Verify it typechecks (no run yet — running needs staging DB + migrations applied)**

Run: `npx tsc --noEmit`
Expected: clean. (Execution happens in Task 8 after migrations are applied to staging.)

- [ ] **Step 3: Commit**

```bash
git add scripts/search-quality-check.ts
git commit -m "test: staging integration script for search quality"
```

---

## Task 8: Apply migrations to STAGING + verify (GATED — get approval first)

**⚠️ Side effect. Pause and get explicit approval before running.**

- [ ] **Step 1: Apply migrations J & K to staging**

```bash
DB_URL=$(node -e "const fs=require('fs');const m=fs.readFileSync('.env.staging.local','utf8').match(/^SUPABASE_DB_PASSWORD=(.*)$/m);const pw=encodeURIComponent(m[1].trim());process.stdout.write('postgresql://postgres:'+pw+'@db.hunvbflchgjphnhdjmws.supabase.co:5432/postgres')")
echo "y" | npx supabase db push --db-url "$DB_URL"
```
Expected: applies `20260608000001_titles_fts.sql` and `20260608000002_titles_trgm.sql`; "Finished supabase db push."

- [ ] **Step 2: Run the integration script against staging**

```bash
npx tsx --env-file=.env.staging.local scripts/search-quality-check.ts
```
Expected: all cases PASS (exact, partial, case-insensitive, fuzzy). Investigate any FAIL before proceeding.

- [ ] **Step 3: No commit** (migrations already committed; this is application + verification).

---

## Task 9: Deploy to staging branch + verify (GATED)

- [ ] **Step 1: Merge `feat/search-quality` → `staging` and push**

```bash
git checkout staging
git merge --no-ff feat/search-quality -m "merge: search quality pipeline (J/K/L/M)"
git push origin staging
git checkout feat/search-quality
```
Expected: Vercel rebuilds `staging.wherecaniwatchit.info`.

- [ ] **Step 2: Spot-check on staging after the deploy propagates**

Query the live staging API for an exact, a fuzzy, and an unknown title:
```bash
for query in "the%20matrix" "the%20matric" "zz-unknown-title"; do
  curl -sS "https://staging.wherecaniwatchit.info/api/search?q=$query" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.source, (j.results||[]).map(r=>r.title.title))})"
done
```
Expected: matrix → db with "The Matrix"; matric → db (fuzzy) with "The Matrix"; unknown → tmdb/empty.

- [ ] **Step 3: No commit** (verification only).

---

## Task 10: Apply to PRODUCTION + deploy (GATED — get approval first)

**⚠️ Production side effect. Pause for explicit approval. Need the production DB connection string/password (request at this gate).**

- [ ] **Step 1: Apply migrations J & K to production**

```bash
# PROD_DB_URL provided at the gate (percent-encode the password).
echo "y" | npx supabase db push --db-url "$PROD_DB_URL"
```
Expected: both migrations applied to production. Verify with `npx supabase migration list --db-url "$PROD_DB_URL"` (both rows show on Remote).

- [ ] **Step 2: Merge `feat/search-quality` → `master` and push (prod deploy)**

```bash
git checkout master
git merge --no-ff feat/search-quality -m "merge: Phase 3 Sub-project 2 search quality pipeline"
git push origin master
```
Expected: Vercel production deploy.

- [ ] **Step 3: Production spot-check after propagation**

```bash
for query in "the%20matrix" "breaking%20bad" "severence"; do
  curl -sS "https://www.wherecaniwatchit.info/api/search?q=$query" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.source,(j.results||[]).map(r=>r.title.title))})"
done
```
Expected: real titles returned; `severence` → fuzzy → "Severance"; no errors.

- [ ] **Step 4: No commit** (verification only).

---

## Self-Review

**Spec coverage:**
- L normalizer (abbreviations, filler, on-platform, year, season) — Task 1. ✓
- Cache keyed by {query, year} — Task 2. ✓
- J: generated `tsvector` (A/B/C/**D cast**), GIN, `websearch_to_tsquery`, exact-match-boosted rank — Task 3. ✓
- K: pg_trgm extension, trgm index, similarity ≥ 0.3, order by similarity — Task 4. ✓
- `searchByFts`/`searchByFuzzy` via RPC + availability assembly — Task 5. ✓
- Cascade FTS→fuzzy→TMDB with year filter — Task 6. ✓
- Unit tests (normalizer, cascade, mapping) + staging integration — Tasks 1,5,6,7. ✓
- Approval gates: staging-first then prod — Tasks 8 & 10. ✓

**Placeholder scan:** none — all steps contain concrete code/commands. (Task 7's case list is concrete; the note says adjust only to real staging titles, not a placeholder.)

**Type consistency:** `normalizeSearch(raw): { query, year }` used identically in Tasks 1/2/6. `searchByFts(query, year, limit)` / `searchByFuzzy(query, year, limit)` consistent between Tasks 5 and 6. `searchCacheKey(query, year?)` consistent between Tasks 2 and 6. RPC names `search_titles_fts`/`search_titles_fuzzy` match between migrations (3/4) and search-db (5).
