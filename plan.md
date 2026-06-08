# Plan — Seed pipeline, quota guard, caching, monitoring

Strategy (updated 2026-06-04): **MOTN Pro plan = 25,000 calls/month.** Bulk seed ~4,000 titles, quota guard on every MOTN consumer, cron throttled to a 30-day cadence.

Guiding constraint: **never exceed 25,000 MOTN calls/month** (hard stop at 24,500, 500-call buffer). The quota guard is the safety mechanism and is built FIRST.

> History: originally scoped to the free tier (500/mo, ~300 titles). Upgraded to Pro mid-build; limits below reflect Pro.

---

## Phase 0 — Quota guard (foundation; build & test before any seeding)

### 0.1 Migration `..._api_quota.sql`
```sql
CREATE TABLE api_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  calls_used INTEGER NOT NULL DEFAULT 0,
  calls_limit INTEGER NOT NULL DEFAULT 500,
  month CHAR(7) NOT NULL,          -- 'YYYY-MM'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service, month)
);
```
Plus `seed_status` on titles: `ALTER TABLE titles ADD COLUMN seed_status TEXT;` (`'active' | 'pending' | NULL`).

### 0.2 `lib/quota.ts`
- `currentMonth()` → 'YYYY-MM' (UTC).
- `getQuota(service='motn')` → row, auto-creating `{calls_used:0, calls_limit:500}` for the month.
- `incrementQuota(service, n=1)` → atomic increment via Postgres RPC (`increment_quota`) to avoid races; returns new `calls_used`.
- `hasRemainingQuota(service, buffer=20)` → `calls_used < calls_limit - buffer`.
- `resetQuota(service)` → upsert current month to 0 (used by monthly cron reset).
- Add RPC migration `increment_quota(p_service, p_month, p_n)` doing an upsert + `calls_used = calls_used + p_n`.

### 0.3 Hook the chokepoint
Wrap `fetchShowByTMDBId` so **every** MOTN call increments quota exactly once (count 404s too — they consume a call). Add an optional guard param so callers can pre-check. Keep the raw fetch in a private fn; export a counted wrapper. All existing callers (`sync.ts`, cron) keep working unchanged.

### 0.4 Tests (`lib/quota.test.ts`)
Mock the admin client. Cover: month rollover, increment, buffer boundary (`<` not `<=`), reset. TDD — write tests first.

---

## Phase A — Verify keys end to end (≤1 MOTN call)
Script `scripts/verify-keys.ts` (run via `npm run verify:keys`, loads `.env.local` via `dotenv`):
1. TMDB: search "Parks and Recreation", fetch TV detail → log title/year/genres (free).
2. MOTN: `fetchShowByTMDBId(<parks tmdb id>, 'tv')` → log which of PH/US/GB/AU/CA have streaming options. **1 call.** Increments quota.
3. Supabase: run `syncTitle` for Parks → confirm rows land in `titles` + `availability`; SELECT them back and log. (Reuses the same MOTN result via the cron-style path? No — `syncTitle` makes its own call. To stay at 1 call, step 2 and 3 share: call `syncTitle` once, then read back the DB. That single path covers TMDB + MOTN + Supabase in one MOTN call.)
4. Print `API calls used this month: N/500`.
Report results; stop if any key errors.

---

## Phase B — Seeding pipeline (code only; no run until approved)

### Mode 1 — `npm run seed` (`scripts/seed.ts`)
- Pull popularity-sorted titles from TMDB (free): `/movie/popular` + `/tv/popular`, paging to **2,000 movies + 2,000 TV = 4,000**.
- For each: skip if `tmdb_id` already in `titles`. Else `syncTitle` (1 MOTN call).
- Batches of **20**, `await sleep(1000)` between batches.
- Before each title: `hasRemainingQuota('motn')` AND `seededThisRun < 4000` AND global `calls_used < 24500` hard stop → else stop.
- On MOTN **429**: stop immediately, report count, no retry.
- On other per-title error: log, mark title `seed_status='pending'`, continue.
- Live log: `API calls used: N/25000 — Seeded X/4000 titles (skipped S, failed F)`.
- Final summary: seeded, availability rows, calls used, failures, skipped, elapsed, remaining quota.

### Mode 2 — `npm run seed:genres` (`scripts/seed-genres.ts`)
- `/discover` per genre (Action…War list from brief); anime = Animation + `with_origin_country=JP`.
- Same skip/quota/batch/429/error rules as Mode 1. **No confirm prompt** (Pro plan — quota is no longer scarce).

