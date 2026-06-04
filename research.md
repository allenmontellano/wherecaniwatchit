# Research — Seeding, Quota, Caching, Monitoring

Date: 2026-06-04. Branch: `feat/frontend-screens`.

## Verified state of the repo
- **Tests:** 85 passing across 12 files (`npx vitest run`). Confirmed.
- **Stack:** Next.js **16.2.7** (App Router) + React 19 + TypeScript strict. (Brief said Next 14 — wrong.) `AGENTS.md` warns this Next has breaking changes vs. training data; read `node_modules/next/dist/docs/` before writing route/runtime code.
- **Supabase schema** migrated & clean: `regions`, `platforms`, `titles`, `availability`, `profiles`, `flags`. Path alias `@/*` → repo root.
- **Env keys present in `.env.local`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`, `MOTN_API_KEY`, `CRON_SECRET`.
- **Streaming key is `MOTN_API_KEY`** (not `STREAMING_API_KEY`).

## Key code facts
- `lib/streaming/client.ts::fetchShowByTMDBId(tmdbId, mediaType)` — the **single chokepoint** for every Movie of the Night (MOTN) call. One call returns all 5 regions. 404 → null. This is where quota counting must hook in.
- `lib/tmdb/client.ts` — `searchTMDB`, `fetchMovieDetail`, `fetchTVDetail`. TMDB is free/unlimited.
- `lib/sync.ts::syncTitle(TMDBSearchResult)` — TMDB detail calls (free) + **1 MOTN call** per title; upserts `titles` + `availability`. Reusable by the seeder as-is.
- `app/api/search/route.ts` — **currently calls `syncTitle` on the top 5 results of every search → up to 5 MOTN calls per search, no quota guard.**
- `app/api/cron/sync-availability/route.ts` — daily cron, refreshes up to **50 stale titles/day** (stale = `last_verified` older than 23h), **1 MOTN call each**, no quota guard.
- `types/database.ts` — `Title.status` already exists = **TMDB production status** ("Released"/"Ended"). Do NOT reuse it for seed state; add a separate `seed_status`.
- `Availability` has `watch_url` and `consecutive_failures` (checker circuit-breaker fields exist).

## Budget reality (free tier = 500 MOTN calls/month)
- A *daily* refresh cron can sustain only **~16 titles** at this tier (500 ÷ 30). Existing cron exceeds 500/mo at **~17 titles**.
- Existing search burns up to 5 calls/search.
- **Decision (user):** Small bulk seed **~300** titles now (~300 calls), keep ~180+ buffer, throttle cron to a monthly cadence with a hard monthly cap. Build a quota tracker that gates **search, cron, AND seed**.

## Gaps to fill
- No `api_quota` table. No `seed_status` column on `titles`. No `scripts/` runner or `tsx`/`dotenv` dev deps for `npm run seed`. No Redis/cache layer. No Sentry.

## Things I cannot do (need the user)
- Verify/modify **Vercel** env vars — Vercel CLI not installed here. I can only verify keys via real local calls.
- Create **Upstash** and **Sentry** accounts (Tasks D/E) — account creation is manual; I'll provide exact steps and wire the code.
