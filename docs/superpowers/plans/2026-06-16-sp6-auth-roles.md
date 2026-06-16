# SP6 — Auth & Roles (invite-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up invite-only email+password authentication with a three-role model (`contributor`/`reviewer`/`admin`) plus app-layer route guards, so SP7's CMS can gate access.

**Architecture:** Supabase Auth via `@supabase/ssr` (browser client + existing cookie-aware server client + a root `proxy.ts` that refreshes the session cookie). Roles live on `profiles.role` (source of truth, set from invite `app_metadata`) and are enforced by server-side `requireUser()`/`requireRole()` guards — **not** in `proxy.ts`, which only does optimistic cookie refresh. Invites are issued by a `scripts/invite.ts` CLI; no in-app admin UI (→ SP7).

**Tech Stack:** Next.js 16.2.7 (App Router, `proxy.ts` convention, Node.js runtime), React 19.2.4, TypeScript strict, `@supabase/ssr@0.10.3`, `@supabase/supabase-js@2.106.2`, Vitest (node env, `globals: false`, `@/*` alias).

**Spec:** `docs/superpowers/specs/2026-06-16-sp6-auth-roles-design.md`

---

## Conventions for every task

- Tests use explicit imports (`globals: false`): `import { describe, it, expect, vi } from 'vitest'`.
- Path alias `@/*` → repo root. Tests are colocated (`foo.test.ts` beside `foo.ts`).
- Run a single test file with: `npx vitest run <path>`.
- Run typecheck with: `npx tsc --noEmit`.
- Branch: `feat/sp6-auth` (already created). One logical change per commit; commit at the end of each task.
- Auto mode applies to this build (commit to `feat/sp6-auth` without asking). **Approval gates:** the migration apply (Task 2) and any staging/prod deploy (Task 10) require explicit user go-ahead.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/auth/roles.ts` | `USER_ROLES`, `UserRole` type, `isUserRole()` guard. Pure. |
| `supabase/migrations/20260616000001_profiles_role.sql` | Add `role` enum column + anti-escalation trigger. |
| `lib/auth/guards.ts` | `getSessionUser()`, `requireUser()`, `requireRole()`. |
| `lib/supabase/client.ts` | Browser Supabase client. |
| `lib/supabase/proxy-session.ts` | `updateSession(request)` cookie-refresh helper. |
| `proxy.ts` (repo root) | Next 16 proxy delegating to `updateSession` + matcher. |
| `lib/auth/accept-invite.ts` | Pure `parseAcceptInviteInput()` + `resolveInviteRole()`. |
| `components/auth/login-form.tsx` | Client sign-in form. |
| `app/login/page.tsx` | Login page wrapper. |
| `components/auth/accept-invite-form.tsx` | Client set-password/username form. |
| `app/accept-invite/page.tsx` | Accept-invite page wrapper. |
| `app/accept-invite/actions.ts` | `acceptInvite` server action. |
| `app/account/page.tsx` | Authed landing (email/role/username + logout). |
| `app/account/actions.ts` | `logout` server action. |
| `scripts/invite.ts` | Invite CLI (`parseInviteArgs`, `inviteRedirectUrl`, `main`). |
| `scripts/invite.test.ts` | Tests for the CLI's pure helpers. |

---

## Task 1: Role definitions + validation

**Files:**
- Create: `lib/auth/roles.ts`
- Test: `lib/auth/roles.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/auth/roles.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { USER_ROLES, isUserRole } from './roles'

describe('USER_ROLES', () => {
  it('is exactly contributor, reviewer, admin in order', () => {
    expect(USER_ROLES).toEqual(['contributor', 'reviewer', 'admin'])
  })
})

