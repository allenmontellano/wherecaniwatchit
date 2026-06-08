# Staging Environment & Cloudflare DNS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a permanent `staging.wherecaniwatchit.info` environment (env-isolated Redis, staging banner, permanent noindex, 50-title seed) and migrate the apex domain onto Cloudflare.

**Architecture:** One Vercel project; `staging` branch + branch-scoped Preview env vars. A single call-time env helper (`lib/env.ts`) drives banner visibility, noindex, and `APP_ENV`-prefixed Redis keys so staging and prod never collide on the shared Upstash instance. Migrations apply to staging via the Supabase CLI; the seed script gains a `--limit` flag. Cloudflare migration is dashboard work + verification (no app code).

**Tech Stack:** Next.js 16.2.7 (App Router), TypeScript strict, Vitest (node env), Upstash Redis + Ratelimit, Supabase CLI, Cloudflare.

**Reference spec:** `docs/superpowers/specs/2026-06-08-staging-and-dns-design.md`

---

## File Structure

- **Create** `lib/env.ts` — call-time `appEnv()` / `isStaging()` reading `NEXT_PUBLIC_ENV`. Single source of truth.
- **Create** `lib/env.test.ts` — unit tests for the above.
- **Create** `components/layout/staging-banner.tsx` — amber bar, renders only when `isStaging()`.
- **Modify** `lib/cache.ts` — prefix `searchCacheKey` / `titleCacheKey` with `appEnv()`.
- **Modify** `lib/cache.test.ts` — update key assertions; add staging-vs-prod isolation test.
- **Modify** `lib/rate-limit.ts` — extract `limiterPrefix(endpoint)` with `appEnv()` prefix.
- **Modify** `lib/rate-limit.test.ts` — add `limiterPrefix` test.
- **Modify** `app/layout.tsx` — render `<StagingBanner/>`; make `noindex` true when `isStaging()`.
- **Modify** `scripts/seed.ts` — parse `--limit=N` → overrides `maxTitles`.
- **Create** `scripts/seed.test.ts` — unit test for `parseLimit`.
- **Ops only (no code):** apply migrations to staging, mini-seed, deploy + Playwright verify, Cloudflare cutover.

**Environment note:** `NEXT_PUBLIC_ENV` is inlined by Next at build for client code and read from `process.env` server-side. `appEnv()` is a function (not a module const) so tests can `vi.stubEnv` per-case without `resetModules`.

---

## Task 1: `lib/env.ts` — environment source of truth

**Files:**
- Create: `lib/env.ts`
- Test: `lib/env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/env.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appEnv, isStaging } from './env'

afterEach(() => vi.unstubAllEnvs())

describe('appEnv', () => {
  it('returns staging when NEXT_PUBLIC_ENV=staging', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
    expect(appEnv()).toBe('staging')
    expect(isStaging()).toBe(true)
  })

  it('returns production when NEXT_PUBLIC_ENV is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', '')
    expect(appEnv()).toBe('production')
    expect(isStaging()).toBe(false)
  })

  it('returns production for any other value', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'preview')
    expect(appEnv()).toBe('production')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/env.test.ts`
Expected: FAIL — cannot find module `./env`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/env.ts
export type AppEnv = 'production' | 'staging'

export function appEnv(): AppEnv {
  return process.env.NEXT_PUBLIC_ENV === 'staging' ? 'staging' : 'production'
}

