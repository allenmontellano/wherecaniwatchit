@AGENTS.md

# Working Agreements & Persistent Decisions

> Loaded every session. Last updated 2026-06-15 (SP4 shipped to prod; SP6 brainstorming in progress).

## Auto mode (working agreement)
- **Claude Code may write, edit, run tests, and commit to FEATURE BRANCHES without asking** for per-action approval. Work to completion, then report.
- **Still pause for explicit go-ahead on:** merges to `staging` or `master`, database migrations, and any decision requiring product/architecture judgment.
- Spec and plan approval gates still apply (brainstorm → spec → plan → build) — auto mode covers the *build* loop, not the design gates.

## Current state (2026-06-15)
- **SP4 SHIPPED TO PROD.** Merged `staging` → `master` (`09eaef3`); production now runs functions in **`sin1`** co-located with Supabase + Upstash (verified `X-Vercel-Id: sin1::sin1`, search returns results, homepage 200, 227 tests green). The `sin1` fix, SP4 load-test tooling, and Phase 3 GO report are all live in prod. Load test (on staging): **cached p95 32ms ✅, DB p95 231ms ✅**, TMDB cold-seed advisory/accepted (~3.5s).
- **Staging redeployed; rate limit restored.** `RATE_LIMIT_SEARCH` deletion is now live — staging search verified back at the default **30/min** (burst test: exactly 30×200 then 429).
- **SP6 (Auth & roles, invite-only) — BUILD COMPLETE on `feat/sp6-auth`, PAUSED AT STAGING GATE (2026-06-16).** Spec `docs/superpowers/specs/2026-06-16-sp6-auth-roles-design.md`, plan `docs/superpowers/plans/2026-06-16-sp6-auth-roles.md`. All 9 impl tasks built TDD via subagents with spec+quality review each; final branch review = **READY FOR STAGING**. `npx tsc --noEmit` clean, **259 tests green**, eslint clean.
  - **Decisions:** email+password with invite onboarding (`inviteUserByEmail`); invites via dashboard + `scripts/invite.ts` (no in-app admin UI → SP7); **Approach A** `profiles.role` enum (`contributor`|`reviewer`|`admin`) + app-layer `requireUser()`/`requireRole()`; password-reset deferred; profile row created in `/accept-invite` server action via admin client.
  - **Built:** `lib/auth/roles.ts`, `lib/auth/guards.ts`, `lib/auth/accept-invite.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy-session.ts` + root **`proxy.ts`** (Next 16 renamed `middleware`→`proxy`), `app/login`, `app/accept-invite` (+action), `app/account` (+logout), `scripts/invite.ts`, migration `supabase/migrations/20260616000001_profiles_role.sql` (role enum + anti-escalation trigger; **idempotent + JWT-claim-safe** after review).
  - **STAGING GATE PROGRESS (2026-06-16):** ✅ (1) **Migration APPLIED + verified on staging** (`hunvbflchgjphnhdjmws`) via Management API — `profiles.role` (`user_role`, default `contributor`, NOT NULL), enum `contributor|reviewer|admin`, trigger `profiles_prevent_role_escalation` all present; **prod `ahgmszdrhndcycvairmn` confirmed untouched** (no `role` col, no `user_role` type). Recorded in `schema_migrations`. ✅ (2) Supabase staging Auth config done (redirect allowlist + Site URL). ✅ (3) `NEXT_PUBLIC_SITE_URL` set in staging Vercel (Preview scope). **⏳ STILL GATED — needs go-ahead:** (4) **merge `feat/sp6-auth` → `staging`** (push triggers deploy), then run the **manual checklist** (invite via `scripts/invite.ts` → accept → login → `/account` → logout; static assets load; escalation blocked) — this is blocked until the merge since the SP6 code isn't on staging yet. **Prod = separate approval after staging verified.** 🔑 Supabase access token `sbp_fb87…` shared in-session 2026-06-16 — **must be rotated** by the user.
  - **Deferred follow-ups (non-blocking, logged):** (1) guards log auth-service errors (currently fails closed silently); (2) proxy-session unit test for `setAll` cookie propagation; (3) invite CLI partial-failure message should include user id. *(Region-validation + form autocomplete/aria-label already fixed pre-gate in `926f4df`.)*
- **SP8 (expanded reporting form)** queued — full spec→plan→build; **no auth dependency**, can build in a parallel worktree. Scope: replace free-text `platform`/`notes` with structured `reported_platform` + `reported_watch_url` columns on `flags`.

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
