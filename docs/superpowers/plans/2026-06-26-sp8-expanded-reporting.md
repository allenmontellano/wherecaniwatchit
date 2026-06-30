# SP8 — Expanded Reporting Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the report modal's free-text platform/notes packing with structured `reported_platform` + `reported_watch_url` columns on `flags`, with sanitized inputs and a platform dropdown.

**Architecture:** Additive migration (two nullable columns). Pure sanitizers in `lib/flags.ts` (`sanitizeWatchUrl`, `sanitizePlatform`). A server data layer (`lib/platforms-data.ts`) supplies a region→platforms map to the title page (for the modal dropdown) and a region slug-set to the API (for validation). The `/api/flags` route validates + stores the structured fields; the report modal gets a platform `<select>` + "Other" text + watch-URL input.

**Tech Stack:** Next.js 16.2.7 (App Router, Server Components), React 19, TypeScript strict, `@supabase/supabase-js`, Vitest (node env, `globals: false`, `@/*` alias).

**Spec:** `docs/superpowers/specs/2026-06-26-sp8-expanded-reporting-design.md`

---

## Conventions for every task
- Tests use explicit imports (`globals: false`): `import { describe, it, expect, vi } from 'vitest'`.
- Path alias `@/*` → repo root; colocated tests; run one file with `npx vitest run <path>`; typecheck `npx tsc --noEmit`.
- Branch: `feat/sp8-reporting` (already created). One logical change per commit; commit message body ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Auto mode applies to the build (commit to `feat/sp8-reporting` freely). **Approval gates:** the migration apply (Task 1) and any staging/prod deploy (Task 8) require explicit user go-ahead.
- **Do NOT run `npm install`/`npm ci` or modify `package.json`/lockfile.**

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260626000001_flags_reported_columns.sql` | Add `reported_platform`, `reported_watch_url`. |
| `lib/flags.ts` | Add `sanitizeWatchUrl`, `sanitizePlatform`; remove `composeNotes`. |
| `lib/flags.test.ts` | Tests for the new sanitizers; drop `composeNotes` tests. |
| `lib/platforms-data.ts` (new) | `buildRegionPlatformsMap` (pure), `getRegionPlatformsMap`, `getRegionPlatformSlugs`. |
| `lib/platforms-data.test.ts` (new) | Test `buildRegionPlatformsMap`. |
| `app/api/flags/route.ts` | Validate + store structured fields; required-platform; drop `composeNotes`. |
| `app/api/flags/route.test.ts` | Updated route tests. |
| `components/report/report-modal.tsx` | Platform `<select>` + "Other" + watch-URL input; new submit body. |
| `components/title/title-detail.tsx` | Accept `platformsByRegion`; pass region's list to modal. |
| `app/titles/[id]/page.tsx` | Fetch the map; pass it down. |

---

## Task 1: Migration — reported columns

**Files:** Create `supabase/migrations/20260626000001_flags_reported_columns.sql`

> File-only + commit. **Do NOT apply or touch any database** — the apply is a gated step in Task 8.

- [ ] **Step 1: Create the migration file**

`supabase/migrations/20260626000001_flags_reported_columns.sql`:
```sql
-- SP8: structured report fields, replacing the packed notes platform string.
alter table flags
  add column if not exists reported_platform text,
  add column if not exists reported_watch_url text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260626000001_flags_reported_columns.sql
git commit -m "feat(sp8): migration — flags.reported_platform + reported_watch_url"
```

---

## Task 2: `sanitizeWatchUrl`

**Files:** Modify `lib/flags.ts`; Test `lib/flags.test.ts`

- [ ] **Step 1: Write the failing test** — append to `lib/flags.test.ts`:
```ts
import { sanitizeWatchUrl } from './flags'

