# Frontend Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the five finalized Claude Design screens (Home, Search Results, Title Detail, Empty States, Report Modal) into the live Next.js app pixel-for-pixel, extending the TMDB sync and `flags` schema to supply the data the designs need.

**Architecture:** A shared sticky header (logo · refine pill · standalone country selector) drives a client `CountryProvider` so country changes recompute availability instantly from a single all-region payload — no refetch. Backend gains nullable `titles` metadata columns (populated from an extended TMDB sync) and a flexible `flags` schema so any report persists.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript (strict), Tailwind v4, framer-motion, lucide-react, Supabase, Vitest.

**Design reference (read before each UI task):** `docs/design-reference/<screen>/*.html` are the canonical prototypes. Match their CSS exactly; translate structure to React. Tokens already exist in `app/layout.tsx` (`--font-display/sans/mono`) and inline hex in components.

**Conventions:** strict TS (no `any`), named exports, tests beside source (`*.test.ts`), `npx tsc --noEmit` after each task, commit per task. Flags use `flagcdn.com/24x18/<code>.png` images (never emoji). Run tests with `npm test`.

---

## Phase 0 — Shared logic & types

### Task 0.1: Shared `REGIONS` const in `lib/country.ts`

**Files:**
- Modify: `lib/country.ts`
- Test: `lib/country.test.ts` (create)

- [ ] **Step 1: Write failing test**

```ts
// lib/country.test.ts
import { describe, it, expect } from 'vitest'
import { REGIONS, SUPPORTED_COUNTRIES, resolveCountry } from './country'

describe('REGIONS', () => {
  it('lists the 5 launch regions in order with flag + name', () => {
    expect(REGIONS.map((r) => r.code)).toEqual(['PH', 'US', 'GB', 'AU', 'CA'])
    expect(REGIONS[0]).toEqual({ code: 'PH', name: 'Philippines', flag: 'ph' })
  })
  it('REGIONS codes match SUPPORTED_COUNTRIES', () => {
    expect(REGIONS.map((r) => r.code)).toEqual([...SUPPORTED_COUNTRIES])
  })
})

describe('resolveCountry', () => {
  it('prefers a valid url param', () => expect(resolveCountry('US', 'GB')).toBe('US'))
  it('falls back to cookie then PH', () => {
    expect(resolveCountry(undefined, 'GB')).toBe('GB')
    expect(resolveCountry('xx', 'yy')).toBe('PH')
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- lib/country.test.ts` (REGIONS undefined).

- [ ] **Step 3: Implement** — append to `lib/country.ts`:

```ts
export interface RegionMeta {
  code: CountryCode
  name: string
  flag: string // flagcdn slug (lowercase)
}

export const REGIONS: RegionMeta[] = [
  { code: 'PH', name: 'Philippines', flag: 'ph' },
  { code: 'US', name: 'United States', flag: 'us' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
  { code: 'AU', name: 'Australia', flag: 'au' },
  { code: 'CA', name: 'Canada', flag: 'ca' },
]

export const regionByCode: Record<CountryCode, RegionMeta> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r])
) as Record<CountryCode, RegionMeta>
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git add lib/country.ts lib/country.test.ts && git commit -m "feat: shared REGIONS const in lib/country"`

### Task 0.2: `formatExtent` in `lib/title-utils.ts`

**Files:** Modify `lib/title-utils.ts`; Test `lib/title-utils.test.ts` (exists — extend).

- [ ] **Step 1: Write failing test** (add to existing file):

