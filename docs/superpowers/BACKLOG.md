# Consolidated Backlog — wherecaniwatchit

> Single ordered source of truth, compiled 2026-07-06 from CLAUDE.md, the SP13/SP14 specs, the phase-3 report, the SP6/SP8 deferred-follow-up notes, and the untracked `Project Han.md`. Ordered by **impact/launch-criticality**, not by when logged. Re-review before launch sequencing.

## Tier 0 — Launch-gating (in flight or must-precede launch)

1. **SP13 batch 1 (security) — IN FLIGHT, at staging gate.** SEC-01/02/08/09 built on `feat/sp13-security-batch1`; migration `20260706000002` written, not applied. Needs: staging migration apply + verify → merge → prod. *Near done.*
2. **SP14 — SEO + GEO/AEO — SPEC WRITTEN, awaiting approval.** `docs/.../2026-07-06-sp14-seo-geo-aeo-design.md`. Launch-gating (robots/sitemap/`SITE_INDEXABLE` flip, per-title metadata, JSON-LD `WatchAction`, AI-crawler policy, `llms.txt`, answer-extraction readiness). Must land **before** SP10 so E2E can assert it.
3. **SP13 batch 2 (security hardening) — not started.** SEC-03 (sanitize `watch_url` on MOTN path + at render), SEC-04 (allowlist title-override cols), SEC-05 (dedicated `IP_HASH_SALT`), SEC-06 (trusted client-IP source), SEC-07 (DB-enforced last-admin invariant). Should land before launch.
4. **SP10 — E2E Playwright gate → launch.** The final gate; flips `SITE_INDEXABLE` → true (prod). Prerequisite for the GitHub Actions CI pipeline. Depends on SP14 landing first.
5. **Privacy contact email** — set up `privacy@wherecaniwatchit.info` via Cloudflare Email Routing **before launch** (referenced in legal pages). Operational, small.

## Tier 1 — High product/data impact (pre-launch or fast-follow)

6. **SP11 — PH Platform Accuracy.** (a) Manual ingestion of **Vivamax/VMX** + **iWantTFC/iWant** (absent from MOTN); (b) **Disney+ PH = Hulu PH** catalog equivalence; (c) **HBO Max content via Viu PH** partnership overlap. Needs **data ingestion (now enabled by the SP7 CMS) + a platform-equivalence/alias table in schema**. Highest data-quality lever for the PH core market. *Ties to SP14 §4.4 (don't feed low-confidence data to answer engines).*
7. **MOTN decision + data-staleness remediation.** SP7 shipped → the "cancel MOTN at SP7 ship" decision is now **actionable**. **95% of prod availability (8,665/9,120) is >30 days stale** (June-4 bulk seed); only 447 `checker` rows stay fresh. Decide: cancel vs keep one cycle, and define the re-seed/refresh plan (CMS manual + checkers). High operational impact; interacts with SP14 freshness signals.
8. **SP12 — Search Quality Polish.** "The Big Bang Theory" → returns **Young Sheldon** (seed TBBT + penalize spin-off metadata in ranking). Core-UX correctness. *(Search-suggestions piece is post-launch — see Tier 4.)*

## Tier 2 — Robustness / ops (medium)

9. **Ops alert — MOTN dead-aggregator signature.** Log/alert when `sync-availability` cron hits `refreshed=0 && stoppedForQuota=false` (the "aggregator returned nothing" signal). Cheap; catches silent staleness (SEC-09 backlog note).
10. **SEC-09-adjacent robustness sweep.** SEC-09 added timeouts to `getTitleDetail`/`/api/flags`/cache. Audit the *other* external calls for missing timeouts: TMDB client, search RPCs (`search-db`), sync/seed paths, other `createAdminClient` reads. Prevent hangs elsewhere.
11. **Report-button prominence / coverage fix.** ✅ **SCOPED (2026-07-11):** add a **persistent per-region-row** report affordance **+ a report entry point on the zero-results view** (today it's only the per-title/search-result modal). Not yet built.
12. **Favicon.** ✅ **SCOPED (2026-07-11):** replace the placeholder `app/favicon.ico` with a **real logo + apple-touch-icon + web manifest** icon set. Not yet built.

## Tier 3 — Small deferred follow-ups (low, batchable)

13. **SP6 follow-ups:** (a) guards **fail closed silently** on auth-service errors — log them (mild security/observability); (b) proxy-session unit test for `setAll` cookie propagation; (c) invite CLI partial-failure message should include the user id.
14. **SP8 follow-ups:** (a) silent error swallowing in `platforms-data` fetch wrappers; (b) **`platformOther` not reset on switch-away** in the report modal (real UX bug); (c) a few boundary tests; (d) SP7 reviewer note on the slug-or-text `reported_platform` dual interpretation.
15. **TMDB attribution logo** — text disclosure satisfies the minimum; adding the required logo image is a footer follow-up (legal nicety).

## Tier 4 — Post-launch roadmap (explicitly not backlog-urgent)

16. Contributor **payment** tracking refinements + payment-rate (deferred, set operationally).
17. **Reporting algorithm** — threshold-based auto-updates from confidence + flag volume.
18. **Search suggestions** (real-time as-you-type). *(Logged 3×: CLAUDE SP12, Project Han §12 + §13 — dedupe.)*
19. **Infisical** secrets manager.
20. **GitHub Actions CI pipeline** (prereq: SP10 Playwright suite; the SP13 `admin-surface-guard` test + full suite should run here).
21. **VMX/iWant/Viu PH partnership outreach** — after 100k users (build leverage first).
22. **Programmatic SEO landing pages** (from SP14 out-of-scope) — growth lever.

## Flags — stale / duplicated / unclear / at-risk

- **STALE:** `Project Han.md` §11 "MOTN — renew for now, revisit once SP7 CMS live" is superseded (SP7 is live; current guidance = "cancel at SP7 ship"). Reconcile to one statement (see item 7).
- **DUPLICATED:** SP11 + SP12 appear in both CLAUDE.md and `Project Han.md` (and again in Project Han's "Post-Launch Roadmap"); "search suggestions" logged 3×. Consolidated here.
- **SCOPED 2026-07-11:** items 11 (report-button: persistent per-region-row + zero-results entry point) and 12 (favicon: real logo + apple-touch-icon + manifest) — now scoped, not yet built.
- **AT-RISK SOURCE:** `Project Han.md` is **untracked** (now gitignored via SEC-08). Its unique content (post-launch roadmap, platform-coverage matrix, key-decisions table) lives nowhere version-controlled. **Recommend folding its unique sections into CLAUDE.md or a tracked doc, then deleting the scratch file** — otherwise it's lost on cleanup. This BACKLOG.md captures its backlog items; the decisions/coverage matrix still need a home.
- **CORRECTLY CLOSED (not dropped):** Task N PgBouncer (N/A — REST API), multi-region replication (premature), AI embeddings (replaced by pg_trgm+TMDB), canary deploys (no traffic). Listed so they're not re-raised.

## Suggested launch sequence

SP13 b1 (finish) → **SP14** → SP13 b2 → SP11 + MOTN decision (data quality) → SP12 → **SP10 E2E gate** → launch flip. Tier 2/3 fold in opportunistically; Tier 4 is post-launch.