describe('sanitizeWatchUrl', () => {
  it('returns null for empty/undefined', () => {
    expect(sanitizeWatchUrl(undefined)).toEqual({ ok: true, value: null })
    expect(sanitizeWatchUrl('   ')).toEqual({ ok: true, value: null })
  })
  it('keeps origin + pathname and drops query + fragment', () => {
    expect(sanitizeWatchUrl('https://www.netflix.com/title/81234?utm_source=share#x'))
      .toEqual({ ok: true, value: 'https://www.netflix.com/title/81234' })
  })
  it('accepts http and https', () => {
    expect(sanitizeWatchUrl('http://x.io/a')).toEqual({ ok: true, value: 'http://x.io/a' })
    expect(sanitizeWatchUrl('https://x.io')).toEqual({ ok: true, value: 'https://x.io/' })
  })
  it('rejects non-http(s) and garbage', () => {
    expect(sanitizeWatchUrl('ftp://x.io/a')).toEqual({ ok: false, error: 'Invalid watch URL.' })
    expect(sanitizeWatchUrl('not a url')).toEqual({ ok: false, error: 'Invalid watch URL.' })
    expect(sanitizeWatchUrl('javascript:alert(1)')).toEqual({ ok: false, error: 'Invalid watch URL.' })
  })
})
```

- [ ] **Step 2: Run, verify FAIL:** `npx vitest run lib/flags.test.ts` (cannot find `sanitizeWatchUrl`).

- [ ] **Step 3: Implement** — add to `lib/flags.ts` (above `composeNotes`, which is removed in Task 4):
```ts
export type SanitizeResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

export function sanitizeWatchUrl(raw: string | undefined | null): SanitizeResult {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Invalid watch URL.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Invalid watch URL.' }
  }
  const sanitized = url.origin + url.pathname
  if (sanitized.length > 500) return { ok: false, error: 'Invalid watch URL.' }
  return { ok: true, value: sanitized }
}
```

- [ ] **Step 4: Run, verify PASS:** `npx vitest run lib/flags.test.ts`.

- [ ] **Step 5: Commit**
```bash
git add lib/flags.ts lib/flags.test.ts
git commit -m "feat(sp8): add sanitizeWatchUrl (origin+pathname, http(s) only)"
```

---

## Task 3: `sanitizePlatform`

**Files:** Modify `lib/flags.ts`; Test `lib/flags.test.ts`

> The user explicitly asked to confirm the regex hyphen is literal — the `iWant-TFC` case below proves `\-` is a literal hyphen, not a range.

- [ ] **Step 1: Write the failing test** — append to `lib/flags.test.ts`:
```ts
import { sanitizePlatform } from './flags'

