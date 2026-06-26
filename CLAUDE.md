@AGENTS.md

# Working Agreements & Persistent Decisions

> Loaded every session. Last updated 2026-06-16 (SP4 + SP6 shipped to prod; SP8 next).

## Auto mode (working agreement)
- **Claude Code may write, edit, run tests, and commit to FEATURE BRANCHES without asking** for per-action approval. Work to completion, then report.
- **Still pause for explicit go-ahead on:** merges to `staging` or `master`, database migrations, and any decision requiring product/architecture judgment.
- Spec and plan approval gates still apply (brainstorm → spec → plan → build) — auto mode covers the *build* loop, not the design gates.

## Current state (2026-06-15)
- **SP4 SHIPPED TO PROD.** Merged `staging` → `master` (`09eaef3`); production now runs functions in **`sin1`** co-located with Supabase + Upstash (verified `X-Vercel-Id: sin1::sin1`, search returns results, homepage 200, 227 tests green). The `sin1` fix, SP4 load-test tooling, and Phase 3 GO report are all live in prod. Load test (on staging): **cached p95 32ms ✅, DB p95 231ms ✅**, TMDB cold-seed advisory/accepted (~3.5s).
- **Staging redeployed; rate limit restored.** `RATE_LIMIT_SEARCH` deletion is now live — staging search verified back at the default **30/min** (burst test: exactly 30×200 then 429).
- **SP6 (Auth & roles, invite-only) — ✅ SHIPPED TO PROD (2026-06-16).** Spec `docs/superpowers/specs/2026-06-16-sp6-auth-roles-design.md`, plan `docs/superpowers/plans/2026-06-16-sp6-auth-roles.md`. 9 tasks + invite-confirm fix built TDD via subagents with spec+quality review; **266 tests green**, tsc + eslint clean. Live-verified on staging AND prod (login/account/logout/route-guard/escalation-block/invite-accept). See PROD ROLLOUT bullet below.
  - **Decisions:** email+password with invite onboarding (`inviteUserByEmail`); invites via dashboard + `scripts/invite.ts` (no in-app admin UI → SP7); **Approach A** `profiles.role` enum (`contributor`|`reviewer`|`admin`) + app-layer `requireUser()`/`requireRole()`; password-reset deferred; profile row created in `/accept-invite` server action via admin client.
  - **Built:** `lib/auth/roles.ts`, `lib/auth/guards.ts`, `lib/auth/accept-invite.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy-session.ts` + root **`proxy.ts`** (Next 16 renamed `middleware`→`proxy`), `app/login`, `app/accept-invite` (+action), `app/account` (+logout), `scripts/invite.ts`, migration `supabase/migrations/20260616000001_profiles_role.sql` (role enum + anti-escalation trigger; **idempotent + JWT-claim-safe** after review).
  - **STAGING GATE (2026-06-16): FULLY VERIFIED incl. invite-accept fix; PROD GATED.** `feat/sp6-auth` merged → `staging` (`af9c485`); invite fix merged (`82b1961`); deploy live at staging.wherecaniwatchit.info. Migration applied+verified on staging; **prod `ahgmszdrhndcycvairmn` untouched**. Token rotated by user. **Live staging verification results:**
    - ✅ **WORKS:** `/login` renders; **login → `/account` → logout** full UI flow (Playwright, real browser) — `/account` shows username/email/role; logout clears session (`/account`→307→`/login`); unauth `/account`→`/login`; static `_next` assets + favicon load (proxy matcher OK); **escalation block CONFIRMED** — authenticated user PATCH `profiles.role=admin` via PostgREST → **400 "role cannot be changed by a client"**, role unchanged (trigger fires on live staging).
    - ✅ **FIXED — invite onboarding now works (verified end-to-end on staging).** Root cause was the implicit/hash flow (tokens in URL hash, invisible to SSR). **Fix = Approach A:** added `app/auth/confirm/route.ts` (GET handler: `verifyOtp({type,token_hash})` sets the session cookie via the server client, then `redirect(next)` with an open-redirect guard rejecting `//` and `/\\`). Built TDD (7 tests), reviewed (open-redirect backslash bypass caught + fixed). Merged `fix/sp6-invite-confirm` → `staging` (`82b1961`). **Verified live (Playwright):** generated a real invite `token_hash` → `/auth/confirm` exchanged it → `/accept-invite` (session live) → set username/password/region → `/account` shows role **reviewer** (from `app_metadata` → `profiles.role`). 266 tests green.
    - ⚠️ **REQUIRED CONFIG before REAL email invites work (Supabase dashboard, user action):** the "Invite user" email template must point its link at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite` (default template uses `{{ .ConfirmationURL }}` = the broken hash flow). Verified via `generateLink` (bypasses the template), so the *code* is proven; the template edit is needed on **staging** (optional re-test with a real email) and **prod** (required before prod invites). `scripts/invite.ts` needs no change.
    - **PROD ROLLOUT (2026-06-16): ✅ SP6 SHIPPED TO PRODUCTION.** (1) ✅ prod "Invite user" email template → `token_hash` pattern (user); (2) ✅ migration applied + verified on prod (`ahgmszdrhndcycvairmn`) — `profiles.role`, enum, trigger, recorded; (3) ✅ `NEXT_PUBLIC_SITE_URL=https://wherecaniwatchit.info` on prod Vercel; (4) ✅ merged `staging` → `master` (`e8f0cf3`, pushed), prod deploy live; (5) ✅ **prod spot-check PASSED** (Playwright, real browser on www.wherecaniwatchit.info): `/login` renders, login → `/account` shows role **reviewer**, logout → `/login`, unauth `/account` → `/login` route guard. `/auth/confirm` live (307→/login w/o token). Only console noise = Cloudflare Insights beacon DNS fail (unrelated). Access token `sbp_5ede…` rotated by user. **SP6 COMPLETE.**
  - **Deferred follow-ups (non-blocking, logged):** (1) guards log auth-service errors (currently fails closed silently); (2) proxy-session unit test for `setAll` cookie propagation; (3) invite CLI partial-failure message should include user id. *(Region-validation + form autocomplete/aria-label already fixed pre-gate in `926f4df`.)*
