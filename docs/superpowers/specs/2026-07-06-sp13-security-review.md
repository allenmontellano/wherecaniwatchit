# SP13 — Security Review — Findings Spec

> Date: 2026-07-06. Reviewer: independent security pass (did not build the app). Status: **findings for triage — do NOT fix yet.** Allen will review this with Claude (chat) before deciding what gets fixed and in what order.
> Scope: **whole app**, not just SP7 — auth, RLS, the `/admin` surface, the service-role write pattern, credential handling, public API surface, DB functions. Read-only review; no code changed.

## 1. Method & threat model

- **Trust boundaries examined:** anonymous internet user → public API (`/api/search`, `/api/flags`, `/api/titles/[id]`) and public catalog reads (PostgREST + public anon key); invited low-privilege user (`contributor`) → `/admin` surface; `reviewer`/`admin` → privileged data + user management; Vercel cron → checker/sync routes.
- **Key architectural facts that shape the model:**
  - All privileged writes go through `createAdminClient()` (Supabase **service role**, which **bypasses RLS**) — `lib/supabase/admin.ts`. Authorization is enforced **only** at the application layer via `requireRole()` (`lib/auth/guards.ts`).
  - RLS on core tables (`supabase/migrations/20260602000002_rls_policies.sql`) allows **public SELECT** on `regions/platforms/titles/availability/profiles`; no anon write policies. The public **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is shipped to the browser, so anyone can issue those SELECTs directly against PostgREST.
  - Role is sourced from Supabase `app_metadata.role` (service-role-writable only), copied into `profiles.role` at accept-invite; an anti-escalation trigger blocks JWT-client role changes.
- **Confidence scale:** each finding carries a 1–10 confidence that it is a *real* issue (not that it is high-severity).

## 2. Executive summary

**No Critical or High findings.** The core security-sensitive logic is sound: the public search path is parameterized (no SQL injection), Server Actions inherit Next.js CSRF protection, the role source is server-controlled with an anti-escalation trigger, privilege-sensitive confirms are reviewer-gated, and user-supplied watch URLs are protocol-sanitized before they can become links. See §5 for the assurances that were checked and passed.

The findings are **defense-in-depth and information-disclosure** issues that matter before a public launch of an invite-only tool:

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| SEC-01 | **Medium** | data_exposure | `profiles` is world-readable via the public anon key → internal user roster + **admin identities** + roles are public — **✅ FIXED (migration, pending staging apply)** |
| SEC-02 | **Medium** | authz / defense-in-depth | Admin authz is app-layer-only over a service-role client that bypasses RLS; no DB backstop — one missing `requireRole` = full unauthenticated data access/mutation — **✅ FIXED (withRole wrapper + CI guard)** |
| SEC-03 | **Low** | xss (latent) | `availability.watch_url` from the MOTN sync is stored unsanitized and rendered as `<a href>`; only user-facing write paths sanitize — *(batch 2)* |
| SEC-04 | **Low** | mass_assignment | `saveTitleOverridesCore` applies a caller-controlled `changes` object to `UPDATE` with a **denylist**, not an allowlist (admin-only) — *(batch 2)* |
| SEC-05 | **Low** | secrets_hygiene | `CRON_SECRET` is reused as the pepper for `hashIp()` — one secret serving two unrelated purposes — *(batch 2)* |
| SEC-06 | **Low** | abuse_control | `clientIp()` trusts the client-controlled leftmost `X-Forwarded-For` for rate-limit + `ip_hash` identity — *(batch 2)* |
| SEC-07 | **Low** | logic / availability | `changeRoleCore` last-admin guard is read-then-write (TOCTOU); concurrent demotions could reach zero admins — *(batch 2)* |
| SEC-08 | **Info** | hygiene | Untracked session artifacts (`.playwright-mcp/` snapshots, loose PNGs) contain page state/anon key; keep them out of git — **✅ FIXED (.gitignore)** |
| SEC-09 | **Info** | robustness / availability | Supabase calls in `getTitleDetail` / `/api/flags` have no client timeout — under a total DB outage the request **hangs** instead of failing fast — **✅ FIXED (withTimeout)** |

---

## 3. Findings