describe('sanitizePlatform', () => {
  const known = new Set(['netflix', 'vivamax'])
  it('returns null for empty', () => {
    expect(sanitizePlatform('', known)).toEqual({ ok: true, value: null })
    expect(sanitizePlatform(undefined, known)).toEqual({ ok: true, value: null })
  })
  it('passes a known slug through unchanged', () => {
    expect(sanitizePlatform('netflix', known)).toEqual({ ok: true, value: 'netflix' })
  })
  it('accepts a valid "Other" name', () => {
    expect(sanitizePlatform('Viu', known)).toEqual({ ok: true, value: 'Viu' })
  })
  it('treats a literal hyphen as a hyphen, not a regex range', () => {
    expect(sanitizePlatform('iWant-TFC', new Set())).toEqual({ ok: true, value: 'iWant-TFC' })
  })
  it('rejects names over 100 characters', () => {
    expect(sanitizePlatform('x'.repeat(101), known))
      .toEqual({ ok: false, error: 'Platform name must be 1–100 characters.' })
  })
  it('rejects URLs and special characters', () => {
    expect(sanitizePlatform('http://evil.com', known))
      .toEqual({ ok: false, error: 'Platform name contains invalid characters.' })
    expect(sanitizePlatform('Net<flix>', known))
      .toEqual({ ok: false, error: 'Platform name contains invalid characters.' })
  })
})
```

- [ ] **Step 2: Run, verify FAIL:** `npx vitest run lib/flags.test.ts`.

- [ ] **Step 3: Implement** — add to `lib/flags.ts`:
```ts
const PLATFORM_NAME_RE = /^[A-Za-z0-9 +.\-&'()]+$/

export function sanitizePlatform(
  raw: string | undefined | null,
  knownSlugs: Set<string>
): SanitizeResult {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  if (knownSlugs.has(trimmed)) return { ok: true, value: trimmed }
  if (trimmed.length > 100) {
    return { ok: false, error: 'Platform name must be 1–100 characters.' }
  }
  if (!PLATFORM_NAME_RE.test(trimmed)) {
    return { ok: false, error: 'Platform name contains invalid characters.' }
  }
  return { ok: true, value: trimmed }
}
```

- [ ] **Step 4: Run, verify PASS:** `npx vitest run lib/flags.test.ts`.

- [ ] **Step 5: Commit**
```bash
git add lib/flags.ts lib/flags.test.ts
git commit -m "feat(sp8): add sanitizePlatform (known slug or 100-char safe name)"
```

---

## Task 4: Platforms data layer

**Files:** Create `lib/platforms-data.ts`, `lib/platforms-data.test.ts`

- [ ] **Step 1: Write the failing test** `lib/platforms-data.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildRegionPlatformsMap } from './platforms-data'

describe('buildRegionPlatformsMap', () => {
  it('groups platforms by region, sorted by name', () => {
    const rows = [
      { slug: 'vivamax', name: 'Vivamax', supported_regions: ['PH'] },
      { slug: 'netflix', name: 'Netflix', supported_regions: ['PH', 'US'] },
      { slug: 'apple', name: 'Apple TV+', supported_regions: ['US'] },
    ]
    expect(buildRegionPlatformsMap(rows)).toEqual({
      PH: [
        { slug: 'netflix', name: 'Netflix' },
        { slug: 'vivamax', name: 'Vivamax' },
      ],
      US: [
        { slug: 'apple', name: 'Apple TV+' },
        { slug: 'netflix', name: 'Netflix' },
      ],
    })
  })
  it('returns an empty object for no rows', () => {
    expect(buildRegionPlatformsMap([])).toEqual({})
  })
})
```

- [ ] **Step 2: Run, verify FAIL:** `npx vitest run lib/platforms-data.test.ts`.

- [ ] **Step 3: Implement** `lib/platforms-data.ts`:
```ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface RegionPlatform {
  slug: string
  name: string
}

export function buildRegionPlatformsMap(
  rows: { slug: string; name: string; supported_regions: string[] }[]
): Record<string, RegionPlatform[]> {
  const map: Record<string, RegionPlatform[]> = {}
  for (const row of rows) {
    for (const region of row.supported_regions) {
      ;(map[region] ??= []).push({ slug: row.slug, name: row.name })
    }
  }
  for (const region of Object.keys(map)) {
    map[region].sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

export async function getRegionPlatformsMap(): Promise<Record<string, RegionPlatform[]>> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('platforms').select('slug, name, supported_regions')
  return buildRegionPlatformsMap(data ?? [])
}

export async function getRegionPlatformSlugs(region: string): Promise<Set<string>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('platforms')
    .select('slug')
    .contains('supported_regions', [region])
  return new Set((data ?? []).map((r: { slug: string }) => r.slug))
}
```

- [ ] **Step 4: Run, verify PASS:** `npx vitest run lib/platforms-data.test.ts`.

- [ ] **Step 5: Commit**
```bash
git add lib/platforms-data.ts lib/platforms-data.test.ts
git commit -m "feat(sp8): add platforms data layer (region map + slug set)"
```

---

## Task 5: API route — structured validation (+ remove `composeNotes`)

**Files:** Modify `lib/flags.ts`, `lib/flags.test.ts`, `app/api/flags/route.ts`, `app/api/flags/route.test.ts`

> `composeNotes` is removed here (not earlier) so every commit stays green — the route stops importing it in the same commit.

- [ ] **Step 1: Remove `composeNotes` from `lib/flags.ts`** — delete this function entirely:
```ts
export function composeNotes(
  issue: IssueType,
  platform: string | undefined,
  notes: string | undefined
): string | null {
  const parts: string[] = []
  if (platform?.trim()) parts.push(`Platform: ${platform.trim()}`)
  if (notes?.trim()) parts.push(notes.trim())
  return parts.length ? parts.join('\n') : null
}
```

- [ ] **Step 2: Remove the `composeNotes` test from `lib/flags.test.ts`** — delete this `it(...)` from the `describe('flags helpers', …)` block (keep the `issueToFlagType` + `ISSUE_TYPES` assertions):
```ts
  it('composeNotes prefixes platform', () => {
    expect(composeNotes('is-here', 'Vivamax', 'hi')).toBe('Platform: Vivamax\nhi')
    expect(composeNotes('not-here', undefined, 'hi')).toBe('hi')
    expect(composeNotes('not-here', undefined, undefined)).toBeNull()
  })
