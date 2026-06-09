# Sub-project 1 — Staging Environment & Cloudflare DNS (Tasks H + I)

**Date:** 2026-06-08
**Phase:** 3
**Status:** Design approved — ready for implementation plan

## Goal

Stand up a formal, permanent staging environment so every change is verified on
`staging.wherecaniwatchit.info` before reaching production, and migrate the apex
domain off GoDaddy DNS onto Cloudflare for DDoS protection, free SSL, and edge
performance.

This unblocks the rest of Phase 3: the new workflow is
**feature branch → staging (test with 50 real titles) → master → production**,
and **all migrations apply to staging before production, never directly to prod.**

## Non-goals

- No search-quality, performance, or load-test work (Sub-projects 2–4).
- No changes to production data, production env vars, or production Supabase.
- No new application features — this is environment/ops + minimal supporting code.

## Decisions (locked during brainstorming)

1. **Vercel topology:** one Vercel project. `staging.wherecaniwatchit.info` is
   assigned to the permanent `staging` git branch; staging env vars are scoped to
   **Preview → `staging` branch**. No separate Vercel project.
2. **Migration mechanism:** Supabase CLI (already a devDependency, v2.104.0).
   `supabase link --project-ref <staging-ref>` then `supabase db push`.
3. **Redis isolation:** keep the **same** Upstash instance (per brief) but
   **namespace all cache + rate-limit keys by environment**. No second Upstash DB.
4. **noindex on staging is permanent and independent** of the existing pre-launch
   global noindex toggle — keyed on `APP_ENV === 'staging'`. When prod launches and
   the global toggle flips off, staging stays noindex forever.
5. **Mini-seed:** add a `--limit=N` CLI flag to the seed script; seed the top 50
   popular titles into staging using existing `fetchPopular` ordering.
6. **DNS cutover ordering:** the `staging` Vercel domain (Task H) is created
   **before** the Cloudflare migration (Task I) so Cloudflare scans in all three
   hostnames (apex, `www`, `staging`) and configures them in one pass.

## Architecture

### Environment source of truth — `lib/env.ts` (new)

A single typed reader so banner, noindex, and Redis namespacing never drift:

```ts
export type AppEnv = 'production' | 'staging'
export const APP_ENV: AppEnv =
  process.env.NEXT_PUBLIC_ENV === 'staging' ? 'staging' : 'production'
export const isStaging = APP_ENV === 'staging'
```

`NEXT_PUBLIC_ENV` is only set (`=staging`) in the Preview→staging scope. Production
and local default to `'production'`.

### Redis key namespacing

All cache and rate-limit keys gain an `APP_ENV` prefix so staging and production
never read or write each other's entries on the shared instance.

- `lib/cache.ts`: `searchCacheKey` / `titleCacheKey` → prefix with `${APP_ENV}:`
  (e.g. `staging:search:parks-and-recreation`, `production:title:<id>`).
- `lib/rate-limit.ts`: limiter prefix `rate-limit:${endpoint}` →
  `${APP_ENV}:rate-limit:${endpoint}`.