### Mode 3 — On-demand (rewrite `app/api/search/route.ts`)
1. **DB-first:** look up matching titles already in DB (by `ilike` on title) + their availability. If found → return immediately, **0 MOTN calls**.
2. Else **TMDB search** (free). No TMDB hits → friendly empty result.
3. TMDB hit + `hasRemainingQuota()` (under 24,500) → `syncTitle` **freely** (with a ~3s race: if slower, return TMDB-metadata + "available soon" and finish the sync in the background via `waitUntil`).
4. TMDB hit + **no quota** → return TMDB metadata only + message "Streaming availability for this title will be available soon." Never a broken result.
5. Total failure → "We're having trouble finding that title right now. Try again in a moment."
- Gate each synced result on quota.

### Cron throttle (`sync-availability`)
- Change stale cutoff 23h → **30 days**, per-run cap **50 titles/run**, prioritise flagged titles for re-checking, and gate each refresh on `hasRemainingQuota()`. Stop when quota guard trips.
- Add monthly quota **reset**: on first run of a new month, `resetQuota('motn')` before refreshing.

---

## Phase C — Run the seed (only after you approve B)
`npm run seed`, stream logs, stop at 24,500/quota, full report, then spot-check Parks/Severance/Parasite across 5 regions from the DB.

---