```ts
import { formatExtent } from './title-utils'

describe('formatExtent', () => {
  it('formats tv as N seasons', () =>
    expect(formatExtent({ type: 'tv', season_count: 7, runtime: null })).toBe('7 seasons'))
  it('singular season', () =>
    expect(formatExtent({ type: 'tv', season_count: 1, runtime: null })).toBe('1 season'))
  it('formats movie runtime', () =>
    expect(formatExtent({ type: 'movie', season_count: null, runtime: 132 })).toBe('2h 12m'))
  it('returns null when nothing to show', () =>
    expect(formatExtent({ type: 'tv', season_count: null, runtime: null })).toBeNull())
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** in `lib/title-utils.ts`:

```ts
export function formatExtent(t: {
  type: 'movie' | 'tv'
  season_count: number | null
  runtime: number | null
}): string | null {
  if (t.type === 'tv') {
    if (!t.season_count) return null
    return `${t.season_count} season${t.season_count === 1 ? '' : 's'}`
  }
  return t.runtime ? formatRuntime(t.runtime) : null
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat: formatExtent helper"`

---

## Phase 1 — Backend: title metadata

### Task 1.1: Migration A + type updates

**Files:**
- Create: `supabase/migrations/20260604000001_title_metadata_fields.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Write migration**

```sql
-- 20260604000001_title_metadata_fields.sql
alter table titles
  add column if not exists network text,
  add column if not exists "cast" text[],
  add column if not exists creators text[],
  add column if not exists origin_country text,
  add column if not exists episode_count int,
  add column if not exists status text,
  add column if not exists original_language text,
  add column if not exists content_rating text;
```

- [ ] **Step 2: Extend `Title` interface** in `types/database.ts` (after `season_count`):

```ts
  network: string | null
  cast: string[] | null
  creators: string[] | null
  origin_country: string | null
  episode_count: number | null
  status: string | null
  original_language: string | null
  content_rating: string | null
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` (expect existing `sync.ts` insert to error on missing fields — fixed in 1.3; acceptable mid-phase, do not commit broken). Proceed to 1.2/1.3 then commit together.

### Task 1.2: TMDB extraction helpers (pure, TDD)

**Files:**
- Create: `lib/tmdb/extract.ts`, `lib/tmdb/extract.test.ts`
- Modify: `lib/tmdb/types.ts`

- [ ] **Step 1: Extend TMDB types** in `lib/tmdb/types.ts`:

```ts
export interface TMDBCredits {
  cast: Array<{ name: string; order: number }>
  crew: Array<{ name: string; job: string }>
}

export interface TMDBMovieDetailFull extends TMDBMovieDetail {
  credits?: TMDBCredits
  production_companies?: Array<{ name: string }>
  production_countries?: Array<{ iso_3166_1: string; name: string }>
  original_language?: string
  spoken_languages?: Array<{ iso_639_1: string; english_name: string }>
  status?: string
  release_dates?: { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }
}

export interface TMDBTVDetailFull extends TMDBTVDetail {
  credits?: TMDBCredits
  created_by?: Array<{ name: string }>
  networks?: Array<{ name: string }>
  origin_country?: string[]
  number_of_episodes?: number
  status?: string
  original_language?: string
  spoken_languages?: Array<{ iso_639_1: string; english_name: string }>
  content_ratings?: { results: Array<{ iso_3166_1: string; rating: string }> }
}
```

- [ ] **Step 2: Write failing tests** `lib/tmdb/extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  extractCast, extractCreatorsTV, extractCreatorsMovie,
  extractNetworkTV, extractNetworkMovie, extractTVCertification,
  extractMovieCertification, extractOriginCountryTV, extractOriginCountryMovie,
  languageName,
} from './extract'

it('extractCast takes top 6 by order', () => {
  const credits = { cast: [
    { name: 'B', order: 1 }, { name: 'A', order: 0 }, { name: 'C', order: 2 },
  ], crew: [] }
  expect(extractCast(credits)).toEqual(['A', 'B', 'C'])
})
it('extractCreatorsMovie picks directors', () => {
  expect(extractCreatorsMovie({ cast: [], crew: [
    { name: 'Bong Joon-ho', job: 'Director' }, { name: 'X', job: 'Editor' },
  ] })).toEqual(['Bong Joon-ho'])
})
it('extractCreatorsTV maps created_by', () =>
  expect(extractCreatorsTV([{ name: 'Michael Schur' }])).toEqual(['Michael Schur']))