Production keys keep a stable, explicit `production:` prefix (chosen over "no prefix
for prod" so the namespace is uniform and greppable). This is a one-time key-space
change; existing prod cache entries simply expire and repopulate under the new
prefix (cache is fail-open and short-TTL, so this is safe).

### Staging banner — `components/staging-banner.tsx` (new)

Small, fixed, unobtrusive amber bar reading **"Staging Environment"**, rendered in
the root layout **only when `isStaging`**. Matches existing component conventions
(Tailwind, existing color tokens). Renders `null` in production → zero prod impact.

### noindex

The root layout's robots metadata is `noindex` when **either** the existing
pre-launch global toggle is on **or** `isStaging`. Staging's noindex cannot be
turned off by the global toggle.

### Seed `--limit` flag — `scripts/seed.ts`

Parse `--limit=N` from `process.argv`; when present it overrides
`SEED_OPTIONS.maxTitles`. `fetchPopular` already returns titles in TMDB popularity
order, so "top 50 popular" = `--limit=50`. Staging seed runs against staging creds
via a local `.env.staging.local` file (gitignored), e.g.
`tsx --env-file=.env.staging.local scripts/seed.ts --limit=50`.

## Task H — Staging environment, step by step

1. **`staging` branch** — created from `origin/master` (`600b33a`) and pushed. ✅ done.
2. **Staging Supabase project** — *user creates* `wherecaniwatchit-staging`, Singapore,
   free tier; provides URL + anon key + service-role key.
3. **Apply migrations** — `supabase link --project-ref <staging-ref>` →
   `supabase db push`. Verify schema parity (`titles` columns, indexes, the
   `api_quota` table, RLS policies) against production.
4. **Vercel domain** — assign `staging.wherecaniwatchit.info` to the `staging` branch.
5. **Vercel env vars (Preview → `staging`):** staging
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ENV=staging`; **and** replicate the
   shared keys (TMDB, MOTN, Redis, Sentry) into the staging scope with the same
   values (they may currently be Production-scoped only).
6. **Permanent noindex** — via `isStaging` (above).
7. **Staging banner** — via `isStaging` (above).
8. **Mini-seed** — top 50 popular titles into staging via `--limit=50`.

**Quota note:** staging has its own `api_quota` row (per-Supabase-project), so the
50-title seed spends 50 MOTN calls against the shared MOTN account and does not
touch prod's quota counter.

## Task I — Cloudflare DNS migration, step by step

No application code. Walkthrough + verification:

1. *User* adds `wherecaniwatchit.info` to Cloudflare free plan; Cloudflare auto-scans
   GoDaddy records. I provide a checklist to confirm every record (esp. Vercel apex
   + `www`, and the new `staging` CNAME) transferred.
2. Set apex, `www`, `staging` to **proxied (orange cloud)** — required for the
   DDoS/edge benefits.
3. Cloudflare provides two nameservers → *user* pastes them into GoDaddy.
4. **Verify propagation** before changing any settings (`dig NS` / DoH until both
   Cloudflare NS are authoritative globally).
5. Enable: SSL/TLS **Full (Strict)**, Always Use HTTPS, Automatic HTTPS Rewrites,
   HSTS, Brotli.
6. **Verify** apex + `www` + `staging` all load over HTTPS with valid certs and
   correct content. Confirm Vercel still reports domains as "Valid Configuration."

**Rollback:** revert nameservers at GoDaddy if cutover breaks anything.

## Testing (TDD — failing test first)

- `lib/env.test.ts` — `APP_ENV` / `isStaging` resolve from `NEXT_PUBLIC_ENV`
  (staging vs unset vs other → production).
- `lib/cache.test.ts` — key builders include the `APP_ENV` prefix; staging and
  production produce different keys for the same query/id.
- `lib/rate-limit.test.ts` — limiter prefix includes `APP_ENV`.
- `components/staging-banner.test.tsx` — renders the bar when `isStaging`, renders
  `null` otherwise.
- `scripts/seed` — `--limit=N` parsing overrides `maxTitles`; absent → default.
- Full `vitest run` green before marking complete.

## Success criteria

- `staging.wherecaniwatchit.info` live; amber banner visible; `noindex` present;
  schema identical to prod; 50 popular titles seeded.
- Redis keys env-namespaced — no cross-env cache/rate-limit collision.
- `wherecaniwatchit.info` + `www` on Cloudflare, proxied, Full (Strict), HSTS +
  Brotli enabled; all three hostnames load correctly over HTTPS.

## Blocked on user (prep everything so execution is instant)

- Staging Supabase project + its 3 credentials.
- Cloudflare signup; GoDaddy nameserver paste.
- Vercel dashboard: domain assignment + env var entry (I provide exact values/paths).

## Dependencies / ordering

`staging` branch (done) → staging Supabase + migrations → Vercel domain + env →
banner/noindex/Redis-namespacing code shipped to staging → mini-seed → **then**
Cloudflare DNS cutover (so all three hostnames migrate in one pass).