```
And drop `composeNotes` from that file's flags import (`import { ISSUE_TYPES, issueToFlagType, composeNotes } from './flags'` → `import { ISSUE_TYPES, issueToFlagType } from './flags'`). Leave the new `sanitizeWatchUrl` / `sanitizePlatform` imports added in Tasks 2–3 intact.

- [ ] **Step 3: Rewrite the route test** `app/api/flags/route.test.ts` (replace the whole file):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

process.env.CRON_SECRET = 'test-secret'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/platforms-data', () => ({
  getRegionPlatformSlugs: vi.fn().mockResolvedValue(new Set(['vivamax', 'netflix'])),
}))

const mockInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: mockInsert }) }),
}))

import { POST } from './route'

beforeEach(() => {
  mockInsert.mockReset()
  mockInsert.mockResolvedValue({ error: null })
})

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/flags', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/flags', () => {
  it('returns 400 when title_id/region_code/issue_type are missing', async () => {
    const res = await POST(makeRequest({ issue_type: 'not-here' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 400 for an invalid issue_type', async () => {
    const res = await POST(makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'spam' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid issue_type/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('stores structured fields (known slug, sanitized url, details) and returns 201', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        reported_platform: 'vivamax',
        reported_watch_url: 'https://www.vivamax.net/watch/9?utm=x#y',
        notes: 'saw it here',
      })
    )
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        flag_type: 'missing',
        availability_id: null,
        reported_platform: 'vivamax',
        reported_watch_url: 'https://www.vivamax.net/watch/9',
        notes: 'saw it here',
        status: 'pending',
      })
    )
  })

  it('returns 400 for an invalid watch URL', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        reported_platform: 'vivamax',
        reported_watch_url: 'not-a-url',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/watch url/i)
  })

  it('returns 400 for an invalid platform name', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'wrong-platform',
        reported_platform: 'http://evil.com',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/platform/i)
  })

  it('requires a platform for is-here / wrong-platform', async () => {
    const res = await POST(
      makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'wrong-platform' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/platform is required/i)
  })

  it('allows no platform for other issue types and hashes the IP', async () => {
    const res = await POST(
      makeRequest(
        { title_id: 't', region_code: 'PH', issue_type: 'wrong-season', notes: 'season 2 wrong' },
        { 'x-forwarded-for': '1.2.3.4' }
      )
    )
    expect(res.status).toBe(201)
    const row = mockInsert.mock.calls[0][0]
    expect(row.flag_type).toBe('outdated')
    expect(row.reported_platform).toBeNull()
    expect(row.reported_watch_url).toBeNull()
    expect(row.ip_hash).toBeDefined()
    expect(row.ip_hash).not.toBe('1.2.3.4')
  })

  it('caps details at 500 characters', async () => {
    await POST(
      makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'other', notes: 'x'.repeat(600) })
    )
    expect(mockInsert.mock.calls[0][0].notes.length).toBe(500)
  })
})
```

