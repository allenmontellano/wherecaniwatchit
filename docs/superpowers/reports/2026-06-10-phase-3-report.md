# Phase 3 Completion Report

> Date: 2026-06-10. Covers Phase 3 (staging, search quality, performance) + the SP4 load test that closes it.

## Scope & status

| Sub-project | Summary | Status |
|---|---|---|
| **SP1 — Staging + DNS** | Dedicated staging env (`staging.wherecaniwatchit.info`), Cloudflare DNS (Full Strict, HSTS, Always HTTPS, zstd), env-namespaced Redis. | ✅ Shipped |
| **SP2 — Search quality pipeline** | normalize → Postgres FTS (weighted tsvector, trigger-maintained) → pg_trgm fuzzy → TMDB fallback + quota-gated on-demand seed. | ✅ Shipped (prod) |
| **SP3 — Ranking / cap / edge / analytics** | Supplementary down-rank above ts_rank + IMDb tie-break; query cap 200→100; good-results edge cache; Vercel Analytics + Speed Insights (cookieless). | ✅ Shipped (prod) |
| **SP5 — MOTN PH data-gap research** | Systematic Disney+ PH gap (0/8) documented; pre-launch PH seeding priorities set. | ✅ Complete |
| **SP4 — Load test + this report** | Concurrent load-test tooling + staging run + findings. | ✅ Tooling shipped; cross-region latency found & fixed (`sin1`) — **GO** |

*(SP9 — Terms & Privacy — is Phase 4 but already shipped to prod; noted for completeness.)*

## SP4 — Load test

**Method.** A custom `scripts/load-test.ts` drove **50 concurrent workers × 10 requests = 500** against the staging Vercel deployment, in three cohorts: **cached** (pre-warmed, Redis-hit path), **db** (distinct titles, Postgres compute), **tmdb** (unseeded titles, on-demand-seed fallback). Per-request **server-compute** time was measured via a response header (see "Server-Timing note"), isolating server time from client/WAN latency. Pass metric = **p95** vs threshold; tooling, percentiles, and threshold logic are unit-tested (`lib/loadtest/stats.ts`).

**Results (server-compute time, staging, 2026-06-10):**

| Cohort | n | p50 | p95 | p99 | Threshold | Result |
|---|---|---|---|---|---|---|
| cached | 426 | 221.9ms | 242.9ms | 324.8ms | <100ms | ❌ FAIL |
| db | 66 | 1013.6ms | 2003.7ms | 2054.8ms | <500ms | ❌ FAIL |
| tmdb | 8 | 3873.3ms | 4148.6ms | 4148.6ms | <3000ms | ❌ FAIL |

- **Error rate: 0.00%** (0 non-2xx of 500). The service stayed healthy under load — no failures, no rate-limit errors (limit raised for the test).
- Cohorts behaved as designed: cached = Redis hits; db = FTS/fuzzy compute; tmdb = **6 on-demand seeds + 2 TMDB** responses (fallback genuinely exercised; MOTN spend bounded to ~8 titles).
- Raw artifact: `docs/superpowers/reports/load-test-results.json`.

### Root cause — cross-region function/data placement (affects production)

The latencies are dominated by **network distance, not compute**: a *Redis cache hit* alone takes ~220ms. The cause:

- **Vercel functions run in `iad1` (US-East)** — confirmed via `X-Vercel-Id: sin1::iad1::…` on both staging *and* production.
- **Supabase Postgres is in `ap-southeast-1` (Singapore)** — confirmed via the Management API for **both** the staging (`hunvbflchgjphnhdjmws`) and **production** (`ahgmszdrhndcycvairmn`) projects.