### SEC-01 — `profiles` table is world-readable (admin roster disclosure) — MEDIUM

- **Category:** data_exposure · **Confidence:** 9/10
- **Location:** `supabase/migrations/20260602000002_rls_policies.sql:13` (`CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (TRUE)`); data now includes `role` (`supabase/migrations/20260616000001_profiles_role.sql`).
- **Description:** The `profiles` table has a public SELECT policy and the anon key is public. Anyone can call `GET https://<ref>.supabase.co/rest/v1/profiles?select=*` (anon key from the shipped JS bundle) and retrieve **every user's** `username`, `region_code`, `contribution_count`, `reputation_score`, `role`, and `joined_at`. SP6/SP7 turned `role` into a real privilege determinant, so this now leaks *who the admins are*.
- **Exploit scenario:** An attacker preparing to attack the invite-only CMS pulls the full profile list, filters `role=eq.admin`, and gets the exact usernames of privileged operators — a targeting list for phishing / credential attacks / social engineering, plus the full internal team roster and per-user activity. No authentication required.
- **Proposed fix & why:** Restrict `profiles` reads. Options, in order of preference: (a) drop the blanket public policy and replace with `USING (auth.uid() = user_id)` for self-reads plus a `reviewer/admin` read policy (via a JWT-claim/role check) for the CMS — the admin dashboard already uses the **service-role** client so it is unaffected by tightening anon RLS; (b) if any public profile display is ever needed, expose only non-sensitive columns through a dedicated view and keep `role` private. Why: the public app never needs to read arbitrary users' rows — only the (service-role) admin surface and the user's own `/account` do, so this access can be removed with no functional loss.
- **Related (fold-in):** `availability_public_read` (`:12`) now also exposes SP7's `reviewed_by` (a reviewer's user UUID) and `confidence` publicly. Low sensitivity (opaque UUID), but it leaks internal review metadata on a public catalog table; consider excluding those columns from the public read path (view) when addressing SEC-01.
- **✅ Resolved (2026-07-06, migration `20260706000002_sp13_rls_hardening.sql` — pending staging apply):** dropped `profiles_public_read`; added `profiles_self_read` (`auth.uid() = user_id`) + `profiles_staff_read` (reviewer/admin via `auth.jwt() -> 'app_metadata' ->> 'role'`). Revoked `SELECT` on `availability` from `anon`/`authenticated` and re-granted only the non-sensitive columns (excludes `reviewed_by`, `reviewed_at`, `confidence`). Verified every in-app read of these tables uses the service role except self-scoped profile reads (`guards.ts`, dashboard own-profile), so nothing breaks. Live staging verification (anon read denied, self-read + service-role OK) to run at the migration gate.

### SEC-02 — Admin authorization is app-layer-only with an RLS-bypassing client — MEDIUM

