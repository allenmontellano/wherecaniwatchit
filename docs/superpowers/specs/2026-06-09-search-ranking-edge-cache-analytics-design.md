# SP3 — Search Ranking Tuning, Input Cap, Edge Cache & Analytics — Design

> Date: 2026-06-09. Status: **approved design, awaiting spec review**.
> Builds on SP2 (search quality pipeline). Pre-launch Phase 3/4.

## Goal

Close the four remaining pre-launch search/observability gaps in one cohesive sub-project:

1. **Ranking tuning** — stop supplementary content (featurettes, "making of", PaleyFest panels) from outranking the canonical title for ambiguous queries, and use IMDb/popularity as the final tie-break.
2. **Input length cap** — tighten the API query ceiling from 200 → 100 characters.
3. **Edge caching** — let Vercel's CDN cache *good* search responses, so repeat queries never touch the function or Redis.
4. **Analytics** — adopt Vercel Analytics + Speed Insights (cookieless, no PII).

These are independent, low-risk, and share the search request path, so they ship together behind one staging gate.

---

## Non-goals

- No change to the normalize → FTS → fuzzy → TMDB → on-demand-seed cascade itself (SP2, frozen).
- No change to the fuzzy RPC ordering (already `similarity desc, imdb_rating desc` — correct for misspellings).
- No new analytics events / custom tracking — page-level Web Analytics + Speed Insights only.
- No removal of the existing Redis (`SEARCH_TTL`) layer; edge cache sits *in front* of it.

---

## 1. Ranking tuning (D4)

### Problem
Observed pre-launch: `parks recreation` surfaces a "PaleyFest" featurette above *Parks and Recreation*. The FTS `ts_rank` can score a short supplementary title higher than the canonical long-form title, and there is no popularity tie-break below `ts_rank`.

### Approach
Modify the `search_titles_fts` RPC ordering only (new migration; the trigger, column, and GIN index from SP2 are untouched). The exact order of the sort keys is the whole point:

```sql
order by
  (lower(t.title) = lower(q)) desc,                       -- 1. exact title always wins (unchanged)
  (t.title ~* <supplementary-pattern>) asc,               -- 2. NEW: down-rank supplementary (false sorts first)
  ts_rank(t.search_vector, websearch_to_tsquery('english', q)) desc,  -- 3. relevance (unchanged)
  t.imdb_rating desc nulls last                           -- 4. popularity tie-break (already present)
```

- **Exact match (1)** stays the top key — a title that *is* "Making Of X" still wins when the user searches exactly that.
- **Supplementary penalty (2)** is a boolean sort key: non-supplementary rows (`false`) sort ahead of supplementary rows (`true`) for everything that isn't an exact match. It sits **above** `ts_rank` so a canonical title beats a featurette even when the featurette scores marginally higher relevance.
- **IMDb (4)** is unchanged in position but is now the documented final tie-break.

### Supplementary pattern
Case-insensitive regex against `t.title` (word-boundaried where a substring would over-match):

```
(behind the scenes|making of|paleyfest|featurette|deleted scene|bloopers?|gag reel|\mextras?\M|\mclips?\M|sneak peek|first look|red carpet|press conference|panel|\mreunions?\M|\mspecials?\M)
```

- `clip`/`clips`, `extra`/`extras`, `reunion`/`reunions`, and `special`/`specials` are word-boundaried (`\m…\M`) so "Extraction", "Eclipse", or "Specialist" don't match. `reunion`/`special` catch "Friends: The Reunion" / "… Holiday Special" type entries ranking above the canonical show.
- The list is intentionally conservative; it can be extended later via a follow-up migration. The penalty only *re-orders* — it never filters a row out, so a false positive at worst demotes within the result set, never hides a title.

### Edge cases
- All results supplementary (e.g. user literally wants featurettes) → relative `ts_rank`/IMDb order preserved among them.
- Exact match that is itself supplementary → still #1 via key (1).
- No change to fuzzy path — misspellings rarely hit supplementary titles, and adding the key there risks demoting a correct fuzzy hit.

### Verification
- `parks recreation` → *Parks and Recreation* ranks above any PaleyFest/featurette row.
- `the matrix` (exact) → *The Matrix* still #1.
- Spot-check 3–4 ambiguous franchise queries on staging (e.g. `friends`, `the office`) for no regression.