it('extractNetworkTV first network', () =>
  expect(extractNetworkTV([{ name: 'NBC' }])).toBe('NBC'))
it('extractNetworkMovie first company', () =>
  expect(extractNetworkMovie([{ name: 'CJ Entertainment' }])).toBe('CJ Entertainment'))
it('extractTVCertification picks US', () =>
  expect(extractTVCertification({ results: [
    { iso_3166_1: 'GB', rating: '15' }, { iso_3166_1: 'US', rating: 'TV-14' },
  ] })).toBe('TV-14'))
it('extractMovieCertification picks US non-empty', () =>
  expect(extractMovieCertification({ results: [
    { iso_3166_1: 'US', release_dates: [{ certification: '' }, { certification: 'R' }] },
  ] })).toBe('R'))
it('extractOriginCountryTV first code', () =>
  expect(extractOriginCountryTV(['US'])).toBe('United States'))
it('languageName maps iso', () => expect(languageName('en')).toBe('English'))
it('returns null on empty', () => {
  expect(extractCast({ cast: [], crew: [] })).toBeNull()
  expect(extractNetworkTV([])).toBeNull()
  expect(extractTVCertification({ results: [] })).toBeNull()
})
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement** `lib/tmdb/extract.ts`:

```ts
import type { TMDBCredits } from './types'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', AU: 'Australia',
  CA: 'Canada', PH: 'Philippines', KR: 'South Korea', JP: 'Japan', FR: 'France',
}
const LANG_NAMES: Record<string, string> = {
  en: 'English', ko: 'Korean', ja: 'Japanese', es: 'Spanish',
  fr: 'French', de: 'German', tl: 'Filipino',
}

export function extractCast(credits: TMDBCredits | undefined): string[] | null {
  if (!credits?.cast?.length) return null
  return [...credits.cast].sort((a, b) => a.order - b.order).slice(0, 6).map((c) => c.name)
}
export function extractCreatorsMovie(credits: TMDBCredits | undefined): string[] | null {
  const dirs = credits?.crew?.filter((c) => c.job === 'Director').map((c) => c.name) ?? []
  return dirs.length ? dirs : null
}
export function extractCreatorsTV(createdBy: Array<{ name: string }> | undefined): string[] | null {
  return createdBy?.length ? createdBy.map((c) => c.name) : null
}
export function extractNetworkTV(networks: Array<{ name: string }> | undefined): string | null {
  return networks?.[0]?.name ?? null
}
export function extractNetworkMovie(companies: Array<{ name: string }> | undefined): string | null {
  return companies?.[0]?.name ?? null
}
export function extractTVCertification(
  cr: { results: Array<{ iso_3166_1: string; rating: string }> } | undefined
): string | null {
  const us = cr?.results?.find((r) => r.iso_3166_1 === 'US')
  return us?.rating || null
}
export function extractMovieCertification(
  rd: { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> } | undefined
): string | null {
  const us = rd?.results?.find((r) => r.iso_3166_1 === 'US')
  return us?.release_dates?.map((d) => d.certification).find(Boolean) ?? null
}
export function extractOriginCountryTV(codes: string[] | undefined): string | null {
  const c = codes?.[0]
  return c ? COUNTRY_NAMES[c] ?? c : null
}
export function extractOriginCountryMovie(
  countries: Array<{ iso_3166_1: string; name: string }> | undefined
): string | null {
  return countries?.[0]?.name ?? null
}
export function languageName(iso: string | undefined): string | null {
  if (!iso) return null
  return LANG_NAMES[iso] ?? iso
}
```

- [ ] **Step 5: Run, expect PASS.**
- [ ] **Step 6: Commit** — `git add lib/tmdb types/database.ts && git commit -m "feat: TMDB metadata extraction helpers + types"`

### Task 1.3: Wire extended fetch + sync mapping

**Files:** Modify `lib/tmdb/client.ts`, `lib/sync.ts`; extend `lib/sync.test.ts`.