- **SP8 (expanded reporting form) — BUILD COMPLETE on `feat/sp8-reporting`, AT STAGING GATE (2026-06-26).** Spec `docs/superpowers/specs/2026-06-26-sp8-expanded-reporting-design.md`, plan `docs/superpowers/plans/2026-06-26-sp8-expanded-reporting.md`. 6 tasks built TDD via subagents (spec+quality review each); final branch review = **READY FOR STAGING**. `tsc` clean, **280 tests green**, eslint clean.
  - **Built:** migration `20260626000001_flags_reported_columns.sql` (adds `reported_platform` + `reported_watch_url`, additive); `lib/flags.ts` `sanitizeWatchUrl` (origin+pathname, http(s)-only) + `sanitizePlatform` (known slug or ≤100-char charset-safe name; hyphen-literal verified) and **`composeNotes` removed**; `lib/platforms-data.ts` (region→platforms map + region slug-set); `/api/flags` stores structured fields + server-side required-platform; report modal platform **dropdown + "Other" + watch-URL**; wired `platformsByRegion` from BOTH title page and search results (2nd ReportModal caller the plan missed).
  - **GATED — needs go-ahead:** (1) apply migration to **staging** (`hunvbflchgjphnhdjmws`) + verify, prod untouched; (2) merge `feat/sp8-reporting` → `staging`; (3) manual browser verify (dropdown, Other=`iWant-TFC`, tracking-param URL stripped, required-platform block, invalid URL rejected); then separate prod approval.
  - **UX finding to decide at gate (final review):** report modal submit is **fire-and-forget** — always shows "Report submitted" even on an API 400 (invalid watch URL / platform). SP8's new validation makes this user-reachable. Small fix = surface the API error instead of false success. Pre-existing pattern, but newly relevant.
  - **Deferred follow-ups (non-blocking):** silent error swallowing in `platforms-data` fetch wrappers; `platformOther` not reset on switch-away; a few boundary tests; SP7 reviewer note on the slug-or-text `reported_platform` dual interpretation.

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