describe('isUserRole', () => {
  it('accepts each valid role', () => {
    expect(isUserRole('contributor')).toBe(true)
    expect(isUserRole('reviewer')).toBe(true)
    expect(isUserRole('admin')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isUserRole('superuser')).toBe(false)
    expect(isUserRole('')).toBe(false)
    expect(isUserRole(null)).toBe(false)
    expect(isUserRole(42)).toBe(false)
    expect(isUserRole(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/roles.test.ts`
Expected: FAIL — cannot find module `./roles`.

- [ ] **Step 3: Write minimal implementation**

`lib/auth/roles.ts`:
```ts
export const USER_ROLES = ['contributor', 'reviewer', 'admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/roles.test.ts`
Expected: PASS (2 files? no — 1 file, 5 assertions across 3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/roles.ts lib/auth/roles.test.ts
git commit -m "feat(sp6): add user role enum + isUserRole guard"
```

---

## Task 2: Migration — `profiles.role` + anti-escalation trigger

**Files:**
- Create: `supabase/migrations/20260616000001_profiles_role.sql`

> **No unit test** — migrations are verified by introspection on staging. **The apply is an approval gate** (see Step 3). The implementer writes + commits the file only.

- [ ] **Step 1: Write the migration file**

`supabase/migrations/20260616000001_profiles_role.sql`:
```sql
-- SP6: add a role to profiles for invite-only RBAC.
create type user_role as enum ('contributor', 'reviewer', 'admin');

alter table profiles
  add column role user_role not null default 'contributor';

-- Block a role change made by a PostgREST *client* (a user's own JWT). The
-- service-role admin client and trusted direct-DB connections (psql / dashboard /
-- Management API, which have no JWT client role) remain allowed. Fires on UPDATE
-- only, so the accept-invite INSERT that sets the initial role is unaffected.
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

- [ ] **Step 2: Commit the migration file**

```bash
git add supabase/migrations/20260616000001_profiles_role.sql
git commit -m "feat(sp6): migration — profiles.role enum + anti-escalation trigger"
```

- [ ] **Step 3: APPROVAL GATE — apply to staging, then verify**

**STOP. Do not apply without explicit user go-ahead.** When approved, apply to **staging** (`hunvbflchgjphnhdjmws`) via the Management API with the explicit ref (per CLAUDE.md migration-safety rules), then record it in `supabase_migrations.schema_migrations`.

Verify on staging (expected results in parentheses):
```sql
-- column exists, enum type correct (returns: role | user_role | 'contributor')
select column_name, udt_name, column_default
from information_schema.columns
where table_name = 'profiles' and column_name = 'role';

-- trigger exists (returns: profiles_prevent_role_escalation)
select tgname from pg_trigger where tgrelid = 'profiles'::regclass and not tgisinternal;
```
Confirm **production (`ahgmszdrhndcycvairmn`) is unchanged** (no `role` column yet). Production apply is a **separate** approval after the full feature is verified on staging (Task 10).

---

## Task 3: Auth guards

**Files:**
- Create: `lib/auth/guards.ts`
- Test: `lib/auth/guards.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/auth/guards.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }))
const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error('REDIRECT:' + url)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { getSessionUser, requireUser, requireRole } from './guards'

type ProfileRow = { username: string; role: string } | null

function stubClient(user: { id: string; email?: string } | null, profile: ProfileRow) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: profile, error: profile ? null : { code: 'PGRST116' } }),
        })),
      })),
    })),
  }
}

beforeEach(() => {
  mockCreateClient.mockReset()
  mockRedirect.mockClear()
})

describe('getSessionUser', () => {
  it('returns null when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(stubClient(null, null))
    expect(await getSessionUser()).toBeNull()
  })
  it('returns the session user with role when profile is valid', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'reviewer' })
    )
    expect(await getSessionUser()).toEqual({ id: 'u1', email: 'a@b.co', role: 'reviewer', username: 'ann' })
  })
  it('returns null when the profile role is invalid', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'wizard' })
    )
    expect(await getSessionUser()).toBeNull()
  })
})

describe('requireUser', () => {
  it('redirects to /login when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(stubClient(null, null))
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
  it('returns the user when authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'admin' })
    )
    expect((await requireUser()).role).toBe('admin')
  })
})

describe('requireRole', () => {
  it('redirects to /account when the role is not permitted', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'contributor' })
    )
    await expect(requireRole('admin')).rejects.toThrow('REDIRECT:/account')
  })
  it('allows when the role is in the permitted list', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'reviewer' })
    )
    expect((await requireRole(['reviewer', 'admin'])).username).toBe('ann')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/guards.test.ts`
Expected: FAIL — cannot find module `./guards`.

- [ ] **Step 3: Write minimal implementation**

`lib/auth/guards.ts`:
```ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isUserRole, type UserRole } from '@/lib/auth/roles'

export interface SessionUser {
  id: string
  email: string | null
  role: UserRole
  username: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !isUserRole(profile.role)) return null

  return { id: user.id, email: user.email ?? null, role: profile.role, username: profile.username }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const user = await requireUser()
  if (!allowed.includes(user.role)) redirect('/account')
  return user
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/guards.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/guards.ts lib/auth/guards.test.ts
git commit -m "feat(sp6): add requireUser/requireRole server guards"
```

---

## Task 4: Browser Supabase client

**Files:**
- Create: `lib/supabase/client.ts`
- Test: `lib/supabase/client.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/supabase/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateBrowserClient } = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn(() => ({ tag: 'browser-client' })),
}))
vi.mock('@supabase/ssr', () => ({ createBrowserClient: mockCreateBrowserClient }))

import { createClient } from './client'

beforeEach(() => {
  mockCreateBrowserClient.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

describe('createClient (browser)', () => {
  it('builds a browser client from the public env vars', () => {
    const client = createClient()
    expect(mockCreateBrowserClient).toHaveBeenCalledWith('https://proj.supabase.co', 'anon-key')
    expect(client).toEqual({ tag: 'browser-client' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/supabase/client.test.ts`
Expected: FAIL — cannot find module `./client`.

- [ ] **Step 3: Write minimal implementation**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/supabase/client.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/client.test.ts
git commit -m "feat(sp6): add browser supabase client"
```

---

## Task 5: Proxy session refresh

**Files:**
- Create: `lib/supabase/proxy-session.ts`
- Create: `proxy.ts` (repo root)
- Test: `lib/supabase/proxy-session.test.ts`

> The matcher's exclusion behavior is verified manually on staging (Task 10) — assets must keep loading. The unit test covers the glue: a `NextResponse` is returned and the session is refreshed via `auth.getUser()`.

- [ ] **Step 1: Write the failing test**

`lib/supabase/proxy-session.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: null } })
  return {
    mockGetUser: getUser,
    mockCreateServerClient: vi.fn(() => ({ auth: { getUser } })),
  }
})
vi.mock('@supabase/ssr', () => ({ createServerClient: mockCreateServerClient }))

import { updateSession } from './proxy-session'

beforeEach(() => {
  mockGetUser.mockClear()
  mockCreateServerClient.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

describe('updateSession', () => {
  it('refreshes the session and returns a NextResponse', async () => {
    const req = new NextRequest('http://localhost/account')
    const res = await updateSession(req)
    expect(mockCreateServerClient).toHaveBeenCalledOnce()
    expect(mockGetUser).toHaveBeenCalledOnce()
    expect(res).toBeInstanceOf(NextResponse)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/supabase/proxy-session.test.ts`
Expected: FAIL — cannot find module `./proxy-session`.

- [ ] **Step 3: Write minimal implementation**

`lib/supabase/proxy-session.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token; do not run authorization logic here.
  await supabase.auth.getUser()

  return response
}
```

`proxy.ts` (repo root):
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy-session'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/supabase/proxy-session.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/proxy-session.ts lib/supabase/proxy-session.test.ts proxy.ts
git commit -m "feat(sp6): add proxy.ts session refresh (Next 16 proxy convention)"
```

---

## Task 6: Login page + form

**Files:**
- Create: `components/auth/login-form.tsx`
- Create: `app/login/page.tsx`

> Client components are not unit-tested in this codebase (node env, no jsdom/RTL — matches `components/report/report-modal.tsx`). Verified manually on staging (Task 10). Match the visual language of `report-modal.tsx` (rounded inputs, `#2B72E8` primary button, `#171717` text).

- [ ] **Step 1: Implement the login form**

`components/auth/login-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Incorrect email or password.')
      setSubmitting(false)
      return
    }
    router.replace('/account')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[360px] flex flex-col gap-4">
      <h1 className="text-[22px] font-bold text-[#171717]" style={{ fontFamily: 'var(--font-display)' }}>
        Sign in
      </h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

`app/login/page.tsx`:
```tsx
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F7F8]">
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-form.tsx app/login/page.tsx
git commit -m "feat(sp6): add login page + email/password form"
```

---

## Task 7: Accept-invite — validation helpers, page, form, server action

**Files:**
- Create: `lib/auth/accept-invite.ts`
- Test: `lib/auth/accept-invite.test.ts`
- Create: `app/accept-invite/actions.ts`
- Create: `components/auth/accept-invite-form.tsx`
- Create: `app/accept-invite/page.tsx`

### 7a — Pure validation helpers (TDD)

- [ ] **Step 1: Write the failing test**

`lib/auth/accept-invite.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseAcceptInviteInput, resolveInviteRole } from './accept-invite'

describe('parseAcceptInviteInput', () => {
  it('accepts a valid username + password', () => {
    const r = parseAcceptInviteInput({ username: 'ann_lee', password: 'longenough', regionCode: 'PH' })
    expect(r).toEqual({ ok: true, value: { username: 'ann_lee', password: 'longenough', regionCode: 'PH' } })
  })
  it('treats blank region as null', () => {
    const r = parseAcceptInviteInput({ username: 'ann', password: 'longenough', regionCode: '' })
    expect(r).toEqual({ ok: true, value: { username: 'ann', password: 'longenough', regionCode: null } })
  })
  it('rejects a short username', () => {
    expect(parseAcceptInviteInput({ username: 'an', password: 'longenough', regionCode: '' }))
      .toEqual({ ok: false, error: 'Username must be 3–30 characters.' })
  })
  it('rejects a username with invalid characters', () => {
    expect(parseAcceptInviteInput({ username: 'ann lee!', password: 'longenough', regionCode: '' }))
      .toEqual({ ok: false, error: 'Username may only contain letters, numbers, and underscores.' })
  })
  it('rejects a short password', () => {
    expect(parseAcceptInviteInput({ username: 'ann', password: 'short', regionCode: '' }))
      .toEqual({ ok: false, error: 'Password must be at least 8 characters.' })
  })
})

describe('resolveInviteRole', () => {
  it('returns the role from app_metadata when valid', () => {
    expect(resolveInviteRole({ role: 'reviewer' })).toBe('reviewer')
    expect(resolveInviteRole({ role: 'admin' })).toBe('admin')
  })
  it('defaults to contributor when missing or invalid', () => {
    expect(resolveInviteRole({})).toBe('contributor')
    expect(resolveInviteRole({ role: 'wizard' })).toBe('contributor')
    expect(resolveInviteRole(null)).toBe('contributor')
    expect(resolveInviteRole(undefined)).toBe('contributor')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/accept-invite.test.ts`
Expected: FAIL — cannot find module `./accept-invite`.

- [ ] **Step 3: Write minimal implementation**

`lib/auth/accept-invite.ts`:
```ts
import { isUserRole, type UserRole } from '@/lib/auth/roles'

export interface AcceptInviteValue {
  username: string
  password: string
  regionCode: string | null
}

export type AcceptInviteParse =
  | { ok: true; value: AcceptInviteValue }
  | { ok: false; error: string }

const USERNAME_RE = /^[A-Za-z0-9_]+$/

export function parseAcceptInviteInput(input: {
  username: string
  password: string
  regionCode: string
}): AcceptInviteParse {
  const username = input.username.trim()
  const regionCode = input.regionCode.trim() === '' ? null : input.regionCode.trim()

  if (username.length < 3 || username.length > 30) {
    return { ok: false, error: 'Username must be 3–30 characters.' }
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'Username may only contain letters, numbers, and underscores.' }
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  return { ok: true, value: { username, password: input.password, regionCode } }
}

export function resolveInviteRole(appMetadata: unknown): UserRole {
  if (appMetadata && typeof appMetadata === 'object') {
    const role = (appMetadata as Record<string, unknown>).role
    if (isUserRole(role)) return role
  }
  return 'contributor'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/accept-invite.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/accept-invite.ts lib/auth/accept-invite.test.ts
git commit -m "feat(sp6): add accept-invite input parsing + role resolution"
```

### 7b — Server action + form + page

- [ ] **Step 6: Write the failing test (server-action error mapping)**

`app/accept-invite/actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockServerClient, mockAdminClient, mockRedirect } = vi.hoisted(() => ({
  mockServerClient: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
  mockAdminClient: { from: vi.fn() },
  mockRedirect: vi.fn((url: string) => {
    throw new Error('REDIRECT:' + url)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockServerClient) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdminClient }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { acceptInvite } from './actions'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'reviewer' } } },
  })
  mockServerClient.auth.updateUser.mockResolvedValue({ error: null })
})

describe('acceptInvite', () => {
  it('returns a validation error without touching the DB', async () => {
    const result = await acceptInvite(form({ username: 'no', password: 'longenough', regionCode: '' }))
    expect(result).toEqual({ error: 'Username must be 3–30 characters.' })
    expect(mockAdminClient.from).not.toHaveBeenCalled()
  })

  it('returns "username taken" on a unique violation', async () => {
    mockAdminClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }),
    })
    const result = await acceptInvite(form({ username: 'taken', password: 'longenough', regionCode: '' }))
    expect(result).toEqual({ error: 'That username is already taken.' })
  })

  it('inserts the profile with the invited role then redirects', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockAdminClient.from.mockReturnValue({ insert })
    await expect(acceptInvite(form({ username: 'ann', password: 'longenough', regionCode: 'PH' })))
      .rejects.toThrow('REDIRECT:/account')
    expect(mockServerClient.auth.updateUser).toHaveBeenCalledWith({ password: 'longenough' })
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      username: 'ann',
      region_code: 'PH',
      role: 'reviewer',
    })
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run app/accept-invite/actions.test.ts`
Expected: FAIL — cannot find module `./actions`.

- [ ] **Step 8: Implement the server action**

`app/accept-invite/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAcceptInviteInput, resolveInviteRole } from '@/lib/auth/accept-invite'

export async function acceptInvite(formData: FormData): Promise<{ error: string } | never> {
  const parsed = parseAcceptInviteInput({
    username: String(formData.get('username') ?? ''),
    password: String(formData.get('password') ?? ''),
    regionCode: String(formData.get('regionCode') ?? ''),
  })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your invite link has expired. Ask an admin to re-invite you.' }

  const { error: pwError } = await supabase.auth.updateUser({ password: parsed.value.password })
  if (pwError) return { error: 'Could not set your password. Please try again.' }

  const role = resolveInviteRole(user.app_metadata)
  const admin = createAdminClient()
  const { error: insertError } = await admin.from('profiles').insert({
    user_id: user.id,
    username: parsed.value.username,
    region_code: parsed.value.regionCode,
    role,
  })
  if (insertError) {
    if (insertError.code === '23505') return { error: 'That username is already taken.' }
    return { error: 'Could not finish setting up your account. Please try again.' }
  }

  redirect('/account')
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run app/accept-invite/actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Implement the form + page (no unit test — client UI)**

`components/auth/accept-invite-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { acceptInvite } from '@/app/accept-invite/actions'

export function AcceptInviteForm() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    const result = await acceptInvite(formData)
    // A successful action redirects; only an error object returns here.
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <form action={onSubmit} className="w-full max-w-[360px] flex flex-col gap-4">
      <h1 className="text-[22px] font-bold text-[#171717]" style={{ fontFamily: 'var(--font-display)' }}>
        Set up your account
      </h1>
      <input
        name="username"
        required
        placeholder="Username"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Password (8+ characters)"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      <input
        name="regionCode"
        placeholder="Region code (optional, e.g. PH)"
        className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
      />
      {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Create account'}
      </button>
    </form>
  )
}
```

`app/accept-invite/page.tsx`:
```tsx
import { AcceptInviteForm } from '@/components/auth/accept-invite-form'

export default function AcceptInvitePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F7F8]">
      <AcceptInviteForm />
    </main>
  )
}
```

- [ ] **Step 11: Verify typecheck + the new tests pass**

Run: `npx tsc --noEmit && npx vitest run lib/auth/accept-invite.test.ts app/accept-invite/actions.test.ts`
Expected: no type errors; all tests PASS.

- [ ] **Step 12: Commit**

```bash
git add app/accept-invite components/auth/accept-invite-form.tsx
git commit -m "feat(sp6): accept-invite action, form, and page"
```

---

## Task 8: Account landing + logout

**Files:**
- Create: `app/account/actions.ts`
- Create: `app/account/page.tsx`

> Server Component + thin server action; verified manually (Task 10). The page calls `requireUser()` (Task 3) so unauthenticated visits redirect to `/login`.

- [ ] **Step 1: Implement the logout action**

`app/account/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Implement the account page**

`app/account/page.tsx`:
```tsx
import { requireUser } from '@/lib/auth/guards'
import { logout } from './actions'

export default async function AccountPage() {
  const user = await requireUser()
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F7F8]">
      <div className="w-full max-w-[360px] flex flex-col gap-4">
        <h1 className="text-[22px] font-bold text-[#171717]" style={{ fontFamily: 'var(--font-display)' }}>
          Your account
        </h1>
        <dl className="text-[14px] text-[#171717] flex flex-col gap-1.5">
          <div className="flex justify-between"><dt className="text-[#717177]">Username</dt><dd>{user.username}</dd></div>
          <div className="flex justify-between"><dt className="text-[#717177]">Email</dt><dd>{user.email}</dd></div>
          <div className="flex justify-between"><dt className="text-[#717177]">Role</dt><dd className="capitalize">{user.role}</dd></div>
        </dl>
        <form action={logout}>
          <button
            type="submit"
            className="w-full px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-[#717177] bg-black/[0.04] hover:bg-black/[0.08] hover:text-[#171717] transition-all"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/account
git commit -m "feat(sp6): add account landing + logout"
```

---

## Task 9: Invite CLI

**Files:**
- Create: `scripts/invite.ts`
- Test: `scripts/invite.test.ts`

> Pure helpers (`parseInviteArgs`, `inviteRedirectUrl`) are TDD-tested; `main()` (network side effects) is exercised manually on staging (Task 10). Run with: `npx tsx --env-file=.env.staging.local scripts/invite.ts <email> <role>`.

- [ ] **Step 1: Write the failing test**

`scripts/invite.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseInviteArgs, inviteRedirectUrl } from './invite'

describe('parseInviteArgs', () => {
  it('accepts a valid email + role', () => {
    expect(parseInviteArgs(['reviewer@example.com', 'reviewer']))
      .toEqual({ ok: true, email: 'reviewer@example.com', role: 'reviewer' })
  })
  it('rejects a missing email', () => {
    expect(parseInviteArgs([])).toEqual({ ok: false, error: 'Usage: invite <email> <role>' })
  })
  it('rejects a missing role', () => {
    expect(parseInviteArgs(['a@b.co'])).toEqual({ ok: false, error: 'Usage: invite <email> <role>' })
  })
  it('rejects an email without @', () => {
    expect(parseInviteArgs(['notanemail', 'admin'])).toEqual({ ok: false, error: 'Invalid email address.' })
  })
  it('rejects an invalid role', () => {
    expect(parseInviteArgs(['a@b.co', 'wizard']))
      .toEqual({ ok: false, error: 'Role must be one of: contributor, reviewer, admin.' })
  })
})

describe('inviteRedirectUrl', () => {
  it('appends /accept-invite to the base', () => {
    expect(inviteRedirectUrl('https://staging.wherecaniwatchit.info')).toBe(
      'https://staging.wherecaniwatchit.info/accept-invite'
    )
  })
  it('strips a trailing slash from the base', () => {
    expect(inviteRedirectUrl('https://x.io/')).toBe('https://x.io/accept-invite')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/invite.test.ts`
Expected: FAIL — cannot find module `./invite`.

- [ ] **Step 3: Write minimal implementation**

`scripts/invite.ts`:
```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { isUserRole, USER_ROLES, type UserRole } from '@/lib/auth/roles'

export type ParsedInvite =
  | { ok: true; email: string; role: UserRole }
  | { ok: false; error: string }

export function parseInviteArgs(argv: string[]): ParsedInvite {
  const [email, role] = argv
  if (!email || !role) return { ok: false, error: 'Usage: invite <email> <role>' }
  if (!email.includes('@')) return { ok: false, error: 'Invalid email address.' }
  if (!isUserRole(role)) {
    return { ok: false, error: `Role must be one of: ${USER_ROLES.join(', ')}.` }
  }
  return { ok: true, email, role }
}

export function inviteRedirectUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/accept-invite`
}

async function main() {
  const parsed = parseInviteArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(1)
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL
  if (!base) {
    console.error('NEXT_PUBLIC_SITE_URL must be set (the app base URL for the invite link).')
    process.exit(1)
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.email, {
    redirectTo: inviteRedirectUrl(base),
  })
  if (error || !data.user) {
    console.error('Invite failed:', error?.message ?? 'no user returned')
    process.exit(1)
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: parsed.role },
  })
  if (roleError) {
    console.error('Invite sent but failed to set role:', roleError.message)
    process.exit(1)
  }

  console.log(`Invited ${parsed.email} as ${parsed.role}.`)
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('invite.ts')) {
  void main()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/invite.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/invite.ts scripts/invite.test.ts
git commit -m "feat(sp6): add invite CLI (inviteUserByEmail + app_metadata role)"
```

---

## Task 10: Full verification + staging gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS (existing 227 + the new SP6 tests, ~29 new assertions).

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Commit any fixes, then push the branch**

```bash
git push -u origin feat/sp6-auth
```

- [ ] **Step 4: APPROVAL GATE — merge to staging + apply migration + configure Supabase**

**STOP. Requires explicit user go-ahead** (merge to `staging`, migration apply, and Supabase config are all gated).

When approved:
1. Apply the Task 2 migration to **staging** (`hunvbflchgjphnhdjmws`) via the Management API with the explicit ref; record it in `supabase_migrations.schema_migrations`.
2. In the **staging** Supabase project Auth settings: set the **Site URL** and add `https://staging.wherecaniwatchit.info/accept-invite` to the **redirect allowlist**; confirm the minimum password length is ≥ 8.
3. Set `NEXT_PUBLIC_SITE_URL=https://staging.wherecaniwatchit.info` in the staging Vercel env (Preview scope).
4. Merge `feat/sp6-auth` → `staging`; confirm the staging deploy is live.

- [ ] **Step 5: Manual staging verification checklist**

- [ ] Static assets still load (CSS/JS/images) — confirms the `proxy.ts` matcher excludes `_next/*` correctly.
- [ ] `tsx --env-file=.env.staging.local scripts/invite.ts you@example.com reviewer` sends an invite email.
- [ ] The invite link opens `/accept-invite`; setting a username + password (8+) creates the account and lands on `/account` showing role **reviewer**.
- [ ] A duplicate username shows "That username is already taken." (no 500).
- [ ] Logging out, then visiting `/account` directly, redirects to `/login`.
- [ ] Signing in at `/login` with the new credentials returns to `/account`.
- [ ] Escalation blocked: as the signed-in reviewer, attempt `update profiles set role='admin' where user_id=auth.uid()` via the PostgREST anon/authenticated path → rejected by the trigger; the role stays `reviewer`.
- [ ] Confirm **production is untouched** (no `role` column; no SP6 routes live).

- [ ] **Step 6: Production gate (separate approval)**

After staging is verified, a **separate explicit approval** ships to production: apply the migration to prod (`ahgmszdrhndcycvairmn`), set `NEXT_PUBLIC_SITE_URL` + the prod redirect allowlist, then merge `staging` → `master`. (This is the standard prod-deploy gate; not part of the build loop.)

---

## Self-review (against the spec)

**Spec coverage:**
- §3 auth method (email+password, invite onboarding) → Tasks 6, 7, 9. ✅
- §3 invite issuance via CLI → Task 9. ✅
- §3 role model A (`profiles.role` + guards) → Tasks 1, 2, 3. ✅
- §3 password reset deferred → not built (correctly out). ✅
- §3 profile creation in accept-invite action → Task 7b. ✅
- §5 migration + anti-escalation trigger → Task 2 (verified Task 10 Step 5). ✅
- §6 every file → mapped to a task (file-structure table). ✅
- §7 invite/login/protected/bootstrap flows → Tasks 9, 6, 3/8, 10. ✅
- §8 security (app_metadata role, trigger, rate limit, password policy) → Tasks 2, 9, 10 Step 4. ✅
- §9 testing (guards, invite-script logic) → Tasks 3, 9 (+ roles, accept-invite, proxy-session). ✅
- §10 scope (admin UI / reset / RLS helpers OUT) → none built. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `UserRole`/`USER_ROLES`/`isUserRole` (Task 1) reused identically in Tasks 3, 7, 9. `SessionUser` shape (Task 3) matches `/account` usage (Task 8). `parseAcceptInviteInput`/`resolveInviteRole` signatures (Task 7a) match the action call (Task 7b). `createClient` (server, async — existing) vs `createClient` (browser, sync — Task 4) are in distinct modules, imported by path; no collision. `acceptInvite(formData)` return type `{ error: string } | never` matches the form's `result?.error` check.