export function isStaging(): boolean {
  return appEnv() === 'staging'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/env.ts lib/env.test.ts
git commit -m "feat: add APP_ENV source of truth for env-aware behavior"
```

---

## Task 2: Env-namespace the cache keys

**Files:**
- Modify: `lib/cache.ts:26-32`
- Test: `lib/cache.test.ts`

- [ ] **Step 1: Update the failing tests**

In `lib/cache.test.ts`, update existing `searchCacheKey`/`titleCacheKey` assertions to expect the `production:` prefix by default, and add an isolation test. Add at the top of the file:

```ts
import { afterEach, vi } from 'vitest'
afterEach(() => vi.unstubAllEnvs())
```

Replace the existing key assertions and add:

```ts
it('prefixes search keys with the environment', () => {
  expect(searchCacheKey('Parks and Recreation')).toBe('production:search:parks-and-recreation')
})

it('prefixes title keys with the environment', () => {
  expect(titleCacheKey('abc-123')).toBe('production:title:abc-123')
})

it('isolates staging keys from production for the same input', () => {
  vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
  expect(searchCacheKey('severance')).toBe('staging:search:severance')
  expect(titleCacheKey('abc-123')).toBe('staging:title:abc-123')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/cache.test.ts`
Expected: FAIL — keys are `search:...` / `title:...` without the env prefix.

- [ ] **Step 3: Write minimal implementation**

In `lib/cache.ts`, add the import and prefix both builders:

```ts
import { appEnv } from './env'
```

```ts
export function searchCacheKey(query: string): string {
  return `${appEnv()}:search:${normalizeQuery(query)}`
}

export function titleCacheKey(id: string): string {
  return `${appEnv()}:title:${id}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cache.ts lib/cache.test.ts
git commit -m "feat: namespace cache keys by environment"
```

---

## Task 3: Env-namespace the rate-limit keys

**Files:**
- Modify: `lib/rate-limit.ts:18-29`
- Test: `lib/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/rate-limit.test.ts`:

```ts
import { afterEach, vi } from 'vitest'
import { limiterPrefix } from './rate-limit'

afterEach(() => vi.unstubAllEnvs())

describe('limiterPrefix', () => {
  it('namespaces the limiter prefix by environment', () => {
    expect(limiterPrefix('search')).toBe('production:rate-limit:search')
    vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
    expect(limiterPrefix('flags')).toBe('staging:rate-limit:flags')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/rate-limit.test.ts`
Expected: FAIL — `limiterPrefix` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `lib/rate-limit.ts` add the import and the helper, and use it in `getLimiter`:

```ts
import { appEnv } from '@/lib/env'
```

```ts
export function limiterPrefix(endpoint: RateLimitedEndpoint): string {
  return `${appEnv()}:rate-limit:${endpoint}`
}
```

In `getLimiter`, change the `prefix` line:

```ts
      prefix: limiterPrefix(endpoint),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts
git commit -m "feat: namespace rate-limit keys by environment"
```

---

## Task 4: Staging banner component + layout wiring

**Files:**
- Create: `components/layout/staging-banner.tsx`
- Modify: `app/layout.tsx:46-55`

(No unit test — the only logic is `isStaging()`, already covered in Task 1. The bar is verified visually via Playwright in Task 9.)

- [ ] **Step 1: Create the component**

```tsx
// components/layout/staging-banner.tsx
import { isStaging } from '@/lib/env'

export function StagingBanner() {
  if (!isStaging()) return null
  return (
    <div
      role="status"
      className="w-full bg-amber-500 py-1 text-center text-xs font-medium text-black"
    >
      Staging Environment
    </div>
  )
}
```

- [ ] **Step 2: Render it at the top of the body in `app/layout.tsx`**

Add the import:

```tsx
import { StagingBanner } from '@/components/layout/staging-banner'
```

Change the body:

```tsx
      <body className="font-sans antialiased">
        <StagingBanner />
        {children}
      </body>
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: clean (no type errors; build succeeds). Banner renders `null` locally (`NEXT_PUBLIC_ENV` unset → production).

- [ ] **Step 4: Commit**

```bash
git add components/layout/staging-banner.tsx app/layout.tsx
git commit -m "feat: add staging banner shown only when APP_ENV=staging"
```

---

## Task 5: Permanent noindex on staging

**Files:**
- Modify: `app/layout.tsx:27-32`

- [ ] **Step 1: Make robots respect staging**

`metadata` is a static export; `isStaging()` reads the build-inlined `NEXT_PUBLIC_ENV`, so it resolves at build time. Add the import (already added in Task 4) and change the robots computation:

```tsx
// Pre-launch toggle: keep false to block search engines (noindex, nofollow).
// Flip to true on launch day. Staging is ALWAYS noindex regardless of this toggle.
const SITE_INDEXABLE = false
const indexable = SITE_INDEXABLE && !isStaging()
```

Update `metadata.robots`:

```tsx
  robots: { index: indexable, follow: indexable },
```

Add the import if not already present from Task 4:

```tsx
import { isStaging } from '@/lib/env'
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: force noindex on staging independent of launch toggle"
```

---

## Task 6: Seed `--limit=N` flag

**Files:**
- Modify: `scripts/seed.ts:5-6`
- Test: `scripts/seed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/seed.test.ts
import { describe, expect, it } from 'vitest'
import { parseLimit } from './seed'

describe('parseLimit', () => {
  it('reads --limit=N', () => {
    expect(parseLimit(['node', 'seed.ts', '--limit=50'])).toBe(50)
  })

  it('returns undefined when absent', () => {
    expect(parseLimit(['node', 'seed.ts'])).toBeUndefined()
  })

  it('ignores a non-numeric limit', () => {
    expect(parseLimit(['node', 'seed.ts', '--limit=abc'])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/seed.test.ts`
Expected: FAIL — `parseLimit` is not exported.

- [ ] **Step 3: Implement and wire it in**

In `scripts/seed.ts`, add the export and apply it. The current file imports `runSeed` and `fetchPopular`; add:

```ts
export function parseLimit(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith('--limit='))
  if (!arg) return undefined
  const n = Number(arg.slice('--limit='.length))
  return Number.isInteger(n) && n > 0 ? n : undefined
}
```

Then override `SEED_MAX_TITLES` before seeding by passing the limit through env so `seed-common`'s `SEED_OPTIONS.maxTitles` honors it. At the top of the run (before `gatherCandidates().then(runSeed)`):

```ts
const limit = parseLimit(process.argv)
if (limit !== undefined) process.env.SEED_MAX_TITLES = String(limit)
```

> Note: set `SEED_MAX_TITLES` **before** `seed-common` reads it. Because `SEED_OPTIONS` is evaluated at import time in `seed-common.ts`, move the `parseLimit` lines to the very top of `scripts/seed.ts`, above the `import { runSeed } from './seed-common'` line, using a dynamic import for `runSeed`:

```ts
import { fetchPopular } from '@/lib/tmdb/client'
import type { TMDBSearchResult } from '@/lib/tmdb/types'

export function parseLimit(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith('--limit='))
  if (!arg) return undefined
  const n = Number(arg.slice('--limit='.length))
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const limit = parseLimit(process.argv)
if (limit !== undefined) process.env.SEED_MAX_TITLES = String(limit)

const PAGES = Number(process.env.SEED_PAGES) || 100

async function gatherCandidates(): Promise<TMDBSearchResult[]> {
  const all: TMDBSearchResult[] = []
  for (const media of ['movie', 'tv'] as const) {
    for (let page = 1; page <= PAGES; page++) {
      const results = await fetchPopular(media, page)
      if (results.length === 0) break
      all.push(...results)
    }
  }
  return all
}

async function main() {
  const { runSeed } = await import('./seed-common')
  await runSeed(await gatherCandidates())
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/seed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts scripts/seed.test.ts
git commit -m "feat: add --limit flag to seed script"
```

---

## Task 7: Apply migrations to staging Supabase (ops)

**Prerequisite from user:** staging DB password (set when the Supabase project was created) OR confirm we use a Supabase **access token** (`SUPABASE_ACCESS_TOKEN`) for linking. `supabase db push` needs the DB connection to apply SQL.

- [ ] **Step 1: Link the CLI to the staging project**

```bash
npx supabase link --project-ref hunvbflchgjphnhdjmws
```
Expected: prompts for DB password; on success prints "Finished supabase link."

- [ ] **Step 2: Push all migrations**

```bash
npx supabase db push
```
Expected: applies all 7 migrations in `supabase/migrations/` in order; prints "Finished supabase db push."

- [ ] **Step 3: Verify schema parity against production**

Confirm the staging `titles` table has every column (incl. `network`, `cast`, `creators`, `seed_status`), the `api_quota` table exists, and indexes match. Run a verification query via the seed/admin client or Supabase SQL editor:

```sql
select column_name from information_schema.columns
where table_name = 'titles' order by ordinal_position;
select to_regclass('public.api_quota') is not null as api_quota_exists;
```
Expected: column list matches production; `api_quota_exists = true`.

- [ ] **Step 4: No commit** (no repo changes — migrations already committed).

---

## Task 8: Mini-seed 50 popular titles into staging (ops)

- [ ] **Step 1: Run the seed against staging creds**

```bash
npx tsx --env-file=.env.staging.local scripts/seed.ts --limit=50
```
Expected: "Quota at start: 0/25000"; seeds ~50 titles; "Seeded: 50" (give or take skips); final quota ~50/25000 on the **staging** counter.

- [ ] **Step 2: Verify row count in staging**

```sql
select count(*) from titles;
select count(*) from availability;
```
Expected: ~50 titles, availability rows present.

- [ ] **Step 3: No commit.**

---

## Task 9: Deploy to staging branch + verify (ops)

- [ ] **Step 1: Merge the feature work into `staging`**

Merge the branch holding Tasks 1–6 into `staging` and push:

```bash
git checkout staging
git merge --no-ff <feature-branch>
git push origin staging
git checkout <feature-branch>
```
Expected: Vercel auto-builds the `staging` branch → deploys to `staging.wherecaniwatchit.info`.

- [ ] **Step 2: Verify with Playwright at 375px and 1280px**

Navigate to `https://staging.wherecaniwatchit.info`. Confirm:
- Amber "Staging Environment" bar visible at the top.
- `<meta name="robots" content="noindex, nofollow">` present (check page `<head>`).
- A search for a seeded title returns a result (DB-first works on staging).

- [ ] **Step 3: Verify Redis isolation**

Run a search on staging, then the same search on production; confirm they don't return each other's data (staging has 50 titles, prod has 3,473). Spot-check via a query unique to one env.

- [ ] **Step 4: No commit** (verification only).

---

## Task 10: Cloudflare DNS migration (ops, Task I)

No app code. User-driven dashboard steps with my verification at each gate.

- [ ] **Step 1: Add site to Cloudflare**

User: Cloudflare → Add a site → `wherecaniwatchit.info` (Free plan). Cloudflare auto-scans GoDaddy records. I provide a checklist confirming apex (Vercel `A`/`ALIAS`), `www` CNAME, and the new `staging` CNAME all transferred.

- [ ] **Step 2: Set proxy status**

Apex, `www`, `staging` → **proxied (orange cloud)**.

- [ ] **Step 3: Update nameservers at GoDaddy**

User pastes Cloudflare's two nameservers into GoDaddy (replacing GoDaddy's). I provide the exact GoDaddy click-path.

- [ ] **Step 4: Verify propagation (gate before any settings change)**

```bash
dig +short NS wherecaniwatchit.info
```
Expected: both Cloudflare nameservers returned, globally authoritative (recheck until stable; can take up to 24h).

- [ ] **Step 5: Enable settings**

SSL/TLS **Full (Strict)**, Always Use HTTPS, Automatic HTTPS Rewrites, HSTS, Brotli.

- [ ] **Step 6: Final verification**

Confirm `wherecaniwatchit.info`, `www.wherecaniwatchit.info`, and `staging.wherecaniwatchit.info` all load over HTTPS with valid certs and correct content; Vercel still reports all domains "Valid Configuration." Rollback = revert GoDaddy nameservers if anything breaks.

---

## Self-Review

**Spec coverage:**
- Staging branch — done pre-plan. ✓
- Staging Supabase + migrations — Task 7. ✓
- Vercel domain + env vars — done by user (confirmed). ✓
- Permanent noindex — Task 5. ✓
- Staging banner — Task 4. ✓
- Mini-seed 50 via `--limit` — Tasks 6 + 8. ✓
- Redis env-namespacing — Tasks 2 + 3. ✓
- `lib/env.ts` source of truth — Task 1. ✓
- Cloudflare migration (all settings) — Task 10. ✓

**Placeholder scan:** none — all steps contain concrete code/commands.

**Type consistency:** `appEnv()`/`isStaging()` defined in Task 1, used identically in Tasks 2/3/4/5. `limiterPrefix(endpoint: RateLimitedEndpoint)` matches the existing exported type. `parseLimit(argv: string[]): number | undefined` consistent between test and impl.

**Open dependency:** Task 7 needs the staging DB password (or `SUPABASE_ACCESS_TOKEN`) — flagged in the task.