- [ ] **Step 1: Extend client** `lib/tmdb/client.ts` — change `append_to_response`:
  - Movie (`fetchMovieDetail`): add `append_to_response: 'credits,release_dates'`; return type `Promise<TMDBMovieDetailFull>`.
  - TV (`fetchTVDetail`): `append_to_response: 'external_ids,credits,content_ratings'`; return `Promise<TMDBTVDetailFull>`.

- [ ] **Step 2: Map new fields in `lib/sync.ts`** — in the movie branch add to `titleData`:

```ts
      network: extractNetworkMovie(d.production_companies),
      cast: extractCast(d.credits),
      creators: extractCreatorsMovie(d.credits),
      origin_country: extractOriginCountryMovie(d.production_countries),
      episode_count: null,
      status: d.status ?? null,
      original_language: languageName(d.original_language),
      content_rating: extractMovieCertification(d.release_dates),
```

  TV branch:

```ts
      network: extractNetworkTV(d.networks),
      cast: extractCast(d.credits),
      creators: extractCreatorsTV(d.created_by),
      origin_country: extractOriginCountryTV(d.origin_country),
      episode_count: d.number_of_episodes ?? null,
      status: d.status ?? null,
      original_language: languageName(d.original_language),
      content_rating: extractTVCertification(d.content_ratings),
```

  Add imports from `./tmdb/extract`.

- [ ] **Step 3: Extend `lib/sync.test.ts`** — add a TV fixture with `networks`, `created_by`, `content_ratings`, `credits`, `origin_country`, `number_of_episodes`, `status`, `original_language`; assert the upsert payload includes the mapped columns. (Mirror the existing mock structure in that file.)

- [ ] **Step 4: Run** `npm test -- lib/sync.test.ts` and `npx tsc --noEmit`, expect PASS.
- [ ] **Step 5: Commit** — `git add lib/tmdb lib/sync.ts supabase/migrations types/database.ts && git commit -m "feat: populate title metadata from TMDB in sync"`

---

## Phase 2 — Backend: flags for any report

### Task 2.1: Flag mapping helpers (pure, TDD)

**Files:** Create `lib/flags.ts`, `lib/flags.test.ts`.

- [ ] **Step 1: Failing test** `lib/flags.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ISSUE_TYPES, issueToFlagType, composeNotes } from './flags'

it('maps issue → flag_type', () => {
  expect(issueToFlagType('not-here')).toBe('incorrect')
  expect(issueToFlagType('is-here')).toBe('missing')
  expect(issueToFlagType('wrong-platform')).toBe('incorrect')
  expect(issueToFlagType('wrong-season')).toBe('outdated')
  expect(issueToFlagType('other')).toBe('incorrect')
})
it('ISSUE_TYPES has the 5 options', () =>
  expect(ISSUE_TYPES).toEqual(['not-here', 'is-here', 'wrong-platform', 'wrong-season', 'other']))
it('composeNotes prefixes platform', () => {
  expect(composeNotes('is-here', 'Vivamax', 'hi')).toBe('Platform: Vivamax\nhi')
  expect(composeNotes('not-here', undefined, 'hi')).toBe('hi')
  expect(composeNotes('not-here', undefined, undefined)).toBeNull()
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `lib/flags.ts`:

```ts
import type { FlagType } from '@/types/database'

