# SP3 — Search Ranking, Input Cap, Edge Cache & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune FTS ranking so canonical titles beat supplementary content, tighten the query length cap, add good-results-only edge caching, and adopt Vercel Analytics + Speed Insights.

**Architecture:** Four independent changes sharing the search request path. The ranking change is a single new migration altering only `search_titles_fts` ordering (SP2 trigger/column/index untouched). The cap is a one-constant change. Edge caching adds a `Cache-Control` header mirroring the existing Redis-cache predicate. Analytics mounts two cookieless components in the root layout.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Vitest (node env, no jsdom/RTL), Supabase Postgres (FTS via RPC), Vercel CDN + Analytics.

**Spec:** `docs/superpowers/specs/2026-06-09-search-ranking-edge-cache-analytics-design.md`

**Branch:** `feat/search-ranking` (already created off `master`; spec already committed at `54ba899`).

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20260609000001_titles_fts_ranking.sql` (new) | Re-create `search_titles_fts` with the supplementary down-rank sort key | 1 |
| `lib/search.ts` | `MAX_QUERY` 200 → 100 | 2 |
| `app/api/search/route.ts` | `Cache-Control` header, good-results-only | 3 |
| `app/layout.tsx` | Mount `<Analytics/>` + `<SpeedInsights/>` | 4 |
| `package.json` / lockfile | Add `@vercel/analytics`, `@vercel/speed-insights` | 4 |
| `app/api/search/route.test.ts` | Cap + header behaviour | 2, 3 |

Tasks 2 and 3 are unit-tested. Task 1 (SQL ordering) and Task 4 (script rendering) are verified at the staging gate per the existing project pattern — no DB/RTL harness exists.

---

### Task 1: FTS ranking — supplementary down-rank migration

**Files:**
- Create: `supabase/migrations/20260609000001_titles_fts_ranking.sql`

> No unit test: RPC ordering needs a live DB. Verified on staging in the deploy step. The migration is idempotent (`create or replace function`) and changes ordering only — no schema/data change, no trigger/index touch.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260609000001_titles_fts_ranking.sql`:

```sql
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
    (t.title ~* '(behind the scenes|making of|paleyfest|featurette|deleted scene|bloopers?|gag reel|\mextras?\M|\mclips?\M|sneak peek|first look|red carpet|press conference|\mpanel\M|\mreunions?\M|\mspecials?\M)') asc,
    ts_rank(t.search_vector, websearch_to_tsquery('english', q)) desc,
    t.imdb_rating desc nulls last
  limit lim;
$$;

grant execute on function search_titles_fts(text, int, int) to anon, authenticated, service_role;
```

- [ ] **Step 2: Verify the file parses locally (syntax sanity)**

Run: `npx supabase db lint --schema public` if available, otherwise visually confirm the regex is single-quoted and balanced. No local DB apply (staging-first per workflow).
Expected: no syntax error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000001_titles_fts_ranking.sql
git commit -m "feat: down-rank supplementary titles in FTS ranking (above ts_rank)"
```

---

### Task 2: Tighten input length cap (200 → 100)

**Files:**
- Modify: `lib/search.ts:12`
- Test: `app/api/search/route.test.ts`

- [ ] **Step 1: Update the failing test**

In `app/api/search/route.test.ts`, replace the existing `'returns 400 when q exceeds 200 characters'` test with the new boundary, and add a just-under-cap pass-through case:

```ts
it('returns 400 when q exceeds 100 characters', async () => {
  const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(101)}`))
  expect(res.status).toBe(400)
  expect(performSearch).not.toHaveBeenCalled()
})

it('processes a query at exactly 100 characters', async () => {
  vi.mocked(performSearch).mockResolvedValueOnce({ results: [], query: 'x', source: 'db' })
  const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(100)}`))
  expect(res.status).toBe(200)
  expect(performSearch).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify the 101 case fails**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: FAIL — with `MAX_QUERY=200`, a 101-char query is still processed (status 200, `performSearch` called), so the new 400 assertion fails.

- [ ] **Step 3: Change the constant**

In `lib/search.ts`, line 12:

```ts
export const MAX_QUERY = 100
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search.ts app/api/search/route.test.ts
git commit -m "feat: tighten search query length cap 200 -> 100"
```

---

### Task 3: Edge cache header (good results only)

**Files:**
- Modify: `app/api/search/route.ts`
- Test: `app/api/search/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/api/search/route.test.ts` (inside the `describe('GET /api/search')` block):

