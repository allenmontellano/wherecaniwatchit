# SP6 — Auth & Roles (invite-only) — Design Spec

> Date: 2026-06-16. Status: approved design, pre-plan. Sub-project SP6 of the pre-launch roadmap.
> Downstream consumer: SP7 (Internal CMS & Data Accuracy Layer). SP6 ships auth *infrastructure only*.

## 1. Goal

Stand up invite-only authentication and a three-role authorization model so that, in SP7, a small set of trusted Contributors and Reviewers (plus manually-assigned Admins) can sign in and operate the CMS. SP6 delivers the auth plumbing, roles, login/accept-invite/logout surfaces, server-side route guards, and an invite CLI — but **no** CMS feature pages and **no** in-app admin UI.

## 2. Background & current state

- **`profiles` table already exists** (`supabase/migrations/20260602000001_initial_schema.sql`): `user_id uuid PK → auth.users(id)`, `username text UNIQUE NOT NULL`, `region_code char(2)`, `contribution_count`, `reputation_score`, `joined_at`. **No `role` column yet.**
- **RLS is enabled** on `profiles` (`20260602000002_rls_policies.sql`): public `SELECT`; `profiles_insert_own` and `profiles_update_own` allow a user to insert/update their *own* row (`auth.uid() = user_id`). All app writes today go through **service-role API routes that bypass RLS**.
- **Supabase Auth is not wired.** `@supabase/ssr@^0.10.3` and `@supabase/supabase-js@^2.106.2` are installed. `lib/supabase/` contains only `server.ts` and `admin.ts` — there is **no browser client, no session-refresh middleware, and no auth UI**.
- Stack: Next.js 16.2.7 (App Router, Server Components), React 19, TypeScript strict, Vitest (node env, no jsdom/RTL).

## 3. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Authentication method | Email + password, **invite-based onboarding** (`inviteUserByEmail`). No self-registration. |
| Invite issuance | Supabase dashboard + a `scripts/invite.ts` CLI. **No in-app admin invite UI in SP6** (→ SP7). |
| Role model | **Approach A** — `role` enum on `profiles` + app-layer `requireUser()`/`requireRole()` guards. RLS `SECURITY DEFINER` read-helpers deferred to SP7. |
| Self-serve password reset | **Deferred** — Admin re-invites / resets via the Supabase dashboard. |
| Profile creation on accept | **`/accept-invite` server action** creates the `profiles` row via the admin client (username/region entered there, role from `app_metadata`). |

## 4. Architecture

Supabase Auth is the identity provider. `@supabase/ssr` supplies three things:

1. A **browser client** (`createBrowserClient`) for client-component sign-in / sign-out.
2. A **cookie-aware server client** (`createServerClient`) for Server Components, server actions, and route handlers.
3. A root **`middleware.ts`** that calls `updateSession` on every matched request to refresh the auth cookie (required by `@supabase/ssr` so Server Components see a fresh session).

Roles live as a Postgres enum column on `profiles` (source of truth) and are enforced in the **application layer** via server-side guards, matching the codebase's existing pattern (writes go through service-role API routes; authorization stays in one place). The intended role is set at invite time in the auth user's `app_metadata` (admin-controlled, not user-editable) and copied to `profiles.role` when the invite is accepted.

## 5. Data model & migration (staging-first)

New migration `supabase/migrations/<timestamp>_profiles_role.sql`:

```sql
create type user_role as enum ('contributor', 'reviewer', 'admin');

alter table profiles
  add column role user_role not null default 'contributor';

-- Anti-escalation: block a role change made by a PostgREST *client* (a user's
-- own JWT). Closes the hole where profiles_update_own RLS would let a user PATCH
-- their own row via PostgREST and set role = 'admin'. The service-role key
-- (admin client) and trusted direct-DB connections (psql / dashboard / Management
-- API, which run as postgres, not a JWT client role) remain allowed.
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
begin
  if new.role is distinct from old.role
     and jwt_role in ('anon', 'authenticated') then
    raise exception 'role cannot be changed by a client; use the service role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();
```

Notes:
- `default 'contributor'` keeps the column safe for any pre-existing rows (prod `profiles` is expected empty pre-launch).
- The trigger reads the JWT role from `request.jwt.claims` (set by PostgREST for client requests; absent → `null` for trusted direct-DB connections). It fires only on `UPDATE`, so the accept-invite **INSERT** that sets the initial role is unaffected. (`auth.role()` is the Supabase shorthand for the same claim; the explicit `current_setting` form avoids any deprecation ambiguity — the implementation plan will confirm against the installed Supabase version.)
- The migration is applied to **staging first**, verified, then a **separate explicit approval** before production (per the migration-safety workflow; Management API with the explicit project ref).

## 6. Components & files