- **Category:** authorization / defense-in-depth · **Confidence:** 8/10 (as a design risk; not a concrete current exploit)
- **Location:** `lib/supabase/admin.ts` (service-role client, bypasses RLS); every `app/admin/**/actions.ts` and `app/admin/**/page.tsx` relies on `requireRole()` (`lib/auth/guards.ts:36`).
- **Description:** The entire privileged surface reads and writes with the service role, which ignores RLS. The **only** thing standing between an anonymous request and full data access/mutation is a correctly-placed `requireRole()` call at the top of each Server Action and each admin page. The current code does place it consistently (verified across queue/availability/titles/platforms/users actions and pages) — but there is **no second layer**: a single future action or route that fetches with `createAdminClient()` and forgets the guard is an immediate unauthenticated data breach or privileged write, with RLS providing no backstop.
- **Exploit scenario:** Not currently exploitable. The risk is regression: e.g. a new `/admin/export` action added later that calls `createAdminClient()` but omits `requireRole` would expose all data to any anonymous caller who knows the action endpoint — exactly the class of bug RLS exists to contain.
- **Proposed fix & why:** Add defense-in-depth so the guard isn't the sole control: (a) a thin wrapper (e.g. `withRole(role, handler)`) that every admin action must go through, plus a lint/test that fails CI if an `app/admin/**` server action references `createAdminClient` without the wrapper; and/or (b) author RLS policies for the CMS keyed on the authenticated user's role (JWT claim) and have the admin surface use the **user-scoped server client** for reads where possible, reserving the service role for the few operations that genuinely need it (auth admin API, cross-user writes). Why: authorization that lives in exactly one place, on a client that bypasses the database's own guardrails, is a fragile single point of failure for a tool about to go public.
- **Live-verified 2026-07-06 (SP13 check #3 + #2):** a complete enumeration of every `createAdminClient()` call site confirms **the current code has no missing or bypassable guard** — every privileged call site runs `requireRole` / `CRON_SECRET` / a valid-session check *before* the service-role client is used (see §7.3). This finding is therefore a **future-regression risk**, not a present hole; the recommended wrapper + CI check exist to keep it that way.
- **✅ Resolved (2026-07-06):** added `lib/auth/with-role.ts` (`withRole(role, handler)`) as the single enforced entry point; migrated all 5 admin action files (`queue/availability/titles/platforms/users`) to `export const x = withRole(...)` (no more inline `requireRole` in actions). Added `lib/auth/admin-surface-guard.test.ts` — a CI test that fails if any `app/admin/**` file reaches `createAdminClient` without a guard, or if an action file bypasses `withRole`. `next build` confirms the HOF exports still register as Server Actions. 353 tests green.

### SEC-03 — Unsanitized third-party `watch_url` rendered as a link (latent XSS) — LOW

- **Category:** xss (stored, latent) · **Confidence:** 8/10 that the sink is unsafe; low *attacker control* today
- **Location:** sink at `components/title/title-detail.tsx:224` (`<a href={a.watch_url} target="_blank" …>`); unsanitized writer in `lib/sync.ts` (the availability upsert sets `watch_url: option.link` straight from the MOTN API response).
- **Description:** `availability.watch_url` is rendered directly as an anchor `href` on the public title page. React does **not** sanitize URL schemes in `href`, so a `javascript:` (or `data:`) value would execute on click. Every *user-controlled* path to `watch_url` is protocol-validated — `sanitizeWatchUrl()` (http/https, origin+pathname) runs at flag submission (`app/api/flags/route.ts:49`) and again on the admin write/accept paths (`lib/admin/availability-service.ts` / `flags-service.ts`). The **MOTN sync path does not** validate the scheme before storing `option.link`.
- **Exploit scenario:** Requires the MOTN aggregator (or a MITM of that server-to-server call) to return a `javascript:`/`data:` link, which then gets stored and rendered; a visitor clicking "Watch on …" runs attacker script in the site origin. Attacker control is low (trusted third party), hence Low severity — but it is a real unsanitized-sink → dangerous-scheme gap and the aggregator is not under our control.
- **Proposed fix & why:** Normalize at the boundary and at the sink: run `sanitizeWatchUrl()` (already written) on `option.link` in `syncTitle` before storing, and additionally guard the render (drop the link / render as text if `watch_url` isn't `http(s)`). Why: the render sink should never assume upstream sanitization; validating on both the third-party write path and at render closes the gap regardless of data source.

### SEC-04 — Denylist mass-assignment in `saveTitleOverridesCore` — LOW

- **Category:** mass_assignment · **Confidence:** 8/10
- **Location:** `lib/admin/titles-service.ts` — `saveTitleOverridesCore` does `.update({ ...changes, metadata_overrides: overrides })` where `changes: Record<string, unknown>` comes from the `saveTitleOverrides` server action; protection is a `PROTECTED_KEYS` **denylist** (`id, tmdb_id, metadata_overrides, created_at, updated_at, seed_status`).
- **Description:** The action accepts an arbitrary key/value map from the client and applies it to the `titles` row. It is **admin-only** (guarded by `requireRole('admin')`), so this is not a privilege boundary crossing — but a denylist means any column *not* explicitly listed is writable (e.g. `type`, `search_vector`-adjacent fields, future columns), so an admin (or a bug in the client) can write unintended/constraint-violating values, and new sensitive columns are writable-by-default until someone remembers to add them to the denylist.
- **Exploit scenario:** Low. A crafted `saveTitleOverrides` call from an admin session sets a column the UI never intended to expose (e.g. corrupts `type`), or a future migration adds a sensitive `titles` column that is silently writable.
- **Proposed fix & why:** Replace the denylist with an **allowlist** of the 7 editable fields the editor actually exposes (`title, release_year, synopsis, poster_url, network, content_rating, genres`) and reject anything else. Why: allowlists fail closed — new columns are non-writable until explicitly permitted — which is the correct default for a mass-assignment surface.

### SEC-05 — `CRON_SECRET` reused as the IP-hash pepper — LOW

- **Category:** secrets_hygiene · **Confidence:** 8/10
- **Location:** `lib/ip.ts:14-18` — `hashIp()` computes `sha256(ip + process.env.CRON_SECRET)`.
- **Description:** `CRON_SECRET` is an authentication secret for the cron endpoints (`app/api/cron/**` compare `Authorization: Bearer ${CRON_SECRET}`). Reusing it as the pepper for IP hashing couples two unrelated security purposes to one value: rotating `CRON_SECRET` (e.g. after a suspected cron-secret leak) silently changes every `ip_hash`, breaking rate-limit/flag-dedup identity continuity; conversely, keeping it static to preserve hashing discourages rotating the cron secret. It also widens the blast radius if either use leaks.
- **Exploit scenario:** No direct external exploit; this is a hygiene/rotation hazard. If `CRON_SECRET` must be rotated for the cron surface, IP-hash continuity breaks as a side effect (and vice-versa), creating pressure not to rotate.
- **Proposed fix & why:** Introduce a dedicated `IP_HASH_SALT` env var for `hashIp()` and let `CRON_SECRET` serve only cron auth. Why: one secret, one purpose — so each can be rotated independently and a leak of one doesn't implicate the other.

### SEC-06 — Client-spoofable `X-Forwarded-For` used for rate-limit + IP identity — LOW

- **Category:** abuse_control · **Confidence:** 8/10 (mechanism); impact is abuse-control, not data breach
- **Location:** `lib/ip.ts:5-11` — `clientIp()` returns the **leftmost** value of `X-Forwarded-For` (then `X-Real-IP`), used for `enforceRateLimit` keys and `hashIp()` on the anonymous `/api/flags` endpoint.
- **Description:** The leftmost `X-Forwarded-For` entry is client-controlled — a caller can send `X-Forwarded-For: <random>` to rotate their rate-limit identity and `ip_hash` on every request. This weakens the rate limiting and flag-abuse attribution on the unauthenticated flag-submission endpoint. (Rate-limiting/DoS proper is out of the strict review scope, but it's noted here because it also undermines the *attribution* value of `ip_hash`.)
- **Exploit scenario:** An attacker spamming the anonymous flag endpoint sets a fresh `X-Forwarded-For` per request to sidestep the per-IP rate limit and avoid `ip_hash`-based grouping, polluting the SP7 review queue at scale.
- **Proposed fix & why:** On Vercel, derive the client IP from the platform-trusted signal rather than the raw leftmost header — use the right-most untrusted-boundary hop (Vercel appends the real client IP), or a Vercel-provided trusted header, and treat inbound `X-Forwarded-For` as untrusted. Why: rate-limit and abuse-attribution keys must be derived from a value the client cannot freely set.

### SEC-07 — TOCTOU in last-admin demotion guard — LOW

- **Category:** logic / availability · **Confidence:** 7/10
- **Location:** `lib/admin/users-service.ts` — `changeRoleCore` reads `count(*) where role='admin'` and, if `> 1`, proceeds to demote.
- **Description:** The "cannot demote the last admin" check is a read-then-write with no transaction/lock. With exactly two admins, two concurrent demotions (one per admin) can both observe `count = 2`, both pass, and both apply — leaving **zero** admins and locking the org out of the CMS. This is an availability/lockout risk, not a breach.
- **Exploit scenario:** Two admins (or one admin in two tabs) demote the two remaining admin accounts simultaneously; both requests pass the guard and the system ends with no admin, requiring a manual service-role/dashboard fix to recover.
- **Proposed fix & why:** Enforce the invariant in the database — e.g. perform the demotion inside a transaction that `SELECT … FOR UPDATE`s the admin set, or add a deferred constraint/trigger guaranteeing `count(admin) >= 1`. Why: a cross-row invariant can't be safely enforced by an app-layer read-then-write; the DB is the only place that can serialize it.

### SEC-08 — Untracked session artifacts contain page state / anon key — INFO

- **Category:** hygiene · **Confidence:** 7/10
- **Location:** working tree: `.playwright-mcp/` (`page-*.yml` snapshots), loose `*.png`, `wherecaniwatchit.info — Project Han.md` (all currently untracked per `git status`).
- **Description:** Playwright snapshots captured during verification embed page URLs (including the public anon key) and rendered admin page state. They are not a secret leak today (anon key is public; files are untracked), but they are the kind of artifact that gets `git add .`-ed by accident and can include session-scoped content.
- **Proposed fix & why:** Add `.playwright-mcp/`, `*-375.png`, and stray scratch docs to `.gitignore`. Why: prevents accidental commit of session artifacts and keeps future snapshots (which could capture more sensitive state) out of history.
- **✅ Resolved (2026-07-06):** `.gitignore` now excludes `.playwright-mcp/`, `*-375.png`, `staging-*/before-*/after-*/qa-*.png`, and the stray `Project Han.md` scratch doc.

### SEC-09 — Unbounded Supabase calls hang under total DB outage — INFO (robustness)

- **Category:** robustness / availability (not information disclosure) · **Confidence:** 9/10 (observed live)
- **Location:** `lib/title-detail.ts` (`getTitleDetail`, backing `GET /api/titles/[id]`) and `app/api/flags/route.ts:63` (the `flags` insert). Neither wraps the Supabase call in a timeout.
- **Description:** During SP13 error-disclosure testing (§7.1), with the app pointed at an unreachable Supabase host, `GET /api/titles/[id]` and `POST /api/flags` **hung** past a 12s client timeout instead of returning a fast generic error, while `/api/search` (which has its own `SYNC_TIMEOUT_MS` guard and try/catch) failed fast and cleanly. This is an availability/robustness gap, **not** an error-disclosure issue (nothing leaked). It is noted for completeness because it was newly observed; it is *out of the security-finding bar* (DoS-adjacent), so it is filed Info.
- **Exploit scenario:** None security-relevant. Operationally, a Supabase outage would pile up long-hanging requests on those two routes rather than shedding them quickly.
- **Proposed fix & why:** Wrap those Supabase calls with an `AbortSignal.timeout(...)` (the checker service already uses this pattern) so they fail fast to the existing generic error responses. Why: fast-fail degradation is both a better UX and reduces resource pile-up during an outage.
- **✅ Resolved (2026-07-06):** added `lib/with-timeout.ts` (`withTimeout` + `DB_TIMEOUT_MS=8s`, TDD). Wrapped the `getTitleDetail` DB queries and the `/api/flags` insert (8s → generic error), and the Redis ops in `lib/cache.ts` (3s, fail-open → cache miss). Tests assert a hanging DB/Redis now fails fast instead of hanging.

---

## 4. Explicitly out of scope / not findings

- **No SQL injection** in the public search path — `search_titles_fts` / `search_titles_fuzzy` (`supabase/migrations/20260609000001_*`, `20260608000002_*`) are `language sql` with **bound parameters** (`websearch_to_tsquery('english', q)`, `similarity(title, q)`); the query string is never concatenated into SQL. Admin `ilike('title', \`%${q}%\`)` searches go through postgrest-js, which URL-encodes params — the caller cannot inject additional filters.
- **Open redirect** in `app/auth/confirm/route.ts` — the `next` guard rejects `//` and `/\` and requires a leading `/`; per review precedent, low-confidence open-redirects are not reported.
- **Cron secret timing comparison** (`!==` on `CRON_SECRET`) — network-jitter dominated; not a practical timing oracle.
- **DoS / rate-limit exhaustion** — excluded by review scope (SEC-06 is included only for its attribution-integrity angle).

## 5. Assurances (checked and found sound)

- **Role source is server-controlled:** role is read from `app_metadata` (service-role-writable only), not `user_metadata`; `acceptInvite` uses `resolveInviteRole(user.app_metadata)` (`app/accept-invite/actions.ts:25`, `lib/auth/accept-invite.ts:44`). The `profiles` anti-escalation trigger blocks JWT-client role changes. **No self-serve privilege escalation path found.**
- **Auth uses `getUser()`** (revalidates the JWT with Supabase) rather than `getSession()` in guards and actions (`lib/auth/guards.ts:14`).
- **Trust ladder enforced server-side:** `confirmAvailability` requires `['reviewer','admin']`; contributors cannot self-approve their own medium-confidence writes (`app/admin/availability/actions.ts`).
- **User-supplied watch URLs are sanitized** to http(s) origin+pathname before storage on both the public API and admin write/accept paths (`lib/flags.ts` `sanitizeWatchUrl`).
- **Server Actions get Next.js CSRF protection** (POST + Origin checks + action IDs) — no custom CSRF gap introduced.
- **Service-role key is server-only** (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix; `createAdminClient` is only imported server-side); **no hardcoded secrets** in tracked source (grep for `sbp_`/JWT/service-role literals returned only the word `service_role` in `GRANT` statements and untracked scratch files).
- **Cron endpoints require the bearer secret** (`app/api/cron/**`).

## 6. Suggested remediation order (for Allen + Claude to decide)

1. **SEC-01** (lock down `profiles` reads) — highest value/lowest effort; removes a real pre-launch information disclosure with no functional loss.
2. **SEC-02** (defense-in-depth wrapper + CI guard for the admin surface) — protects the whole privileged surface against future regressions.
3. **SEC-03** (sanitize `watch_url` on the MOTN path + at render) — small, closes a latent XSS sink.
4. **SEC-05 / SEC-06** (dedicated IP salt; trusted client-IP source) — hygiene + abuse-control hardening.
5. **SEC-04 / SEC-07** (allowlist for title overrides; DB-enforced last-admin invariant) — correctness hardening, admin-only impact.
6. **SEC-08** (gitignore scratch artifacts) — trivial hygiene.

---

## 7. Live verification (SP13 checks #1–#4, run 2026-07-06)

These four checks were **executed live**, not inferred from code. Read-only; no code changed.

### 7.1 Error disclosure under DB failure — **PASS**
- **Method:** (a) a **real** production error — `POST /api/flags` on `www.wherecaniwatchit.info` with a well-formed body but a non-existent `title_id` (FK violation → server-side DB error); (b) a **simulated total outage** — a local `next build` + `next start` in production mode with Supabase/Redis pointed at unreachable hosts (via a gitignored `.env.production.local` override; real `.env.local` untouched), then hitting the public search API, the search page (Server Component), the title API, the `/admin` page (Server Component error path), `POST /api/flags`, and `/api/debug/sentry`.
- **Result:** No leakage anywhere. Prod FK error → `{"error":"Failed to submit flag"}` (500) with clean headers — no Postgres text, stack, connection string, host, or file paths. Under simulated outage: `/api/search` → `{"…","source":"error","notice":"We're having trouble finding that title right now."}` (200); `/search` page → clean HTML, leak-scan (stack/paths/`postgres`/`PGRST`/`supabase.co`/host/`ECONNREFUSED`) empty; `/admin` → clean `307 → /login` (getUser returns null on network failure, so the guard redirects rather than throwing); `POST /api/flags` → generic; `/api/debug/sentry` (and `?mode=throw`) → `404` without the `CRON_SECRET` (existence hidden, unhandled-throw path unreachable publicly). Next.js production mode renders no dev overlay / stack.
- **New note:** two routes **hang** rather than fail-fast under total outage → **SEC-09** (Info/robustness).

### 7.2 Auth enforcement (direct, unauthenticated requests) — **PASS**
- **Method:** direct `curl` (no session cookie) against prod.
- **Cron (6 routes):** `GET /api/cron/{checkers/ph,us,gb,au,ca, sync-availability}` → **401** with **no** bearer and with a **wrong** bearer (all 12 cases).
- **Admin (7 routes):** `GET /admin{,/queue,/availability,/pending,/titles,/platforms,/users}` (no cookie) → **307 → /login** (all).
- **Server Actions:** an unauthenticated `POST` with a fabricated `Next-Action` header to `/admin/users` and `/admin/titles` → **404** (Next rejects unknown action IDs outright — no execution). Since every admin page and every admin action share the identical `requireRole()` guard, and the page GETs are proven to redirect live, the actions enforce the same boundary (call-order confirmed in §7.3). *Method limit: invoking a real action by its build-specific ID was not performed; enforcement is evidenced by the shared guard + unknown-action rejection.*
- **Public-by-design APIs:** `/api/search` 200, `/api/titles/<bad>` 404, `POST /api/flags {}` 400 — behave as intended public endpoints; none expose privileged operations.

### 7.3 Complete `createAdminClient()` / service-role enumeration — **PASS**
Every non-test call site, and the auth check that runs **before** the service-role client is used:

| Call site | Reached via | Auth check before service-role client |
|---|---|---|
| `app/admin/{page,queue,pending,titles,titles/[id],availability,availability/[titleId],platforms,users}/…page.tsx` | HTTP GET (dynamic) | `requireRole(...)` at top of each page; `app/admin/page.tsx` gates its `createAdminClient` inside `if (user.role === 'admin')` ✅ |
| `app/admin/queue/actions.ts` (accept/reject) | Server Action | `requireRole(['contributor','reviewer','admin'])` before `createAdminClient()` ✅ |
| `app/admin/availability/actions.ts` (write / confirm) | Server Action | `requireRole([all3])` / `requireRole(['reviewer','admin'])` before `deps()`→`createAdminClient()` ✅ |
| `app/admin/titles/actions.ts` (save/reset/addLocal/addByTmdb/resync) | Server Action | `requireRole('admin')` first in every export ✅ |
| `app/admin/platforms/actions.ts` (create/update) | Server Action | `requireRole('admin')` before `createAdminClient()` ✅ |
| `app/admin/users/actions.ts` (changeRole/invite) | Server Action | `requireRole('admin')` before `createAdminClient()` ✅ |
| `app/accept-invite/actions.ts` | Server Action | `getUser()` valid-session check + role sourced from `app_metadata` before the profile insert ✅ |
| `app/api/cron/sync-availability/route.ts`; `lib/checkers/service.ts` (via `app/api/cron/checkers/[region]`) | Cron GET | `Authorization: Bearer CRON_SECRET` compared and 401-returned **before** `createAdminClient()` ✅ |
| `app/api/flags/route.ts` | Public POST | **No auth (intentionally public)** — service role used only to `INSERT` a `flags` row with server-set fields (`status`, `ip_hash`); scoped, rate-limited, cannot read/exfiltrate ⚠️ by-design |
| `lib/search-db.ts`, `lib/title-detail.ts`, `lib/platforms-data.ts`, `lib/sync.ts`, `lib/quota.ts` | Public search / title / seed paths | **No auth (intentionally public)** — service role used for scoped public catalog reads + quota-gated TMDB/MOTN seeding; no arbitrary data access or privileged ops ⚠️ by-design |
| `scripts/*.ts` (`invite`, `seed-common`, `verify-keys`, `load-test`) | CLI only (not HTTP-reachable) | N/A — operator-run with local env |

**No call site was found where the service-role client is reachable *before an intended auth check*, or where the guard is optional/bypassable.** The intentionally-public endpoints (`⚠️ by-design`) use the RLS-bypassing client for narrowly-scoped public operations — which is exactly why **SEC-02** recommends a defense-in-depth backstop so this stays true as the surface grows.

### 7.4 Full git-history secret scan — **PASS**
- **Method:** `.gitignore` inspection + `git check-ignore` + `git ls-files` + `git log --all -p` pattern scan (gitleaks/trufflehog not installed, so manual high-signal grep across all commits/branches).
- **Result:** `.env*` is gitignored (`!.env*.example` exception); `.env`/`.env.local`/`.env.staging.local`/`.env.production.local` all confirmed ignored; the only tracked env file is `.env.local.example` (empty placeholders). **No** JWT (`eyJ…`), Supabase access token (`sbp_…`), or assigned secret value (`SERVICE_ROLE_KEY=/MOTN_API_KEY=/…`) appears **anywhere** in history — including added-then-deleted/reverted commits (0 matches). No history rewrite is needed.

*No code has been changed. This document is for triage; fixes are a separate, explicitly-approved step.*