```ts
it('sets a cacheable Cache-Control header for good results', async () => {
  vi.mocked(performSearch).mockResolvedValueOnce({
    results: [{ id: '1' }] as never,
    query: 'inception',
    source: 'db',
  })
  const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
  expect(res.headers.get('Cache-Control')).toBe(
    'public, s-maxage=3600, stale-while-revalidate=3600',
  )
})

it('sets no-store when results are empty', async () => {
  vi.mocked(performSearch).mockResolvedValueOnce({ results: [], query: 'zzz', source: 'db' })
  const res = await GET(new NextRequest('http://localhost/api/search?q=zzz'))
  expect(res.headers.get('Cache-Control')).toBe('no-store')
})

it('sets no-store when the response carries a notice', async () => {
  vi.mocked(performSearch).mockResolvedValueOnce({
    results: [{ id: '1' }] as never,
    query: 'dune',
    source: 'tmdb',
    notice: 'Finding streaming availability — refresh in a moment.',
  })
  const res = await GET(new NextRequest('http://localhost/api/search?q=dune'))
  expect(res.headers.get('Cache-Control')).toBe('no-store')
})

it('sets no-store on error source', async () => {
  vi.mocked(performSearch).mockResolvedValueOnce({
    results: [{ id: '1' }] as never,
    query: 'dune',
    source: 'error',
  })
  const res = await GET(new NextRequest('http://localhost/api/search?q=dune'))
  expect(res.headers.get('Cache-Control')).toBe('no-store')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: FAIL — no `Cache-Control` header is set yet (`.get(...)` returns `null`).

- [ ] **Step 3: Implement the header**

Replace the tail of `app/api/search/route.ts` (the `const result` line through `return`) with:

```ts
  const result = await performSearch(query)

  const cacheable =
    result.results.length > 0 && !result.notice && result.source !== 'error'

  const res = NextResponse.json(result)
  res.headers.set(
    'Cache-Control',
    cacheable
      ? `public, s-maxage=${SEARCH_TTL}, stale-while-revalidate=${SEARCH_TTL}`
      : 'no-store',
  )
  return res
}
```

Add this import at the top of the file (alongside the existing `performSearch`/`MIN_QUERY`/`MAX_QUERY` import from `@/lib/search`):

```ts
import { SEARCH_TTL } from '@/lib/cache'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: PASS (all cap + header cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/search/route.ts app/api/search/route.test.ts
git commit -m "feat: edge-cache good search responses via Cache-Control (good results only)"
```

---

### Task 4: Vercel Analytics + Speed Insights

**Files:**
- Modify: `app/layout.tsx`
- Modify: `package.json` (+ lockfile)

> No unit test: the project runs Vitest in node env with no jsdom/RTL, so component rendering isn't unit-tested here. Verified via build + staging (scripts load, dashboard populates).

- [ ] **Step 1: Install dependencies**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

- [ ] **Step 2: Mount the components**

In `app/layout.tsx`, add imports near the top:

```tsx
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
```

And inside `<body>`, after `{children}`:

```tsx
      <body className="font-sans antialiased">
        <StagingBanner />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; build output references the analytics scripts.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all green (no regressions).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add Vercel Analytics + Speed Insights (cookieless, no PII)"
```

---

## Staging & production deploy (post-build, approval-gated)

> Side effects — do NOT run without the explicit go-ahead at each gate. Follows the project workflow: staging-first, verify, then a separate prod approval.

- [ ] **Step 1: Push branch + open staging path**

Merge `feat/search-ranking` → `staging` (or push branch and merge per existing flow). Confirm staging deploy is live (account for Vercel propagation lag).

- [ ] **Step 2: Apply the ranking migration to STAGING**

```bash
supabase db push --db-url "<staging db url>"
```
Expected: `20260609000001_titles_fts_ranking` applied; no error.

- [ ] **Step 3: Staging verification (all four items)**

- Ranking: `parks recreation` → *Parks and Recreation* ranks above any PaleyFest/featurette row; `friends` → *Friends* above "Friends: The Reunion"; `the matrix` (exact) still #1. Clear the relevant `staging:search:*` Redis keys first to avoid cache-masking.
- Cap: `…?q=<101 chars>` → 400; `<100 chars>` → 200.
- Edge cache: repeat a good query; 2nd response shows `x-vercel-cache: HIT` / non-zero `age`. A `notice`/empty query → `Cache-Control: no-store`.
- Analytics: both scripts load; Vercel dashboard shows Analytics + Speed Insights data after a few hits.

- [ ] **Step 4: GATE — request production approval.** Report staging results; wait for explicit go-ahead.

- [ ] **Step 5: Apply migration to PRODUCTION, then merge → master + deploy**

```bash
supabase db push --db-url "<prod db url>"
```
Then merge `staging` → `master` (Vercel auto-deploys).

- [ ] **Step 6: Post-deploy prod spot-check**

Clear relevant `production:search:*` Redis keys, then re-run the ranking + cap + edge-cache probes against the live prod deployment.

---

## Self-review notes

- **Spec coverage:** ranking (Task 1), cap (Task 2), edge cache (Task 3), analytics (Task 4) — all four spec sections mapped.
- **Type consistency:** `SEARCH_TTL` imported from `@/lib/cache` (3600); route uses `NextResponse` (already imported). `MAX_QUERY` remains exported from `@/lib/search` and consumed by the route unchanged.
- **Placeholder scan:** none — all code blocks complete; only the staging/prod DB URLs are intentionally external secrets supplied at deploy time.
