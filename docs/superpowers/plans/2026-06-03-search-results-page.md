# Search Results Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, production-grade search results page that continues the homepage's glassmorphism/white aesthetic, showing title cards with poster images and streaming availability per country.

**Architecture:** Server component page (`app/search/page.tsx`) fetches results and renders a sticky glassmorphism header (compact logo + search bar) plus a responsive card grid. Three client components handle interactivity: `CompactSearchForm` (pre-filled pill search), `ResultCard` (poster + info + platform chips), and `ResultsSection` (animated staggered grid + empty/error states). A pure-function utility module (`lib/platforms.ts`) maps MOTN service slugs to display names and badge colors.

**Tech Stack:** Next.js 16 App Router, React 19, Framer Motion 12, Tailwind CSS 4, TypeScript 5, Vitest 4 (node env), Lucide React, `next/image` (TMDB domain already configured)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/platforms.ts` | Create | Maps platform slug → `{ label, bg, text }` for badge display |
| `lib/platforms.test.ts` | Create | Tests for `platformLabel()` pure function |
| `components/search/compact-search-form.tsx` | Create | Compact glassmorphism pill search for sticky header |
| `components/search/result-card.tsx` | Create | Individual title card: poster, badges, platform chips |
| `components/search/results-section.tsx` | Create | Staggered grid + empty state + "no country" fallback |
| `app/search/page.tsx` | Rewrite | Server component: fetch + layout + header + results |
| `app/search/loading.tsx` | Create | Skeleton loading state matching card grid layout |

---

## Task 1: Platform Utility (TDD)

**Files:**
- Create: `lib/platforms.ts`
- Create: `lib/platforms.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/platforms.test.ts
import { describe, it, expect } from 'vitest'
import { platformLabel } from './platforms'