export const ISSUE_TYPES = ['not-here', 'is-here', 'wrong-platform', 'wrong-season', 'other'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

const MAP: Record<IssueType, FlagType> = {
  'not-here': 'incorrect',
  'is-here': 'missing',
  'wrong-platform': 'incorrect',
  'wrong-season': 'outdated',
  other: 'incorrect',
}

export function issueToFlagType(issue: IssueType): FlagType {
  return MAP[issue]
}
export function composeNotes(
  issue: IssueType, platform: string | undefined, notes: string | undefined
): string | null {
  const parts: string[] = []
  if (platform?.trim()) parts.push(`Platform: ${platform.trim()}`)
  if (notes?.trim()) parts.push(notes.trim())
  return parts.length ? parts.join('\n') : null
}
```

- [ ] **Step 4: Run, expect PASS.** **Step 5: Commit** — `git commit -am "feat: flag issue/notes mapping helpers"`

### Task 2.2: Migration B + Flag type

**Files:** Create `supabase/migrations/20260604000002_flags_title_region.sql`; Modify `types/database.ts`.

- [ ] **Step 1: Migration**

```sql
-- 20260604000002_flags_title_region.sql
alter table flags alter column availability_id drop not null;
alter table flags
  add column if not exists title_id uuid references titles(id) on delete cascade,
  add column if not exists region_code text,
  add column if not exists issue_type text;
```

- [ ] **Step 2: Update `Flag`** in `types/database.ts`: make `availability_id: string | null`; add `title_id: string | null`, `region_code: string | null`, `issue_type: string | null`.
- [ ] **Step 3: Typecheck** `npx tsc --noEmit`. **Commit** — `git commit -am "feat: flags schema supports title+region reports"`

### Task 2.3: Rewrite `/api/flags`

**Files:** Modify `app/api/flags/route.ts`; rewrite `app/api/flags/route.test.ts`.

- [ ] **Step 1: Rewrite tests** to the new body shape `{ title_id, region_code, issue_type, platform?, notes? }`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const insert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}))

function req(body: unknown) {
  return new Request('http://x/api/flags', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
  }) as unknown as import('next/server').NextRequest
}

beforeEach(() => { insert.mockReset(); insert.mockResolvedValue({ error: null }) })

it('rejects missing fields', async () => {
  const res = await POST(req({ issue_type: 'not-here' }))
  expect(res.status).toBe(400)
})
it('rejects invalid issue_type', async () => {
  const res = await POST(req({ title_id: 't', region_code: 'PH', issue_type: 'bogus' }))
  expect(res.status).toBe(400)
})
it('inserts mapped flag', async () => {
  const res = await POST(req({ title_id: 't', region_code: 'PH', issue_type: 'is-here', platform: 'Vivamax', notes: 'hi' }))
  expect(res.status).toBe(201)
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    title_id: 't', region_code: 'PH', issue_type: 'is-here',
    flag_type: 'missing', notes: 'Platform: Vivamax\nhi', status: 'pending',
  }))
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Rewrite `route.ts`** — validate against `ISSUE_TYPES`, require `title_id` + `region_code` + `issue_type`, map via `issueToFlagType`/`composeNotes`, keep `hashIp`, insert `{ title_id, region_code, issue_type, flag_type, availability_id: null, notes, ip_hash, status: 'pending' }`.
- [ ] **Step 4: Run tests + tsc, expect PASS.** **Step 5: Commit** — `git commit -am "feat: /api/flags accepts title+region reports"`

---

## Phase 3 — Shared UI: country context, header, primitives

### Task 3.1: Country context

**Files:** Create `components/country/country-context.tsx`.

- [ ] **Step 1: Implement** (client). Provides `{ country, setCountry }`; persists cookie + `history.replaceState` URL `country` param; no refetch.

```tsx
'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import type { CountryCode } from '@/lib/country'

interface Ctx { country: CountryCode; setCountry: (c: CountryCode) => void }
const CountryContext = createContext<Ctx | null>(null)

export function CountryProvider({ initial, children }: { initial: CountryCode; children: React.ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(initial)
  const setCountry = useCallback((c: CountryCode) => {
    setCountryState(c)
    document.cookie = `selected-country=${c}; path=/; max-age=31536000; SameSite=Lax`
    const url = new URL(window.location.href)
    url.searchParams.set('country', c)
    window.history.replaceState(null, '', url.toString())
  }, [])
  return <CountryContext.Provider value={{ country, setCountry }}>{children}</CountryContext.Provider>
}

export function useCountry(): Ctx {
  const ctx = useContext(CountryContext)
  if (!ctx) throw new Error('useCountry must be used within CountryProvider')
  return ctx
}
```

- [ ] **Step 2: tsc, commit** — `git add components/country && git commit -m "feat: country context provider"`

### Task 3.2: `CountrySelector` (standalone)

**Files:** Create `components/layout/country-selector.tsx`.
**Design:** `docs/design-reference/search-results/Search Results.html` `.country/.country-btn/.dropdown/.opt` (lines 95–132) + `render.js` selector logic (lines 7–43).

- [ ] **Step 1: Implement** (client) — button (flag 22×16, full name, chevron) + dropdown of `REGIONS`; uses `useCountry()`; outside-click closes; `.country-name` hidden `<720px` (`hidden min-[721px]:inline` or media). Match the exact classes' inline styles.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: standalone country selector"`

### Task 3.3: `RefineSearchForm`

**Files:** Create `components/layout/refine-search-form.tsx`.
**Design:** `.refine/.refine-pill/.refine-input/.refine-btn` (Search Results.html lines 60–93).

- [ ] **Step 1: Implement** (client) — controlled input (default = `initialQuery`), focus ring via `focused` state, submit → `router.push('/search?q=…&country=' + useCountry().country)`.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: refine search form"`

### Task 3.4: `SiteHeader`

**Files:** Create `components/layout/site-header.tsx`.
**Design:** `.header` grid (Search Results.html lines 42–58).

- [ ] **Step 1: Implement** (client) — grid `1fr minmax(0,540px) 1fr`, glass bg + blur, logo (`<Logo/>` left, links `/`), `RefineSearchForm` center, `CountrySelector` right. Props: `initialQuery: string`. Mobile grid `auto 1fr auto`.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: shared site header"`

### Task 3.5: `PlatformBadge` + `AnswerBox`

**Files:** Create `components/ui/platform-badge.tsx`, `components/ui/answer-box.tsx`.

- [ ] **Step 1: `PlatformBadge`** — `{ slug: string; size?: 'sm'|'lg' }` → span styled from `platformLabel(slug)`; `lg` = `padding 6px 13px; font 13px`, default `4px 11px; 12px`.
- [ ] **Step 2: `AnswerBox`** — props `{ available: boolean; region: RegionMeta; children?: ReactNode; size?: 'card'|'lg' }`. Green/red box per `.answer.available/.unavailable` (Search Results.html lines 230–268; lg variant from Title Detail.html lines 114–133). Check/X icon, flag, "Available/Not available in {name}", `children` = detail slot.
- [ ] **Step 3: tsc, commit** — `git commit -am "feat: PlatformBadge and AnswerBox primitives"`

---

## Phase 4 — Report modal

### Task 4.1: `ReportModal`

**Files:** Create `components/report/report-modal.tsx`.
**Design:** Search Results.html lines 307–343 (CSS) + 413–459 (markup) + render.js 163–210.

- [ ] **Step 1: Implement** (client). Props: `{ open, onClose, titleId, titleName, region: RegionMeta }`.
  - State: `issue` (`IssueType`, default `not-here`), `platform`, `notes`, `submitting`, `done`.
  - Conditional platform field shown when `issue==='wrong-platform' || issue==='is-here'` (animate max-height).
  - Notes `maxLength={280}` + counter `${n} / 280`, warn `≥260`.
  - Submit → `POST /api/flags` `{ title_id: titleId, region_code: region.code, issue_type: issue, platform, notes }` → on ok set `done`.
  - Success state: animated check, "Report submitted", Done/Close.
  - Close on Esc (key listener), backdrop click, X, Cancel. `role="dialog" aria-modal`. Reset state on open.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: report modal wired to /api/flags"`

---

## Phase 5 — Search Results

### Task 5.1: Rewrite `ResultCard`

**Files:** Rewrite `components/search/result-card.tsx`.
**Design:** Search Results.html `.card/.poster/.info/...` (lines 148–305) + render.js `cardHTML` (57–128).

- [ ] **Step 1: Implement** (client). Props: `{ title, availabilityByRegion, index }`. Reads `useCountry()`.
  - Horizontal card, `gap 28px`, hover lift. Poster 156px 2/3: real `poster_url` `<Image>` if present, else gradient placeholder (`--poster-bg` from a deterministic tint by `title.id` or fixed `#F5F5F7→` tint) with title text + "Poster" tag.
  - Info: title (display 25px), meta row = `[release_year, type→'Series'/'Movie', genres[0], formatExtent].filter(Boolean)` joined with `·` dots + `★ rating`. (Omit `network` if null.) Synopsis.
  - `AnswerBox` for `country`: available if `availabilityByRegion[country]?.length`; detail = `PlatformBadge lg` per slug; else note "Not currently streaming on any service here."
  - "Available in other regions": for each `REGIONS` ≠ country → row flag+name / badges or "Not available".
  - Footer Report button → calls `onReport(title)` prop (modal owned by list).
  - framer-motion fade-up `delay index*0.06`, `whileHover y:-3`, reduced-motion safe.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: detailed search result card"`

### Task 5.2: Rewrite `ResultsSection` → results list + summary + modal owner

**Files:** Rewrite `components/search/results-section.tsx`.

- [ ] **Step 1: Implement** (client). Props `{ results, query }`. Reads `useCountry()`.
  - If `results.length === 0` → `<EmptyNoResults query={query} />` (Task 6.1).
  - Else if `results.length === 1 && (availabilityByRegion[country]?.length ?? 0) === 0` → `<NotInRegion result={results[0]} />` (Task 6.2).
  - Else: summary line `**N results** for "{query}" · streaming availability in **{regionName}**`, then `.cards` list of `ResultCard`.
  - Owns one `ReportModal`; `onReport(title)` opens it with `{ titleId, titleName, region }`.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: results list with summary and report modal"`

### Task 5.3: Update `app/search/page.tsx`

**Files:** Modify `app/search/page.tsx`.

- [ ] **Step 1:** Wrap content in `CountryProvider initial={country}`. Replace header with `<SiteHeader initialQuery={q} />`. Render `<ResultsSection results={data.results} query={data.query} />`. Keep `AnimatedBackground`, `max-w` → `880px` content wrap (`max-w-[880px]`). Keep no-query / error fallbacks.
- [ ] **Step 2: tsc, browser-verify** `/search?q=Severance`. **Commit** — `git commit -am "feat: wire search page to new header + results"`

---

## Phase 6 — Empty states

### Task 6.1: `EmptyNoResults`

**Files:** Create `components/search/empty-no-results.tsx`.
**Design:** Empty State.html scenario 1 (lines 166–182) + cloud `?` SVG (171–175).

- [ ] **Step 1: Implement** — centered cloud-`?` SVG, "We couldn't find that title", body, "Try searching for:" + chips (`Severance`, `The Bear`, `Parasite`) each → `router.push('/search?q=…&country')`. Uses `useCountry()`.
- [ ] **Step 2: tsc, commit** — `git commit -am "feat: no-results empty state"`

### Task 6.2: `NotInRegion` (rich scenario 2)

**Files:** Create `components/search/not-in-region.tsx`.
**Design:** Empty State.html `.scenario.found` + `renderFound` (lines 80–131, 247–323).

- [ ] **Step 1: Implement** (client). Props `{ result }`. Reads `useCountry()`.
  - Condensed title card (96px poster, title, meta, synopsis).
  - `AnswerBox` unavailable for `country`.
  - "Available in these regions" 2×2 grid of clickable `region-card`s (regions ≠ country with availability) → `setCountry(code)`; each shows flag+name+arrow + first `PlatformBadge`.
  - Globe nudge line.
  - Triggered only by `ResultsSection` (single unavailable result).
- [ ] **Step 2: tsc, browser-verify** with a title unavailable in PH. **Commit** — `git commit -am "feat: found-not-in-region rich screen"`

---

## Phase 7 — Title Detail

### Task 7.1: Rewrite Title Detail as client tree

**Files:** Modify `app/titles/[id]/page.tsx`; Create `components/title/title-detail.tsx`.
**Design:** Title Detail.html (full) + title.js render functions.

- [ ] **Step 1: Server page** — keep data fetch (`/api/titles/[id]` returns `{ title, availability }`), resolve country, wrap in `CountryProvider initial={country}`, render `<SiteHeader initialQuery={title.title} />` then `<TitleDetail title={title} availability={availability} />`. Drop the old back-nav/poster/tabs markup.
- [ ] **Step 2: `TitleDetail`** (client) using `useCountry()` + `groupByRegion(availability)`:
  - **Hero** (lines 59–107): backdrop gradient (no real backdrop column → gradient by genre/tint) + grain + dark gradient → white; poster (real `poster_url` else gradient); title; meta `[network, year, type, genres[0], formatExtent].filter(Boolean)` + `★rating`; synopsis; credits (Starring `cast.slice(0,3)`, Created by `creators`) — omit a credit block if its field is null.
  - **Answer** (lg `AnswerBox`): platforms for `country` with `PlatformBadge` + "Watch on {label}" external link (`watch_url`); freshness line from latest `last_verified` (Today if today else date) "· across 5 regions".
  - **Where else** table: regions ≠ country → flag+name / badges / "Not available".
  - **Title details** grid: build rows from real fields, **omitting null ones** — Cast (`cast` + `creators` as "— Creator"), Genre pills (`genres`), Release year, Network, Country of origin (`origin_country`), Runtime (`formatRuntime(runtime)` or "per episode" for tv if runtime present), Total episodes (`episode_count`), Status, Language (`original_language`), Content rating (`content_rating`).
  - Report button in table footer → `ReportModal { titleId: title.id, titleName: title.title, region }`.
  - Footer line.
- [ ] **Step 3: tsc, browser-verify** a real title. **Commit** — `git commit -am "feat: cinematic title detail page"`

### Task 7.2: Update loading skeleton

**Files:** Modify `app/titles/[id]/loading.tsx`.

- [ ] **Step 1:** Adjust skeleton blocks to the new hero + sections layout (header, hero poster+text, answer block, table, details grid). Keep existing shimmer approach.
- [ ] **Step 2: commit** — `git commit -am "feat: title detail loading skeleton matches layout"`

---

## Phase 8 — Homepage verify + final pass

### Task 8.1: Homepage diff

**Files:** Read `app/page.tsx`, `components/home/*`; compare to `docs/design-reference/home/Home.html`.

- [ ] **Step 1:** Diff visually in browser at `/`. List deltas. Fix only real mismatches (tokens, spacing, copy). If none, note "matches".
- [ ] **Step 2:** If changed, `git commit -am "fix: homepage parity with design"`.

### Task 8.2: Full verification

- [ ] **Step 1:** `npm test` — all green.
- [ ] **Step 2:** `npx tsc --noEmit` — clean.
- [ ] **Step 3:** `npm run lint` — clean.
- [ ] **Step 4:** Browser pass each screen at 1440px + 375px: Home, `/search?q=Severance` (multi), a one-result-unavailable query (NotInRegion), a no-results query (EmptyNoResults), a title detail, report modal submit→success.
- [ ] **Step 5:** Final commit if needed; report.

---

## Self-review notes
- Spec coverage: every spec section maps to a task (shared header/context → 3.x; migrations → 1.1/2.2; TMDB → 1.2/1.3; flags → 2.x; modal → 4.1; SERP → 5.x; empties → 6.x; title → 7.x; home → 8.1). ✔
- Per-platform seasons intentionally omitted everywhere (data unavailable). ✔
- Types consistent: `formatExtent` signature, `IssueType`, `RegionMeta`, `useCountry()` used identically across tasks. ✔
- Migrations are additive/nullable — safe to apply to existing DB; sync backfills metadata on next sync of each title.