| File | Responsibility |
|---|---|
| `lib/supabase/client.ts` (new) | Browser client via `createBrowserClient`. |
| `lib/supabase/server.ts` (update) | Confirm/upgrade to the `@supabase/ssr` `createServerClient` cookie pattern used by Server Components & route handlers. |
| `lib/supabase/middleware.ts` (new) | `updateSession(request)` helper that refreshes the session cookie. |
| `middleware.ts` (new, repo root) | Next middleware delegating to `updateSession`, with a matcher excluding static assets / images / favicon. |
| `lib/auth/guards.ts` (new) | `getSessionUser()` → `{ user, profile }` or null; `requireUser()` → redirects to `/login` if unauthenticated; `requireRole(role \| role[])` → 403/redirect if role not permitted. |
| `app/login/page.tsx` (+ client form) | Email+password sign-in via the browser client; redirect to `/account` on success; inline error on failure. |
| `app/accept-invite/page.tsx` (+ client form) | Consumes the invite-link session; user sets password + username (+ optional region); server action sets the password and creates the `profiles` row. |
| `app/account/page.tsx` (new) | Minimal authed landing: shows email + role + a logout control. Proves the loop end-to-end. |
| Logout (server action, colocated) | `signOut()` then redirect to `/login`. |
| `scripts/invite.ts` (new) | CLI: `tsx --env-file=.env.<env>.local scripts/invite.ts <email> <role>` → admin `inviteUserByEmail`, then `admin.updateUserById(id, { app_metadata: { role } })` to record the role in **`app_metadata`** (admin-only, not user-editable). Also the first-admin bootstrap path. |
| `lib/supabase/admin.ts` (exists) | Reused for admin-client operations (invite, profile insert). |

## 7. Data flow

**Invite onboarding**
1. Admin runs `scripts/invite.ts <email> <role>`. The script validates the role, calls `inviteUserByEmail(email, { redirectTo: <app>/accept-invite })`, then calls `admin.updateUserById(id, { app_metadata: { role } })` so the role lives in **`app_metadata`** (admin-controlled, not user-editable — unlike `user_metadata`, which a user can change via `updateUser`).
2. Supabase emails an invite link pointing at `/accept-invite`.
3. User clicks the link → `/accept-invite`; the link establishes a Supabase session for that user.
4. User enters a password + username (+ optional region) and submits.
5. The accept-invite **server action**: calls `updateUser({ password })`, reads the role from the invited user's `app_metadata`, and inserts the `profiles` row (`user_id`, `username`, `region_code`, `role`) via the **admin client**.
6. Redirect to `/account`; the user is signed in.

**Login**
1. `/login` → email+password → `signInWithPassword` → redirect to `/account`. Invalid credentials render an inline error.

**Protected request**
1. `middleware.ts` refreshes the session cookie.
2. A Server Component / route handler calls `requireUser()` or `requireRole('admin')`.
3. The guard loads the session and the caller's `profiles.role`, then allows the request or redirects (`/login`) / returns 403.

**First-admin bootstrap**
- The first Admin is created manually: invite with `role = admin` via `scripts/invite.ts`, accepted like any invite (the accept-invite INSERT sets `role = admin`; the trigger only fires on UPDATE). An existing user can also be promoted via a trusted direct-DB update (dashboard SQL / Management API) or the service-role admin client — both are permitted by the anti-escalation trigger, which blocks only client-JWT (`anon`/`authenticated`) role changes.

## 8. Security

- **Role authority:** the intended role is set in `app_metadata` at invite time (not user-editable) and copied to `profiles.role` on accept. Users never receive a role-editing surface in SP6.
- **Anti-escalation:** the `profiles_prevent_role_escalation` trigger rejects any direct `role` change not made by the service role, closing the `profiles_update_own` PostgREST escalation path.
- **Auth rate limiting:** Supabase enforces built-in rate limits on auth endpoints (sign-in, invite, OTP). No custom limiter added in SP6.
- **Password policy:** minimum length / strength enforced via Supabase Auth project config.
- **Secrets:** the invite CLI uses the service-role key from `.env.<env>.local` only; never committed.

## 9. Testing (TDD, Vitest node env)

- `lib/auth/guards.test.ts` — `requireRole` allows/denies per role (contributor vs reviewer vs admin) with a mocked server client / session + profile; `requireUser` redirects when unauthenticated.
- `scripts/invite.test.ts` — extract a pure `validateRole(role)` and an invite-payload builder; test that invalid roles are rejected and the payload places the role in `app_metadata` with the correct `redirectTo`.
- Pages stay thin; logic lives in testable guards/helpers. Full browser E2E (login → accept-invite → guarded route) is **SP10** (Playwright), not SP6.
- Migration verified on **staging** (introspect `profiles` has `role`; the trigger blocks a non-service-role role update; a service-role update succeeds) before any production apply.

## 10. Scope boundaries (YAGNI)

**IN SP6:** session plumbing (browser/server clients + middleware), `role` column + migration + anti-escalation trigger, `/login`, `/accept-invite` (set password + create profile), `/account` (landing + logout), `requireUser`/`requireRole` guards, `scripts/invite.ts`, first-admin bootstrap.

**OUT (→ SP7 or later):** in-app admin invite/role-management UI, profile editing, self-serve password reset, RLS `SECURITY DEFINER` read-helpers, the review queue / CMS feature pages, contribution-counter wiring.

## 11. Open risks / notes

- `@supabase/ssr` cookie handling in Next 16 must follow the current `node_modules/next/dist/docs/` + `@supabase/ssr` guidance (App Router middleware + Server Component patterns may differ from older examples) — verify against installed-version docs before implementing.
- `profiles.username` is `NOT NULL UNIQUE`; the accept-invite form must handle a username-collision error gracefully (re-prompt) rather than 500.
- `inviteUserByEmail` requires a configured redirect URL allowlist in Supabase Auth settings for `/accept-invite` on each environment (staging + prod).
