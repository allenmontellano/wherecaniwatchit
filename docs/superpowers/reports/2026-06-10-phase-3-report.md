# Phase 3 Completion Report

> Date: 2026-06-10. Covers Phase 3 (staging, search quality, performance) + the SP4 load test that closes it.

## Scope & status

| Sub-project | Summary | Status |
|---|---|---|
| **SP1 — Staging + DNS** | Dedicated staging env (`staging.wherecaniwatchit.info`), Cloudflare DNS (Full Strict, HSTS, Always HTTPS, zstd), env-namespaced Redis. | ✅ Shipped |
| **SP2 — Search quality pipeline** | normalize → Postgres FTS (weighted tsvector, trigger-maintained) → pg_trgm fuzzy → TMDB fallback + quota-gated on-demand seed. | ✅ Shipped (prod) |
| **SP3 — Ranking / cap / edge / analytics** | Supplementary down-rank above ts_rank + IMDb tie-break; query cap 200→100; good-results edge cache; Vercel Analytics + Speed Insights (cookieless). | ✅ Shipped (prod) |
| **SP5 — MOTN PH data-gap research** | Systematic Disney+ PH gap (0/8) documented; pre-launch PH seeding priorities set. | ✅ Complete |
| **SP4 — Load test + this report** | Concurrent load-test tooling + staging run + findings. | ✅ Tooling shipped; ⚠️ perf finding (below) |

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

## Launch readiness — Go / No-Go

- ✅ **Functional pipeline, ranking, caching, analytics, security, legal pages** — all green (SP1–SP3, SP9).
- ✅ **Stability under load** — 0% errors at 50× concurrency.
- ⛔ **Search latency — NO-GO as-is.** All three thresholds fail due to function/DB region mismatch. This is the one blocking item from Phase 3.

### Recommended remediation (then re-test)
1. **Co-locate Vercel functions with the data** — pin the deployment region to **Singapore (`sin1`)** to match Supabase `ap-southeast-1` (e.g., `vercel.json` `"regions": ["sin1"]` or the project's Functions-region setting). Expected effect: cached → tens of ms, db → low hundreds of ms (same-region FTS + join).
2. **Verify the Upstash Redis region** — if the Redis instance isn't in Asia, move/recreate it in a Singapore region so the cached path is also same-region.
3. **`tmdb` cohort** is partly bound by external TMDB/MOTN latency + the 3s on-demand-seed timeout; re-evaluate the <3000ms target after co-location (the seed path returns a "available soon" notice at the timeout by design).
4. **Re-run the load test** (`scripts/load-test.ts`, with the staging rate limit temporarily raised) to confirm thresholds, and capture an updated results table here.

## Next steps — handoff

Phase 3 is functionally complete; the latency remediation above is the gating pre-launch performance item. In parallel, the next sub-projects can begin:
- **SP6 — Auth & roles (invite-only)** — full spec → plan → build; unblocks SP7. (Migration-heavy: needs `SUPABASE_ACCESS_TOKEN` in env for Management-API migrations; CLI is linked to staging.)
- **SP8 — Expanded reporting form** — **no auth dependency**, can run **in parallel with SP6**.
- **SP7 — Internal CMS & Data Accuracy Layer** — after SP6. (Disney+ PH + `motn` rows default to very low confidence in the verification queue.)
- **SP10 — E2E Playwright gate**, then launch (flip `SITE_INDEXABLE` → true).