---

## 2. Input length cap

`MAX_QUERY` 200 → 100 in [lib/search.ts](../../../lib/search.ts). The route already returns `400 {error:'Query too long'}` for `query.length > MAX_QUERY`; only the constant changes. 100 chars comfortably exceeds the longest real title while shrinking the abuse/cost surface (oversized FTS/trigram queries, Redis key bloat).

### Verification
- 101-char query → `400`.
- 100-char query → processed normally.

---

## 3. Edge caching (good results only)

### Approach
Set `Cache-Control` on the API response in [app/api/search/route.ts](../../../app/api/search/route.ts), **only** when the result is genuinely cacheable:

```ts
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
```

- Mirrors the exact predicate `performSearch` uses to decide Redis caching — good results only. `notice` (quota/slow-seed) and `error` and empty responses are `no-store`, so transient states are never CDN-pinned.
- `s-maxage` (shared/CDN TTL) = `SEARCH_TTL` (3600s) for parity with Redis; `stale-while-revalidate` lets the CDN serve a slightly stale hit while revalidating, smoothing the hour boundary.
- Uses `public` (not `private`) — responses are anonymous and identical per query; no per-user data.

### Interaction with rate limiting
Edge-cache hits never reach the function, so they don't consume a rate-limit token. This is acceptable and beneficial: only uncached (novel) queries are rate-limited, which is exactly the load we want to bound. The rate-limit check stays first in the handler for uncached requests.

### Verification
- Two identical good queries on staging: second shows an `age`/`x-vercel-cache: HIT` response header.
- A `notice`/empty query: response carries `Cache-Control: no-store`.

---

## 4. Analytics (Vercel Analytics + Speed Insights)

### Approach
- Add deps: `@vercel/analytics`, `@vercel/speed-insights`.
- Mount in [app/layout.tsx](../../../app/layout.tsx) `<body>`, after `{children}`:

```tsx
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
// …
<StagingBanner />
{children}
<Analytics />
<SpeedInsights />
```

- Both are cookieless and collect no PII (aggregated page + Web Vitals only). This matches the architecture decision already recorded in CLAUDE.md.
- **Privacy Policy (SP9) dependency:** must disclose cookieless/aggregated/no-PII analytics — do **not** claim "zero tracking." Flagged here; implemented in SP9.

### Verification
- Build succeeds; both scripts load on staging.
- Vercel dashboard shows Analytics + Speed Insights data after a few staging hits.

---

## Files touched

| File | Change |
|---|---|
| `supabase/migrations/2026060900000X_titles_fts_ranking.sql` (new) | `create or replace function search_titles_fts` with supplementary down-rank key |
| `lib/search.ts` | `MAX_QUERY` 200 → 100 |
| `app/api/search/route.ts` | `Cache-Control` header (good-only) |
| `app/layout.tsx` | `<Analytics/>` + `<SpeedInsights/>` |
| `package.json` | add `@vercel/analytics`, `@vercel/speed-insights` |

Tests: `lib/search.test.ts` (cap), `app/api/search/route.test.ts` (cap 400 + header presence/absence), plus a SQL ranking assertion exercised on staging (RPC ordering isn't unit-testable without a DB — verified at the staging gate per existing pattern).

---

## Migration & deploy plan

1. Build on `feat/search-ranking` (branched off `master`), TDD throughout.
2. Apply the FTS ranking migration to **staging** first; verify `parks recreation` ordering + no regression.
3. Staging spot-check all four items (ranking, cap 400, edge `HIT`, analytics loading).
4. **Separate explicit approval** → apply migration to production, merge → `master`, deploy, post-deploy spot-check (clear relevant Redis keys before probing to avoid cache-masking).

## Risks

- **Regex over-match** → demotes a legitimate title. Mitigated by word-boundaries + the penalty being re-order-only (never filters). Low blast radius.
- **Edge cache serving stale availability** → bounded to `SEARCH_TTL` (1h), same as today's Redis window; acceptable pre-launch.
- **Analytics adds two scripts** → negligible; Speed Insights itself measures the impact.