describe('platformLabel', () => {
  it('returns Netflix label with correct badge colors', () => {
    const result = platformLabel('netflix')
    expect(result.label).toBe('Netflix')
    expect(result.bg).toBeDefined()
    expect(result.text).toBeDefined()
  })

  it('returns Prime Video label for prime slug', () => {
    expect(platformLabel('prime').label).toBe('Prime Video')
  })

  it('returns Disney+ label for disney-plus slug', () => {
    expect(platformLabel('disney-plus').label).toBe('Disney+')
  })

  it('falls back gracefully for unknown slugs by capitalizing', () => {
    const result = platformLabel('some-unknown-service')
    expect(result.label).toBe('Some Unknown Service')
    expect(result.bg).toBeDefined()
    expect(result.text).toBeDefined()
  })

  it('handles single-word unknown slug', () => {
    expect(platformLabel('hulu').label).toBe('Hulu')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
npx vitest run lib/platforms.test.ts
```

Expected: `FAIL — Cannot find module './platforms'`

- [ ] **Step 3: Implement `lib/platforms.ts`**

```typescript
interface PlatformBadge {
  label: string
  bg: string
  text: string
}

const KNOWN: Record<string, PlatformBadge> = {
  netflix:          { label: 'Netflix',      bg: '#FEE2E2', text: '#991B1B' },
  prime:            { label: 'Prime Video',  bg: '#DBEAFE', text: '#1E40AF' },
  'disney-plus':    { label: 'Disney+',      bg: '#EDE9FE', text: '#5B21B6' },
  hbo:              { label: 'HBO Max',      bg: '#F3E8FF', text: '#7E22CE' },
  'apple-tv-plus':  { label: 'Apple TV+',   bg: '#F1F5F9', text: '#334155' },
  hulu:             { label: 'Hulu',         bg: '#DCFCE7', text: '#15803D' },
  peacock:          { label: 'Peacock',      bg: '#FEF9C3', text: '#854D0E' },
  'paramount-plus': { label: 'Paramount+',  bg: '#DBEAFE', text: '#1E40AF' },
  mubi:             { label: 'MUBI',         bg: '#FFF7ED', text: '#9A3412' },
  showtime:         { label: 'Showtime',     bg: '#FEF2F2', text: '#7F1D1D' },
}

export function platformLabel(slug: string): PlatformBadge {
  if (KNOWN[slug]) return KNOWN[slug]
  const label = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { label, bg: '#F1F5F9', text: '#475569' }
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```powershell
npx vitest run lib/platforms.test.ts
```

Expected: `PASS — 5 tests passed`

- [ ] **Step 5: Commit**

```powershell
git add lib/platforms.ts lib/platforms.test.ts
git commit -m "feat: add platform slug → badge label/color utility"
```

---

## Task 2: Compact Search Form Component

**Files:**
- Create: `components/search/compact-search-form.tsx`

This is a client component adapting the homepage `SearchForm` into a compact header bar version. Same pill glassmorphism, but smaller (44px height vs 56px), no chips, no trust line. Pre-populated from URL params. Country selection saved to cookie.

- [ ] **Step 1: Create `components/search/compact-search-form.tsx`**

```typescript
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
] as const

type CountryCode = (typeof COUNTRIES)[number]['code']

interface CompactSearchFormProps {
  initialQuery: string
  initialCountry: CountryCode
}

export function CompactSearchForm({ initialQuery, initialCountry }: CompactSearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [country, setCountry] = useState<CountryCode>(initialCountry)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0]

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectCountry = useCallback((code: CountryCode) => {
    setCountry(code)
    setDropdownOpen(false)
    document.cookie = `selected-country=${code}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  const doSearch = useCallback(
    (q: string) => {
      const t = q.trim()
      if (!t) return
      router.push(`/search?q=${encodeURIComponent(t)}&country=${country}`)
    },
    [router, country]
  )

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); doSearch(query) }}
      className="relative w-full"
      aria-label="Search for a movie or TV show"
    >
      {/* Outer glow */}
      <div
        aria-hidden="true"
        className="absolute rounded-full transition-all duration-300 ease-out pointer-events-none"
        style={{
          inset: '-8px 4px',
          background: 'rgba(43, 114, 232, 0.16)',
          filter: 'blur(22px)',
          opacity: focused ? 0.75 : 0.3,
          transform: focused ? 'scale(1.01)' : 'scale(1)',
        }}
      />

      {/* Pill */}
      <div
        className="relative flex items-center rounded-full transition-all duration-300 ease-out"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: focused
            ? '1px solid rgba(43, 114, 232, 0.5)'
            : '1px solid rgba(220, 220, 220, 0.8)',
          boxShadow: focused
            ? '0 0 0 3px rgba(43,114,232,0.09), 0 8px 24px rgba(43,114,232,0.14), 0 2px 6px rgba(0,0,0,0.05)'
            : '0 4px 16px rgba(43,114,232,0.07), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Country selector */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1 pl-3 pr-2 py-2.5 rounded-l-full hover:bg-black/[0.03] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1 cursor-pointer"
            aria-label={`Country: ${selected.name}. Click to change.`}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://flagcdn.com/24x18/${selected.code.toLowerCase()}.png`}
              alt={selected.name}
              width={20}
              height={15}
              className="rounded-[2px] object-cover flex-shrink-0"
            />
            <span className="text-xs font-semibold text-[#171717] tracking-wide leading-none">
              {selected.code}
            </span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-[#AEAEB8] transition-transform duration-200 flex-shrink-0',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {dropdownOpen && (
            <div
              className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1 min-w-[180px] overflow-hidden"
              role="listbox"
              aria-label="Select country"
            >
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={c.code === country}
                  onClick={() => selectCountry(c.code)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm cursor-pointer transition-colors duration-100',
                    c.code === country
                      ? 'text-[#2B72E8] font-medium bg-[#2B72E8]/[0.05]'
                      : 'text-[#171717] font-normal hover:bg-[#2B72E8]/[0.04]',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`}
                    alt={c.name}
                    width={20}
                    height={15}
                    className="rounded-[2px] object-cover flex-shrink-0"
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-black/[0.08] flex-shrink-0" aria-hidden="true" />

        {/* Input */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search movies & shows..."
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none font-sans"
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Submit */}
        <button
          type="submit"
          className="flex-shrink-0 mr-1 my-1 w-8 h-8 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] active:bg-[#1752be] flex items-center justify-center transition-all duration-150 hover:shadow-[0_4px_14px_rgba(43,114,232,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2 cursor-pointer"
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </button>
      </div>
    </form>
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
git add components/search/compact-search-form.tsx
git commit -m "feat: add compact search form for results page header"
```

---

## Task 3: Result Card Component

**Files:**
- Create: `components/search/result-card.tsx`

Client component rendering a single title result. Uses `next/image` for poster (TMDB domain already in `next.config.ts`). Framer Motion `initial/animate` for staggered entrance. Platform availability chips from `lib/platforms.ts`.

- [ ] **Step 1: Create `components/search/result-card.tsx`**

```typescript
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star, Tv, Film } from 'lucide-react'
import { platformLabel } from '@/lib/platforms'

interface ResultCardProps {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
  }
  availabilityByRegion: Record<string, string[]>
  country: string
  index: number
}

export function ResultCard({ title, availabilityByRegion, country, index }: ResultCardProps) {
  const platforms = availabilityByRegion[country] ?? []
  const isTV = title.type === 'tv'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
    >
      <Link
        href={`/titles/${title.id}`}
        className="group block rounded-2xl overflow-hidden transition-shadow duration-300"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(229, 229, 229, 0.7)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden bg-[#F5F5F7]">
          {title.poster_url ? (
            <Image
              src={title.poster_url}
              alt={title.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#AEAEB8]">
              {isTV ? <Tv className="w-10 h-10" /> : <Film className="w-10 h-10" />}
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase"
              style={{
                background: isTV ? 'rgba(43,114,232,0.88)' : 'rgba(23,23,23,0.82)',
                color: '#fff',
                backdropFilter: 'blur(6px)',
              }}
            >
              {isTV ? 'Series' : 'Movie'}
            </span>
          </div>

          {/* IMDb rating */}
          {title.imdb_rating && (
            <div
              className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)' }}
            >
              <Star className="w-2.5 h-2.5 fill-[#F5C518] stroke-none" />
              <span className="text-[10px] font-semibold text-white leading-none">
                {title.imdb_rating}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3
            className="text-[13px] font-semibold text-[#171717] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#2B72E8] transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title.title}
          </h3>

          <div className="flex items-center gap-1.5 mb-2.5">
            {title.release_year && (
              <span className="text-[11px] text-[#717177]">{title.release_year}</span>
            )}
            {isTV && title.season_count && (
              <>
                <span className="text-[11px] text-[#AEAEB8]">·</span>
                <span className="text-[11px] text-[#717177]">
                  {title.season_count} {title.season_count === 1 ? 'season' : 'seasons'}
                </span>
              </>
            )}
          </div>

          {/* Platform chips */}
          {platforms.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {platforms.slice(0, 3).map((slug) => {
                const p = platformLabel(slug)
                return (
                  <span
                    key={slug}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none"
                    style={{ background: p.bg, color: p.text }}
                  >
                    {p.label}
                  </span>
                )
              })}
              {platforms.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none bg-[#F1F5F9] text-[#64748B]">
                  +{platforms.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[#AEAEB8]">Not available in {country}</span>
          )}
        </div>
      </Link>
    </motion.div>
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
git add components/search/result-card.tsx
git commit -m "feat: add ResultCard component for search results"
```

---

## Task 4: Results Section Component

**Files:**
- Create: `components/search/results-section.tsx`

Client component rendering the count line, staggered card grid, and empty state. Wraps `ResultCard` instances.

- [ ] **Step 1: Create `components/search/results-section.tsx`**

```typescript
'use client'

import { Search } from 'lucide-react'
import { ResultCard } from './result-card'

interface SyncedResult {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
  }
  availabilityByRegion: Record<string, string[]>
}

interface ResultsSectionProps {
  results: SyncedResult[]
  query: string
  country: string
}

export function ResultsSection({ results, query, country }: ResultsSectionProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(43,114,232,0.08)' }}
        >
          <Search className="w-6 h-6 text-[#2B72E8]" />
        </div>
        <p
          className="text-xl font-semibold text-[#171717] mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-[#717177] max-w-xs">
          Try a different spelling, or search for a related title.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-[#717177] mb-5 font-sans">
        {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
        <span className="font-semibold text-[#171717]">&ldquo;{query}&rdquo;</span>
        <span className="ml-1.5 text-[#AEAEB8]">· {country}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {results.map((result, i) => (
          <ResultCard
            key={result.title.id}
            title={result.title}
            availabilityByRegion={result.availabilityByRegion}
            country={country}
            index={i}
          />
        ))}
      </div>
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
git add components/search/results-section.tsx
git commit -m "feat: add ResultsSection component with staggered grid and empty state"
```

---

## Task 5: Search Page Rewrite

**Files:**
- Modify: `app/search/page.tsx` (full rewrite)

Server component. Reads `q` and `country` from `searchParams`. Resolves country with fallback chain: URL param → cookie → `'PH'`. Renders `AnimatedBackground`, sticky glassmorphism header, and `ResultsSection`. Error and no-query states are simple, on-brand inline views.

- [ ] **Step 1: Rewrite `app/search/page.tsx`**

```typescript
import Link from 'next/link'
import { cookies } from 'next/headers'
import { AnimatedBackground } from '@/components/home/animated-background'
import { Logo } from '@/components/logo'
import { CompactSearchForm } from '@/components/search/compact-search-form'
import { ResultsSection } from '@/components/search/results-section'

const SUPPORTED = ['PH', 'US', 'GB', 'AU', 'CA'] as const
type CountryCode = (typeof SUPPORTED)[number]

interface SyncedResult {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
  }
  availabilityByRegion: Record<string, string[]>
}

async function fetchSearch(query: string): Promise<{ results: SyncedResult[]; query: string }> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(query)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Search failed')
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string }>
}) {
  const { q, country: countryParam } = await searchParams
  const cookieStore = await cookies()
  const savedCountry = cookieStore.get('selected-country')?.value
  const country = resolveCountry(countryParam, savedCountry)

  if (!q) {
    return (
      <main
        className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <div className="relative z-10 text-center px-4">
          <p className="text-lg text-[#717177]" style={{ fontFamily: 'var(--font-display)' }}>
            Enter a search query to get started.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[#2B72E8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          >
            ← Back to search
          </Link>
        </div>
      </main>
    )
  }

  let data: { results: SyncedResult[]; query: string }
  try {
    data = await fetchSearch(q)
  } catch {
    return (
      <main
        className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <div className="relative z-10 text-center px-4">
          <p
            className="text-xl font-semibold text-[#171717] mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Search failed
          </p>
          <p className="text-sm text-[#717177] mb-4">Something went wrong. Please try again.</p>
          <Link
            href="/"
            className="text-sm text-[#2B72E8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          >
            ← Back to search
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <AnimatedBackground />

      {/* Sticky header */}
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
        <Link href="/" aria-label="Home" className="flex-shrink-0">
          <Logo width={110} />
        </Link>
        <div className="flex-1 max-w-lg">
          <CompactSearchForm initialQuery={q} initialCountry={country} />
        </div>
      </header>

      {/* Results */}
      <div className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
        <ResultsSection results={data.results} query={data.query} country={country} />
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
git add app/search/page.tsx
git commit -m "feat: rewrite search results page with glassmorphism header and card grid"
```

---

## Task 6: Skeleton Loading State

**Files:**
- Create: `app/search/loading.tsx`

Next.js App Router automatically uses this file during server component data-fetching. Renders a fake header + shimmer skeleton cards so the user sees immediate visual feedback instead of a blank white page during the API round-trip (TMDB + MOTN + Supabase can take 2–4s).

- [ ] **Step 1: Create `app/search/loading.tsx`**

```typescript
import { Logo } from '@/components/logo'

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(229,229,229,0.7)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Poster placeholder */}
      <div className="aspect-[2/3] bg-[#F0F0F2] animate-pulse" />
      {/* Info placeholder */}
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#F0F0F2] rounded-full animate-pulse w-3/4" />
        <div className="h-2.5 bg-[#F0F0F2] rounded-full animate-pulse w-1/2" />
        <div className="flex gap-1 pt-0.5">
          <div className="h-4 w-12 bg-[#F0F0F2] rounded-full animate-pulse" />
          <div className="h-4 w-10 bg-[#F0F0F2] rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function SearchLoading() {
  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* Minimal static header (no AnimatedBackground during load to avoid hydration flash) */}
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
        }}
      >
        <div className="flex-shrink-0">
          <Logo width={110} />
        </div>
        {/* Search bar skeleton */}
        <div className="flex-1 max-w-lg">
          <div className="h-10 rounded-full bg-[#F5F5F7] animate-pulse" />
        </div>
      </header>

      {/* Results skeleton */}
      <div className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
        {/* Count line skeleton */}
        <div className="h-4 w-40 bg-[#F0F0F2] rounded-full animate-pulse mb-5" />
        {/* Card grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
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
git add app/search/loading.tsx
git commit -m "feat: add skeleton loading state for search results page"
```

---

## Task 7: Full Test Run + Visual Verification

- [ ] **Step 1: Run all tests**

```powershell
npx vitest run
```

Expected: `PASS — lib/platforms.test.ts (5 tests)`

- [ ] **Step 2: Typecheck entire project**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Start dev server and visually verify**

```powershell
npm run dev
```

Test these URLs in browser:
- `http://localhost:3000/search?q=Severance&country=PH` — should show results grid
- `http://localhost:3000/search?q=xyznotarealshow&country=US` — should show empty state
- `http://localhost:3000/search` — should show no-query state
- Verify sticky header stays on scroll
- Verify country dropdown works in header
- Verify searching from header navigates to new results
- Verify poster images load (TMDB URLs)
- Verify platform chips appear for available titles

---

## Self-Review: Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Sticky header with logo + search bar | Task 5 |
| Compact search bar matching homepage pill aesthetic | Task 2 |
| Country selection preserved from URL param / cookie | Task 5 |
| Card grid with poster images | Task 3, 4 |
| Platform availability chips per country | Task 1, 3 |
| IMDb rating badge | Task 3 |
| Type badge (Movie / Series) | Task 3 |
| Year + season count | Task 3 |
| Empty state with helpful message | Task 4 |
| Error state | Task 5 |
| No-query state | Task 5 |
| Loading skeleton | Task 6 |
| Staggered entrance animations | Task 3, 4 |
| AnimatedBackground continuity | Task 5 |
| Typecheck passing | Task 7 |
| Tests passing | Tasks 1, 7 |