- [ ] **Step 4: Run, verify FAIL:** `npx vitest run app/api/flags/route.test.ts` (old route still uses `composeNotes`/`platform`).

- [ ] **Step 5: Rewrite** `app/api/flags/route.ts` (replace the whole file):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ISSUE_TYPES,
  issueToFlagType,
  sanitizeWatchUrl,
  sanitizePlatform,
  type IssueType,
} from '@/lib/flags'
import { getRegionPlatformSlugs } from '@/lib/platforms-data'
import { captureException } from '@/lib/observability'
import { clientIp, hashIp } from '@/lib/ip'
import { enforceRateLimit } from '@/lib/rate-limit'

interface FlagBody {
  title_id: string
  region_code: string
  issue_type: IssueType
  reported_platform?: string
  reported_watch_url?: string
  notes?: string
}

const PLATFORM_REQUIRED: IssueType[] = ['is-here', 'wrong-platform']

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'flags')
  if (limited) return limited

  let body: FlagBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title_id, region_code, issue_type, reported_platform, reported_watch_url, notes } = body

  if (!title_id || !region_code || !issue_type) {
    return NextResponse.json(
      { error: 'title_id, region_code and issue_type are required' },
      { status: 400 }
    )
  }
  if (!ISSUE_TYPES.includes(issue_type)) {
    return NextResponse.json({ error: 'Invalid issue_type' }, { status: 400 })
  }

  const url = sanitizeWatchUrl(reported_watch_url)
  if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 })

  const knownSlugs = await getRegionPlatformSlugs(region_code)
  const platform = sanitizePlatform(reported_platform, knownSlugs)
  if (!platform.ok) return NextResponse.json({ error: platform.error }, { status: 400 })

  if (PLATFORM_REQUIRED.includes(issue_type) && platform.value === null) {
    return NextResponse.json({ error: 'A platform is required for this report.' }, { status: 400 })
  }

  const details = notes?.trim() ? notes.trim().slice(0, 500) : null

  const supabase = createAdminClient()
  const { error } = await supabase.from('flags').insert({
    availability_id: null,
    title_id,
    region_code,
    issue_type,
    flag_type: issueToFlagType(issue_type),
    reported_platform: platform.value,
    reported_watch_url: url.value,
    notes: details,
    ip_hash: hashIp(clientIp(req)),
    status: 'pending',
  })

  if (error) {
    captureException(error, { op: 'flags.insert', title_id, region_code, issue_type })
    return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
```

- [ ] **Step 6: Run, verify PASS:** `npx vitest run lib/flags.test.ts app/api/flags/route.test.ts && npx tsc --noEmit` (all tests pass; typecheck clean — `composeNotes` is fully gone and the route no longer references it).

- [ ] **Step 7: Commit**
```bash
git add lib/flags.ts lib/flags.test.ts app/api/flags/route.ts app/api/flags/route.test.ts
git commit -m "feat(sp8): /api/flags stores structured reported_platform + reported_watch_url; drop composeNotes"
```

---

## Task 6: Report modal + title page wiring

**Files:** Modify `components/report/report-modal.tsx`, `components/title/title-detail.tsx`, `app/titles/[id]/page.tsx`

> Client UI — no unit test (codebase convention); verified in-browser at the staging gate. Match existing visual tokens (`rounded-xl border border-[#E5E5E5]`, primary `#2B72E8`).

- [ ] **Step 1: Update `components/report/report-modal.tsx`.** Change the props interface and the platform/watch-URL fields.

Replace the props interface + the `import` (add nothing new) and the component signature:
```tsx
interface ReportModalProps {
  onClose: () => void
  titleId: string
  titleName: string
  region: RegionMeta
  platforms: { slug: string; name: string }[]
}
```
```tsx
export function ReportModal({ onClose, titleId, titleName, region, platforms }: ReportModalProps) {
```

Replace the platform/notes state lines:
```tsx
  const [platform, setPlatform] = useState('')
```
with:
```tsx
  const [platformValue, setPlatformValue] = useState('')
  const [platformOther, setPlatformOther] = useState('')
  const [watchUrl, setWatchUrl] = useState('')
```

Replace the submit `body` construction inside `submit()`:
```tsx
        body: JSON.stringify({
          title_id: titleId,
          region_code: region.code,
          issue_type: issue,
          platform: showPlatform ? platform : undefined,
          notes,
        }),
```
with:
```tsx
        body: JSON.stringify({
          title_id: titleId,
          region_code: region.code,
          issue_type: issue,
          reported_platform: showPlatform
            ? platformValue === '__other__'
              ? platformOther.trim() || undefined
              : platformValue || undefined
            : undefined,
          reported_watch_url: showPlatform ? watchUrl.trim() || undefined : undefined,
          notes,
        }),
```

Replace the entire conditional platform block (the `<div>` wrapping the "Which platform is it actually on?" label + text input) with a select + conditional "Other" input + watch-URL input:
```tsx
            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: showPlatform ? 320 : 0,
                opacity: showPlatform ? 1 : 0,
                marginBottom: showPlatform ? 16 : 0,
              }}
            >
              <FieldLabel>Which platform?</FieldLabel>
              <select
                value={platformValue}
                onChange={(e) => setPlatformValue(e.target.value)}
                className="w-full appearance-none cursor-pointer rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 pr-9 text-[14px] text-[#171717] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23AEAEB8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                <option value="">Select a platform…</option>
                {platforms.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
                <option value="__other__">Other — specify</option>
              </select>

              {platformValue === '__other__' && (
                <input
                  type="text"
                  value={platformOther}
                  onChange={(e) => setPlatformOther(e.target.value)}
                  maxLength={100}
                  placeholder="Platform name"
                  className="mt-2 w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                />
              )}

              <div className="mt-3">
                <FieldLabel>Watch link (optional)</FieldLabel>
                <input
                  type="url"
                  value={watchUrl}
                  onChange={(e) => setWatchUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] font-sans focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
                />
              </div>
            </div>
```

- [ ] **Step 2: Update `components/title/title-detail.tsx`.** Add the prop and thread it to the modal.

Change the props interface:
```tsx
interface TitleDetailProps {
  title: Title
  availability: AvailabilityWithPlatform[]
  platformsByRegion: Record<string, { slug: string; name: string }[]>
}
```
Change the signature:
```tsx
export function TitleDetail({ title, availability, platformsByRegion }: TitleDetailProps) {
```
In the `ReportModal` render, pass the current region's platforms:
```tsx
      {reportOpen && (
        <ReportModal
          onClose={() => setReportOpen(false)}
          titleId={title.id}
          titleName={title.title}
          region={region}
          platforms={platformsByRegion[country] ?? []}
        />
      )}
```

- [ ] **Step 3: Update `app/titles/[id]/page.tsx`.** Fetch the map in parallel with the detail and pass it down.

Add the import:
```tsx
import { getRegionPlatformsMap } from '@/lib/platforms-data'
```
Replace:
```tsx
  const detail = await getTitleDetail(id)
  if (!detail) notFound()
  const { title, availability } = detail
```
with:
```tsx
  const [detail, platformsByRegion] = await Promise.all([
    getTitleDetail(id),
    getRegionPlatformsMap(),
  ])
  if (!detail) notFound()
  const { title, availability } = detail
```
Replace the `<TitleDetail …>` render:
```tsx
          <TitleDetail title={title} availability={availability} platformsByRegion={platformsByRegion} />
```

- [ ] **Step 4: Typecheck + full suite:** `npx tsc --noEmit && npx vitest run` (clean; all tests pass).

- [ ] **Step 5: Commit**
```bash
git add components/report/report-modal.tsx components/title/title-detail.tsx app/titles/[id]/page.tsx
git commit -m "feat(sp8): report modal platform dropdown + watch-url; wire platforms from title page"
```

---

## Task 7: Full verification + staging gate

**Files:** none (verification only).

- [ ] **Step 1: Full suite + typecheck + lint:** `npx tsc --noEmit && npx vitest run && npx eslint .` (all clean/green).

- [ ] **Step 2: Push the branch:** `git push -u origin feat/sp8-reporting`.

- [ ] **Step 3: APPROVAL GATE — merge to staging + apply migration.** **STOP; requires explicit user go-ahead.** When approved: apply `20260626000001_flags_reported_columns.sql` to **staging** (`hunvbflchgjphnhdjmws`) via the Management API with the explicit ref; record it in `schema_migrations`; verify the two columns exist; confirm **prod untouched**. Then merge `feat/sp8-reporting` → `staging` and confirm the deploy is live.

- [ ] **Step 4: Manual staging verification (browser):**
  - On a title page, open "Report incorrect info"; choose **IS available here** → the platform **dropdown** shows the region's platforms + "Other — specify"; the **watch link** field appears.
  - Submit with a known platform + a tracking-param URL → 201; confirm the stored `flags` row has the **slug** in `reported_platform` and the **stripped** `reported_watch_url` (origin+pathname).
  - Choose **Other — specify**, type `iWant-TFC` → submits fine (hyphen accepted).
  - Submit **wrong-platform** with no platform → blocked (button/he API returns the "platform is required" error).
  - Try an invalid watch URL → rejected.
  - Confirm **other** / **wrong-season** show no platform/URL fields, only details.

- [ ] **Step 5: Production gate (separate approval).** After staging verifies, a separate explicit approval ships to prod: apply the migration to prod (`ahgmszdrhndcycvairmn`), then merge `staging` → `master`.

---

## Self-review (against the spec)

**Tasks:** 1 migration · 2 `sanitizeWatchUrl` · 3 `sanitizePlatform` · 4 platforms-data · 5 route (+remove `composeNotes`) · 6 modal + wiring · 7 verification/gate.

**Spec coverage:**
- §4 migration (2 columns, additive) → Task 1. ✅
- §5 form fields per issue type (dropdown + Other + watch URL + details; reveal logic) → Task 6. ✅
- §6 region→platforms map from page; `getRegionPlatformSlugs` for API → Task 4 (both helpers), Task 6 (map wired to page/modal), Task 5 (slugs used by route). ✅
- §7a `sanitizeWatchUrl` → Task 2. ✅
- §7b `sanitizePlatform` → Task 3. ✅
- §7c route behavior incl. required-platform + details cap + drop `composeNotes` → Task 5. ✅
- §8 testing (sanitizers, route, `buildRegionPlatformsMap`; modal in-browser) → Tasks 2, 3, 4, 5, 7. ✅
- §9 scope (no backfill, no admin UI, no review-queue rendering) → none built. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. Every commit is green (composeNotes removal folded into the route commit in Task 5).

**Type consistency:** `SanitizeResult` (Task 2) reused by `sanitizePlatform` (Task 3) and the route (Task 5). `RegionPlatform`/`{slug,name}[]` shape consistent across `platforms-data.ts` (Task 4), `TitleDetail.platformsByRegion` + `ReportModal.platforms` (Task 6). `getRegionPlatformSlugs` signature (Task 4) matches the route call + test mock (Task 5). `reported_platform`/`reported_watch_url` column names consistent: migration (Task 1) ↔ route insert (Task 5). The modal's `__other__` sentinel is internal to the modal only (never sent — it maps to `platformOther`).
