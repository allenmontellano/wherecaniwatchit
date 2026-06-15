@AGENTS.md

# Working Agreements & Persistent Decisions

> Loaded every session. Last updated 2026-06-10 (Phase 3 done; SP4 complete, prod deploy pending).

## Auto mode (working agreement)
- **Claude Code may write, edit, run tests, and commit to FEATURE BRANCHES without asking** for per-action approval. Work to completion, then report.
- **Still pause for explicit go-ahead on:** merges to `staging` or `master`, database migrations, and any decision requiring product/architecture judgment.
- Spec and plan approval gates still apply (brainstorm → spec → plan → build) — auto mode covers the *build* loop, not the design gates.

## Current state (2026-06-10)
- **SP4 (load test) COMPLETE.** Load test passed after the region fix: **cached p95 32ms ✅, DB p95 231ms ✅**, TMDB cold-seed path advisory/accepted (~3.5s, inherent to the 3s seed timeout + external API; rare, self-healing). Root cause was cross-region (functions `iad1` / data Singapore); fixed by pinning Vercel functions to **`sin1`** (`vercel.json` `regions`). Phase 3 report committed as **GO** (`docs/superpowers/reports/2026-06-10-phase-3-report.md`).
- **Branch state: `staging` is 11 commits ahead of `master`.** All SP4 tooling + the `sin1` region pin + Phase 3 report live on `staging`, **not yet on `master`**. **PENDING: prod deploy — merge `staging` → `master`** (this is what ships the `sin1` fix to production, which still runs in `iad1` and is slow until then).
- **`RATE_LIMIT_SEARCH` was deleted from the Vercel Preview env** (it was raised to 100000 for the load test). **Staging needs a redeploy** to restore the default 30/min search rate limit.
- **Next up:** **SP6 (Auth & roles, invite-only)** and **SP8 (expanded reporting form)** in parallel, *after* the prod deploy. Both go through the full **spec → plan → build** process (SP4's spec/plan exemption was one-time).

## Process (non-negotiable)
- **TDD throughout**: write the failing test first → run it and watch it fail → minimal implementation → green → commit. One logical change per commit.
- **Load all superpowers skills** from `/mnt/skills/user/` and `/mnt/skills/public/` at the start of every session, and invoke the relevant skill before acting (brainstorming → writing-plans → subagent-driven-development, plus test-driven-development, systematic-debugging, etc.).
- **Approval gates before any side effect**: never apply a migration, deploy, or other outward-facing/irreversible action without explicit go-ahead. Flow is brainstorm → spec (approved) → plan (approved) → build → staging → prod.
- **Subagent-driven execution**: one fresh subagent per task, with two-stage review between tasks — spec-compliance review first, then code-quality review. Fix all review findings before moving to the next task.

## Branch & deploy workflow
- Branches flow `feat/xxx → staging → master`. **Never commit or deploy directly to master.**
- `master` = production (Vercel auto-deploys on push); the `staging` branch deploys to `staging.wherecaniwatchit.info`.
- **Migrations always staging-first**, verified, then a **separate explicit approval** before production. Never prod before staging.
- Account for Vercel propagation lag — verify against the actually-live deployment, not just a green build. Beware cache-masking: clear the relevant Redis key before a verification probe.

### Applying migrations safely (project refs + targeting)
- **Project refs:** staging = `hunvbflchgjphnhdjmws`, production = `ahgmszdrhndcycvairmn`.
- **DANGER — `supabase db push --db-url` can silently hit the WRONG project.** Supabase direct hosts (`db.<ref>.supabase.co`) no longer resolve — only the pooler does. When `--db-url` can't connect, the authenticated push falls back to the **CLI-linked project**, ignoring `--db-url`. On 2026-06-09 this applied the SP3 ranking migration to **prod instead of staging** because the CLI was linked to prod.
- **Preferred method — Management API with EXPLICIT ref** (no linking/DNS ambiguity): `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `{ "query": "<sql>" }` and `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`. Run the migration SQL, then record it: `insert into supabase_migrations.schema_migrations (version,name,statements) select '<version>','<name>',ARRAY[$mig$<sql>$mig$] where not exists (select 1 from supabase_migrations.schema_migrations where version='<version>')`.
- **Keep the CLI linked to STAGING** (`supabase link --project-ref hunvbflchgjphnhdjmws`) so any accidental `db push` targets staging, never prod.
- **Always verify the target after applying**: introspect the function/object on the intended ref (e.g. `select pg_get_functiondef('<fn>(...)'::regprocedure)`) AND confirm the OTHER ref is unchanged.

## Security
- **Never commit secrets, `.env` files, or credentials.** Secrets live only in gitignored `.env.local` / `.env.staging.local` and in Vercel env vars.
- **Rotate any DB token/password** shared into a session immediately after it has been used.

## Architecture decisions (this project)
- **Task N (PgBouncer / connection pooling) is DROPPED — not applicable.** The app uses Supabase via the PostgREST REST API (`@supabase/supabase-js`, `@supabase/ssr`), not a direct Postgres driver; Supabase pools PostgREST natively. Revisit only if a direct-pg path is ever added (e.g. a future ORM in the CMS).
- **Analytics: Vercel Analytics + Speed Insights adopted.** Cookieless, no PII. The Privacy Policy must disclose cookieless/aggregated/no-PII analytics — do not claim "zero tracking."
- **Redis keys are environment-namespaced** (`<env>:...`) on a shared Upstash instance, isolating staging from production cache + rate-limit buckets.
- **Search pipeline**: normalize → Postgres FTS (`websearch_to_tsquery`; weighted `tsvector` A/B/C/D = title/synopsis/genres/cast, **trigger-maintained**) → `pg_trgm` fuzzy (similarity ≥ 0.3, `%` operator for index use) → TMDB fallback + quota-gated on-demand seed. NOTE: a GENERATED tsvector column can't use `array_to_string` (non-immutable) — use a trigger instead.
- **Ranking tuning**: both an IMDb/popularity tie-break AND a supplementary-content soft penalty (down-rank "behind the scenes / making of / paleyfest / featurette / clip" etc., as a sort key above ts_rank) so canonical titles win ambiguous queries. Exact title match always ranks first.

## Pre-launch product decisions
- **Auth (SP6)**: invite-only for Contributors & Reviewers; Admin assigned manually; no self-registration.
- **Expanded flags (SP8)**: add structured columns `reported_platform` + `reported_watch_url` to the `flags` table (not freeform notes).
- **Contributor payments (SP7)**: ship the contribution counter + admin view first; the payment rate is deferred and set operationally later.
- **Staging is permanently `noindex`** (independent of the prod pre-launch `SITE_INDEXABLE` toggle). Launch = flip `SITE_INDEXABLE` → true (prod only).

## SP5 — MOTN Philippines data-gap finding (2026-06-08)
- MOTN has a **systematic Disney+ PH gap**: 0/8 Disney+ PH titles returned availability (Netflix/Apple TV = 5/5 correct). Viu PH, iWantTFC, Vivamax, and WeTV PH are **entirely absent** from MOTN's PH service registry (MOTN indexes only 9 PH services).
- **Action: seed PH availability aggressively before launch** — priority Disney+ PH → Viu PH → iWantTFC → Vivamax. Full report: `docs/superpowers/research/2026-06-08-motn-ph-data-gap.md`.
- HIMYM is **confirmed on Disney+ PH** (personally verified 2026-06-09); the MOTN Disney+ PH gap is real and systematic, not a per-title fluke.
- **SP7 rule**: in the verification queue, any availability row where `platform = Disney+ PH` **and** `source = motn` defaults to a **very low confidence score** (MOTN is known-unreliable for this platform/region).