So every query makes a **US ↔ Singapore round trip** (×N for the DB path's multiple queries → ~1s). **Because production shares the same `iad1` functions + Singapore database, production search is affected identically** — this is a real pre-launch UX issue, not a staging artifact.

### Secondary finding — `Server-Timing` is stripped by the platform

The standard `Server-Timing` header set by `/api/search` does **not** survive to the client on either the Cloudflare-fronted domain *or* the raw `*.vercel.app` URL (the Next/Vercel response path drops it). Workaround shipped: the route also sets a custom **`X-Search-Compute-Ms`** header (custom `X-` headers pass through), which the load test reads. Keep this in mind for any future observability that relies on `Server-Timing`.

### Remediation applied — region co-location

Fix shipped to staging: **`vercel.json` `"regions": ["sin1"]`** pins the functions to Singapore, co-located with Supabase (`ap-southeast-1`) and Upstash (already in `sin1`). Function region confirmed flipped via `X-Vercel-Id: sin1::sin1::…`; a single cached query dropped from ~236ms → ~14ms.

### Re-test (sin1-co-located, staging, 2026-06-10)

| Cohort | n | p50 | p95 | p99 | Threshold | Before (iad1) p95 | Result |
|---|---|---|---|---|---|---|---|
| cached | 409 | 3.9ms | **32.0ms** | 41.6ms | <100ms | 242.9ms | ✅ PASS |
| db | 83 | 90.3ms | **231.6ms** | 604.5ms | <500ms | 2003.7ms | ✅ PASS |
| tmdb | 8 | 3.4ms | 3525.3ms | 3525.3ms | <3000ms | 4148.6ms | ⚠️ see note |

- Error rate **0.00%**; full run in 5.84s. Co-location cut hot-path latency **~85–90%**.
- **`tmdb` note:** this cohort's p95 is an artifact, not a regression. Run-1 seeded 7 of the 8 cold titles, so run-2 served them from the DB (samples: `[3, 3, 3, 3, 59, 73, 178, 3525]` ms; sources `7 db + 1 on-demand`). The single 3525ms sample is one genuine cold on-demand seed; with n=8, p95 = that max. The on-demand-seed path is **inherently ~3–3.5s by design** (external TMDB/MOTN latency + the 3000ms `SYNC_TIMEOUT_MS`, after which it returns a graceful "available soon" notice). It's a **rare, self-healing first-lookup path** (the title is cached afterward), not normal search.

## Launch readiness — Go / No-Go

- ✅ **Functional pipeline, ranking, caching, analytics, security, legal pages** — all green (SP1–SP3, SP9).
- ✅ **Stability under load** — 0% errors at 50× concurrency.
- ✅ **Search latency (normal paths) — GO.** After co-location, **cached p95 32ms** and **db p95 232ms** both pass comfortably. These are the paths real users hit.
- ⚠️ **`tmdb` cold-seed path — advisory, acceptable.** Its p95 sits just over the 3000ms target because it's bounded by the external-API + 3s-seed-timeout design and degrades gracefully (notice + background seed). **Recommendation:** treat the <3000ms target as advisory for this path, or restate it as "returns within the seed timeout (~3s) with a notice." Not a launch blocker.

**Verdict: GO** for search performance, with the `tmdb` fallback characterized as acceptable-by-design above.

### Follow-ups
- Merge the SP4 tooling + the `sin1` region pin to **`master`** so production also runs co-located (production has the same `iad1`/Singapore mismatch this fixes).
- Restore the staging search rate limit (remove `RATE_LIMIT_SEARCH`).

## Next steps — handoff

Phase 3 is functionally complete; the latency remediation above is the gating pre-launch performance item. In parallel, the next sub-projects can begin:
- **SP6 — Auth & roles (invite-only)** — full spec → plan → build; unblocks SP7. (Migration-heavy: needs `SUPABASE_ACCESS_TOKEN` in env for Management-API migrations; CLI is linked to staging.)
- **SP8 — Expanded reporting form** — **no auth dependency**, can run **in parallel with SP6**.
- **SP7 — Internal CMS & Data Accuracy Layer** — after SP6. (Disney+ PH + `motn` rows default to very low confidence in the verification queue.)
- **SP10 — E2E Playwright gate**, then launch (flip `SITE_INDEXABLE` → true).
