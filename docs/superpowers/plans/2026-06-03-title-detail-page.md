# Title Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished title detail page at `/titles/[id]` showing a hero section (poster + metadata) and an interactive region-tab availability section with clickable watch links.

**Architecture:** Server component page (`app/titles/[id]/page.tsx`) fetches title + availability from the existing API, resolves the initial country from the `?country=` URL param (falling back to the `selected-country` cookie then `PH`), and passes data to `AvailabilityTabs` — a client component handling region tab switching entirely on the client with no additional fetches. Two pure utility functions (`formatRuntime`, `groupByRegion`) in `lib/title-utils.ts` are tested first.

**Tech Stack:** Next.js 16 App Router, React 19, Framer Motion 12, Tailwind CSS 4, TypeScript 5, Vitest 4, Lucide React, `next/image` (TMDB already configured), `lib/platforms.ts` (existing), `@/types/database` (existing: `Title`, `AvailabilityWithPlatform`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/title-utils.ts` | Create | `formatRuntime(mins)` and `groupByRegion(availability[])` pure utilities |
| `lib/title-utils.test.ts` | Create | Vitest tests for both utilities |
| `components/title/availability-tabs.tsx` | Create | Client: region tab switcher + platform watch-link list |
| `app/titles/[id]/page.tsx` | Rewrite | Server: fetch, resolve country, render hero + AvailabilityTabs + metadata |
| `app/titles/[id]/loading.tsx` | Create | Skeleton matching the hero + tabs layout |

---

## Task 1: Title Utilities (TDD)

**Files:**
- Create: `lib/title-utils.ts`
- Create: `lib/title-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/title-utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatRuntime, groupByRegion } from './title-utils'
import type { AvailabilityWithPlatform } from '@/types/database'

describe('formatRuntime', () => {
  it('formats exact hours', () => {
    expect(formatRuntime(120)).toBe('2h 0m')
  })

  it('formats hours and minutes', () => {
    expect(formatRuntime(95)).toBe('1h 35m')
  })

  it('formats minutes only when under 60', () => {
    expect(formatRuntime(45)).toBe('45m')
  })

  it('returns null for zero', () => {
    expect(formatRuntime(0)).toBeNull()
  })
})