## Phase D — Upstash Redis cache (creds READY in .env.local + Vercel)
- Add `@upstash/redis`. `lib/redis.ts` = `Redis.fromEnv()` + fail-open wrapper.
- `lib/cache.ts`: `normalizeQuery()` (lowercase, trim, strip specials except hyphen, spaces→hyphen, expand P&R/GoT/HIMYM/TBBT/AoT). TTL search 1h, detail 6h.
- Search/detail: cache hit → return (0 DB/0 MOTN). Miss → query → store. Never cache empty/error/flags. Fails open (Redis down ⇒ proceed, log).
- Integrate search cache in `lib/search.ts::performSearch`; detail cache in `app/api/titles/[id]/route.ts`.
- **CONFIRMED DECISIONS (2026-06-05):**
  - **Cache key = normalized query ONLY (country-agnostic)** → `search:<normalized>`. Payload already includes all 5 regions, so per-country keys are redundant. (Intentional deviation from brief's `-<cc>`.) Detail key = `title:<id>`.
  - **Invalidation = 1h search TTL + targeted detail invalidation.** Cron/verified-flag updates delete `title:<id>`; search relies on the 1h TTL (no key SCAN). (Intentional deviation from brief's name-match SCAN.)

## Phase E — Sentry (creds READY: SENTRY_DSN in .env.local + Vercel)
- `@sentry/nextjs`, wizard config. NOTE: client capture likely needs `NEXT_PUBLIC_SENTRY_DSN` too (currently only `SENTRY_DSN` is set) — add it to Vercel or reuse the same value in the client config.
- Capture unhandled client/server, API route context (endpoint/query/country/ip-hash), seed failures, MOTN errors (status/endpoint/title), cache errors, checker circuit-breaker events, quota-low (<50 remaining) warning. One alert: >10 errors/5min → email. Test with a deliberate error.
- Build a `lib/observability.ts` shim (captureMessage/captureException) so Phase F rate-limit logging routes through it.

---

## Phase F — Production-grade rate limiting (PLAN — do not implement yet)

Uses the already-configured Upstash Redis (creds in `.env.local` + Vercel). **F is unblocked now** — independent of Phase D's caching. Only the "log to Sentry" requirement depends on E; handled via an observability shim until then.

### Research findings (grounding)
- **Cron auth already done:** `sync-availability` + all 5 checker crons already 401 on missing `Bearer CRON_SECRET`. F's cron requirement = verify only, no new code. (Checkers are `runtime = 'edge'`.)
- **IP + hashing already exists** in `app/api/flags/route.ts`: IP = `x-forwarded-for`[0] → `x-real-ip` → `'unknown'`; hash = `sha256(ip + CRON_SECRET).slice(0,32)`. Next 16 has no `req.ip`. → **Extract to `lib/ip.ts`** and reuse (no duplication); refactor flags route to use it.
- Endpoints to limit (all default Node runtime, so `node:crypto` is fine): `GET /api/search` (30/min), `GET /api/titles/[id]` (60/min), `POST /api/flags` (10/min).

### Design
- **Approach: per-route helper, not middleware.** Limits vary per endpoint, need Sentry context + fail-open; a helper called at the top of each handler is explicit and testable. (Middleware noted as alternative but rejected — harder to vary/limit/test.)
- **`lib/redis.ts`** — shared Upstash client `Redis.fromEnv()` (also used by Phase D later). New deps: `@upstash/redis`, `@upstash/ratelimit`.
- **`lib/observability.ts`** — `captureMessage` / `captureException` shim. Console now; swapped to `@sentry/nextjs` in Phase E (one-file change). Decouples F from E.
- **`lib/ip.ts`** — `clientIp(req)` + `hashIp(ip)` (moved from flags route).
- **`lib/rate-limit.ts`**:
  - `LIMITS = { search: 30, titles: 60, flags: 10 }` requests / `60 s`, **sliding window** via `Ratelimit.slidingWindow(limit, '60 s')`.
  - One lazy-singleton `Ratelimit` per endpoint, `prefix: 'rate-limit:<endpoint>'`, `identifier = hashIp(ip)` → key `rate-limit:<endpoint>:<ip-hash>` (never raw IP). ✓ brief format.
  - `enforceRateLimit(req, endpoint): Promise<NextResponse | null>`:
    - extract+hash IP, run `limiter.limit(idHash)`.
    - **exceeded** → `captureMessage('rate_limit_exceeded', { endpoint, ipHash, count })`, return `NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.', retryAfter: 60 }, { status: 429, headers: { 'Retry-After': '60' } })`.
    - **ok** → return `null`.
    - **Redis throws** → `captureException(err, { endpoint })`, **fail open** (return `null`).
- **Wire into routes** — at top of each handler:
  ```ts
  const limited = await enforceRateLimit(req, 'search'); if (limited) return limited
  ```
  search → `'search'`, titles → `'titles'`, flags → `'flags'`. Crons unchanged (verify CRON_SECRET 401 path).

### Tests (TDD)
- `lib/ip.test.ts` — IP precedence (xff → x-real-ip → unknown), hash stable/never raw.
- `lib/rate-limit.test.ts` — inject/mock limiter: under-limit→null; over-limit→429 with `Retry-After: 60` + exact JSON body; Redis-throw→null (fail open) + `captureException` called; violation→`captureMessage` called with context.
- Acceptance (manual / `scripts/test-ratelimit.ts`, needs real Redis + dev server): 35 rapid hits → 31st is 429 w/ Retry-After; resumes after 60 s; cron without secret → 401. Sentry appearance verified after Phase E.

### Dependency / sequencing
- Implementable **now** (creds exist). Violations log to console via shim until Phase E swaps in Sentry — at which point the brief's "appears in Sentry" check passes with no F changes.

### TODO (Phase F)
- [ ] add `@upstash/redis`, `@upstash/ratelimit`
- [ ] `lib/redis.ts` (shared Upstash client)
- [ ] `lib/observability.ts` (Sentry shim)
- [ ] `lib/ip.ts` + refactor flags route to use it (TDD)
- [ ] `lib/rate-limit.ts` `enforceRateLimit` (TDD)
- [ ] wire search / titles / flags routes
- [ ] verify cron 401s
- [ ] `scripts/test-ratelimit.ts` + manual acceptance run

**Don't implement Phase F yet** — this is the plan for review.

## Hard rules
- Quota guard merged & tested **before** any MOTN spend beyond the 1-call Phase A test.
- `tsc --noEmit` + `vitest run` green before each phase is marked done.
- No `any`. New migrations, not edits to applied ones. TDD for `lib/quota.ts`.

## TODO
- [x] 0.1 migrations: `api_quota`, `seed_status`, `increment_quota` RPC — `supabase/migrations/20260604000003_api_quota.sql` (limit 25,000; NOT yet pushed to Supabase)
- [x] 0.2 `lib/quota.ts` — done (limit 25,000, buffer 500)
- [x] 0.3 wrap `fetchShowByTMDBId` with counting — done, counts every MOTN response incl. 404/error
- [x] 0.4 `lib/quota.test.ts` (TDD) — 13 tests passing
- [x] A `scripts/verify-keys.ts` + `npm run verify:keys` (tsx + --env-file; no dotenv needed)
- [x] B1 `scripts/seed.ts` + `lib/seed.ts` core (TDD, 8 tests) + `npm run seed`
- [x] B2 `scripts/seed-genres.ts` + `npm run seed:genres` (no confirm prompt)
- [x] B3 rewrite `app/api/search/route.ts` (DB-first + quota-gated + after() bg) + `lib/search-db.ts`
- [x] B4 throttle cron: 30-day stale, flagged-priority (`lib/cron-select.ts`), quota-gated, day-1 reset
- [ ] BLOCKED: push migration to Supabase (needs your `supabase login` / SUPABASE_ACCESS_TOKEN)
- [ ] A-run: `npm run verify:keys` (1 MOTN call) — after migration pushed
- [ ] C run seed + spot-check (after approval)
- [ ] C run seed + spot-check (after approval)
- [ ] D Upstash cache (after account)
- [ ] E Sentry (after account)

**Don't implement yet** — awaiting review/annotations on this plan.