describe('groupByRegion', () => {
  const makeEntry = (region: string, platformName: string): AvailabilityWithPlatform => ({
    id: `${region}-${platformName}`,
    title_id: 'title-1',
    platform_id: `plat-${platformName}`,
    region_code: region,
    available: true,
    last_verified: new Date().toISOString(),
    source: 'api',
    watch_url: `https://example.com/${platformName}`,
    consecutive_failures: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    platform: {
      id: `plat-${platformName}`,
      name: platformName,
      slug: platformName.toLowerCase(),
      logo_url: null,
      supported_regions: [region],
      created_at: new Date().toISOString(),
    },
  })

  it('groups entries by region code', () => {
    const entries = [
      makeEntry('PH', 'Netflix'),
      makeEntry('PH', 'Apple TV+'),
      makeEntry('US', 'Netflix'),
    ]
    const grouped = groupByRegion(entries)
    expect(grouped['PH']).toHaveLength(2)
    expect(grouped['US']).toHaveLength(1)
    expect(grouped['GB']).toBeUndefined()
  })

  it('returns empty object for empty input', () => {
    expect(groupByRegion([])).toEqual({})
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
npx vitest run lib/title-utils.test.ts
```

Expected: `FAIL — Cannot find module './title-utils'`

- [ ] **Step 3: Implement `lib/title-utils.ts`**

```typescript
import type { AvailabilityWithPlatform } from '@/types/database'

export function formatRuntime(minutes: number): string | null {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function groupByRegion(
  availability: AvailabilityWithPlatform[]
): Record<string, AvailabilityWithPlatform[]> {
  return availability.reduce<Record<string, AvailabilityWithPlatform[]>>((acc, a) => {
    ;(acc[a.region_code] ??= []).push(a)
    return acc
  }, {})
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```powershell
npx vitest run lib/title-utils.test.ts
```

Expected: `PASS — 6 tests passed`

- [ ] **Step 5: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```powershell
git add lib/title-utils.ts lib/title-utils.test.ts
git commit -m "feat: add title utilities (formatRuntime, groupByRegion) with tests"
```

---

## Task 2: Availability Tabs Component

**Files:**
- Create: `components/title/availability-tabs.tsx`

Client component. Receives the full `availability` array and an `initialCountry` string. Manages selected tab in local state. Renders flag + country-code tabs, then the platform list for the selected tab. Each platform entry with a `watch_url` shows a "Watch" link button that opens in a new tab.

Uses `platformLabel()` from `@/lib/platforms` for badge colors, and `groupByRegion()` from `@/lib/title-utils` to partition data.

- [ ] **Step 1: Create `components/title/availability-tabs.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { ExternalLink, Tv2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { platformLabel } from '@/lib/platforms'
import { groupByRegion } from '@/lib/title-utils'
import type { AvailabilityWithPlatform } from '@/types/database'

const REGIONS = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
] as const

type RegionCode = (typeof REGIONS)[number]['code']

interface AvailabilityTabsProps {
  availability: AvailabilityWithPlatform[]
  initialCountry: string
}

export function AvailabilityTabs({ availability, initialCountry }: AvailabilityTabsProps) {
  const validInitial = REGIONS.some((r) => r.code === initialCountry)
    ? (initialCountry as RegionCode)
    : 'PH'
  const [active, setActive] = useState<RegionCode>(validInitial)

  const byRegion = groupByRegion(availability)
  const platforms = byRegion[active] ?? []

  return (
    <div>
      <h2
        className="text-lg font-semibold text-[#171717] mb-4"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Where to Watch
      </h2>

      {/* Region tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {REGIONS.map((region) => {
          const hasPlatforms = (byRegion[region.code]?.length ?? 0) > 0
          return (
            <button
              key={region.code}
              type="button"
              onClick={() => setActive(region.code)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1',
                active === region.code
                  ? 'bg-[#2B72E8] text-white shadow-[0_2px_8px_rgba(43,114,232,0.30)]'
                  : hasPlatforms
                  ? 'bg-white border border-[#E5E5E5] text-[#171717] hover:border-[#2B72E8] hover:text-[#2B72E8]'
                  : 'bg-white border border-[#E5E5E5] text-[#AEAEB8] cursor-default'
              )}
              aria-pressed={active === region.code}
              aria-label={`Show availability in ${region.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/24x18/${region.code.toLowerCase()}.png`}
                alt={region.name}
                width={16}
                height={12}
                className="rounded-[2px] object-cover flex-shrink-0"
              />
              <span>{region.code}</span>
              {hasPlatforms && active !== region.code && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#34C759] flex-shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Platform list */}
      {platforms.length === 0 ? (
        <div
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{
            background: 'rgba(245,245,247,0.8)',
            border: '1px solid rgba(229,229,229,0.6)',
          }}
        >
          <Tv2 className="w-5 h-5 text-[#AEAEB8] flex-shrink-0" />
          <p className="text-sm text-[#717177]">
            Not available in{' '}
            <span className="font-medium text-[#171717]">
              {REGIONS.find((r) => r.code === active)?.name}
            </span>{' '}
            on any supported platform.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {platforms.map((a) => {
            const badge = platformLabel(a.platform.slug)
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(229,229,229,0.7)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-sm text-[#717177] truncate">
                    {a.platform.name}
                  </span>
                </div>
                {a.watch_url && (
                  <a
                    href={a.watch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] text-white text-xs font-semibold transition-all duration-150 hover:shadow-[0_4px_14px_rgba(43,114,232,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2"
                    aria-label={`Watch on ${a.platform.name} (opens in new tab)`}
                  >
                    Watch
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add components/title/availability-tabs.tsx
git commit -m "feat: add AvailabilityTabs component with region switcher and watch links"
```

---

## Task 3: Title Detail Page Rewrite

**Files:**
- Modify: `app/titles/[id]/page.tsx` (full rewrite)

Server component. Fetches from the existing `/api/titles/[id]` endpoint. Resolves `initialCountry` from `?country=` URL param → `selected-country` cookie → `'PH'`. Renders: sticky back-nav header, hero section (poster + metadata), and `AvailabilityTabs`. Also exports `generateMetadata` for SEO.

Hero layout: `grid-cols-1 md:grid-cols-[2fr_3fr]` — poster on left (desktop), full-width on mobile.

- [ ] **Step 1: Rewrite `app/titles/[id]/page.tsx`**

```typescript
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { Star, Clock, Calendar, Tv, Film, ChevronLeft } from 'lucide-react'
import { AnimatedBackground } from '@/components/home/animated-background'
import { Logo } from '@/components/logo'
import { AvailabilityTabs } from '@/components/title/availability-tabs'
import { formatRuntime } from '@/lib/title-utils'
import type { Title, AvailabilityWithPlatform } from '@/types/database'

const SUPPORTED = ['PH', 'US', 'GB', 'AU', 'CA'] as const
type CountryCode = (typeof SUPPORTED)[number]

async function fetchTitle(
  id: string
): Promise<{ title: Title; availability: AvailabilityWithPlatform[] }> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${base}/api/titles/${id}`, { cache: 'no-store' })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load title')
  return res.json()
}

function resolveCountry(
  urlParam: string | undefined,
  cookieValue: string | undefined
): CountryCode {
  if (urlParam && SUPPORTED.includes(urlParam as CountryCode)) return urlParam as CountryCode
  if (cookieValue && SUPPORTED.includes(cookieValue as CountryCode)) return cookieValue as CountryCode
  return 'PH'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const { title } = await fetchTitle(id)
    return {
      title: `${title.title} — Where Can I Watch It?`,
      description: title.synopsis ?? `Find where to watch ${title.title} online.`,
    }
  } catch {
    return { title: 'Title — Where Can I Watch It?' }
  }
}

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ country?: string }>
}) {
  const [{ id }, { country: countryParam }, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ])

  const savedCountry = cookieStore.get('selected-country')?.value
  const country = resolveCountry(countryParam, savedCountry)
  const { title, availability } = await fetchTitle(id)

  const isTV = title.type === 'tv'
  const runtime = title.runtime ? formatRuntime(title.runtime) : null

  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <AnimatedBackground />

      {/* Sticky back-nav header */}
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
        }}
      >
        <Link
          href={`/search?q=${encodeURIComponent(title.title)}&country=${country}`}
          className="flex items-center gap-1.5 text-sm text-[#717177] hover:text-[#2B72E8] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          aria-label="Back to search results"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <div className="flex-1 flex justify-center">
          <Link href="/" aria-label="Home">
            <Logo width={100} />
          </Link>
        </div>
        {/* Spacer to balance the back link */}
        <div className="w-14" aria-hidden="true" />
      </header>

      {/* Content */}
      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 pb-16">

        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 md:gap-10 mb-10">

          {/* Poster */}
          <div className="w-full max-w-[280px] mx-auto md:mx-0">
            <div
              className="relative w-full rounded-2xl overflow-hidden"
              style={{
                aspectRatio: '2/3',
                background: '#F5F5F7',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              {title.poster_url ? (
                <Image
                  src={title.poster_url}
                  alt={title.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 280px, 320px"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#AEAEB8]">
                  {isTV ? <Tv className="w-14 h-14" /> : <Film className="w-14 h-14" />}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-start pt-0 md:pt-2">
            {/* Type + year badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase"
                style={{
                  background: isTV ? 'rgba(43,114,232,0.10)' : 'rgba(23,23,23,0.07)',
                  color: isTV ? '#2B72E8' : '#171717',
                }}
              >
                {isTV ? 'Series' : 'Movie'}
              </span>
              {title.release_year && (
                <span className="flex items-center gap-1 text-[11px] text-[#717177]">
                  <Calendar className="w-3 h-3" />
                  {title.release_year}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1 text-[11px] text-[#717177]">
                  <Clock className="w-3 h-3" />
                  {runtime}
                </span>
              )}
              {isTV && title.season_count && (
                <span className="text-[11px] text-[#717177]">
                  {title.season_count} {title.season_count === 1 ? 'season' : 'seasons'}
                </span>
              )}
              {title.imdb_rating && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#171717]">
                  <Star className="w-3 h-3 fill-[#F5C518] stroke-none" />
                  {title.imdb_rating}
                  <span className="text-[#AEAEB8] font-normal">/10</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl font-bold text-[#171717] leading-tight mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title.title}
            </h1>

            {/* Genres */}
            {title.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {title.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#717177]"
                    style={{ background: 'rgba(245,245,247,0.9)', border: '1px solid rgba(229,229,229,0.8)' }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {title.synopsis && (
              <p className="text-sm text-[#717177] leading-relaxed mb-6 max-w-prose">
                {title.synopsis}
              </p>
            )}

            {/* Availability tabs — desktop inline */}
            <div className="hidden md:block">
              <AvailabilityTabs availability={availability} initialCountry={country} />
            </div>
          </div>
        </div>

        {/* Availability tabs — mobile below hero */}
        <div className="md:hidden">
          <AvailabilityTabs availability={availability} initialCountry={country} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add app/titles/[id]/page.tsx
git commit -m "feat: rewrite title detail page with hero, metadata, and availability tabs"
```

---

## Task 4: Loading Skeleton

**Files:**
- Create: `app/titles/[id]/loading.tsx`

Matches the hero layout (poster placeholder left, text skeletons right, tab skeletons below).

- [ ] **Step 1: Create `app/titles/[id]/loading.tsx`**

```typescript
import { Logo } from '@/components/logo'
import { ChevronLeft } from 'lucide-react'

export default function TitleLoading() {
  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* Header skeleton */}
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
        }}
      >
        <div className="flex items-center gap-1.5 text-sm text-[#AEAEB8]">
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </div>
        <div className="flex-1 flex justify-center">
          <Logo width={100} />
        </div>
        <div className="w-14" aria-hidden="true" />
      </header>

      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 md:gap-10 mb-10">
          {/* Poster skeleton */}
          <div className="w-full max-w-[280px] mx-auto md:mx-0">
            <div
              className="w-full rounded-2xl bg-[#F0F0F2] animate-pulse"
              style={{ aspectRatio: '2/3' }}
            />
          </div>

          {/* Info skeleton */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-2">
              <div className="h-5 w-14 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-10 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-16 bg-[#F0F0F2] rounded-full animate-pulse" />
            </div>
            <div className="h-9 w-3/4 bg-[#F0F0F2] rounded-lg animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-5 w-20 bg-[#F0F0F2] rounded-full animate-pulse" />
            </div>
            <div className="space-y-2 mt-1">
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse" />
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse w-5/6" />
              <div className="h-3.5 bg-[#F0F0F2] rounded-full animate-pulse w-4/6" />
            </div>
            {/* Tab skeletons */}
            <div className="hidden md:flex gap-2 mt-4">
              {[60, 52, 64, 56, 52].map((w, i) => (
                <div key={i} className={`h-8 w-${w} bg-[#F0F0F2] rounded-full animate-pulse`} style={{ width: w }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add "app/titles/[id]/loading.tsx"
git commit -m "feat: add skeleton loading state for title detail page"
```

---

## Task 5: Full Test Run + Visual Verification

- [ ] **Step 1: Run full test suite**

```powershell
npx vitest run
```

Expected: All tests pass (includes 6 new title-utils tests).

- [ ] **Step 2: Typecheck entire project**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Visual verification in browser**

Dev server should already be running. Test these URLs (replace UUID with a real title ID from a prior search):

- `http://localhost:3000/titles/{id}?country=PH` — hero section, Apple TV+ tab active for PH
- `http://localhost:3000/titles/{id}?country=US` — US tab pre-selected
- Click each region tab — platform list updates without page reload
- Click "Watch" button — opens correct URL in new tab
- `http://localhost:3000/titles/nonexistent-id` — Next.js 404 page
- Mobile viewport (375px wide) — poster stacks above info, tabs appear below

To get a real title ID, run:
```powershell
curl "http://localhost:3000/api/search?q=Severance"
```
Copy the `id` field from the first result.

---

## Self-Review: Spec Coverage

| Requirement | Task |
|-------------|------|
| Hero: large poster | Task 3 |
| Hero: title, type badge, year, runtime/seasons, IMDb rating | Task 3 |
| Hero: genre pills | Task 3 |
| Hero: synopsis | Task 3 |
| Availability: region tab switcher with flags | Task 2 |
| Availability: platform list with colored badges | Task 2 |
| Availability: clickable Watch links (new tab) | Task 2 |
| Availability: "Not available" empty state per region | Task 2 |
| Green dot indicator on tabs that have availability | Task 2 |
| Country pre-selected from URL `?country=` param | Task 3 |
| Country fallback: cookie → PH | Task 3 |
| Back navigation to search results | Task 3 |
| Logo centered in header | Task 3 |
| AnimatedBackground continuity | Task 3 |
| SEO: `generateMetadata` with title + synopsis | Task 3 |
| Mobile responsive: stacked layout | Task 3 |
| Loading skeleton | Task 4 |
| `formatRuntime` tested | Task 1 |
| `groupByRegion` tested | Task 1 |
| All tests passing | Task 5 |
| Typecheck clean | Task 5 |
